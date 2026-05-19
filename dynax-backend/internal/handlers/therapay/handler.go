package therapay

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles TheraPay payment endpoints.
type Handler struct {
	service Service
}

type Service interface {
	CreatePlan(professionalID string, req *models.CreateTherapayRequest) (*models.TheraPay, error)
	GetPlans(userID string, q *models.PaginationQuery) ([]models.TheraPay, int64, error)
	GetPlan(userID, planID string) (*models.TheraPay, error)
	RecordPayment(professionalID, planID string, amount float64, notes string) (*models.TheraPay, error)
	CancelPlan(professionalID, planID string) error
	GetPatientBalance(patientID string) (map[string]interface{}, error)
	ApplyApplication(patientID string, data map[string]interface{}) (interface{}, error)
	GetApplications(userID string, q *models.PaginationQuery) ([]interface{}, int64, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// CreatePlan godoc
// @Summary      Create TheraPay plan
// @Description  Creates a flexible therapy payment plan (session, bundle, subscription, or installment).
// @Tags         therapay
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateTherapayRequest  true  "Payment plan details"
// @Success      201   {object}  response.Envelope{data=models.TheraPay}
// @Failure      400   {object}  response.Envelope
// @Router       /therapay/plans [post]
func (h *Handler) CreatePlan(c *gin.Context) {
	var req models.CreateTherapayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	plan, err := h.service.CreatePlan(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "TheraPay plan created", plan)
}

// ListPlans godoc
// @Summary      List TheraPay plans
// @Description  Returns paginated therapy payment plans for the authenticated user.
// @Tags         therapay
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.TheraPay}
// @Failure      401  {object}  response.Envelope
// @Router       /therapay/plans [get]
func (h *Handler) ListPlans(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	plans, total, err := h.service.GetPlans(userID, &q)
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
// @Summary      Get a TheraPay plan
// @Description  Returns a single payment plan by ID.
// @Tags         therapay
// @Security     BearerAuth
// @Produce      json
// @Param        plan_id  path  string  true  "Plan UUID"
// @Success      200  {object}  response.Envelope{data=models.TheraPay}
// @Failure      404  {object}  response.Envelope
// @Router       /therapay/plans/{plan_id} [get]
func (h *Handler) GetPlan(c *gin.Context) {
	userID := middleware.GetUserID(c)
	planID := c.Param("plan_id")
	plan, err := h.service.GetPlan(userID, planID)
	if err != nil {
		response.NotFound(c, "Payment plan")
		return
	}
	response.OK(c, "Plan retrieved", plan)
}

// RecordPayment godoc
// @Summary      Record a payment
// @Description  Records a payment against an existing TheraPay installment or session plan.
// @Tags         therapay
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        plan_id  path  string  true  "Plan UUID"
// @Param        body     body  object  true  "Payment amount and notes"
// @Success      200  {object}  response.Envelope{data=models.TheraPay}
// @Failure      400  {object}  response.Envelope
// @Router       /therapay/plans/{plan_id}/payments [post]
func (h *Handler) RecordPayment(c *gin.Context) {
	var body struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
		Notes  string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "amount (> 0) is required")
		return
	}
	userID := middleware.GetUserID(c)
	planID := c.Param("plan_id")
	plan, err := h.service.RecordPayment(userID, planID, body.Amount, body.Notes)
	if err != nil {
		response.NotFound(c, "Payment plan")
		return
	}
	response.OK(c, "Payment recorded", plan)
}

// CancelPlan godoc
// @Summary      Cancel a TheraPay plan
// @Description  Cancels an active payment plan.
// @Tags         therapay
// @Security     BearerAuth
// @Produce      json
// @Param        plan_id  path  string  true  "Plan UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /therapay/plans/{plan_id}/cancel [post]
func (h *Handler) CancelPlan(c *gin.Context) {
	userID := middleware.GetUserID(c)
	planID := c.Param("plan_id")
	if err := h.service.CancelPlan(userID, planID); err != nil {
		response.NotFound(c, "Payment plan")
		return
	}
	response.OK(c, "Payment plan cancelled", nil)
}

// GetPatientBalance godoc
// @Summary      Get patient's payment balance
// @Description  Returns the outstanding balance and session credits for a patient.
// @Tags         therapay
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  path  string  true  "Patient UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /therapay/balance/{patient_id} [get]
func (h *Handler) GetPatientBalance(c *gin.Context) {
	patientID := c.Param("patient_id")
	balance, err := h.service.GetPatientBalance(patientID)
	if err != nil {
		response.NotFound(c, "Patient")
		return
	}
	response.OK(c, "Balance retrieved", balance)
}

// ApplyForTheraPay godoc
// @Summary      Apply for TheraPay
// @Description  Submits a TheraPay application for installment payment approval.
// @Tags         therapay
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "Application data"
// @Success      201   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /therapay/apply [post]
func (h *Handler) ApplyForTheraPay(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	app, err := h.service.ApplyApplication(userID, body)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "TheraPay application submitted", app)
}

// ListApplications godoc
// @Summary      List TheraPay applications
// @Description  Returns paginated TheraPay applications (admin / professional view).
// @Tags         therapay
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /therapay/applications [get]
func (h *Handler) ListApplications(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	apps, total, err := h.service.GetApplications(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, apps, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}
