// Package studio ports the DynaX Studio telemetry + release-manifest backend
// (originally a standalone FastAPI service) into the single Go backend. It is
// self-contained: device-facing ingestion + releases endpoints use their own
// bearer-token auth, and admin endpoints reuse the platform's JWT admin auth.
package studio

import "time"

// EventPayload is one usage event submitted by a Studio installation.
type EventPayload struct {
	EventID        string    `json:"event_id"`
	InstallID      string    `json:"install_id"`
	SessionID      string    `json:"session_id"`
	EventType      string    `json:"event_type"`
	Workflow       *string   `json:"workflow"`
	Stage          *string   `json:"stage"`
	Value          *string   `json:"value"`
	DurationS      *float64  `json:"duration_s"`
	Timestamp      time.Time `json:"timestamp"`
	AddonVersion   *string   `json:"addon_version"`
	BlenderVersion *string   `json:"blender_version"`
	OSPlatform     string    `json:"os_platform"`
}

// TokenIdentity is the resolved identity behind an ingestion bearer token.
type TokenIdentity struct {
	TokenID     string
	InstallID   *string // nil until the token binds to an installation
	Environment string
}

// ReleaseManifest is the public update-check payload the desktop app expects.
// Field names and the fixed "product" are part of the client contract.
type ReleaseManifest struct {
	Product                 string  `json:"product"`
	Version                 string  `json:"version"`
	MinimumSupportedVersion *string `json:"minimum_supported_version"`
	DownloadURL             *string `json:"download_url"`
	ReleaseNotesURL         *string `json:"release_notes_url"`
	PublishedAt             *string `json:"published_at"`
	// Sha256 lets the updater verify the downloaded artefact before running it.
	// buildReleaseManifest has always populated this from DYNAX_RELEASE_SHA256;
	// the field was simply missing from the struct, so the package would not
	// compile once that code path was reached.
	Sha256 *string `json:"sha256"`
}

// TokenInfo is an ingestion token as shown to an administrator (never the secret).
type TokenInfo struct {
	TokenID     string     `json:"token_id"`
	InstallID   *string    `json:"install_id"`
	Enabled     bool       `json:"enabled"`
	Label       *string    `json:"label"`
	Environment string     `json:"environment"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
}
