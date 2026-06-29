package repository

import (
	"context"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

type AdminRepository struct{ db *db.Pool }

func NewAdminRepository(db *db.Pool) *AdminRepository { return &AdminRepository{db: db} }

func (r *AdminRepository) Stats(ctx context.Context) (*models.AdminStats, error) {
	s := &models.AdminStats{}
	err := r.db.QueryRow(ctx,
		`SELECT total_users, total_patients, total_professionals, pending_approvals,
		        total_sessions, active_care_plans, sessions_this_month
		 FROM public.get_platform_stats()`).
		Scan(&s.TotalUsers, &s.TotalPatients, &s.TotalProfessionals, &s.PendingApprovals,
			&s.TotalSessions, &s.ActiveCarePlans, &s.SessionsThisMonth)
	if err != nil {
		return nil, err
	}
	_ = r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount),0) FROM public.payment_transactions WHERE status='success'`).
		Scan(&s.TotalRevenue)
	return s, nil
}

func (r *AdminRepository) ListUsers(ctx context.Context, q *models.PaginationQuery) ([]models.User, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.dynax_users`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, email, role, is_active, is_verified, created_at, updated_at
		 FROM public.dynax_users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.IsActive, &u.IsVerified, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	return out, total, rows.Err()
}

func (r *AdminRepository) SetActive(ctx context.Context, userID string, active bool) error {
	return r.db.ExecOne(ctx,
		`UPDATE public.dynax_users SET is_active=$2, updated_at=NOW() WHERE id=$1`, userID, active)
}

const profListCols = `user_id, full_name, email, professional_type, approval_status, is_approved, created_at`

// ListProfessionals unions the role-specific profile tables.
func (r *AdminRepository) ListProfessionals(ctx context.Context, q *models.PaginationQuery, status string) ([]models.ProfessionalProfile, int64, error) {
	base := `
		SELECT user_id, full_name, email, 'physiotherapist' AS professional_type, approval_status, is_approved, created_at FROM public.therapist_profiles
		UNION ALL SELECT user_id, full_name, email, professional_type, approval_status, is_approved, created_at FROM public.po_professional_profiles
		UNION ALL SELECT user_id, full_name, email, 'occupational_therapist', approval_status, is_approved, created_at FROM public.occupational_therapist_profiles
		UNION ALL SELECT user_id, full_name, email, 'speech_therapist', approval_status, is_approved, created_at FROM public.speech_therapist_profiles
		UNION ALL SELECT user_id, full_name, email, 'mental_health_clinician', approval_status, is_approved, created_at FROM public.mental_health_clinician_profiles`

	where := ""
	args := []interface{}{}
	if status != "" {
		where = ` WHERE p.approval_status = $1`
		args = append(args, status)
	}

	countQ := `SELECT COUNT(*) FROM (` + base + `) p` + where
	var total int64
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQ := `SELECT p.user_id, p.full_name, p.email, p.professional_type, p.approval_status, p.is_approved, p.created_at
		FROM (` + base + `) p` + where +
		` ORDER BY p.created_at DESC LIMIT $` + itoa(len(args)+1) + ` OFFSET $` + itoa(len(args)+2)
	args = append(args, q.PageSize, q.Offset())

	rows, err := r.db.Query(ctx, listQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.ProfessionalProfile{}
	for rows.Next() {
		var p models.ProfessionalProfile
		if err := rows.Scan(&p.UserID, &p.FullName, &p.Email, &p.ProfessionalType, &p.ApprovalStatus, &p.IsApproved, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, p)
	}
	return out, total, rows.Err()
}

func (r *AdminRepository) ListPatients(ctx context.Context, q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.patient_profiles`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT user_id, full_name, email, phone_number, personal_code, created_at
		 FROM public.patient_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.PatientProfile{}
	for rows.Next() {
		var p models.PatientProfile
		if err := rows.Scan(&p.UserID, &p.FullName, &p.Email, &p.PhoneNumber, &p.PersonalCode, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, p)
	}
	return out, total, rows.Err()
}

func (r *AdminRepository) ListSessions(ctx context.Context, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.therapy_sessions`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, patient_id, professional_id, session_date, duration_minutes, session_type, status, created_at, updated_at
		 FROM public.therapy_sessions ORDER BY session_date DESC LIMIT $1 OFFSET $2`,
		q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.TherapySession{}
	for rows.Next() {
		var s models.TherapySession
		if err := rows.Scan(&s.ID, &s.PatientID, &s.ProfessionalID, &s.SessionDate, &s.DurationMins,
			&s.SessionType, &s.Status, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, s)
	}
	return out, total, rows.Err()
}

func (r *AdminRepository) AuditLogs(ctx context.Context, q *models.PaginationQuery) ([]interface{}, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.audit_logs`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, user_email, user_role, action, target_type, created_at::text
		 FROM public.audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []interface{}{}
	for rows.Next() {
		var id, action, createdAt string
		var email, role, targetType *string
		if err := rows.Scan(&id, &email, &role, &action, &targetType, &createdAt); err != nil {
			return nil, 0, err
		}
		out = append(out, map[string]interface{}{
			"id": id, "user_email": email, "user_role": role,
			"action": action, "target_type": targetType, "created_at": createdAt,
		})
	}
	return out, total, rows.Err()
}

// RoleDistribution returns counts of active professionals per role for analytics.
func (r *AdminRepository) RoleDistribution(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.db.Query(ctx,
		`SELECT role, COUNT(*) FROM public.dynax_users
		 WHERE is_active AND role NOT IN ('patient','admin') GROUP BY role ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var role string
		var n int64
		if err := rows.Scan(&role, &n); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"name": role, "value": n})
	}
	return out, rows.Err()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
