package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// ProfessionalRepository handles queries across all professional profile tables.
type ProfessionalRepository struct {
	db *db.Pool
}

func NewProfessionalRepository(db *db.Pool) *ProfessionalRepository {
	return &ProfessionalRepository{db: db}
}

// ─── Profile reads ────────────────────────────────────────────────────────────

// FindByUserID looks up a professional profile by user_id (queries all role tables).
func (r *ProfessionalRepository) FindByUserID(ctx context.Context, userID string, role models.Role) (*models.ProfessionalProfile, error) {
	table := roleTable(role)
	if table == "" {
		return nil, fmt.Errorf("unsupported professional role: %s", role)
	}

	q := fmt.Sprintf(`
		SELECT id, user_id, full_name, email, phone_number,
		       license_number, specializations, experience_years, bio,
		       clinic_name, personal_code, session_rate,
		       virtual_sessions_enabled, in_person_sessions_enabled,
		       approval_status, is_approved, avatar_url, created_at, updated_at
		FROM public.%s
		WHERE user_id = $1
		LIMIT 1`, table)

	p := &models.ProfessionalProfile{}
	err := r.db.QueryRow(ctx, q, userID).Scan(
		&p.ID, &p.UserID, &p.FullName, &p.Email, &p.PhoneNumber,
		&p.LicenseNumber, &p.Specializations, &p.ExperienceYears, &p.Bio,
		&p.ClinicName, &p.PersonalCode, &p.SessionRate,
		&p.VirtualSessionEnabled, &p.InPersonEnabled,
		&p.ApprovalStatus, &p.IsApproved, &p.AvatarURL, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

// FindByPersonalCode looks up a professional via their unique PIN across all tables.
func (r *ProfessionalRepository) FindByPersonalCode(ctx context.Context, code string) (*models.ProfessionalProfile, error) {
	// Use the DB function that queries all tables
	const q = `SELECT user_id, professional_type, full_name, clinic_name, avatar_url, is_approved
	            FROM public.find_professional_by_code($1)`

	row := r.db.QueryRow(ctx, q, code)
	var userID, profType, fullName, clinicName, avatarURL string
	var isApproved bool
	err := row.Scan(&userID, &profType, &fullName, &clinicName, &avatarURL, &isApproved)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	p := &models.ProfessionalProfile{
		UserID:         userID,
		ProfessionalType: profType,
		FullName:       fullName,
		ClinicName:     &clinicName,
		AvatarURL:      &avatarURL,
		IsApproved:     isApproved,
		PersonalCode:   &code,
	}
	return p, nil
}

// ─── Profile writes ───────────────────────────────────────────────────────────

// Create inserts a new professional profile into the appropriate role table.
func (r *ProfessionalRepository) Create(ctx context.Context, userID, fullName, email string, role models.Role) error {
	table := roleTable(role)
	if table == "" {
		return fmt.Errorf("unsupported professional role: %s", role)
	}

	// Generate a personal code via DB function
	const codeQ = `SELECT public.generate_personal_code()`
	var code string
	if err := r.db.QueryRow(ctx, codeQ).Scan(&code); err != nil {
		return fmt.Errorf("generate personal code: %w", err)
	}

	q := fmt.Sprintf(`
		INSERT INTO public.%s (user_id, full_name, email, personal_code)
		VALUES ($1, $2, $3, $4)`, table)

	_, err := r.db.Exec(ctx, q, userID, fullName, email, code)
	return err
}

// UpdatePersonalCode sets a new personal code on the professional profile.
func (r *ProfessionalRepository) UpdatePersonalCode(ctx context.Context, userID string, role models.Role, code string) error {
	table := roleTable(role)
	if table == "" {
		return fmt.Errorf("unsupported professional role: %s", role)
	}
	q := fmt.Sprintf(`UPDATE public.%s SET personal_code = $2, updated_at = NOW() WHERE user_id = $1`, table)
	return r.db.ExecOne(ctx, q, userID, code)
}

// SetApprovalStatus updates the approval status (admin only).
func (r *ProfessionalRepository) SetApprovalStatus(ctx context.Context, userID string, role models.Role, approved bool, approvedBy string) error {
	table := roleTable(role)
	if table == "" {
		return fmt.Errorf("unsupported professional role: %s", role)
	}

	status := "approved"
	if !approved {
		status = "rejected"
	}

	q := fmt.Sprintf(`
		UPDATE public.%s
		SET approval_status = $2, is_approved = $3, approved_by = $4, approved_at = NOW(), updated_at = NOW()
		WHERE user_id = $1`, table)

	return r.db.ExecOne(ctx, q, userID, status, approved, approvedBy)
}

// ─── Patients under a professional ───────────────────────────────────────────

// ListPatients returns all active patients for a professional.
func (r *ProfessionalRepository) ListPatients(ctx context.Context, professionalID string, q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	search := "%" + q.Search + "%"

	const countQ = `
		SELECT COUNT(*)
		FROM public.professional_patient_connections c
		JOIN public.patient_profiles p ON p.user_id = c.patient_id
		WHERE c.professional_id = $1 AND c.status = 'active'
		  AND (p.full_name ILIKE $2 OR $2 = '%%')`

	var total int64
	if err := r.db.QueryRow(ctx, countQ, professionalID, search).Scan(&total); err != nil {
		return nil, 0, err
	}

	const listQ = `
		SELECT p.id, p.user_id, p.full_name, p.email, p.phone_number,
		       p.date_of_birth, p.gender, p.primary_condition,
		       p.personal_code, p.created_at, p.updated_at
		FROM public.professional_patient_connections c
		JOIN public.patient_profiles p ON p.user_id = c.patient_id
		WHERE c.professional_id = $1 AND c.status = 'active'
		  AND (p.full_name ILIKE $2 OR $2 = '%%')
		ORDER BY c.connected_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.db.Query(ctx, listQ, professionalID, search, q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var patients []models.PatientProfile
	for rows.Next() {
		var p models.PatientProfile
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.FullName, &p.Email, &p.PhoneNumber,
			&p.DateOfBirth, &p.Gender, &p.Condition,
			&p.PersonalCode, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		patients = append(patients, p)
	}
	return patients, total, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// roleTable maps a user_role to its corresponding profile table name.
func roleTable(role models.Role) string {
	switch role {
	case models.RolePhysiotherapist:
		return "therapist_profiles"
	case models.RoleProsthetist, models.RoleOrthotist:
		return "po_professional_profiles"
	case models.RoleOccupationalTherapist:
		return "occupational_therapist_profiles"
	case models.RoleSpeechTherapist:
		return "speech_therapist_profiles"
	case models.RoleMentalHealthClinician:
		return "mental_health_clinician_profiles"
	default:
		return ""
	}
}
