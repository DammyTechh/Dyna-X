package patient

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles patient-facing endpoints.
type Handler struct {
	service Service
}

// Service defines patient business logic.
type Service interface {
	GetProfile(userID string) (*models.PatientProfile, error)
	UpdateProfile(userID string, req *models.UpdatePatientProfileRequest) (*models.PatientProfile, error)
	ConnectToProfessional(userID string, req *models.ConnectToProfessionalRequest) (*models.ProfessionalConnection, error)
	DisconnectFromProfessional(userID, professionalID string) error
	GetMyProfessionals(userID string) ([]models.ProfessionalProfile, error)
	GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error)
	GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error)
	GetCarePlans(userID string) ([]models.CarePlan, error)
	GetRehabHistory(userID string, q *models.PaginationQuery) ([]interface{}, int64, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// GetProfile godoc
// @Summary      Get patient profile
// @Description  Returns the authenticated patient's profile.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=models.PatientProfile}
// @Failure      401  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /patient/profile [get]
func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	profile, err := h.service.GetProfile(userID)
	if err != nil {
		response.NotFound(c, "Profile")
		return
	}
	response.OK(c, "Profile retrieved", profile)
}

// UpdateProfile godoc
// @Summary      Update patient profile
// @Description  Partially updates the patient's own profile.
// @Tags         patient
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.UpdatePatientProfileRequest  true  "Fields to update"
// @Success      200   {object}  response.Envelope{data=models.PatientProfile}
// @Failure      400   {object}  response.Envelope
// @Router       /patient/profile [patch]
func (h *Handler) UpdateProfile(c *gin.Context) {
	var req models.UpdatePatientProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	profile, err := h.service.UpdateProfile(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Profile updated", profile)
}

// ConnectToProfessional godoc
// @Summary      Connect to a professional via PIN
// @Description  Links the patient to a professional using their unique personal code/PIN.
// @Tags         patient
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.ConnectToProfessionalRequest  true  "Professional PIN"
// @Success      200   {object}  response.Envelope{data=models.ProfessionalConnection}
// @Failure      400   {object}  response.Envelope
// @Failure      404   {object}  response.Envelope
// @Router       /patient/connect [post]
func (h *Handler) ConnectToProfessional(c *gin.Context) {
	var req models.ConnectToProfessionalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	conn, err := h.service.ConnectToProfessional(userID, &req)
	if err != nil {
		if err.Error() == "professional_not_found" {
			response.NotFound(c, "Professional with that code")
			return
		}
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Connected to professional successfully", conn)
}

// DisconnectFromProfessional godoc
// @Summary      Disconnect from a professional
// @Description  Removes the patient's connection to a professional.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Param        professional_id  path  string  true  "Professional UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /patient/connect/{professional_id} [delete]
func (h *Handler) DisconnectFromProfessional(c *gin.Context) {
	userID := middleware.GetUserID(c)
	profID := c.Param("professional_id")
	if err := h.service.DisconnectFromProfessional(userID, profID); err != nil {
		response.NotFound(c, "Connection")
		return
	}
	response.OK(c, "Disconnected successfully", nil)
}

// GetMyProfessionals godoc
// @Summary      List connected professionals
// @Description  Returns all professionals the patient is connected to.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=[]models.ProfessionalProfile}
// @Failure      401  {object}  response.Envelope
// @Router       /patient/professionals [get]
func (h *Handler) GetMyProfessionals(c *gin.Context) {
	userID := middleware.GetUserID(c)
	professionals, err := h.service.GetMyProfessionals(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Professionals retrieved", professionals)
}

// GetAppointments godoc
// @Summary      List patient's appointments
// @Description  Returns a paginated list of the patient's scheduled appointments.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.Appointment}
// @Failure      401  {object}  response.Envelope
// @Router       /patient/appointments [get]
func (h *Handler) GetAppointments(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	apps, total, err := h.service.GetAppointments(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, apps, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetSessions godoc
// @Summary      List patient's session history
// @Description  Returns a paginated list of the patient's therapy sessions.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.TherapySession}
// @Failure      401  {object}  response.Envelope
// @Router       /patient/sessions [get]
func (h *Handler) GetSessions(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	sessions, total, err := h.service.GetSessions(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, sessions, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetCarePlans godoc
// @Summary      List patient's care plans
// @Description  Returns all active and historical care plans for the patient.
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=[]models.CarePlan}
// @Failure      401  {object}  response.Envelope
// @Router       /patient/care-plans [get]
func (h *Handler) GetCarePlans(c *gin.Context) {
	userID := middleware.GetUserID(c)
	plans, err := h.service.GetCarePlans(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Care plans retrieved", plans)
}

// GetRehabHistory godoc
// @Summary      Get rehabilitation history
// @Description  Returns a paginated rehabilitation history for the patient (sessions, notes, progress).
// @Tags         patient
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /patient/rehab-history [get]
func (h *Handler) GetRehabHistory(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	history, total, err := h.service.GetRehabHistory(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, history, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}
