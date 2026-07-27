package studio

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// Repository is the studio module's data access. It uses the shared pool.
type Repository struct{ db *db.Pool }

// NewRepository builds a studio Repository over the shared connection pool.
func NewRepository(pool *db.Pool) *Repository { return &Repository{db: pool} }

var errForbidden = errors.New("invalid ingestion identity")

// VerifyToken resolves an enabled token and checks the secret in constant time.
func (r *Repository) VerifyToken(ctx context.Context, tokenID, secret string) (*TokenIdentity, error) {
	var storedHash, environment string
	var installID *string
	err := r.db.QueryRow(ctx,
		`SELECT secret_hash, install_id, environment
		 FROM public.studio_ingestion_tokens
		 WHERE token_id = $1 AND enabled = TRUE`, tokenID).Scan(&storedHash, &installID, &environment)
	if err != nil {
		return nil, errForbidden
	}
	if !constantTimeEqual(storedHash, secretHash(secret)) {
		return nil, errForbidden
	}
	return &TokenIdentity{TokenID: tokenID, InstallID: installID, Environment: environment}, nil
}

// BindToken binds a token to an installation on first use and enforces it after.
func (r *Repository) BindToken(ctx context.Context, id *TokenIdentity, installID string) error {
	if id.InstallID != nil {
		if *id.InstallID != installID {
			return errForbidden
		}
		_, _ = r.db.Exec(ctx,
			`UPDATE public.studio_ingestion_tokens SET last_used_at = NOW() WHERE token_id = $1`, id.TokenID)
		return nil
	}
	_, _ = r.db.Exec(ctx,
		`UPDATE public.studio_ingestion_tokens
		 SET install_id = $2, last_used_at = NOW()
		 WHERE token_id = $1 AND install_id IS NULL`, id.TokenID, installID)
	var bound *string
	if err := r.db.QueryRow(ctx,
		`SELECT install_id FROM public.studio_ingestion_tokens WHERE token_id = $1`, id.TokenID).Scan(&bound); err != nil {
		return errForbidden
	}
	if bound == nil || *bound != installID {
		return errForbidden
	}
	return nil
}

// InsertEvents inserts a validated batch idempotently and returns how many new
// rows were created (duplicates by event_id are silently ignored).
func (r *Repository) InsertEvents(ctx context.Context, events []EventPayload, environment string) (int, error) {
	if len(events) == 0 {
		return 0, nil
	}
	receivedAt := time.Now().UTC()
	const cols = 14
	values := make([]string, 0, len(events))
	args := make([]interface{}, 0, len(events)*cols)
	for i, e := range events {
		b := i * cols
		values = append(values, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			b+1, b+2, b+3, b+4, b+5, b+6, b+7, b+8, b+9, b+10, b+11, b+12, b+13, b+14))
		args = append(args,
			e.EventID, e.InstallID, e.SessionID, e.EventType, e.Workflow, e.Stage, e.Value,
			e.DurationS, e.Timestamp, e.AddonVersion, e.BlenderVersion, e.OSPlatform, receivedAt, environment)
	}
	query := `INSERT INTO public.studio_events
		(event_id, install_id, session_id, event_type, workflow, stage, value,
		 duration_s, timestamp, addon_version, blender_version, os_platform, received_at, environment)
		VALUES ` + strings.Join(values, ",") + `
		ON CONFLICT (event_id) DO NOTHING`
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// CreateToken provisions a new ingestion credential and returns the token id and
// the one-time raw token "<token_id>.<secret>". Only the secret hash is stored.
func (r *Repository) CreateToken(ctx context.Context, tokenID, secretHashHex, environment, label string) error {
	var labelArg interface{}
	if strings.TrimSpace(label) != "" {
		labelArg = label
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.studio_ingestion_tokens (token_id, secret_hash, enabled, created_at, environment, label)
		 VALUES ($1, $2, TRUE, NOW(), $3, $4)`,
		tokenID, secretHashHex, environment, labelArg)
	return err
}

// ListTokens returns all provisioned tokens (never the secret).
func (r *Repository) ListTokens(ctx context.Context) ([]TokenInfo, error) {
	rows, err := r.db.Query(ctx,
		`SELECT token_id, install_id, enabled, label, environment, created_at, last_used_at
		 FROM public.studio_ingestion_tokens ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TokenInfo{}
	for rows.Next() {
		var t TokenInfo
		if err := rows.Scan(&t.TokenID, &t.InstallID, &t.Enabled, &t.Label, &t.Environment, &t.CreatedAt, &t.LastUsedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// RevokeToken disables a token so it can no longer ingest.
func (r *Repository) RevokeToken(ctx context.Context, tokenID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.studio_ingestion_tokens SET enabled = FALSE WHERE token_id = $1`, tokenID)
	return err
}
