package services

import (
	"context"
	"errors"
	"strconv"

	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository"
)

// ─── Rehab Credit Service ─────────────────────────────────────────────────────
//
// Rehab Credit is financed by Mediloan, a third party. DynaX is not the lender:
// it records which sessions both sides confirmed, and what an admin reports
// after reading Mediloan's statement. Nothing in this service moves money or
// changes a repayment outcome on its own.

// notifRehabCredit is the notification type every Rehab Credit event uses.
const notifRehabCredit = "rehab_credit_update"

type RehabCreditService struct {
	cfg   *config.Config
	repo  *repository.RehabCreditRepository
	notif *repository.NotificationRepository
}

func NewRehabCreditService(cfg *config.Config, repo *repository.RehabCreditRepository, notif *repository.NotificationRepository) *RehabCreditService {
	return &RehabCreditService{cfg: cfg, repo: repo, notif: notif}
}

// mapRehabErr translates the repository's internal sentinels into the shared
// models.Err* vocabulary, so handlers can map outcomes to HTTP codes without
// importing the repository package. Unrecognised errors pass through unchanged
// and surface as 500s.
func mapRehabErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repository.ErrPlanNotFound):
		return models.ErrPlanNotFound
	case errors.Is(err, repository.ErrPlanNotPending):
		return models.ErrPlanNotPending
	case errors.Is(err, repository.ErrPlanSuspended):
		return models.ErrPlanSuspended
	case errors.Is(err, repository.ErrPlanNotActive):
		return models.ErrPlanNotActive
	case errors.Is(err, repository.ErrReleaseNotFound):
		return models.ErrReleaseNotFound
	case errors.Is(err, repository.ErrReleaseNotOpen):
		return models.ErrReleaseNotOpen
	case errors.Is(err, repository.ErrReleaseNotPayable):
		return models.ErrReleaseNotPayable
	case errors.Is(err, repository.ErrNotOnThisPlan):
		return models.ErrNotOnThisPlan
	case errors.Is(err, repository.ErrCheckNotFound):
		return models.ErrCheckNotFound
	default:
		return err
	}
}

// notifyAdmins fans a notification out to every active admin.
func (s *RehabCreditService) notifyAdmins(ctx context.Context, title, body string, data map[string]string) {
	admins, err := s.repo.ListAdminIDs(ctx)
	if err != nil {
		return
	}
	for _, id := range admins {
		_ = s.notif.Create(ctx, id, notifRehabCredit, title, body, data)
	}
}

// ApplyForCredit records a patient's request and puts it in front of admin.
func (s *RehabCreditService) ApplyForCredit(patientID string, req *models.CreateRehabCreditApplicationRequest) (*models.RehabCreditPlan, error) {
	ctx := context.Background()
	if req.TotalCreditAmount <= 0 {
		return nil, errors.New("invalid_amount")
	}
	plan, err := s.repo.CreateApplication(ctx, patientID, req)
	if err != nil {
		return nil, mapRehabErr(err)
	}
	name := s.repo.DisplayName(ctx, patientID)
	s.notifyAdmins(ctx, "New Rehab Credit application",
		name+" has applied for Rehab Credit. Review the request and confirm the terms with Mediloan.",
		map[string]string{"plan_id": plan.ID})
	return plan, nil
}

// ReviewPlan approves or rejects a pending application. On approval the admin
// supplies the terms agreed with Mediloan and the physio who will deliver the
// sessions; both the patient and that physio are notified.
func (s *RehabCreditService) ReviewPlan(adminID, planID string, req *models.ReviewRehabCreditPlanRequest) (*models.RehabCreditPlan, error) {
	ctx := context.Background()

	if req.Decision == "reject" {
		plan, err := s.repo.RejectPlan(ctx, planID, adminID, req.Notes)
		if err != nil {
			return nil, mapRehabErr(err)
		}
		_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Rehab Credit application declined",
			"Your Rehab Credit application was not approved. Your care team can talk you through other options.",
			map[string]string{"plan_id": plan.ID})
		return plan, nil
	}

	if req.Decision != "approve" {
		return nil, errors.New("invalid_decision")
	}
	// Approval terms are what the physio gets paid against, so none of them may
	// be left to a default.
	if req.PhysioID == "" {
		return nil, errors.New("physio_id_required")
	}
	if req.SessionRate <= 0 {
		return nil, errors.New("session_rate_required")
	}
	if req.SessionsTotal <= 0 {
		return nil, errors.New("sessions_total_required")
	}
	if req.DurationMonths <= 0 {
		return nil, errors.New("duration_months_required")
	}

	plan, err := s.repo.ApprovePlan(ctx, planID, adminID, req)
	if err != nil {
		return nil, mapRehabErr(err)
	}

	_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Rehab Credit approved",
		"Your Rehab Credit is active. Mediloan is financing "+strconv.Itoa(plan.SessionsTotal)+
			" sessions — confirm each one in the app after it happens.",
		map[string]string{"plan_id": plan.ID})

	if plan.PhysioID != nil {
		patientName := s.repo.DisplayName(ctx, plan.PatientID)
		_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "You've been assigned a Rehab Credit plan",
			patientName+" has an active Mediloan-backed plan with you. Confirm each session so the payout can be released.",
			map[string]string{"plan_id": plan.ID})
	}
	return plan, nil
}

// CreateSessionRelease opens the payout record for a delivered session against
// a known plan. It fails with models.ErrPlanSuspended when repayments are
// behind, rather than accruing a release that can never be paid.
func (s *RehabCreditService) CreateSessionRelease(planID, appointmentID string, amount float64) (*models.RehabSessionRelease, error) {
	rel, err := s.repo.CreateSessionRelease(context.Background(), planID, appointmentID, amount)
	return rel, mapRehabErr(err)
}

// LinkSessionToCredit is the hook the session-logging flow calls after a
// session is recorded. It looks for an active Rehab Credit plan for that exact
// (patient, physio) pair — migration 017 guarantees at most one — and opens a
// session release for the plan's session rate.
//
// Returning (nil, nil) is the normal case: most sessions are not financed, and
// a session with no matching active plan is simply an ordinary session. A
// suspended plan does not match either, so no release accrues while repayments
// are behind.
func (s *RehabCreditService) LinkSessionToCredit(ctx context.Context, patientID, physioID, appointmentID string) (*models.RehabSessionRelease, error) {
	plan, err := s.repo.FindActivePlanForPair(ctx, patientID, physioID)
	if err != nil || plan == nil {
		return nil, mapRehabErr(err)
	}

	rel, err := s.repo.CreateSessionRelease(ctx, plan.ID, appointmentID, plan.SessionRate)
	if err != nil {
		return nil, mapRehabErr(err)
	}

	// Both sides must confirm before the payout can be released, so prompt them.
	data := map[string]string{"plan_id": plan.ID, "release_id": rel.ID}
	_ = s.notif.Create(ctx, patientID, notifRehabCredit, "Confirm your session",
		"Please confirm your Rehab Credit session took place so your physiotherapist can be paid.", data)
	_ = s.notif.Create(ctx, physioID, notifRehabCredit, "Confirm your session",
		"Confirm this Rehab Credit session so the Mediloan payout can be released.", data)
	return rel, nil
}

// ConfirmSession routes to the patient or physio confirmation based on the
// caller's role. Once both sides have confirmed, admin is told a payout is ready.
func (s *RehabCreditService) ConfirmSession(userID, role, releaseID string) (*models.RehabSessionRelease, error) {
	ctx := context.Background()

	var (
		rel *models.RehabSessionRelease
		err error
	)
	if role == string(models.RolePatient) {
		rel, err = s.repo.ConfirmSessionByPatient(ctx, releaseID, userID)
	} else if role == string(models.RoleAdmin) {
		// An admin is neither party to the session and must not confirm on
		// their behalf — that is the whole point of the two-sided check.
		return nil, errors.New("admin_cannot_confirm_session")
	} else {
		rel, err = s.repo.ConfirmSessionByPhysio(ctx, releaseID, userID)
	}
	if err != nil {
		return nil, mapRehabErr(err)
	}

	if rel.Status == "both_confirmed" {
		plan, perr := s.repo.GetPlan(ctx, rel.PlanID)
		if perr == nil {
			patientName := s.repo.DisplayName(ctx, plan.PatientID)
			s.notifyAdmins(ctx, "Session payout ready",
				"A Rehab Credit session for "+patientName+" is confirmed by both sides. Check Mediloan and mark it paid once the payout lands.",
				map[string]string{"plan_id": plan.ID, "release_id": rel.ID})
		}
	}
	return rel, nil
}

// MarkPaid records that Mediloan has released the payout for a confirmed
// session, and tells both sides.
func (s *RehabCreditService) MarkPaid(adminID, releaseID string) (*models.RehabSessionRelease, error) {
	ctx := context.Background()
	rel, err := s.repo.MarkSessionPaid(ctx, releaseID, adminID)
	if err != nil {
		return nil, mapRehabErr(err)
	}
	plan, perr := s.repo.GetPlan(ctx, rel.PlanID)
	if perr != nil {
		return rel, nil
	}
	data := map[string]string{"plan_id": plan.ID, "release_id": rel.ID}
	_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Session payment released",
		"Mediloan has released the payment for one of your Rehab Credit sessions.", data)
	if plan.PhysioID != nil {
		_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "Session payment released",
			"Mediloan has released the payment for a confirmed Rehab Credit session.", data)
	}
	return rel, nil
}

// MarkRepaymentStatus records what Mediloan reported for one installment and
// runs the escalation ladder. DynaX never decides that a payment was missed —
// this only reflects an admin's reading of Mediloan's report.
//
// Escalation, each step fired at most once per miss count:
//
//	1 miss  → physio is warned
//	2 misses → patient is asked to settle, physio gets the updated count
//	3 misses → physio is told to pause sessions and the plan is suspended
//
// Catching up resets the counter and reactivates a suspended plan.
func (s *RehabCreditService) MarkRepaymentStatus(adminID, checkID, status string) (*models.RehabCreditPlan, error) {
	ctx := context.Background()
	if status != "on_time" && status != "missed" {
		return nil, errors.New("invalid_repayment_status")
	}

	plan, err := s.repo.MarkRepaymentStatus(ctx, checkID, adminID, status)
	if err != nil {
		return nil, mapRehabErr(err)
	}
	patientName := s.repo.DisplayName(ctx, plan.PatientID)

	if status == "on_time" {
		// Caught up. Reactivate if this plan had been suspended for arrears.
		if plan.Status == "suspended" {
			if err := s.repo.SetPlanStatus(ctx, plan.ID, "active"); err != nil {
				return nil, err
			}
			data := map[string]string{"plan_id": plan.ID}
			_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Rehab Credit reactivated",
				"Your Mediloan repayments are up to date and your sessions are active again.", data)
			if plan.PhysioID != nil {
				_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "Rehab Credit reactivated",
					patientName+" is up to date with Mediloan. You can resume sessions.", data)
			}
			return s.repo.GetPlan(ctx, plan.ID)
		}
		return plan, nil
	}

	// A miss. Escalate only if this count has not already been escalated.
	count := plan.ConsecutiveMissedPayments
	if count <= plan.EscalationNotifiedAtCount {
		return plan, nil
	}
	if err := s.escalate(ctx, plan, patientName, count); err != nil {
		return nil, err
	}
	return s.repo.GetPlan(ctx, plan.ID)
}

// escalate fires the notifications for a given miss count and raises the
// watermark so the same miss is never escalated twice.
func (s *RehabCreditService) escalate(ctx context.Context, plan *models.RehabCreditPlan, patientName string, count int) error {
	data := map[string]string{"plan_id": plan.ID, "missed_count": strconv.Itoa(count)}

	switch {
	case count == 1:
		if plan.PhysioID != nil {
			_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "Payment behind for "+patientName,
				"Payment behind for "+patientName+" — Mediloan reports a missed installment. Keep an eye on this.", data)
		}

	case count == 2:
		_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Your Mediloan repayment is behind",
			"Your Mediloan repayment is now 2 installments behind. Please settle this to keep your sessions active.", data)
		if plan.PhysioID != nil {
			_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "Payment behind for "+patientName,
				patientName+" is now 2 Mediloan installments behind. Sessions will be paused at 3.", data)
		}

	case count >= 3:
		if plan.PhysioID != nil {
			_ = s.notif.Create(ctx, *plan.PhysioID, notifRehabCredit, "Please pause sessions for "+patientName,
				"Please pause sessions for "+patientName+" — repayments are 3 installments behind. "+
					"DynaX will not release further session payments until the account is current.", data)
		}
		_ = s.notif.Create(ctx, plan.PatientID, notifRehabCredit, "Sessions paused",
			"Your Rehab Credit sessions are paused because your Mediloan repayments are 3 installments behind. "+
				"Settle with Mediloan to resume.", data)
		if err := s.repo.SetPlanStatus(ctx, plan.ID, "suspended"); err != nil {
			return err
		}
	}

	return s.repo.MarkEscalationNotified(ctx, plan.ID, count)
}

// GetPlans returns the plans visible to the caller, scoped by role.
func (s *RehabCreditService) GetPlans(userID, role string, q *models.PaginationQuery) ([]models.RehabCreditPlan, int64, error) {
	return s.repo.ListPlansForUser(context.Background(), userID, role, q)
}

// GetPlanDetail returns a plan with its releases and repayment schedule. The
// Mediloan reference and the admin's review notes are admin-only — neither the
// patient nor the physio sees the other side's paperwork.
func (s *RehabCreditService) GetPlanDetail(userID, role, planID string) (map[string]interface{}, error) {
	ctx := context.Background()
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, mapRehabErr(err)
	}

	isAdmin := role == string(models.RoleAdmin)
	isPatient := plan.PatientID == userID
	isPhysio := plan.PhysioID != nil && *plan.PhysioID == userID
	if !isAdmin && !isPatient && !isPhysio {
		return nil, models.ErrNotOnThisPlan
	}

	if !isAdmin {
		plan.MediloanRef = nil
		plan.ReviewNotes = nil
		plan.ReviewedBy = nil
	}

	releases, err := s.repo.ListReleasesForPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	checks, err := s.repo.ListRepaymentChecks(ctx, planID)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"plan":             plan,
		"releases":         releases,
		"repayment_checks": checks,
		"lender":           "Mediloan",
	}, nil
}

// GetPendingPayouts is the admin queue of sessions both sides have confirmed.
func (s *RehabCreditService) GetPendingPayouts() ([]models.PendingPayout, error) {
	return s.repo.ListPendingPayouts(context.Background())
}
