package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// UserRepository handles all user-related database queries.
type UserRepository struct {
	db *db.Pool
}

func NewUserRepository(db *db.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// ─── Reads ────────────────────────────────────────────────────────────────────

// FindByID returns a user by their DynaX user ID.
func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	const q = `
		SELECT id, email, role, is_active, created_at, updated_at
		FROM public.dynax_users
		WHERE id = $1 AND is_active = TRUE
		LIMIT 1`

	u := &models.User{}
	err := r.db.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

// FindByEmail returns a user by email address.
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	const q = `
		SELECT id, email, role, is_active, created_at, updated_at
		FROM public.dynax_users
		WHERE email = $1
		LIMIT 1`

	u := &models.User{}
	err := r.db.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

// FindByAuthID looks up a DynaX user via their Supabase auth.users UUID.
func (r *UserRepository) FindByAuthID(ctx context.Context, authID string) (*models.User, error) {
	const q = `
		SELECT id, email, role, is_active, created_at, updated_at
		FROM public.dynax_users
		WHERE auth_id = $1
		LIMIT 1`

	u := &models.User{}
	err := r.db.QueryRow(ctx, q, authID).Scan(
		&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

// EmailExists returns true if an email is already registered.
func (r *UserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM public.dynax_users WHERE email = $1)`
	var exists bool
	return exists, r.db.QueryRow(ctx, q, email).Scan(&exists)
}

// ─── Writes ───────────────────────────────────────────────────────────────────

// Create inserts a new user and returns the created record.
func (r *UserRepository) Create(ctx context.Context, email string, role models.Role, authID *string) (*models.User, error) {
	const q = `
		INSERT INTO public.dynax_users (email, role, auth_id)
		VALUES ($1, $2, $3)
		RETURNING id, email, role, is_active, created_at, updated_at`

	u := &models.User{}
	err := r.db.QueryRow(ctx, q, email, role, authID).Scan(
		&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	return u, err
}

// UpdateLastLogin updates the last_login_at timestamp.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id string) error {
	const q = `UPDATE public.dynax_users SET last_login_at = $2 WHERE id = $1`
	return r.db.ExecOne(ctx, q, id, time.Now())
}

// SetVerified marks the user's email as verified.
func (r *UserRepository) SetVerified(ctx context.Context, id string) error {
	const q = `UPDATE public.dynax_users SET is_verified = TRUE, updated_at = NOW() WHERE id = $1`
	return r.db.ExecOne(ctx, q, id)
}

// SetActive enables or disables a user account.
func (r *UserRepository) SetActive(ctx context.Context, id string, active bool) error {
	const q = `UPDATE public.dynax_users SET is_active = $2, updated_at = NOW() WHERE id = $1`
	return r.db.ExecOne(ctx, q, id, active)
}

// List returns paginated users with optional role filter.
func (r *UserRepository) List(ctx context.Context, q *models.PaginationQuery, roleFilter string) ([]models.User, int64, error) {
	search := "%" + q.Search + "%"

	countQ := `SELECT COUNT(*) FROM public.dynax_users WHERE (email ILIKE $1 OR $1 = '%%')`
	args := []interface{}{search}

	var total int64
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQ := `
		SELECT id, email, role, is_active, created_at, updated_at
		FROM public.dynax_users
		WHERE (email ILIKE $1 OR $1 = '%%')
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, listQ, search, q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}
