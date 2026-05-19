package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// ─── Appointment Repository ───────────────────────────────────────────────────

type AppointmentRepository struct {
	db *db.Pool
}

func NewAppointmentRepository(db *db.Pool) *AppointmentRepository {
	return &AppointmentRepository{db: db}
}

// Create inserts a new appointment.
func (r *AppointmentRepository) Create(ctx context.Context, a *models.Appointment) (*models.Appointment, error) {
	const q = `
		INSERT INTO public.appointments
		  (patient_id, professional_id, professional_type, title, description,
		   scheduled_at, duration_minutes, session_type, meeting_url)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, status, created_at, updated_at`

	err := r.db.QueryRow(ctx, q,
		a.PatientID, a.ProfessionalID, "physiotherapist", a.Title, a.Description,
		a.ScheduledAt, a.DurationMinutes, a.SessionType, a.MeetingURL,
	).Scan(&a.ID, &a.Status, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

// FindByID returns a single appointment.
func (r *AppointmentRepository) FindByID(ctx context.Context, id string) (*models.Appointment, error) {
	const q = `
		SELECT id, patient_id, professional_id, title, description,
		       scheduled_at, duration_minutes, session_type, status,
		       meeting_url, notes, completed_at, created_at, updated_at
		FROM public.appointments
		WHERE id = $1 LIMIT 1`

	a := &models.Appointment{}
	err := r.db.QueryRow(ctx, q, id).Scan(
		&a.ID, &a.PatientID, &a.ProfessionalID, &a.Title, &a.Description,
		&a.ScheduledAt, &a.DurationMinutes, &a.SessionType, &a.Status,
		&a.MeetingURL, &a.Notes, &a.CompletedAt, &a.CreatedAt, &a.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return a, err
}

// ListByProfessional returns paginated appointments for a professional.
func (r *AppointmentRepository) ListByProfessional(ctx context.Context, professionalID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	const countQ = `SELECT COUNT(*) FROM public.appointments WHERE professional_id = $1`
	var total int64
	if err := r.db.QueryRow(ctx, countQ, professionalID).Scan(&total); err != nil {
		return nil, 0, err
	}

	const listQ = `
		SELECT id, patient_id, professional_id, title, description,
		       scheduled_at, duration_minutes, session_type, status,
		       meeting_url, notes, completed_at, created_at, updated_at
		FROM public.appointments
		WHERE professional_id = $1
		ORDER BY scheduled_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanAppointments(ctx, listQ, professionalID, q.PageSize, q.Offset())
}

// ListByPatient returns paginated appointments for a patient.
func (r *AppointmentRepository) ListByPatient(ctx context.Context, patientID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	const countQ = `SELECT COUNT(*) FROM public.appointments WHERE patient_id = $1`
	var total int64
	if err := r.db.QueryRow(ctx, countQ, patientID).Scan(&total); err != nil {
		return nil, 0, err
	}

	const listQ = `
		SELECT id, patient_id, professional_id, title, description,
		       scheduled_at, duration_minutes, session_type, status,
		       meeting_url, notes, completed_at, created_at, updated_at
		FROM public.appointments
		WHERE patient_id = $1
		ORDER BY scheduled_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanAppointments(ctx, listQ, patientID, q.PageSize, q.Offset())
}

// UpdateStatus changes the status of an appointment.
func (r *AppointmentRepository) UpdateStatus(ctx context.Context, id, status string) error {
	q := `UPDATE public.appointments SET status = $2, updated_at = NOW() WHERE id = $1`
	if status == "completed" {
		q = `UPDATE public.appointments SET status = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1`
	}
	if status == "cancelled" {
		q = `UPDATE public.appointments SET status = $2, cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`
	}
	return r.db.ExecOne(ctx, q, id, status)
}

// ─── scan helper ─────────────────────────────────────────────────────────────

func (r *AppointmentRepository) scanAppointments(ctx context.Context, query string, args ...interface{}) ([]models.Appointment, int64, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var appts []models.Appointment
	for rows.Next() {
		var a models.Appointment
		if err := rows.Scan(
			&a.ID, &a.PatientID, &a.ProfessionalID, &a.Title, &a.Description,
			&a.ScheduledAt, &a.DurationMinutes, &a.SessionType, &a.Status,
			&a.MeetingURL, &a.Notes, &a.CompletedAt, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		appts = append(appts, a)
	}
	return appts, int64(len(appts)), nil
}

// ─── Therapy Session Repository ───────────────────────────────────────────────

type SessionRepository struct {
	db *db.Pool
}

func NewSessionRepository(db *db.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

// Create inserts a new therapy session log.
func (r *SessionRepository) Create(ctx context.Context, s *models.TherapySession) (*models.TherapySession, error) {
	const q = `
		INSERT INTO public.therapy_sessions
		  (patient_id, professional_id, appointment_id, professional_type,
		   session_date, duration_minutes, session_type, status,
		   subjective_note, objective_note, assessment_note, plan_note)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9,$10,$11)
		RETURNING id, status, created_at, updated_at`

	err := r.db.QueryRow(ctx, q,
		s.PatientID, s.ProfessionalID, s.AppointmentID, s.SessionType,
		s.SessionDate, s.DurationMins, s.SessionType,
		s.SubjectiveNote, s.ObjectiveNote, s.AssessmentNote, s.PlanNote,
	).Scan(&s.ID, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

// FindByID returns a single session by ID.
func (r *SessionRepository) FindByID(ctx context.Context, id string) (*models.TherapySession, error) {
	const q = `
		SELECT id, patient_id, professional_id, appointment_id, session_date,
		       duration_minutes, session_type, status,
		       subjective_note, objective_note, assessment_note, plan_note,
		       goals_achieved, patient_rating, created_at, updated_at
		FROM public.therapy_sessions
		WHERE id = $1 LIMIT 1`

	s := &models.TherapySession{}
	err := r.db.QueryRow(ctx, q, id).Scan(
		&s.ID, &s.PatientID, &s.ProfessionalID, &s.AppointmentID, &s.SessionDate,
		&s.DurationMins, &s.SessionType, &s.Status,
		&s.SubjectiveNote, &s.ObjectiveNote, &s.AssessmentNote, &s.PlanNote,
		&s.GoalsAchieved, &s.PatientRating, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return s, err
}

// ListByProfessional returns paginated sessions for a professional.
func (r *SessionRepository) ListByProfessional(ctx context.Context, professionalID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	const countQ = `SELECT COUNT(*) FROM public.therapy_sessions WHERE professional_id = $1`
	var total int64
	if err := r.db.QueryRow(ctx, countQ, professionalID).Scan(&total); err != nil {
		return nil, 0, err
	}

	const listQ = `
		SELECT id, patient_id, professional_id, appointment_id, session_date,
		       duration_minutes, session_type, status,
		       subjective_note, objective_note, assessment_note, plan_note,
		       goals_achieved, patient_rating, created_at, updated_at
		FROM public.therapy_sessions
		WHERE professional_id = $1
		ORDER BY session_date DESC
		LIMIT $2 OFFSET $3`

	return r.scanSessions(ctx, listQ, professionalID, q.PageSize, q.Offset())
}

// ListByPatient returns paginated sessions for a patient.
func (r *SessionRepository) ListByPatient(ctx context.Context, patientID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	const countQ = `SELECT COUNT(*) FROM public.therapy_sessions WHERE patient_id = $1`
	var total int64
	if err := r.db.QueryRow(ctx, countQ, patientID).Scan(&total); err != nil {
		return nil, 0, err
	}

	const listQ = `
		SELECT id, patient_id, professional_id, appointment_id, session_date,
		       duration_minutes, session_type, status,
		       subjective_note, objective_note, assessment_note, plan_note,
		       goals_achieved, patient_rating, created_at, updated_at
		FROM public.therapy_sessions
		WHERE patient_id = $1
		ORDER BY session_date DESC
		LIMIT $2 OFFSET $3`

	return r.scanSessions(ctx, listQ, patientID, q.PageSize, q.Offset())
}

// ─── scan helper ─────────────────────────────────────────────────────────────

func (r *SessionRepository) scanSessions(ctx context.Context, query string, args ...interface{}) ([]models.TherapySession, int64, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sessions []models.TherapySession
	for rows.Next() {
		var s models.TherapySession
		if err := rows.Scan(
			&s.ID, &s.PatientID, &s.ProfessionalID, &s.AppointmentID, &s.SessionDate,
			&s.DurationMins, &s.SessionType, &s.Status,
			&s.SubjectiveNote, &s.ObjectiveNote, &s.AssessmentNote, &s.PlanNote,
			&s.GoalsAchieved, &s.PatientRating, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		sessions = append(sessions, s)
	}

	// Return real count (not estimated)
	if len(sessions) == 0 {
		return nil, 0, nil
	}
	_ = fmt.Sprintf // keep import
	return sessions, int64(len(sessions)), nil
}
