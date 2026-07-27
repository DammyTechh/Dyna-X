package studio

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
)

var (
	tokenSecretRe = regexp.MustCompile(`^[A-Za-z0-9_-]{32,256}$`)
	semverRe      = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$`)
	semverPartsRe = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$`)
)

// parseIngestionToken splits "<token_id>.<secret>" and validates the shape.
func parseIngestionToken(raw string) (tokenID, secret string, err error) {
	idx := strings.IndexByte(raw, '.')
	if idx <= 0 {
		return "", "", errors.New("invalid ingestion token")
	}
	tokenID, secret = raw[:idx], raw[idx+1:]
	if !uuidRe.MatchString(tokenID) || !tokenSecretRe.MatchString(secret) {
		return "", "", errors.New("invalid ingestion token")
	}
	return tokenID, secret, nil
}

// secretHash is SHA-256(secret) as lowercase hex — the only form stored.
func secretHash(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// constantTimeEqual compares two hex hashes without leaking timing.
func constantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

type semver struct{ major, minor, patch int }

func parseSemver(value string) (semver, bool) {
	m := semverRe.FindStringSubmatch(strings.TrimSpace(value))
	if m == nil {
		return semver{}, false
	}
	maj, _ := strconv.Atoi(m[1])
	min, _ := strconv.Atoi(m[2])
	pat, _ := strconv.Atoi(m[3])
	return semver{maj, min, pat}, true
}

// versionState mirrors dashboard_service.version_state.
func versionState(version, currentRelease string) string {
	if strings.TrimSpace(version) == "" {
		return "Unknown"
	}
	reported := semverPartsRe.FindStringSubmatch(strings.TrimSpace(version))
	currentText := currentRelease
	if currentText == "" {
		currentText = os.Getenv("DYNAX_CURRENT_RELEASE_VERSION")
	}
	current := semverPartsRe.FindStringSubmatch(strings.TrimSpace(currentText))
	if reported == nil {
		return "Invalid version"
	}
	if current == nil {
		return "Unknown"
	}
	rp := triple(reported)
	cp := triple(current)
	reportedPre := reported[4] != ""
	currentPre := current[4] != ""
	if rp == cp && reportedPre && !currentPre {
		return "Update available"
	}
	if rp == cp {
		return "Current"
	}
	if less(rp, cp) {
		return "Update available"
	}
	return "Ahead"
}

func triple(m []string) [3]int {
	a, _ := strconv.Atoi(m[1])
	b, _ := strconv.Atoi(m[2])
	c, _ := strconv.Atoi(m[3])
	return [3]int{a, b, c}
}

func less(a, b [3]int) bool {
	for i := 0; i < 3; i++ {
		if a[i] != b[i] {
			return a[i] < b[i]
		}
	}
	return false
}

// ── Signed, opaque installation reference ─────────────────────────────────────
// The dashboard never exposes a raw install UUID; it uses a signed reference.

func referenceSecret() []byte {
	s := os.Getenv("STUDIO_REFERENCE_SECRET")
	if s == "" {
		s = os.Getenv("DYNAX_DASHBOARD_SESSION_SECRET")
	}
	if s == "" {
		s = os.Getenv("JWT_SECRET")
	}
	return []byte("dynax-installation-reference-v1:" + s)
}

func installationReference(installID string) string {
	mac := hmac.New(sha256.New, referenceSecret())
	mac.Write([]byte(installID))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	id := base64.RawURLEncoding.EncodeToString([]byte(installID))
	return id + "." + sig
}

func decodeInstallationReference(ref string) (string, bool) {
	parts := strings.SplitN(ref, ".", 2)
	if len(parts) != 2 {
		return "", false
	}
	idBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", false
	}
	installID := string(idBytes)
	expected := installationReference(installID)
	if subtle.ConstantTimeCompare([]byte(ref), []byte(expected)) != 1 {
		return "", false
	}
	if !uuidRe.MatchString(installID) {
		return "", false
	}
	return installID, true
}

func shortInstallationID(installID string) string {
	compact := strings.ReplaceAll(installID, "-", "")
	if len(compact) > 8 {
		return compact[:8]
	}
	return compact
}
