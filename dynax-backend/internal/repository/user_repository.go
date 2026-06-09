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

// ─── Local auth (password-based) ──────────────────────────────────────────────

// CreateLocal inserts a new user with a bcrypt password hash and returns it.
func (r *UserRepository) CreateLocal(ctx context.Context, email string, role models.Role, passwordHash string) (*models.User, error) {
	const q = `
		INSERT INTO public.dynax_users (email, role, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, email, role, is_active, created_at, updated_at`

	u := &models.User{}
	err := r.db.QueryRow(ctx, q, email, role, passwordHash).Scan(
		&u.ID, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	return u, err
}

// Credentials carries the fields needed to authenticate a login.
type Credentials struct {
	ID           string
	Email        string
	Role         models.Role
	PasswordHash string
	IsActive     bool
	IsVerified   bool
}

// GetCredentialsByEmail returns auth fields for an email, or nil if not found.
func (r *UserRepository) GetCredentialsByEmail(ctx context.Context, email string) (*Credentials, error) {
	const q = `
		SELECT id, email, role, COALESCE(password_hash, ''), is_active, is_verified
		FROM public.dynax_users
		WHERE email = $1
		LIMIT 1`

	c := &Credentials{}
	err := r.db.QueryRow(ctx, q, email).Scan(
		&c.ID, &c.Email, &c.Role, &c.PasswordHash, &c.IsActive, &c.IsVerified,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// GetPasswordHash returns the bcrypt hash for a user id.
func (r *UserRepository) GetPasswordHash(ctx context.Context, id string) (string, error) {
	const q = `SELECT COALESCE(password_hash, '') FROM public.dynax_users WHERE id = $1`
	var hash string
	err := r.db.QueryRow(ctx, q, id).Scan(&hash)
	return hash, err
}

// UpdatePassword sets a new bcrypt password hash.
func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	const q = `UPDATE public.dynax_users SET password_hash = $2, updated_at = NOW() WHERE id = $1`
	return r.db.ExecOne(ctx, q, id, passwordHash)
}

// CreatePatientProfile inserts a patient_profiles row with a generated PIN code.
func (r *UserRepository) CreatePatientProfile(ctx context.Context, userID, fullName, email string) error {
	var code string
	if err := r.db.QueryRow(ctx, `SELECT public.generate_personal_code()`).Scan(&code); err != nil {
		return err
	}
	const q = `
		INSERT INTO public.patient_profiles (user_id, full_name, email, personal_code)
		VALUES ($1, $2, $3, $4)`
	_, err := r.db.Exec(ctx, q, userID, fullName, email, code)
	return err
}

// GetPatientProfile returns the patient profile for a user id.
func (r *UserRepository) GetPatientProfile(ctx context.Context, userID string) (*models.PatientProfile, error) {
	const q = `
		SELECT id, user_id, full_name, email, phone_number, date_of_birth, gender,
		       primary_condition, diagnosis_notes, personal_code,
		       emergency_contact, address, created_at, updated_at
		FROM public.patient_profiles
		WHERE user_id = $1
		LIMIT 1`

	p := &models.PatientProfile{}
	err := r.db.QueryRow(ctx, q, userID).Scan(
		&p.ID, &p.UserID, &p.FullName, &p.Email, &p.PhoneNumber, &p.DateOfBirth, &p.Gender,
		&p.Condition, &p.DiagnosisNotes, &p.PersonalCode,
		&p.EmergencyContact, &p.Address, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

// UpdatePatientProfile applies a partial update (COALESCE keeps existing values).
func (r *UserRepository) UpdatePatientProfile(ctx context.Context, userID string, req *models.UpdatePatientProfileRequest) error {
	const q = `
		UPDATE public.patient_profiles SET
			full_name         = COALESCE($2, full_name),
			phone_number      = COALESCE($3, phone_number),
			date_of_birth     = COALESCE($4::date, date_of_birth),
			gender            = COALESCE($5, gender),
			emergency_contact = COALESCE($6, emergency_contact),
			address           = COALESCE($7, address),
			updated_at        = NOW()
		WHERE user_id = $1`
	return r.db.ExecOne(ctx, q, userID,
		req.FullName, req.PhoneNumber, req.DateOfBirth, req.Gender, req.EmergencyContact, req.Address)
}
