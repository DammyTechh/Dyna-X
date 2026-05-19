package admin

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles admin-only endpoints.
type Handler struct {
	service Service
}

type Service interface {
	GetStats() (*models.AdminStats, error)
	ListUsers(q *models.PaginationQuery) ([]models.User, int64, error)
	GetUser(userID string) (*models.User, error)
	DeactivateUser(adminID, userID string) error
	ReactivateUser(adminID, userID string) error
	ListProfessionals(q *models.PaginationQuery, status string) ([]models.ProfessionalProfile, int64, error)
	ApproveProfessional(adminID, professionalID string, req *models.ApproveProfessionalRequest) (*models.ProfessionalProfile, error)
	ListPatients(q *models.PaginationQuery) ([]models.PatientProfile, int64, error)
	AssignProfessional(adminID string, req *models.AssignProfessionalRequest) error
	ListSessions(q *models.PaginationQuery) ([]models.TherapySession, int64, error)
	GetAuditLogs(q *models.PaginationQuery) ([]interface{}, int64, error)
	GetAnalytics(period string) (map[string]interface{}, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// GetStats godoc
// @Summary      Platform statistics
// @Description  Returns high-level platform statistics (admin only).
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=models.AdminStats}
// @Failure      401  {object}  response.Envelope
// @Failure      403  {object}  response.Envelope
// @Router       /admin/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.service.GetStats()
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Stats retrieved", stats)
}

// ListUsers godoc
// @Summary      List all users
// @Description  Returns a paginated list of all platform users.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int     false  "Page"
// @Param        page_size  query  int     false  "Page size"
// @Param        search     query  string  false  "Search by email or name"
// @Success      200  {object}  response.Envelope{data=[]models.User}
// @Failure      403  {object}  response.Envelope
// @Router       /admin/users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	users, total, err := h.service.ListUsers(&q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, users, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// DeactivateUser godoc
// @Summary      Deactivate user account
// @Description  Disables a user's account, preventing login.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        user_id  path  string  true  "User UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /admin/users/{user_id}/deactivate [post]
func (h *Handler) DeactivateUser(c *gin.Context) {
	adminID := middleware.GetUserID(c)
	userID := c.Param("user_id")
	if err := h.service.DeactivateUser(adminID, userID); err != nil {
		response.NotFound(c, "User")
		return
	}
	response.OK(c, "User deactivated", nil)
}

// ReactivateUser godoc
// @Summary      Reactivate user account
// @Description  Re-enables a previously deactivated user account.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        user_id  path  string  true  "User UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /admin/users/{user_id}/reactivate [post]
func (h *Handler) ReactivateUser(c *gin.Context) {
	adminID := middleware.GetUserID(c)
	userID := c.Param("user_id")
	if err := h.service.ReactivateUser(adminID, userID); err != nil {
		response.NotFound(c, "User")
		return
	}
	response.OK(c, "User reactivated", nil)
}

// ListProfessionals godoc
// @Summary      List professionals
// @Description  Returns a paginated list of professionals, optionally filtered by approval status.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int     false  "Page"
// @Param        page_size  query  int     false  "Page size"
// @Param        status     query  string  false  "Filter by status: pending | approved | rejected"
// @Success      200  {object}  response.Envelope{data=[]models.ProfessionalProfile}
// @Failure      403  {object}  response.Envelope
// @Router       /admin/professionals [get]
func (h *Handler) ListProfessionals(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	status := c.Query("status")
	professionals, total, err := h.service.ListProfessionals(&q, status)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, professionals, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// ApproveProfessional godoc
// @Summary      Approve or reject a professional
// @Description  Approves or rejects a professional's registration (triggers email notification).
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        professional_id  path  string                           true  "Professional UUID"
// @Param        body             body  models.ApproveProfessionalRequest  true  "Approval decision"
// @Success      200  {object}  response.Envelope{data=models.ProfessionalProfile}
// @Failure      404  {object}  response.Envelope
// @Router       /admin/professionals/{professional_id}/approve [post]
func (h *Handler) ApproveProfessional(c *gin.Context) {
	var req models.ApproveProfessionalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	adminID := middleware.GetUserID(c)
	profID := c.Param("professional_id")
	prof, err := h.service.ApproveProfessional(adminID, profID, &req)
	if err != nil {
		response.NotFound(c, "Professional")
		return
	}
	msg := "Professional approved"
	if !req.IsApproved {
		msg = "Professional rejected"
	}
	response.OK(c, msg, prof)
}

// ListPatients godoc
// @Summary      List all patients
// @Description  Returns a paginated list of all patients on the platform.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int     false  "Page"
// @Param        page_size  query  int     false  "Page size"
// @Param        search     query  string  false  "Search by name"
// @Success      200  {object}  response.Envelope{data=[]models.PatientProfile}
// @Failure      403  {object}  response.Envelope
// @Router       /admin/patients [get]
func (h *Handler) ListPatients(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	patients, total, err := h.service.ListPatients(&q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, patients, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// AssignProfessional godoc
// @Summary      Assign a professional to a patient
// @Description  Admin-assigns a professional to a patient's care team.
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.AssignProfessionalRequest  true  "Assignment data"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /admin/assign [post]
func (h *Handler) AssignProfessional(c *gin.Context) {
	var req models.AssignProfessionalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	adminID := middleware.GetUserID(c)
	if err := h.service.AssignProfessional(adminID, &req); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Professional assigned to patient", nil)
}

// GetAuditLogs godoc
// @Summary      Get audit logs
// @Description  Returns paginated platform audit logs (admin only).
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope
// @Failure      403  {object}  response.Envelope
// @Router       /admin/audit-logs [get]
func (h *Handler) GetAuditLogs(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	logs, total, err := h.service.GetAuditLogs(&q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, logs, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetAnalytics godoc
// @Summary      Get platform analytics
// @Description  Returns platform analytics broken down by time period.
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        period  query  string  false  "Period: day | week | month | year (default: month)"
// @Success      200  {object}  response.Envelope
// @Failure      403  {object}  response.Envelope
// @Router       /admin/analytics [get]
func (h *Handler) GetAnalytics(c *gin.Context) {
	period := c.DefaultQuery("period", "month")
	analytics, err := h.service.GetAnalytics(period)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Analytics retrieved", analytics)
}
