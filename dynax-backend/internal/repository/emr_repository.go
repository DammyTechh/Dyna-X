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
	tasks := req.Tasks
	if len(tasks) == 0 {
		tasks = json.RawMessage("[]")
	}
	shared := true
	if req.SharedWithPatient != nil {
		shared = *req.SharedWithPatient
	}
	const q = `
		INSERT INTO public.care_plans
		  (patient_id, professional_id, title, description, goals, start_date, end_date, tasks, shared_with_patient)
		VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8::jsonb,$9)
		RETURNING id, status, created_at, updated_at`
	p := &models.CarePlan{
		PatientID: req.PatientID, ProfessionalID: professionalID, Title: req.Title,
		Description: nilIfEmptyStr(req.Description), Goals: req.Goals, StartDate: req.StartDate,
		EndDate: nilIfEmptyStr(req.EndDate), Tasks: tasks, SharedWithPatient: shared,
	}
	err := r.db.QueryRow(ctx, q, p.PatientID, p.ProfessionalID, p.Title, p.Description,
		p.Goals, p.StartDate, p.EndDate, string(tasks), shared).Scan(&p.ID, &p.Status, &p.CreatedAt, &p.UpdatedAt)
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
			&p.Goals, &p.StartDate, &p.EndDate, &p.Status, &p.ProgressNotes, &p.Tasks, &p.SharedWithPatient, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

const carePlanCols = `id, patient_id, professional_id, title, description, goals,
		start_date::text, end_date::text, status, progress_notes, tasks, shared_with_patient, created_at, updated_at`

func (r *EMRRepository) ListCarePlans(ctx context.Context, professionalID, patientID string) ([]models.CarePlan, error) {
	return r.scanCarePlans(ctx,
		`SELECT `+carePlanCols+` FROM public.care_plans
		 WHERE professional_id=$1 AND patient_id=$2 ORDER BY created_at DESC`,
		professionalID, patientID)
}

func (r *EMRRepository) ListCarePlansForPatient(ctx context.Context, patientID string) ([]models.CarePlan, error) {
	return r.scanCarePlans(ctx,
		`SELECT `+carePlanCols+` FROM public.care_plans
		 WHERE patient_id=$1 AND shared_with_patient = true ORDER BY created_at DESC`, patientID)
}

// UpdateCarePlanTasks lets a patient update the task checklist on their own plan.
func (r *EMRRepository) UpdateCarePlanTasks(ctx context.Context, patientID, planID string, tasks json.RawMessage) (*models.CarePlan, error) {
	if len(tasks) == 0 {
		tasks = json.RawMessage("[]")
	}
	if err := r.db.ExecOne(ctx,
		`UPDATE public.care_plans SET tasks=$1::jsonb, updated_at=NOW()
		 WHERE id=$2 AND patient_id=$3`,
		string(tasks), planID, patientID); err != nil {
		return nil, err
	}
	plans, err := r.scanCarePlans(ctx, `SELECT `+carePlanCols+` FROM public.care_plans WHERE id=$1`, planID)
	if err != nil || len(plans) == 0 {
		return nil, err
	}
	return &plans[0], nil
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
		  (patient_id, professional_id, device_type, body_region, measurements, notes, model_3d_url, stl_file_url)
		VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
		RETURNING id, status, created_at, updated_at`
	d := &models.DeviceMeasurement{
		PatientID: req.PatientID, ProfessionalID: professionalID,
		DeviceType: req.DeviceType, BodyRegion: req.BodyRegion,
		Measurements: req.Measurements, Notes: nilIfEmptyStr(req.Notes),
		Model3DURL: nilIfEmptyStr(req.Model3DURL), STLFileURL: nilIfEmptyStr(req.STLFileURL),
	}
	err := r.db.QueryRow(ctx, q, d.PatientID, d.ProfessionalID, d.DeviceType, d.BodyRegion,
		string(raw), d.Notes, d.Model3DURL, d.STLFileURL).Scan(&d.ID, &d.Status, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

const deviceCols = `id, patient_id, professional_id, device_type, body_region, measurements, notes, status, model_3d_url, stl_file_url, created_at, updated_at`

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
			&meas, &d.Notes, &d.Status, &d.Model3DURL, &d.STLFileURL, &d.CreatedAt, &d.UpdatedAt); err != nil {
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

// ─── Patient Records ─────────────────────────────────────────────────────────

const patientRecordCols = `id, professional_id, full_name, date_of_birth::text, gender, phone, email, address,
	clinical_history, case_notes, assessment_findings, progress_notes, outcome_measures,
	measurements, attachments, created_at, updated_at`

func (r *EMRRepository) scanPatientRecords(ctx context.Context, query string, args ...interface{}) ([]models.PatientRecord, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.PatientRecord{}
	for rows.Next() {
		var p models.PatientRecord
		if err := rows.Scan(&p.ID, &p.ProfessionalID, &p.FullName, &p.DateOfBirth, &p.Gender, &p.Phone, &p.Email, &p.Address,
			&p.ClinicalHistory, &p.CaseNotes, &p.AssessmentFindings, &p.ProgressNotes, &p.OutcomeMeasures,
			&p.Measurements, &p.Attachments, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *EMRRepository) CreatePatientRecord(ctx context.Context, professionalID string, req *models.CreatePatientRecordRequest) (*models.PatientRecord, error) {
	measurements := req.Measurements
	if len(measurements) == 0 {
		measurements = json.RawMessage("{}")
	}
	attachments := req.Attachments
	if len(attachments) == 0 {
		attachments = json.RawMessage("[]")
	}
	const q = `
		INSERT INTO public.patient_records
		  (professional_id, full_name, date_of_birth, gender, phone, email, address,
		   clinical_history, case_notes, assessment_findings, progress_notes, outcome_measures,
		   measurements, attachments)
		VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
		RETURNING id, created_at, updated_at`
	rec := &models.PatientRecord{
		ProfessionalID: professionalID, FullName: req.FullName,
		DateOfBirth: nilIfEmptyStr(req.DateOfBirth), Gender: nilIfEmptyStr(req.Gender),
		Phone: nilIfEmptyStr(req.Phone), Email: nilIfEmptyStr(req.Email), Address: nilIfEmptyStr(req.Address),
		ClinicalHistory: nilIfEmptyStr(req.ClinicalHistory), CaseNotes: nilIfEmptyStr(req.CaseNotes),
		AssessmentFindings: nilIfEmptyStr(req.AssessmentFindings), ProgressNotes: nilIfEmptyStr(req.ProgressNotes),
		OutcomeMeasures: nilIfEmptyStr(req.OutcomeMeasures), Measurements: measurements, Attachments: attachments,
	}
	err := r.db.QueryRow(ctx, q,
		rec.ProfessionalID, rec.FullName, rec.DateOfBirth, rec.Gender, rec.Phone, rec.Email, rec.Address,
		rec.ClinicalHistory, rec.CaseNotes, rec.AssessmentFindings, rec.ProgressNotes, rec.OutcomeMeasures,
		string(measurements), string(attachments),
	).Scan(&rec.ID, &rec.CreatedAt, &rec.UpdatedAt)
	return rec, err
}

func (r *EMRRepository) ListPatientRecords(ctx context.Context, professionalID string) ([]models.PatientRecord, error) {
	return r.scanPatientRecords(ctx,
		`SELECT `+patientRecordCols+` FROM public.patient_records
		 WHERE professional_id=$1 ORDER BY updated_at DESC`, professionalID)
}

func (r *EMRRepository) GetPatientRecord(ctx context.Context, professionalID, recordID string) (*models.PatientRecord, error) {
	recs, err := r.scanPatientRecords(ctx,
		`SELECT `+patientRecordCols+` FROM public.patient_records WHERE id=$1 AND professional_id=$2`,
		recordID, professionalID)
	if err != nil || len(recs) == 0 {
		return nil, err
	}
	return &recs[0], nil
}

func (r *EMRRepository) UpdatePatientRecord(ctx context.Context, professionalID, recordID string, req *models.CreatePatientRecordRequest) (*models.PatientRecord, error) {
	measurements := req.Measurements
	if len(measurements) == 0 {
		measurements = json.RawMessage("{}")
	}
	attachments := req.Attachments
	if len(attachments) == 0 {
		attachments = json.RawMessage("[]")
	}
	if err := r.db.ExecOne(ctx,
		`UPDATE public.patient_records SET
		   full_name=$3, date_of_birth=$4::date, gender=$5, phone=$6, email=$7, address=$8,
		   clinical_history=$9, case_notes=$10, assessment_findings=$11, progress_notes=$12,
		   outcome_measures=$13, measurements=$14::jsonb, attachments=$15::jsonb, updated_at=NOW()
		 WHERE id=$1 AND professional_id=$2`,
		recordID, professionalID, req.FullName, nilIfEmptyStr(req.DateOfBirth), nilIfEmptyStr(req.Gender),
		nilIfEmptyStr(req.Phone), nilIfEmptyStr(req.Email), nilIfEmptyStr(req.Address),
		nilIfEmptyStr(req.ClinicalHistory), nilIfEmptyStr(req.CaseNotes), nilIfEmptyStr(req.AssessmentFindings),
		nilIfEmptyStr(req.ProgressNotes), nilIfEmptyStr(req.OutcomeMeasures),
		string(measurements), string(attachments)); err != nil {
		return nil, err
	}
	return r.GetPatientRecord(ctx, professionalID, recordID)
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const followUpCols = `id, patient_id, professional_id, cadence, due_date::text, status, note, patient_response, needs_reevaluation, created_at, updated_at`

func (r *EMRRepository) scanFollowUps(ctx context.Context, query string, args ...interface{}) ([]models.FollowUp, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.FollowUp{}
	for rows.Next() {
		var f models.FollowUp
		if err := rows.Scan(&f.ID, &f.PatientID, &f.ProfessionalID, &f.Cadence, &f.DueDate,
			&f.Status, &f.Note, &f.PatientResponse, &f.NeedsReevaluation, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *EMRRepository) CreateFollowUp(ctx context.Context, professionalID string, req *models.CreateFollowUpRequest) (*models.FollowUp, error) {
	cadence := req.Cadence
	if cadence == "" {
		cadence = "custom"
	}
	fs, err := r.scanFollowUps(ctx,
		`INSERT INTO public.follow_ups (patient_id, professional_id, cadence, due_date, note)
		 VALUES ($1,$2,$3,$4::date,$5) RETURNING `+followUpCols,
		req.PatientID, professionalID, cadence, req.DueDate, nilIfEmptyStr(req.Note))
	if err != nil || len(fs) == 0 {
		return nil, err
	}
	return &fs[0], nil
}

func (r *EMRRepository) ListFollowUpsForProfessional(ctx context.Context, professionalID string) ([]models.FollowUp, error) {
	return r.scanFollowUps(ctx, `SELECT `+followUpCols+` FROM public.follow_ups WHERE professional_id=$1 ORDER BY due_date ASC`, professionalID)
}

func (r *EMRRepository) ListFollowUpsForPatient(ctx context.Context, patientID string) ([]models.FollowUp, error) {
	return r.scanFollowUps(ctx, `SELECT `+followUpCols+` FROM public.follow_ups WHERE patient_id=$1 ORDER BY due_date ASC`, patientID)
}

func (r *EMRRepository) RespondFollowUp(ctx context.Context, id, patientID, response string, needsReeval bool) (*models.FollowUp, error) {
	status := "completed"
	if needsReeval {
		status = "flagged"
	}
	if err := r.db.ExecOne(ctx,
		`UPDATE public.follow_ups SET patient_response=$3, needs_reevaluation=$4, status=$5, updated_at=NOW()
		 WHERE id=$1 AND patient_id=$2`, id, patientID, response, needsReeval, status); err != nil {
		return nil, err
	}
	fs, err := r.scanFollowUps(ctx, `SELECT `+followUpCols+` FROM public.follow_ups WHERE id=$1`, id)
	if err != nil || len(fs) == 0 {
		return nil, err
	}
	return &fs[0], nil
}
