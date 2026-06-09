package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// ErrOTPInvalid is returned when an OTP is missing, expired, used, or wrong.
var ErrOTPInvalid = errors.New("otp invalid or expired")

const maxOTPAttempts = 5

// TokenRepository handles one-time passcodes for verify/reset email flows.
type TokenRepository struct {
	db *db.Pool
}

func NewTokenRepository(db *db.Pool) *TokenRepository {
	return &TokenRepository{db: db}
}

// Create stores a new OTP (caller passes the SHA-256 hash of the 6-digit code).
// Any previous unused OTPs for the same user+purpose are invalidated first so
// only the newest code works.
func (r *TokenRepository) Create(ctx context.Context, userID, codeHash, purpose string, expiresAt time.Time) error {
	if _, err := r.db.Exec(ctx,
		`UPDATE public.auth_otps SET used_at = NOW()
		 WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
		userID, purpose); err != nil {
		return err
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.auth_otps (user_id, code_hash, purpose, expires_at)
		 VALUES ($1, $2, $3, $4)`,
		userID, codeHash, purpose, expiresAt)
	return err
}

// Consume validates the supplied code hash for a user+purpose. On success it
// marks the OTP used and returns nil. On a wrong code it increments attempts.
// Returns ErrOTPInvalid for any failure (missing/expired/used/locked/wrong).
func (r *TokenRepository) Consume(ctx context.Context, userID, codeHash, purpose string) error {
	const sel = `
		SELECT id, code_hash, attempts
		FROM public.auth_otps
		WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1`

	var id, storedHash string
	var attempts int
	err := r.db.QueryRow(ctx, sel, userID, purpose).Scan(&id, &storedHash, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrOTPInvalid
	}
	if err != nil {
		return err
	}

	if attempts >= maxOTPAttempts {
		// Lock this code out for good.
		_, _ = r.db.Exec(ctx, `UPDATE public.auth_otps SET used_at = NOW() WHERE id = $1`, id)
		return ErrOTPInvalid
	}

	if storedHash != codeHash {
		_, _ = r.db.Exec(ctx, `UPDATE public.auth_otps SET attempts = attempts + 1 WHERE id = $1`, id)
		return ErrOTPInvalid
	}

	_, err = r.db.Exec(ctx, `UPDATE public.auth_otps SET used_at = NOW() WHERE id = $1`, id)
	return err
}
