package scanner

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"time"
)

const officialKiriBaseURL = "https://api.kiriengine.app/api/"

// kiriStatus maps KIRI's integer task status to a provider status.
var kiriStatus = map[int]string{-1: "QUEUED", 0: "PROCESSING", 1: "FAILED", 2: "COMPLETE", 3: "QUEUED", 4: "FAILED"}

type kiriData struct {
	CalculateType *int   `json:"calculateType"`
	Serialize     string `json:"serialize"`
	Status        *int   `json:"status"`
	ModelURL      string `json:"modelUrl"`
	Balance       *int   `json:"balance"`
}

type kiriEnvelope struct {
	Code int       `json:"code"`
	Msg  string    `json:"msg"`
	Data *kiriData `json:"data"`
}

// KiriProvider talks to the KIRI Engine open API.
type KiriProvider struct {
	apiKey         string
	baseURL        string
	maxResultBytes int64
	client         *http.Client
}

// NewKiriProvider builds a KIRI provider from the environment.
func NewKiriProvider() *KiriProvider {
	base := strings.TrimSpace(os.Getenv("KIRI_BASE_URL"))
	if base == "" {
		base = officialKiriBaseURL
	}
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return &KiriProvider{
		apiKey:         strings.TrimSpace(os.Getenv("KIRI_API_KEY")),
		baseURL:        base,
		maxResultBytes: 1 << 30, // 1 GiB
		client:         &http.Client{Timeout: 120 * time.Second},
	}
}

func (p *KiriProvider) Key() string { return "kiri" }

func (p *KiriProvider) configured() error {
	if p.apiKey == "" {
		return errors.New("reconstruction service credentials are not configured")
	}
	return nil
}

func (p *KiriProvider) CreateJob(ctx context.Context, video []byte, mediaType, fileName, mode string) (string, error) {
	if err := p.configured(); err != nil {
		return "", err
	}
	if mediaType != "video/mp4" || !strings.HasSuffix(strings.ToLower(fileName), ".mp4") {
		return "", errors.New("the KIRI workflow accepts MP4 video only")
	}
	featureless := mode == ModeFeatureless
	endpoint := "v1/open/photo/video"
	expectedType := 1
	if featureless {
		endpoint = "v1/open/featureless/video"
		expectedType = 2
	}

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("fileFormat", "OBJ")
	safeName := strings.NewReplacer(`"`, "_", "\r", "_", "\n", "_").Replace(fileName)
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="videoFile"; filename="%s"`, safeName))
	h.Set("Content-Type", mediaType)
	part, err := w.CreatePart(h)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(video); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	env, err := p.postEnvelope(ctx, endpoint, w.FormDataContentType(), body.Bytes())
	if err != nil {
		return "", err
	}
	if env.Data == nil || env.Data.CalculateType == nil || *env.Data.CalculateType != expectedType {
		return "", errors.New("the reconstruction service returned an unexpected task type")
	}
	if !validSerialize(env.Data.Serialize) {
		return "", errors.New("the reconstruction service returned an invalid task identifier")
	}
	return env.Data.Serialize, nil
}

func (p *KiriProvider) GetStatus(ctx context.Context, privateID string) (string, error) {
	if err := p.configured(); err != nil {
		return "", err
	}
	if !validSerialize(privateID) {
		return "", errors.New("invalid task identifier")
	}
	env, err := p.getEnvelope(ctx, "v1/open/model/getStatus?serialize="+url.QueryEscape(privateID))
	if err != nil {
		return "", err
	}
	if env.Data == nil || env.Data.Status == nil {
		return "", errors.New("the reconstruction service returned an invalid status")
	}
	status, ok := kiriStatus[*env.Data.Status]
	if !ok {
		return "", errors.New("the reconstruction service returned an unknown status")
	}
	return status, nil
}

func (p *KiriProvider) GetResult(ctx context.Context, privateID string) (ProviderResult, error) {
	if err := p.configured(); err != nil {
		return ProviderResult{}, err
	}
	status, err := p.GetStatus(ctx, privateID)
	if err != nil {
		return ProviderResult{}, err
	}
	if status != "COMPLETE" {
		return ProviderResult{}, errors.New("the reconstruction result is not ready")
	}
	env, err := p.getEnvelope(ctx, "v1/open/model/getModelZip?serialize="+url.QueryEscape(privateID))
	if err != nil {
		return ProviderResult{}, err
	}
	if env.Data == nil || env.Data.ModelURL == "" {
		return ProviderResult{}, errors.New("the reconstruction service returned an invalid model link")
	}
	link, err := url.Parse(env.Data.ModelURL)
	if err != nil || link.Scheme != "https" {
		return ProviderResult{}, errors.New("the reconstruction service returned an insecure model link")
	}
	zipBytes, err := p.download(ctx, link.String())
	if err != nil {
		return ProviderResult{}, err
	}
	obj, err := extractSingleOBJ(zipBytes)
	if err != nil {
		return ProviderResult{}, err
	}
	return ProviderResult{Bytes: obj, FileName: "raw-reconstruction.obj", MediaType: "model/obj"}, nil
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func (p *KiriProvider) postEnvelope(ctx context.Context, endpoint, contentType string, body []byte) (*kiriEnvelope, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", contentType)
	return p.do(req)
}

func (p *KiriProvider) getEnvelope(ctx context.Context, endpoint string) (*kiriEnvelope, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	return p.do(req)
}

func (p *KiriProvider) do(req *http.Request) (*kiriEnvelope, error) {
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("the reconstruction service could not be reached: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 65_536))
	if err != nil {
		return nil, errors.New("the reconstruction service response could not be read")
	}
	var env kiriEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("the reconstruction service returned invalid JSON (status %d)", resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || (env.Code != 0 && env.Code != 200) {
		return nil, fmt.Errorf("the reconstruction service rejected the request (http %d, code %d)", resp.StatusCode, env.Code)
	}
	return &env, nil
}

func (p *KiriProvider) download(ctx context.Context, link string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("the reconstruction result could not be downloaded: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("the reconstruction result download failed (http %d)", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, p.maxResultBytes))
}

// extractSingleOBJ returns the bytes of the one .obj entry in a ZIP archive.
func extractSingleOBJ(zipBytes []byte) ([]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return nil, errors.New("the reconstruction result is not a valid ZIP archive")
	}
	var match *zip.File
	for _, f := range reader.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if strings.HasSuffix(strings.ToLower(name), ".obj") &&
			!strings.HasSuffix(name, "/") && !strings.HasPrefix(name, "/") &&
			!strings.Contains("/"+name+"/", "/../") {
			if match != nil {
				return nil, errors.New("the reconstruction archive must contain exactly one OBJ model")
			}
			f := f
			match = f
		}
	}
	if match == nil {
		return nil, errors.New("the reconstruction archive must contain exactly one OBJ model")
	}
	rc, err := match.Open()
	if err != nil {
		return nil, errors.New("the reconstruction model could not be read")
	}
	defer rc.Close()
	obj, err := io.ReadAll(rc)
	if err != nil || len(obj) == 0 {
		return nil, errors.New("the reconstruction model could not be decompressed")
	}
	return obj, nil
}

func validSerialize(v string) bool {
	if len(v) < 1 || len(v) > 200 {
		return false
	}
	for _, r := range v {
		if !(r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return false
		}
	}
	return true
}
