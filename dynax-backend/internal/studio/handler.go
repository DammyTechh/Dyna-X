package studio

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dynalimb/dynax-backend/internal/repository/db"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// maxRequestBytes caps an ingestion request body (matches the Python service).
const maxRequestBytes = 1 << 20

// Handler serves the studio endpoints (device ingestion, release manifest, and
// admin token provisioning).
type Handler struct {
	repo *Repository
}

// NewHandler builds the studio Handler over the shared pool.
func NewHandler(pool *db.Pool) *Handler {
	return &Handler{repo: NewRepository(pool)}
}

// ── Device-facing: event ingestion ────────────────────────────────────────────

// IngestEvents accepts a bearer-authenticated batch and returns {accepted, rejected}.
//
// @Summary  Ingest Studio usage events
// @Tags     studio
// @Security BearerIngestion
// @Accept   json
// @Produce  json
// @Success  200 {object} map[string]int
// @Router   /api/v1/events [post]
func (h *Handler) IngestEvents(c *gin.Context) {
	tokenID, secret, ok := bearerIngestionToken(c)
	if !ok {
		c.Header("WWW-Authenticate", "Bearer")
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Unauthorized"})
		return
	}
	identity, err := h.repo.VerifyToken(c.Request.Context(), tokenID, secret)
	if err != nil {
		c.Header("WWW-Authenticate", "Bearer")
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Unauthorized"})
		return
	}

	// Cap the request body (matches the Python 1 MB limit) and reject unknown
	// fields (matches pydantic extra="forbid").
	if c.Request.ContentLength > maxRequestBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": "Request too large"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	dec := json.NewDecoder(c.Request.Body)
	dec.DisallowUnknownFields()
	var events []EventPayload
	if err := dec.Decode(&events); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid payload"})
		return
	}
	validated, err := validateBatch(events)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid payload"})
		return
	}
	if err := h.repo.BindToken(c.Request.Context(), identity, validated[0].InstallID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Invalid ingestion identity"})
		return
	}
	accepted, err := h.repo.InsertEvents(c.Request.Context(), validated, identity.Environment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Ingestion failed"})
		return
	}
	// Top-level shape is part of the client contract.
	c.JSON(http.StatusOK, gin.H{"accepted": accepted, "rejected": len(validated) - accepted})
}

// ── Device-facing: release manifest ───────────────────────────────────────────

// CurrentRelease returns the public update-check manifest.
//
// @Summary  Current DynaX Studio release
// @Tags     studio
// @Produce  json
// @Success  200 {object} ReleaseManifest
// @Router   /api/v1/releases/current [get]
func (h *Handler) CurrentRelease(c *gin.Context) {
	manifest, err := buildReleaseManifest()
	if err != nil {
		// A misconfiguration must never be cached -- it would outlive the fix.
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Release information unavailable"})
		return
	}

	// Caching this for an hour is what turns a bad download URL into a day-long
	// outage: browsers and any CDN in front of the API keep serving the dead
	// link long after the environment is corrected. Cache only what is known
	// good, and only briefly.
	//
	// ReleaseDownloadHealthy memoises its probe (5 min on success, 20 s on
	// failure), so this costs at most one HEAD per five minutes -- not one per
	// update check from every installed copy of Studio.
	if healthy, _ := ReleaseDownloadHealthy(); healthy {
		c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
	} else {
		c.Header("Cache-Control", "no-store")
	}
	c.JSON(http.StatusOK, manifest)
}

func buildReleaseManifest() (*ReleaseManifest, error) {
	version := strings.TrimSpace(os.Getenv("DYNAX_CURRENT_RELEASE_VERSION"))
	minimum := strings.TrimSpace(os.Getenv("DYNAX_MINIMUM_SUPPORTED_VERSION"))
	if _, ok := parseSemver(version); !ok {
		return nil, fmt.Errorf("invalid current release version")
	}
	if minimum != "" {
		if _, ok := parseSemver(minimum); !ok {
			return nil, fmt.Errorf("invalid minimum supported version")
		}
	}
	download, err := optionalHTTPSURL("DYNAX_RELEASE_DOWNLOAD_URL")
	if err != nil {
		return nil, err
	}
	notes, err := optionalHTTPSURL("DYNAX_RELEASE_NOTES_URL")
	if err != nil {
		return nil, err
	}
	published := strings.TrimSpace(os.Getenv("DYNAX_RELEASE_PUBLISHED_AT"))
	if published != "" && !validISOTimestamp(published) {
		return nil, fmt.Errorf("invalid release publication timestamp")
	}
	sha256Hex := strings.ToLower(strings.TrimSpace(os.Getenv("DYNAX_RELEASE_SHA256")))
	if sha256Hex != "" && !isHex64(sha256Hex) {
		return nil, fmt.Errorf("invalid release sha256")
	}
	m := &ReleaseManifest{Product: "dynax-studio", Version: version}
	if minimum != "" {
		m.MinimumSupportedVersion = &minimum
	}
	m.DownloadURL = download
	m.ReleaseNotesURL = notes
	if published != "" {
		m.PublishedAt = &published
	}
	if sha256Hex != "" {
		m.Sha256 = &sha256Hex
	}
	return m, nil
}

// isHex64 checks for a 64-character lowercase hex string (a SHA-256 digest).
func isHex64(s string) bool {
	if len(s) != 64 {
		return false
	}
	for _, r := range s {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			return false
		}
	}
	return true
}

// validISOTimestamp accepts the ISO-8601 forms the Python service accepted via
// datetime.fromisoformat (date, datetime, with "Z" or an explicit offset).
func validISOTimestamp(value string) bool {
	v := strings.Replace(value, "Z", "+00:00", 1)
	layouts := []string{
		time.RFC3339, time.RFC3339Nano,
		"2006-01-02T15:04:05", "2006-01-02T15:04", "2006-01-02",
	}
	for _, l := range layouts {
		if _, err := time.Parse(l, v); err == nil {
			return true
		}
	}
	return false
}

func optionalHTTPSURL(name string) (*string, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return nil, nil
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return nil, fmt.Errorf("invalid %s", name)
	}
	return &value, nil
}

// ── Admin: token provisioning ─────────────────────────────────────────────────

// CreateToken provisions an ingestion credential and returns the raw token once.
//
// @Summary  Provision a Studio ingestion token
// @Tags     studio-admin
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/studio/tokens [post]
func (h *Handler) CreateToken(c *gin.Context) {
	var body struct {
		Environment string `json:"environment"`
		Label       string `json:"label"`
	}
	_ = c.ShouldBindJSON(&body)
	env := strings.ToLower(strings.TrimSpace(body.Environment))
	switch env {
	case "production", "development", "test":
	case "":
		env = "test"
	default:
		response.BadRequest(c, "INVALID_ENVIRONMENT", "environment must be production, development, or test")
		return
	}
	tokenID := uuidV4()
	secret := randomSecret()
	if err := h.repo.CreateToken(c.Request.Context(), tokenID, secretHash(secret), env, body.Label); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Ingestion token created — copy it now, it cannot be recovered", gin.H{
		"token_id":    tokenID,
		"token":       tokenID + "." + secret,
		"environment": env,
		"label":       body.Label,
	})
}

// ListTokens lists provisioned ingestion tokens (never the secret).
//
// @Summary  List Studio ingestion tokens
// @Tags     studio-admin
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/studio/tokens [get]
func (h *Handler) ListTokens(c *gin.Context) {
	tokens, err := h.repo.ListTokens(c.Request.Context())
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Tokens retrieved", tokens)
}

// RevokeToken disables an ingestion token.
//
// @Summary  Revoke a Studio ingestion token
// @Tags     studio-admin
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/studio/tokens/{token_id}/revoke [post]
func (h *Handler) RevokeToken(c *gin.Context) {
	tokenID := c.Param("token_id")
	if !uuidRe.MatchString(tokenID) {
		response.BadRequest(c, "INVALID_TOKEN_ID", "token_id must be a UUID")
		return
	}
	if err := h.repo.RevokeToken(c.Request.Context(), tokenID); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Token revoked", nil)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func bearerIngestionToken(c *gin.Context) (tokenID, secret string, ok bool) {
	auth := c.GetHeader("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return "", "", false
	}
	raw := strings.TrimSpace(auth[len(prefix):])
	tokenID, secret, err := parseIngestionToken(raw)
	if err != nil {
		return "", "", false
	}
	return tokenID, secret, true
}

func uuidV4() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func randomSecret() string {
	b := make([]byte, 36)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
