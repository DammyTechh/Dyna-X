package studio

// Release download resolution.
//
// The release manifest is assembled entirely from environment variables (see
// buildReleaseManifest in handler.go). DYNAX_RELEASE_DOWNLOAD_URL is a
// hand-entered string and nothing has ever checked that the object behind it
// actually exists — so bumping DYNAX_CURRENT_RELEASE_VERSION without uploading
// the matching artefact (or uploading it under a different key) leaves the
// download button pointing at a Supabase 404 body, which the browser renders
// as a JSON page instead of downloading anything.
//
// This file adds a redirect endpoint that probes the object before sending
// anyone to it, so a mismatch surfaces as a clear 503 from our own API rather
// than as a raw storage error in the user's tab.

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// probeClient is deliberately short-lived: this sits in front of a user click,
// so a slow storage backend must not hold the request open.
var probeClient = &http.Client{Timeout: 6 * time.Second}

type probeResult struct {
	ok         bool
	statusCode int
	checkedAt  time.Time
}

var (
	probeMu    sync.Mutex
	probeCache = map[string]probeResult{}
)

const (
	probeTTLOK   = 5 * time.Minute
	probeTTLFail = 20 * time.Second
)

// releaseObjectAvailable issues a HEAD against the artefact URL and reports
// whether it can be served. Results are cached briefly so a burst of clicks
// doesn't turn into a burst of upstream requests; failures are cached for much
// less time so a re-upload takes effect almost immediately.
func releaseObjectAvailable(rawURL string) (bool, int) {
	now := time.Now()

	probeMu.Lock()
	if cached, found := probeCache[rawURL]; found {
		ttl := probeTTLFail
		if cached.ok {
			ttl = probeTTLOK
		}
		if now.Sub(cached.checkedAt) < ttl {
			probeMu.Unlock()
			return cached.ok, cached.statusCode
		}
	}
	probeMu.Unlock()

	status := 0
	ok := false

	req, err := http.NewRequest(http.MethodHead, rawURL, nil)
	if err == nil {
		resp, doErr := probeClient.Do(req)
		if doErr == nil {
			defer resp.Body.Close()
			status = resp.StatusCode
			ok = resp.StatusCode >= 200 && resp.StatusCode < 400
		} else {
			// The probe itself failed (DNS, timeout, TLS). Treat the artefact as
			// available rather than blocking a download that may well work — a
			// transient outage on our side shouldn't take the button offline.
			ok = true
			status = 0
		}
	}

	probeMu.Lock()
	probeCache[rawURL] = probeResult{ok: ok, statusCode: status, checkedAt: now}
	probeMu.Unlock()

	return ok, status
}

// withAttachment appends Supabase's `download` query parameter, which flips the
// response to `Content-Disposition: attachment`. Without it the browser may
// render the object inline and leave the user sitting on a blank-looking page.
func withAttachment(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	if !strings.HasSuffix(parsed.Hostname(), ".supabase.co") {
		return rawURL
	}
	if parsed.Query().Has("download") {
		return rawURL
	}
	filename := path.Base(parsed.Path)
	if filename == "" || filename == "." || filename == "/" {
		filename = "DynaX-Studio.zip"
	}
	// Collapse an accidentally duplicated final extension ("...zip.zip") so the
	// user saves a sanely named file even when the stored key is malformed.
	if ext := path.Ext(filename); ext != "" {
		for strings.HasSuffix(filename, ext+ext) {
			filename = strings.TrimSuffix(filename, ext)
		}
	}
	q := parsed.Query()
	q.Set("download", filename)
	parsed.RawQuery = q.Encode()
	return parsed.String()
}

// resolveArtifactURL returns the real storage URL for the current build.
//
// DYNAX_RELEASE_ARTIFACT_URL is the source of truth and may contain a
// "{version}" placeholder, which is filled from DYNAX_CURRENT_RELEASE_VERSION.
// That keeps the version in exactly one environment variable instead of two
// that can drift apart -- the drift is what broke the download button.
//
// DYNAX_RELEASE_DOWNLOAD_URL is what the manifest advertises to clients. Once
// it points at this endpoint it must never be used as the redirect target, or
// the handler redirects to itself forever; the loop guard below enforces that.
func resolveArtifactURL() (string, error) {
	raw := strings.TrimSpace(os.Getenv("DYNAX_RELEASE_ARTIFACT_URL"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("DYNAX_RELEASE_DOWNLOAD_URL"))
	}
	if raw == "" {
		return "", fmt.Errorf("no release artefact is configured")
	}

	if version := strings.TrimSpace(os.Getenv("DYNAX_CURRENT_RELEASE_VERSION")); version != "" {
		raw = strings.ReplaceAll(raw, "{version}", version)
	}
	if strings.Contains(raw, "{version}") {
		return "", fmt.Errorf("artefact URL has an unresolved {version} placeholder")
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return "", fmt.Errorf("the configured artefact URL is not a valid https URL")
	}
	if strings.HasSuffix(strings.TrimRight(parsed.Path, "/"), "/releases/current/download") {
		return "", fmt.Errorf(
			"artefact URL points back at this endpoint -- set DYNAX_RELEASE_ARTIFACT_URL to the storage object",
		)
	}
	return raw, nil
}

// DownloadCurrent redirects to the current Windows artefact after confirming it
// exists.
//
// @Summary  Download the current DynaX Studio build
// @Tags     studio
// @Produce  json
// @Success  302 {string} string "Redirect to the release artefact"
// @Failure  503 {object} map[string]string
// @Router   /api/v1/releases/current/download [get]
func (h *Handler) DownloadCurrent(c *gin.Context) {
	// Never cached: the target changes with every release, and a cached 503
	// would outlive the upload that fixes it.
	c.Header("Cache-Control", "no-store")

	raw, err := resolveArtifactURL()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": err.Error()})
		return
	}

	if ok, status := releaseObjectAvailable(raw); !ok {
		version := strings.TrimSpace(os.Getenv("DYNAX_CURRENT_RELEASE_VERSION"))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"detail": fmt.Sprintf(
				"The DynaX Studio %s installer is not available from storage (upstream status %d). "+
					"The published version and the uploaded artefact are out of sync.",
				version, status,
			),
		})
		return
	}

	// 302, not 301: the target changes with every release.
	c.Redirect(http.StatusFound, withAttachment(raw))
}

// ReleaseDownloadHealthy reports whether the configured artefact is currently
// reachable. Wire this into your existing health/readiness output so a
// version bump without an upload is caught by monitoring instead of by users.
func ReleaseDownloadHealthy() (bool, string) {
	raw, err := resolveArtifactURL()
	if err != nil {
		return false, err.Error()
	}
	if ok, status := releaseObjectAvailable(raw); !ok {
		return false, fmt.Sprintf("release artefact unreachable (status %d)", status)
	}
	return true, "ok"
}
