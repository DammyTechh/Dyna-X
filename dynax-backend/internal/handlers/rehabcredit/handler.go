// Package rehabcredit exposes the Rehab Credit endpoints. Rehab Credit is
// financed by Mediloan, a third party — DynaX only records session
// confirmations and what an admin reports from Mediloan's statement.
package rehabcredit

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

type Handler struct {
	service Service
}

type Service interface {
	ApplyForCredit(patientID string, req *models.CreateRehabCreditApplicationRequest) (*models.RehabCreditPlan, error)
	ReviewPlan(adminID, planID string, req *models.ReviewRehabCreditPlanRequest) (*models.RehabCreditPlan, error)
	GetPlans(userID, role string, q *models.PaginationQuery) ([]models.RehabCreditPlan, int64, error)
	GetPlanDetail(userID, role, planID string) (map[string]interface{}, error)
	ConfirmSession(userID, role, releaseID string) (*models.RehabSessionRelease, error)
	MarkPaid(adminID, releaseID string) (*models.RehabSessionRelease, error)
	GetPendingPayouts() ([]models.PendingPayout, error)
	MarkRepaymentStatus(adminID, checkID, status string) (*models.RehabCreditPlan, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// Apply godoc
// @Summary      Apply for Rehab Credit
// @Description  Submits a Rehab Credit application. Rehab Credit is financed by Mediloan,
// @Description  a third-party lender; DynaX records the request for admin review.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateRehabCreditApplicationRequest  true  "Requested credit amount"
// @Success      201   {object}  response.Envelope{data=models.RehabCreditPlan}
// @Failure      400   {object}  response.Envelope
// @Router       /patient/rehab-credit/apply [post]
func (h *Handler) Apply(c *gin.Context) {
	var req models.CreateRehabCreditApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if req.TotalCreditAmount <= 0 {
		response.BadRequest(c, "INVALID_AMOUNT", "total_credit_amount must be greater than 0")
		return
	}
	plan, err := h.service.ApplyForCredit(middleware.GetUserID(c), &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Rehab Credit application submitted", plan)
}

// ListPlans godoc
// @Summary      List Rehab Credit plans
// @Description  Returns paginated plans scoped to the caller: a patient sees their own,
// @Description  a physiotherapist sees plans assigned to them, an admin sees all.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.RehabCreditPlan}
// @Failure      401  {object}  response.Envelope
// @Router       /rehab-credit/plans [get]
func (h *Handler) ListPlans(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	plans, total, err := h.service.GetPlans(middleware.GetUserID(c), middleware.GetRole(c), &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, plans, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetPlan godoc
// @Summary      Get a Rehab Credit plan
// @Description  Returns a plan with its session releases and repayment schedule. The
// @Description  Mediloan reference and admin review notes are only included for admins.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Produce      json
// @Param        plan_id  path  string  true  "Plan UUID"
// @Success      200  {object}  response.Envelope
// @Failure      403  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /rehab-credit/plans/{plan_id} [get]
func (h *Handler) GetPlan(c *gin.Context) {
	detail, err := h.service.GetPlanDetail(middleware.GetUserID(c), middleware.GetRole(c), c.Param("plan_id"))
	if err != nil {
		h.respondErr(c, err, "Rehab Credit plan")
		return
	}
	response.OK(c, "Plan retrieved", detail)
}

// ReviewPlan godoc
// @Summary      Review a Rehab Credit application
// @Description  Admin approves or rejects a pending application. On approval the admin
// @Description  supplies the terms agreed with Mediloan and assigns the treating physiotherapist.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        plan_id  path  string  true  "Plan UUID"
// @Param        body     body  models.ReviewRehabCreditPlanRequest  true  "Decision and approval terms"
// @Success      200  {object}  response.Envelope{data=models.RehabCreditPlan}
// @Failure      400  {object}  response.Envelope
// @Failure      409  {object}  response.Envelope
// @Router       /admin/rehab-credit/plans/{plan_id}/review [post]
func (h *Handler) ReviewPlan(c *gin.Context) {
	var req models.ReviewRehabCreditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if req.Decision != "approve" && req.Decision != "reject" {
		response.BadRequest(c, "INVALID_DECISION", "decision must be approve or reject")
		return
	}
	// On approval every term the physio gets paid against must be explicit.
	if req.Decision == "approve" {
		switch {
		case req.PhysioID == "":
			response.BadRequest(c, "PHYSIO_REQUIRED", "physio_id is required to approve a plan")
			return
		case req.SessionRate <= 0:
			response.BadRequest(c, "SESSION_RATE_REQUIRED", "session_rate must be greater than 0")
			return
		case req.SessionsTotal <= 0:
			response.BadRequest(c, "SESSIONS_TOTAL_REQUIRED", "sessions_total must be greater than 0")
			return
		case req.DurationMonths <= 0:
			response.BadRequest(c, "DURATION_REQUIRED", "duration_months must be greater than 0")
			return
		}
	}
	plan, err := h.service.ReviewPlan(middleware.GetUserID(c), c.Param("plan_id"), &req)
	if err != nil {
		h.respondErr(c, err, "Rehab Credit plan")
		return
	}
	response.OK(c, "Application "+req.Decision+"d", plan)
}

// ConfirmSession godoc
// @Summary      Confirm a Rehab Credit session
// @Description  Confirms a session took place. Both the patient and the physiotherapist
// @Description  must confirm before a payout can be released. The caller's role decides
// @Description  which side of the confirmation is recorded.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        release_id  path  string  true  "Session release UUID"
// @Success      200  {object}  response.Envelope{data=models.RehabSessionRelease}
// @Failure      403  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /rehab-credit/sessions/{release_id}/confirm [post]
func (h *Handler) ConfirmSession(c *gin.Context) {
	role := middleware.GetRole(c)
	// An admin is neither party to the session. Letting them confirm would
	// defeat the two-sided check the payout depends on.
	if role == string(models.RoleAdmin) {
		response.Forbidden(c, "Only the patient and the assigned physiotherapist can confirm a session")
		return
	}
	rel, err := h.service.ConfirmSession(middleware.GetUserID(c), role, c.Param("release_id"))
	if err != nil {
		h.respondErr(c, err, "Session release")
		return
	}
	response.OK(c, "Session confirmed", rel)
}

// MarkSessionPaid godoc
// @Summary      Mark a session payout as paid
// @Description  Admin records that Mediloan has released the payout for a session both
// @Description  sides confirmed. Only a both_confirmed or payout_pending release can be paid.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Produce      json
// @Param        release_id  path  string  true  "Session release UUID"
// @Success      200  {object}  response.Envelope{data=models.RehabSessionRelease}
// @Failure      409  {object}  response.Envelope
// @Router       /admin/rehab-credit/sessions/{release_id}/mark-paid [post]
func (h *Handler) MarkSessionPaid(c *gin.Context) {
	rel, err := h.service.MarkPaid(middleware.GetUserID(c), c.Param("release_id"))
	if err != nil {
		h.respondErr(c, err, "Session release")
		return
	}
	response.OK(c, "Session payout marked paid", rel)
}

// ListPendingPayouts godoc
// @Summary      List payouts awaiting release
// @Description  Admin queue of session releases both the patient and physiotherapist have
// @Description  confirmed but which have not yet been marked paid.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /admin/rehab-credit/payouts/pending [get]
func (h *Handler) ListPendingPayouts(c *gin.Context) {
	payouts, err := h.service.GetPendingPayouts()
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Pending payouts retrieved", payouts)
}

// MarkRepaymentStatus godoc
// @Summary      Record a Mediloan repayment outcome
// @Description  Admin records what Mediloan reported for one installment period. Marking a
// @Description  period missed advances the escalation ladder; marking it on time clears it.
// @Tags         rehab-credit
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        check_id  path  string  true  "Repayment check UUID"
// @Param        body      body  models.MarkRepaymentStatusRequest  true  "on_time or missed"
// @Success      200  {object}  response.Envelope{data=models.RehabCreditPlan}
// @Failure      400  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /admin/rehab-credit/repayment/{check_id}/mark [post]
func (h *Handler) MarkRepaymentStatus(c *gin.Context) {
	var req models.MarkRepaymentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if req.Status != "on_time" && req.Status != "missed" {
		response.BadRequest(c, "INVALID_STATUS", "status must be on_time or missed")
		return
	}
	plan, err := h.service.MarkRepaymentStatus(middleware.GetUserID(c), c.Param("check_id"), req.Status)
	if err != nil {
		h.respondErr(c, err, "Repayment check")
		return
	}
	response.OK(c, "Repayment status recorded", plan)
}

// respondErr maps the service layer's sentinel errors onto the right HTTP shape
// so a guarded status transition reads as a conflict rather than a server error.
func (h *Handler) respondErr(c *gin.Context, err error, resource string) {
	switch {
	case errors.Is(err, models.ErrPlanNotFound),
		errors.Is(err, models.ErrReleaseNotFound),
		errors.Is(err, models.ErrCheckNotFound):
		response.NotFound(c, resource)
	case errors.Is(err, models.ErrNotOnThisPlan):
		response.Forbidden(c, "You are not a party to this Rehab Credit plan")
	case errors.Is(err, models.ErrPlanSuspended):
		response.Conflict(c, "This plan is suspended because Mediloan repayments are behind")
	case errors.Is(err, models.ErrPlanNotActive):
		response.Conflict(c, "This plan is not active")
	case errors.Is(err, models.ErrPlanNotPending):
		response.Conflict(c, "This application has already been reviewed")
	case errors.Is(err, models.ErrReleaseNotOpen):
		response.Conflict(c, "This session has already been confirmed")
	case errors.Is(err, models.ErrReleaseNotPayable):
		response.Conflict(c, "This session must be confirmed by both sides before it can be marked paid")
	default:
		response.InternalError(c, err)
	}
}
