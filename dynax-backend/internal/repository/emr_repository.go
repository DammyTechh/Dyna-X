package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// EMRRepository handles clinical notes, care plans, device measurements,
// and the device share/comment collaboration tables.
type EMRRepository struct{ db *db.Pool }

func NewEMRRepository(db *db.Pool) *EMRRepository { return &EMRRepository{db: db} }

// ── Clinical notes ────────────────────────────────────────────────────────────

func (r *EMRRepository) CreateNote(ctx context.Context, professionalID string, req *models.CreateClinicalNoteRequest) (*models.ClinicalNote, error) {
	const q = `
		INSERT INTO public.clinical_notes
		  (patient_id, professional_id, session_id, note_type, title, content, diagnosis_codes, is_confidential)
		VALUES ($1,$2,$3,$4::note_type,$5,$6,$7,$8)
		RETURNING id, created_at, updated_at`
	n := &models.ClinicalNote{
		PatientID: req.PatientID, ProfessionalID: professionalID,
		SessionID: nilIfEmptyStr(req.SessionID), NoteType: req.NoteType,
		Title: req.Title, Content: req.Content, DiagnosisCodes: req.DiagnosisCodes,
		IsConfidential: req.IsConfidential,
	}
	err := r.db.QueryRow(ctx, q, n.PatientID, n.ProfessionalID, n.SessionID, n.NoteType,
		n.Title, n.Content, n.DiagnosisCodes, n.IsConfidential).
		Scan(&n.ID, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func (r *EMRRepository) ListNotes(ctx context.Context, professionalID, patientID string, q *models.PaginationQuery) ([]models.ClinicalNote, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.clinical_notes WHERE professional_id=$1 AND patient_id=$2 AND is_deleted=FALSE`,
		professionalID, patientID).Scan(&total); err != nil {
		return nil, 0, err
	}
	const list = `
		SELECT id, patient_id, professional_id, session_id, note_type, title, content,
		       diagnosis_codes, is_confidential, created_at, updated_at
		FROM public.clinical_notes
		WHERE professional_id=$1 AND patient_id=$2 AND is_deleted=FALSE
		ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	rows, err := r.db.Query(ctx, list, professionalID, patientID, q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.ClinicalNote{}
	for rows.Next() {
		var n models.ClinicalNote
		if err := rows.Scan(&n.ID, &n.PatientID, &n.ProfessionalID, &n.SessionID, &n.NoteType,
			&n.Title, &n.Content, &n.DiagnosisCodes, &n.IsConfidential, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, n)
	}
	return out, total, rows.Err()
}

func (r *EMRRepository) GetNote(ctx context.Context, professionalID, noteID string) (*models.ClinicalNote, error) {
	const q = `
		SELECT id, patient_id, professional_id, session_id, note_type, title, content,
		       diagnosis_codes, is_confidential, created_at, updated_at
		FROM public.clinical_notes
		WHERE id=$1 AND professional_id=$2 AND is_deleted=FALSE LIMIT 1`
	n := &models.ClinicalNote{}
	err := r.db.QueryRow(ctx, q, noteID, professionalID).Scan(
		&n.ID, &n.PatientID, &n.ProfessionalID, &n.SessionID, &n.NoteType,
		&n.Title, &n.Content, &n.DiagnosisCodes, &n.IsConfidential, &n.CreatedAt, &n.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return n, err
}

func (r *EMRRepository) UpdateNote(ctx context.Context, professionalID, noteID, content string) error {
	return r.db.ExecOne(ctx,
		`UPDATE public.clinical_notes SET content=$3, updated_at=NOW() WHERE id=$1 AND professional_id=$2`,
		noteID, professionalID, content)
}

func (r *EMRRepository) DeleteNote(ctx context.Context, professionalID, noteID string) error {
	return r.db.ExecOne(ctx,
		`UPDATE public.clinical_notes SET is_deleted=TRUE, deleted_at=NOW() WHERE id=$1 AND professional_id=$2`,
		noteID, professionalID)
}

// ── Care plans ────────────────────────────────────────────────────────────────

func (r *EMRRepository) CreateCarePlan(ctx context.Context, professionalID string, req *models.CreateCarePlanRequest) (*models.CarePlan, error) {
	const q = `
		INSERT INTO public.care_plans
		  (patient_id, professional_id, title, description, goals, start_date, end_date)
		VALUES ($1,$2,$3,$4,$5,$6::date,$7::date)
		RETURNING id, status, created_at, updated_at`
	p := &models.CarePlan{
		PatientID: req.PatientID, ProfessionalID: professionalID, Title: req.Title,
		Description: nilIfEmptyStr(req.Description), Goals: req.Goals, StartDate: req.StartDate,
		EndDate: nilIfEmptyStr(req.EndDate),
	}
	err := r.db.QueryRow(ctx, q, p.PatientID, p.ProfessionalID, p.Title, p.Description,
		p.Goals, p.StartDate, p.EndDate).Scan(&p.ID, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func (r *EMRRepository) scanCarePlans(ctx context.Context, query string, args ...interface{}) ([]models.CarePlan, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.CarePlan{}
	for rows.Next() {
		var p models.CarePlan
		if err := rows.Scan(&p.ID, &p.PatientID, &p.ProfessionalID, &p.Title, &p.Description,
			&p.Goals, &p.StartDate, &p.EndDate, &p.Status, &p.ProgressNotes, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

const carePlanCols = `id, patient_id, professional_id, title, description, goals,
		start_date::text, end_date::text, status, progress_notes, created_at, updated_at`

func (r *EMRRepository) ListCarePlans(ctx context.Context, professionalID, patientID string) ([]models.CarePlan, error) {
	return r.scanCarePlans(ctx,
		`SELECT `+carePlanCols+` FROM public.care_plans
		 WHERE professional_id=$1 AND patient_id=$2 ORDER BY created_at DESC`,
		professionalID, patientID)
}

func (r *EMRRepository) ListCarePlansForPatient(ctx context.Context, patientID string) ([]models.CarePlan, error) {
	return r.scanCarePlans(ctx,
		`SELECT `+carePlanCols+` FROM public.care_plans
		 WHERE patient_id=$1 ORDER BY created_at DESC`, patientID)
}

func (r *EMRRepository) UpdateCarePlan(ctx context.Context, professionalID, planID string, status, notes *string) (*models.CarePlan, error) {
	if err := r.db.ExecOne(ctx,
		`UPDATE public.care_plans
		 SET status = COALESCE($3::care_plan_status, status),
		     progress_notes = COALESCE($4, progress_notes),
		     updated_at = NOW()
		 WHERE id=$1 AND professional_id=$2`,
		planID, professionalID, status, notes); err != nil {
		return nil, err
	}
	plans, err := r.scanCarePlans(ctx, `SELECT `+carePlanCols+` FROM public.care_plans WHERE id=$1`, planID)
	if err != nil || len(plans) == 0 {
		return nil, err
	}
	return &plans[0], nil
}

// ── Device measurements ───────────────────────────────────────────────────────

func (r *EMRRepository) CreateDevice(ctx context.Context, professionalID string, req *models.CreateDeviceMeasurementRequest) (*models.DeviceMeasurement, error) {
	raw, _ := json.Marshal(req.Measurements)
	const q = `
		INSERT INTO public.device_measurements
		  (patient_id, professional_id, device_type, body_region, measurements, notes)
		VALUES ($1,$2,$3,$4,$5::jsonb,$6)
		RETURNING id, status, created_at, updated_at`
	d := &models.DeviceMeasurement{
		PatientID: req.PatientID, ProfessionalID: professionalID,
		DeviceType: req.DeviceType, BodyRegion: req.BodyRegion,
		Measurements: req.Measurements, Notes: nilIfEmptyStr(req.Notes),
	}
	err := r.db.QueryRow(ctx, q, d.PatientID, d.ProfessionalID, d.DeviceType, d.BodyRegion,
		string(raw), d.Notes).Scan(&d.ID, &d.Status, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

const deviceCols = `id, patient_id, professional_id, device_type, body_region, measurements, notes, status, created_at, updated_at`

func (r *EMRRepository) scanDevices(ctx context.Context, query string, args ...interface{}) ([]models.DeviceMeasurement, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.DeviceMeasurement{}
	for rows.Next() {
		var d models.DeviceMeasurement
		var meas []byte
		if err := rows.Scan(&d.ID, &d.PatientID, &d.ProfessionalID, &d.DeviceType, &d.BodyRegion,
			&meas, &d.Notes, &d.Status, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meas, &d.Measurements)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *EMRRepository) ListDevices(ctx context.Context, professionalID, patientID string) ([]models.DeviceMeasurement, error) {
	return r.scanDevices(ctx,
		`SELECT `+deviceCols+` FROM public.device_measurements
		 WHERE professional_id=$1 AND patient_id=$2 ORDER BY created_at DESC`,
		professionalID, patientID)
}

func (r *EMRRepository) FindDeviceByID(ctx context.Context, deviceID string) (*models.DeviceMeasurement, error) {
	devs, err := r.scanDevices(ctx, `SELECT `+deviceCols+` FROM public.device_measurements WHERE id=$1`, deviceID)
	if err != nil || len(devs) == 0 {
		return nil, err
	}
	return &devs[0], nil
}

func (r *EMRRepository) UpdateDeviceStatus(ctx context.Context, professionalID, deviceID, status string) (*models.DeviceMeasurement, error) {
	if err := r.db.ExecOne(ctx,
		`UPDATE public.device_measurements SET status=$3::device_status, updated_at=NOW()
		 WHERE id=$1 AND professional_id=$2`,
		deviceID, professionalID, status); err != nil {
		return nil, err
	}
	return r.FindDeviceByID(ctx, deviceID)
}

// ── Device share + comments (3D editor collaboration) ─────────────────────────

type DeviceShare struct {
	ID         string  `json:"id"`
	DeviceID   string  `json:"device_id"`
	Token      string  `json:"token"`
	Permission string  `json:"permission"`
	URL        string  `json:"url,omitempty"`
	ExpiresAt  *string `json:"expires_at,omitempty"`
	CreatedAt  string  `json:"created_at"`
}

type DeviceComment struct {
	ID         string `json:"id"`
	DeviceID   string `json:"device_id"`
	AuthorID   string `json:"author_id"`
	AuthorName string `json:"author_name"`
	AuthorRole string `json:"author_role"`
	Content    string `json:"content"`
	CreatedAt  string `json:"created_at"`
}

func (r *EMRRepository) CreateShare(ctx context.Context, deviceID, token, permission, createdBy string) (*DeviceShare, error) {
	const q = `
		INSERT INTO public.device_shares (device_id, token, permission, created_by)
		VALUES ($1,$2,$3,$4)
		RETURNING id, device_id, token, permission, created_at::text`
	s := &DeviceShare{}
	err := r.db.QueryRow(ctx, q, deviceID, token, permission, createdBy).
		Scan(&s.ID, &s.DeviceID, &s.Token, &s.Permission, &s.CreatedAt)
	return s, err
}

// GetShareByToken returns the device id + permission for a share token.
func (r *EMRRepository) GetShareByToken(ctx context.Context, token string) (deviceID, permission string, err error) {
	const q = `
		SELECT device_id, permission FROM public.device_shares
		WHERE token=$1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`
	err = r.db.QueryRow(ctx, q, token).Scan(&deviceID, &permission)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrOTPInvalid // reuse generic "invalid" sentinel
	}
	return deviceID, permission, err
}

func (r *EMRRepository) ListComments(ctx context.Context, deviceID string) ([]DeviceComment, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, device_id, author_id, author_name, author_role, content, created_at::text
		 FROM public.device_comments WHERE device_id=$1 ORDER BY created_at ASC`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DeviceComment{}
	for rows.Next() {
		var c DeviceComment
		if err := rows.Scan(&c.ID, &c.DeviceID, &c.AuthorID, &c.AuthorName, &c.AuthorRole, &c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *EMRRepository) AddComment(ctx context.Context, deviceID, authorID, authorName, authorRole, content string) (*DeviceComment, error) {
	const q = `
		INSERT INTO public.device_comments (device_id, author_id, author_name, author_role, content)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, device_id, author_id, author_name, author_role, content, created_at::text`
	c := &DeviceComment{}
	err := r.db.QueryRow(ctx, q, deviceID, authorID, authorName, authorRole, content).
		Scan(&c.ID, &c.DeviceID, &c.AuthorID, &c.AuthorName, &c.AuthorRole, &c.Content, &c.CreatedAt)
	return c, err
}

// nilIfEmptyStr mirrors the services helper for repo-local use.
func nilIfEmptyStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
