package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// ConnectionRepository manages professional ↔ patient links (the DX-PIN system).
type ConnectionRepository struct {
	db *db.Pool
}

func NewConnectionRepository(db *db.Pool) *ConnectionRepository {
	return &ConnectionRepository{db: db}
}

// ConnRef is a lightweight reference to a connected professional.
type ConnRef struct {
	ProfessionalID   string
	ProfessionalType string
}

// Create links a patient to a professional. If a (possibly ended) link already
// exists it is reactivated. Returns the resulting connection.
func (r *ConnectionRepository) Create(ctx context.Context, patientID, professionalID, professionalType, createdBy string) (*models.ProfessionalConnection, error) {
	const q = `
		INSERT INTO public.professional_patient_connections
		  (patient_id, professional_id, professional_type, status, created_by)
		VALUES ($1, $2, $3, 'active', $4)
		ON CONFLICT (patient_id, professional_id)
		DO UPDATE SET status = 'active', ended_at = NULL
		RETURNING id, patient_id, professional_id, status, connected_at`

	c := &models.ProfessionalConnection{}
	err := r.db.QueryRow(ctx, q, patientID, professionalID, professionalType, createdBy).Scan(
		&c.ID, &c.PatientID, &c.ProfessionalID, &c.Status, &c.ConnectedAt,
	)
	return c, err
}

// End marks a connection as ended (soft).
func (r *ConnectionRepository) End(ctx context.Context, patientID, professionalID string) error {
	const q = `
		UPDATE public.professional_patient_connections
		SET status = 'ended', ended_at = NOW()
		WHERE patient_id = $1 AND professional_id = $2`
	return r.db.ExecOne(ctx, q, patientID, professionalID)
}

// Exists reports whether an active link exists between a patient and professional.
func (r *ConnectionRepository) Exists(ctx context.Context, patientID, professionalID string) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1 FROM public.professional_patient_connections
			WHERE patient_id = $1 AND professional_id = $2 AND status = 'active'
		)`
	var ok bool
	return ok, r.db.QueryRow(ctx, q, patientID, professionalID).Scan(&ok)
}

// ListForPatient returns the active professional links for a patient.
func (r *ConnectionRepository) ListForPatient(ctx context.Context, patientID string) ([]ConnRef, error) {
	const q = `
		SELECT professional_id, professional_type
		FROM public.professional_patient_connections
		WHERE patient_id = $1 AND status = 'active'
		ORDER BY connected_at DESC`

	rows, err := r.db.Query(ctx, q, patientID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()

	var refs []ConnRef
	for rows.Next() {
		var ref ConnRef
		if err := rows.Scan(&ref.ProfessionalID, &ref.ProfessionalType); err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// ── One-time DX connection PINs ───────────────────────────────────────────────

// CreateDxPin stores a one-time connection PIN a professional issues for a
// patient's email. The PIN is emailed to the patient.
func (r *ConnectionRepository) CreateDxPin(ctx context.Context, professionalID, professionalType, patientEmail, pin string, ttl time.Duration) error {
	const q = `
		INSERT INTO public.dx_connection_pins
		  (professional_id, professional_type, patient_email, pin, expires_at)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, q, professionalID, professionalType, patientEmail, pin, time.Now().Add(ttl))
	return err
}

// ConsumeDxPin validates and marks a PIN used for a given professional. It
// returns the professional_type captured when the PIN was issued.
func (r *ConnectionRepository) ConsumeDxPin(ctx context.Context, professionalID, pin, usedBy string) (professionalType string, ok bool, err error) {
	const q = `
		UPDATE public.dx_connection_pins
		SET used = TRUE, used_by = $3
		WHERE id = (
			SELECT id FROM public.dx_connection_pins
			WHERE professional_id = $1 AND pin = $2 AND used = FALSE AND expires_at > NOW()
			ORDER BY created_at DESC LIMIT 1
		)
		RETURNING professional_type`
	err = r.db.QueryRow(ctx, q, professionalID, pin, usedBy).Scan(&professionalType)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return professionalType, true, nil
}

// ConsumeDxPinByCode resolves the professional from the PIN alone (the PIN is
// unique and unguessable), validates it, marks it used, and returns both the
// professional id and their type.
func (r *ConnectionRepository) ConsumeDxPinByCode(ctx context.Context, pin, usedBy string) (professionalID, professionalType string, ok bool, err error) {
	const q = `
		UPDATE public.dx_connection_pins
		SET used = TRUE, used_by = $2
		WHERE id = (
			SELECT id FROM public.dx_connection_pins
			WHERE pin = $1 AND used = FALSE AND expires_at > NOW()
			ORDER BY created_at DESC LIMIT 1
		)
		RETURNING professional_id, professional_type`
	err = r.db.QueryRow(ctx, q, pin, usedBy).Scan(&professionalID, &professionalType)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return professionalID, professionalType, true, nil
}
