package repository

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// RehabCreditRepository handles Mediloan-backed Rehab Credit plans, the session
// releases that pay physios, and the repayment checks an admin marks from
// Mediloan's report. No method here changes a financial status on its own —
// every transition is driven by an explicit admin or confirmation action.
type RehabCreditRepository struct{ db *db.Pool }

func NewRehabCreditRepository(db *db.Pool) *RehabCreditRepository {
	return &RehabCreditRepository{db: db}
}

// Sentinel errors the service layer maps onto user-facing responses.
var (
	ErrPlanNotFound      = errors.New("plan_not_found")
	ErrPlanSuspended     = errors.New("plan_suspended")
	ErrPlanNotActive     = errors.New("plan_not_active")
	ErrPlanNotPending    = errors.New("plan_not_pending")
	ErrReleaseNotFound   = errors.New("release_not_found")
	ErrReleaseNotPayable = errors.New("release_not_payable")
	ErrReleaseNotOpen    = errors.New("release_not_open_for_confirmation")
	ErrNotOnThisPlan     = errors.New("not_a_party_to_this_plan")
	ErrCheckNotFound     = errors.New("repayment_check_not_found")
)

// confirmMiss explains why a confirmation matched no rows: either the release
// has already moved past 'pending', or the caller is not the party the WHERE
// clause pinned. Without this the two cases are indistinguishable and a
// double-confirm reads as a permissions failure.
func (r *RehabCreditRepository) confirmMiss(ctx context.Context, releaseID string) error {
	rel, err := r.GetRelease(ctx, releaseID)
	if err != nil {
		return err
	}
	if rel.Status != "pending" {
		return ErrReleaseNotOpen
	}
	return ErrNotOnThisPlan
}

const rehabPlanCols = `id, patient_id, physio_id, total_credit_amount, session_rate,
	sessions_total, sessions_released, duration_months, mediloan_ref, status,
	consecutive_missed_payments, escalation_notified_at_count, review_notes,
	reviewed_by, reviewed_at, created_at, updated_at`

func (r *RehabCreditRepository) scanPlans(ctx context.Context, query string, args ...interface{}) ([]models.RehabCreditPlan, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RehabCreditPlan{}
	for rows.Next() {
		var p models.RehabCreditPlan
		if err := rows.Scan(&p.ID, &p.PatientID, &p.PhysioID, &p.TotalCreditAmount, &p.SessionRate,
			&p.SessionsTotal, &p.SessionsReleased, &p.DurationMonths, &p.MediloanRef, &p.Status,
			&p.ConsecutiveMissedPayments, &p.EscalationNotifiedAtCount, &p.ReviewNotes,
			&p.ReviewedBy, &p.ReviewedAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// rehabPlanColsNamed is rehabPlanCols qualified with the "p" alias plus the two
// display names joined from the profile tables. Used by the read paths only —
// an INSERT/UPDATE ... RETURNING cannot join, so those keep scanPlans.
const rehabPlanColsNamed = `p.id, p.patient_id, p.physio_id, p.total_credit_amount, p.session_rate,
	p.sessions_total, p.sessions_released, p.duration_months, p.mediloan_ref, p.status,
	p.consecutive_missed_payments, p.escalation_notified_at_count, p.review_notes,
	p.reviewed_by, p.reviewed_at, p.created_at, p.updated_at,
	COALESCE(pp.full_name, ''), COALESCE(tp.full_name, '')`

// rehabPlanNameJoins resolves the patient's and physio's display names, mirroring
// the join ListPendingPayouts uses. LEFT JOINs so a plan with no physio assigned
// yet (still pending_admin) still comes back.
const rehabPlanNameJoins = `
	FROM public.rehab_credit_plans p
	LEFT JOIN public.patient_profiles   pp ON pp.user_id = p.patient_id
	LEFT JOIN public.therapist_profiles tp ON tp.user_id = p.physio_id`

func (r *RehabCreditRepository) scanPlansNamed(ctx context.Context, query string, args ...interface{}) ([]models.RehabCreditPlan, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RehabCreditPlan{}
	for rows.Next() {
		var p models.RehabCreditPlan
		if err := rows.Scan(&p.ID, &p.PatientID, &p.PhysioID, &p.TotalCreditAmount, &p.SessionRate,
			&p.SessionsTotal, &p.SessionsReleased, &p.DurationMonths, &p.MediloanRef, &p.Status,
			&p.ConsecutiveMissedPayments, &p.EscalationNotifiedAtCount, &p.ReviewNotes,
			&p.ReviewedBy, &p.ReviewedAt, &p.CreatedAt, &p.UpdatedAt,
			&p.PatientName, &p.PhysioName); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

const rehabReleaseCols = `id, plan_id, appointment_id, amount, patient_confirmed_at,
	physio_confirmed_at, status, admin_marked_paid_at, admin_marked_paid_by,
	created_at, updated_at`

func (r *RehabCreditRepository) scanReleases(ctx context.Context, query string, args ...interface{}) ([]models.RehabSessionRelease, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RehabSessionRelease{}
	for rows.Next() {
		var s models.RehabSessionRelease
		if err := rows.Scan(&s.ID, &s.PlanID, &s.AppointmentID, &s.Amount, &s.PatientConfirmedAt,
			&s.PhysioConfirmedAt, &s.Status, &s.AdminMarkedPaidAt, &s.AdminMarkedPaidBy,
			&s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ─── Plans ───────────────────────────────────────────────────────────────────

// CreateApplication inserts a pending_admin plan holding only what the patient
// asked for. The physio, rate, session count and term are set at approval.
func (r *RehabCreditRepository) CreateApplication(ctx context.Context, patientID string, req *models.CreateRehabCreditApplicationRequest) (*models.RehabCreditPlan, error) {
	const q = `
		INSERT INTO public.rehab_credit_plans (patient_id, total_credit_amount, review_notes, status)
		VALUES ($1,$2,$3,'pending_admin')
		RETURNING ` + rehabPlanCols
	plans, err := r.scanPlans(ctx, q, patientID, req.TotalCreditAmount, nilIfEmptyStr(req.Reason))
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, ErrPlanNotFound
	}
	// Re-read so the caller gets the joined display names — RETURNING cannot join.
	return r.GetPlan(ctx, plans[0].ID)
}

// ApprovePlan moves a pending_admin plan to active, fills in the terms an admin
// agreed with Mediloan, and generates the weekly repayment check schedule.
// It refuses to act on a plan that is not still pending.
func (r *RehabCreditRepository) ApprovePlan(ctx context.Context, planID, adminID string, req *models.ReviewRehabCreditPlanRequest) (*models.RehabCreditPlan, error) {
	const q = `
		UPDATE public.rehab_credit_plans
		   SET status = 'active',
		       physio_id = $2,
		       session_rate = $3,
		       sessions_total = $4,
		       duration_months = $5,
		       mediloan_ref = $6,
		       review_notes = $7,
		       reviewed_by = $8,
		       reviewed_at = NOW(),
		       updated_at = NOW()
		 WHERE id = $1 AND status = 'pending_admin'
		RETURNING ` + rehabPlanCols
	plans, err := r.scanPlans(ctx, q, planID, req.PhysioID, req.SessionRate, req.SessionsTotal,
		req.DurationMonths, nilIfEmptyStr(req.MediloanRef), nilIfEmptyStr(req.Notes), adminID)
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		// Either the plan does not exist or it has already been reviewed.
		return nil, ErrPlanNotPending
	}
	if err := r.generateRepaymentSchedule(ctx, planID, req.DurationMonths); err != nil {
		return nil, err
	}
	// Re-read so the caller gets the joined display names — RETURNING cannot join.
	return r.GetPlan(ctx, planID)
}

// generateRepaymentSchedule writes one weekly check per expected installment,
// spaced 7 days apart starting a week after approval. Idempotent: it does
// nothing if the plan already has checks.
func (r *RehabCreditRepository) generateRepaymentSchedule(ctx context.Context, planID string, durationMonths int) error {
	var existing int64
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.rehab_repayment_checks WHERE plan_id=$1`, planID).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}
	weeks := durationMonths * 4
	if weeks <= 0 {
		return nil
	}
	for i := 1; i <= weeks; i++ {
		if _, err := r.db.Exec(ctx,
			`INSERT INTO public.rehab_repayment_checks (plan_id, period_label, due_date, status)
			 VALUES ($1,$2, CURRENT_DATE + ($3::int * INTERVAL '7 days'), 'upcoming')`,
			planID, "Week "+strconv.Itoa(i), i); err != nil {
			return err
		}
	}
	return nil
}

// RejectPlan marks a pending plan rejected. It refuses if the plan has already
// been reviewed, so an active plan can never be rejected out from under a physio.
func (r *RehabCreditRepository) RejectPlan(ctx context.Context, planID, adminID, notes string) (*models.RehabCreditPlan, error) {
	const q = `
		UPDATE public.rehab_credit_plans
		   SET status = 'rejected', review_notes = $2, reviewed_by = $3,
		       reviewed_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND status = 'pending_admin'
		RETURNING ` + rehabPlanCols
	plans, err := r.scanPlans(ctx, q, planID, nilIfEmptyStr(notes), adminID)
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, ErrPlanNotPending
	}
	// Re-read so the caller gets the joined display names — RETURNING cannot join.
	return r.GetPlan(ctx, planID)
}

// GetPlan returns a single plan with display names attached, or ErrPlanNotFound.
func (r *RehabCreditRepository) GetPlan(ctx context.Context, planID string) (*models.RehabCreditPlan, error) {
	plans, err := r.scanPlansNamed(ctx,
		`SELECT `+rehabPlanColsNamed+rehabPlanNameJoins+` WHERE p.id = $1`, planID)
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, ErrPlanNotFound
	}
	return &plans[0], nil
}

// FindActivePlanForPair returns the active plan linking a patient to a physio,
// or (nil, nil) when there is none — an ordinary session outside Rehab Credit.
// Migration 017's partial unique index guarantees at most one such row, so this
// lookup is never ambiguous.
func (r *RehabCreditRepository) FindActivePlanForPair(ctx context.Context, patientID, physioID string) (*models.RehabCreditPlan, error) {
	plans, err := r.scanPlans(ctx,
		`SELECT `+rehabPlanCols+` FROM public.rehab_credit_plans
		  WHERE patient_id = $1 AND physio_id = $2 AND status = 'active'
		  LIMIT 1`, patientID, physioID)
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, nil
	}
	return &plans[0], nil
}

// ListPlansForUser scopes the list by role: a patient sees their own plans, a
// physio sees the ones assigned to them, an admin sees everything.
func (r *RehabCreditRepository) ListPlansForUser(ctx context.Context, userID, role string, q *models.PaginationQuery) ([]models.RehabCreditPlan, int64, error) {
	where := `WHERE p.patient_id = $1`
	args := []interface{}{userID}
	switch role {
	case string(models.RoleAdmin):
		where = `WHERE TRUE`
		args = []interface{}{}
	case string(models.RolePatient):
		// default above
	default:
		// Any clinical role sees plans assigned to them as the physio.
		where = `WHERE p.physio_id = $1`
	}

	// The count does not need the name joins — they are LEFT JOINs on unique
	// user ids, so they cannot change the row count.
	var total int64
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.rehab_credit_plans p `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(append([]interface{}{}, args...), q.PageSize, q.Offset())
	limit := `LIMIT $2 OFFSET $3`
	if len(args) == 0 {
		limit = `LIMIT $1 OFFSET $2`
	}
	plans, err := r.scanPlansNamed(ctx,
		`SELECT `+rehabPlanColsNamed+rehabPlanNameJoins+` `+where+
			` ORDER BY p.created_at DESC `+limit, listArgs...)
	return plans, total, err
}

// ─── Session releases ────────────────────────────────────────────────────────

// CreateSessionRelease opens a payout record for one session. It only succeeds
// against an active plan — a suspended plan returns ErrPlanSuspended so the
// caller can surface that rather than silently accruing an unpayable release.
func (r *RehabCreditRepository) CreateSessionRelease(ctx context.Context, planID, appointmentID string, amount float64) (*models.RehabSessionRelease, error) {
	plan, err := r.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if plan.Status == "suspended" {
		return nil, ErrPlanSuspended
	}
	if plan.Status != "active" {
		return nil, ErrPlanNotActive
	}
	const q = `
		INSERT INTO public.rehab_session_releases (plan_id, appointment_id, amount, status)
		VALUES ($1,$2,$3,'pending')
		RETURNING ` + rehabReleaseCols
	releases, err := r.scanReleases(ctx, q, planID, nilIfEmptyStr(appointmentID), amount)
	if err != nil {
		return nil, err
	}
	if len(releases) == 0 {
		return nil, ErrReleaseNotFound
	}
	return &releases[0], nil
}

// GetRelease returns a single release, or ErrReleaseNotFound.
func (r *RehabCreditRepository) GetRelease(ctx context.Context, releaseID string) (*models.RehabSessionRelease, error) {
	releases, err := r.scanReleases(ctx,
		`SELECT `+rehabReleaseCols+` FROM public.rehab_session_releases WHERE id=$1`, releaseID)
	if err != nil {
		return nil, err
	}
	if len(releases) == 0 {
		return nil, ErrReleaseNotFound
	}
	return &releases[0], nil
}

// ConfirmSessionByPatient stamps the patient's confirmation. If the physio has
// already confirmed, the release flips to both_confirmed. The WHERE clause
// pins the caller to the plan's patient, so one patient cannot confirm
// another's session. Only a still-pending release can be confirmed.
func (r *RehabCreditRepository) ConfirmSessionByPatient(ctx context.Context, releaseID, patientID string) (*models.RehabSessionRelease, error) {
	const q = `
		UPDATE public.rehab_session_releases s
		   SET patient_confirmed_at = COALESCE(s.patient_confirmed_at, NOW()),
		       status = CASE WHEN s.physio_confirmed_at IS NOT NULL THEN 'both_confirmed' ELSE s.status END,
		       updated_at = NOW()
		  FROM public.rehab_credit_plans p
		 WHERE s.id = $1 AND s.plan_id = p.id AND p.patient_id = $2 AND s.status = 'pending'
		RETURNING ` + rehabReleaseColsPrefixed
	releases, err := r.scanReleases(ctx, q, releaseID, patientID)
	if err != nil {
		return nil, err
	}
	if len(releases) == 0 {
		return nil, r.confirmMiss(ctx, releaseID)
	}
	return &releases[0], nil
}

// ConfirmSessionByPhysio is the mirror of ConfirmSessionByPatient.
func (r *RehabCreditRepository) ConfirmSessionByPhysio(ctx context.Context, releaseID, physioID string) (*models.RehabSessionRelease, error) {
	const q = `
		UPDATE public.rehab_session_releases s
		   SET physio_confirmed_at = COALESCE(s.physio_confirmed_at, NOW()),
		       status = CASE WHEN s.patient_confirmed_at IS NOT NULL THEN 'both_confirmed' ELSE s.status END,
		       updated_at = NOW()
		  FROM public.rehab_credit_plans p
		 WHERE s.id = $1 AND s.plan_id = p.id AND p.physio_id = $2 AND s.status = 'pending'
		RETURNING ` + rehabReleaseColsPrefixed
	releases, err := r.scanReleases(ctx, q, releaseID, physioID)
	if err != nil {
		return nil, err
	}
	if len(releases) == 0 {
		return nil, r.confirmMiss(ctx, releaseID)
	}
	return &releases[0], nil
}

// rehabReleaseColsPrefixed is rehabReleaseCols qualified with the "s" alias,
// needed by the UPDATE ... FROM statements above.
const rehabReleaseColsPrefixed = `s.id, s.plan_id, s.appointment_id, s.amount, s.patient_confirmed_at,
	s.physio_confirmed_at, s.status, s.admin_marked_paid_at, s.admin_marked_paid_by,
	s.created_at, s.updated_at`

// MarkSessionPaid records that Mediloan has paid out for a confirmed session.
// Only both_confirmed or payout_pending releases can be paid — this is what
// stops a release skipping from pending straight to paid. It also bumps the
// plan's released count, and completes the plan once every session is released.
func (r *RehabCreditRepository) MarkSessionPaid(ctx context.Context, releaseID, adminID string) (*models.RehabSessionRelease, error) {
	const q = `
		UPDATE public.rehab_session_releases
		   SET status = 'paid', admin_marked_paid_at = NOW(), admin_marked_paid_by = $2, updated_at = NOW()
		 WHERE id = $1 AND status IN ('both_confirmed','payout_pending')
		RETURNING ` + rehabReleaseCols
	releases, err := r.scanReleases(ctx, q, releaseID, adminID)
	if err != nil {
		return nil, err
	}
	if len(releases) == 0 {
		return nil, ErrReleaseNotPayable
	}
	rel := releases[0]

	if _, err := r.db.Exec(ctx,
		`UPDATE public.rehab_credit_plans
		    SET sessions_released = sessions_released + 1,
		        status = CASE WHEN sessions_total > 0 AND sessions_released + 1 >= sessions_total
		                      THEN 'completed' ELSE status END,
		        updated_at = NOW()
		  WHERE id = $1`, rel.PlanID); err != nil {
		return nil, err
	}
	return &rel, nil
}

// ListPendingPayouts returns every release both sides have confirmed but no
// admin has marked paid yet.
func (r *RehabCreditRepository) ListPendingPayouts(ctx context.Context) ([]models.PendingPayout, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id, s.plan_id, s.amount,
		       p.patient_id, COALESCE(pp.full_name, ''),
		       p.physio_id, COALESCE(tp.full_name, ''),
		       p.mediloan_ref,
		       COALESCE(to_char(GREATEST(s.patient_confirmed_at, s.physio_confirmed_at),
		                        'YYYY-MM-DD"T"HH24:MI:SSOF'), '')
		  FROM public.rehab_session_releases s
		  JOIN public.rehab_credit_plans p ON p.id = s.plan_id
		  LEFT JOIN public.patient_profiles   pp ON pp.user_id = p.patient_id
		  LEFT JOIN public.therapist_profiles tp ON tp.user_id = p.physio_id
		 WHERE s.status = 'both_confirmed'
		 ORDER BY s.updated_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.PendingPayout{}
	for rows.Next() {
		var p models.PendingPayout
		if err := rows.Scan(&p.ReleaseID, &p.PlanID, &p.Amount, &p.PatientID, &p.PatientName,
			&p.PhysioID, &p.PhysioName, &p.MediloanRef, &p.ConfirmedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ─── Repayment checks ────────────────────────────────────────────────────────

// MarkRepaymentStatus records what Mediloan reported for one installment.
// A miss increments the plan's consecutive counter; an on-time payment resets
// it (and clears the escalation watermark so a later miss escalates again).
// It returns the plan as it stands after the update so the service can decide
// what to escalate.
func (r *RehabCreditRepository) MarkRepaymentStatus(ctx context.Context, checkID, adminID, status string) (*models.RehabCreditPlan, error) {
	if status != "on_time" && status != "missed" {
		return nil, errors.New("invalid_repayment_status")
	}
	var planID string
	err := r.db.QueryRow(ctx,
		`UPDATE public.rehab_repayment_checks
		    SET status = $2, marked_by = $3, marked_at = NOW()
		  WHERE id = $1
		 RETURNING plan_id`, checkID, status, adminID).Scan(&planID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCheckNotFound
	}
	if err != nil {
		return nil, err
	}

	if status == "missed" {
		if _, err := r.db.Exec(ctx,
			`UPDATE public.rehab_credit_plans
			    SET consecutive_missed_payments = consecutive_missed_payments + 1, updated_at = NOW()
			  WHERE id = $1`, planID); err != nil {
			return nil, err
		}
	} else {
		if _, err := r.db.Exec(ctx,
			`UPDATE public.rehab_credit_plans
			    SET consecutive_missed_payments = 0, escalation_notified_at_count = 0, updated_at = NOW()
			  WHERE id = $1`, planID); err != nil {
			return nil, err
		}
	}
	return r.GetPlan(ctx, planID)
}

// MarkEscalationNotified raises the watermark so the same miss count is never
// escalated twice.
func (r *RehabCreditRepository) MarkEscalationNotified(ctx context.Context, planID string, count int) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.rehab_credit_plans
		    SET escalation_notified_at_count = $2, updated_at = NOW()
		  WHERE id = $1 AND escalation_notified_at_count < $2`, planID, count)
	return err
}

// SetPlanStatus moves a plan between active and suspended. It refuses to touch
// a plan that has been rejected or completed, so a settled plan is never
// silently reopened.
func (r *RehabCreditRepository) SetPlanStatus(ctx context.Context, planID, status string) error {
	if status != "active" && status != "suspended" {
		return errors.New("invalid_plan_status")
	}
	_, err := r.db.Exec(ctx,
		`UPDATE public.rehab_credit_plans SET status = $2, updated_at = NOW()
		  WHERE id = $1 AND status IN ('active','suspended')`, planID, status)
	return err
}

// ListRepaymentChecks returns a plan's full installment schedule in due order.
func (r *RehabCreditRepository) ListRepaymentChecks(ctx context.Context, planID string) ([]models.RehabRepaymentCheck, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, plan_id, period_label, due_date::text, status, marked_by, marked_at, created_at
		   FROM public.rehab_repayment_checks WHERE plan_id=$1 ORDER BY due_date ASC`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RehabRepaymentCheck{}
	for rows.Next() {
		var c models.RehabRepaymentCheck
		if err := rows.Scan(&c.ID, &c.PlanID, &c.PeriodLabel, &c.DueDate, &c.Status,
			&c.MarkedBy, &c.MarkedAt, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ListReleasesForPlan returns a plan's session releases, newest first.
func (r *RehabCreditRepository) ListReleasesForPlan(ctx context.Context, planID string) ([]models.RehabSessionRelease, error) {
	return r.scanReleases(ctx,
		`SELECT `+rehabReleaseCols+` FROM public.rehab_session_releases
		  WHERE plan_id=$1 ORDER BY created_at DESC`, planID)
}

// EscalationCandidate is a plan whose miss count has moved past whatever was
// last escalated for it.
type EscalationCandidate struct {
	PlanID      string
	PatientID   string
	PatientName string
	PhysioID    *string
	MissCount   int
	Status      string
}

// ListPlansNeedingEscalation returns plans whose consecutive miss count has
// risen above the count already notified. Capped at 3 because escalation stops
// at the suspend step.
func (r *RehabCreditRepository) ListPlansNeedingEscalation(ctx context.Context) ([]EscalationCandidate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.patient_id, COALESCE(pp.full_name, 'your patient'),
		       p.physio_id, p.consecutive_missed_payments, p.status
		  FROM public.rehab_credit_plans p
		  LEFT JOIN public.patient_profiles pp ON pp.user_id = p.patient_id
		 WHERE p.consecutive_missed_payments > p.escalation_notified_at_count
		   AND p.consecutive_missed_payments BETWEEN 1 AND 3
		   AND p.status IN ('active','suspended')
		 ORDER BY p.consecutive_missed_payments DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []EscalationCandidate{}
	for rows.Next() {
		var c EscalationCandidate
		if err := rows.Scan(&c.PlanID, &c.PatientID, &c.PatientName, &c.PhysioID,
			&c.MissCount, &c.Status); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

// ListAdminIDs returns every active admin, so financial events notify all of
// them rather than only the first.
func (r *RehabCreditRepository) ListAdminIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id FROM public.dynax_users WHERE role = 'admin' AND is_active = TRUE ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// DisplayName resolves a user's name from whichever profile table holds it,
// falling back to a neutral label so notification copy never renders blank.
func (r *RehabCreditRepository) DisplayName(ctx context.Context, userID string) string {
	var name string
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(
		  (SELECT full_name FROM public.patient_profiles   WHERE user_id = $1),
		  (SELECT full_name FROM public.therapist_profiles WHERE user_id = $1),
		  ''
		)`, userID).Scan(&name)
	if err != nil || name == "" {
		return "this user"
	}
	return name
}
