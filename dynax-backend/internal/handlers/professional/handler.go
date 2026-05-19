package professional

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles professional-facing endpoints.
type Handler struct {
	service Service
}

// Service defines professional business logic.
type Service interface {
	GetProfile(userID string) (*models.ProfessionalProfile, error)
	UpdateProfile(userID string, req *models.UpdateProfessionalProfileRequest) (*models.ProfessionalProfile, error)
	GetMyPatients(userID string, q *models.PaginationQuery) ([]models.PatientProfile, int64, error)
	GetPatient(professionalID, patientID string) (*models.PatientProfile, error)
	GeneratePersonalCode(userID string) (string, error)
	GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error)
	CreateAppointment(userID string, req *models.CreateAppointmentRequest) (*models.Appointment, error)
	UpdateAppointment(userID, appointmentID string, req *models.UpdateAppointmentRequest) (*models.Appointment, error)
	CancelAppointment(userID, appointmentID string) error
	GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error)
	CreateSession(userID string, req *models.CreateSessionRequest) (*models.TherapySession, error)
	GetSession(userID, sessionID string) (*models.TherapySession, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// ─── Profile ──────────────────────────────────────────────────────────────────

// GetProfile godoc
// @Summary      Get professional profile
// @Description  Returns the authenticated professional's profile details.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=models.ProfessionalProfile}
// @Failure      401  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /professional/profile [get]
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
// @Summary      Update professional profile
// @Description  Partially updates the authenticated professional's profile.
// @Tags         professional
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.UpdateProfessionalProfileRequest  true  "Fields to update"
// @Success      200   {object}  response.Envelope{data=models.ProfessionalProfile}
// @Failure      400   {object}  response.Envelope
// @Failure      401   {object}  response.Envelope
// @Router       /professional/profile [patch]
func (h *Handler) UpdateProfile(c *gin.Context) {
	var req models.UpdateProfessionalProfileRequest
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

// GeneratePersonalCode godoc
// @Summary      Generate or refresh personal PIN
// @Description  Generates a unique professional PIN that patients can use to connect.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=object}
// @Failure      401  {object}  response.Envelope
// @Router       /professional/generate-code [post]
func (h *Handler) GeneratePersonalCode(c *gin.Context) {
	userID := middleware.GetUserID(c)
	code, err := h.service.GeneratePersonalCode(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Personal code generated", gin.H{"personal_code": code})
}

// ─── Patients ─────────────────────────────────────────────────────────────────

// ListPatients godoc
// @Summary      List professional's patients
// @Description  Returns a paginated list of patients connected to this professional.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int     false  "Page number (default: 1)"
// @Param        page_size  query  int     false  "Items per page (default: 20)"
// @Param        search     query  string  false  "Search by name or email"
// @Success      200  {object}  response.Envelope{data=[]models.PatientProfile}
// @Failure      401  {object}  response.Envelope
// @Router       /professional/patients [get]
func (h *Handler) ListPatients(c *gin.Context) {
	var q models.PaginationQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		response.BadRequest(c, "INVALID_QUERY", "Invalid query parameters")
		return
	}
	userID := middleware.GetUserID(c)
	patients, total, err := h.service.GetMyPatients(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, patients, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetPatient godoc
// @Summary      Get a patient's details
// @Description  Returns full profile of a specific patient assigned to this professional.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  path  string  true  "Patient UUID"
// @Success      200  {object}  response.Envelope{data=models.PatientProfile}
// @Failure      403  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /professional/patients/{patient_id} [get]
func (h *Handler) GetPatient(c *gin.Context) {
	userID := middleware.GetUserID(c)
	patientID := c.Param("patient_id")
	patient, err := h.service.GetPatient(userID, patientID)
	if err != nil {
		response.NotFound(c, "Patient")
		return
	}
	response.OK(c, "Patient retrieved", patient)
}

// ─── Appointments ─────────────────────────────────────────────────────────────

// ListAppointments godoc
// @Summary      List appointments
// @Description  Returns paginated appointments for the authenticated professional.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int     false  "Page"
// @Param        page_size  query  int     false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.Appointment}
// @Failure      401  {object}  response.Envelope
// @Router       /professional/appointments [get]
func (h *Handler) ListAppointments(c *gin.Context) {
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

// CreateAppointment godoc
// @Summary      Create appointment
// @Description  Schedules a new appointment for a patient.
// @Tags         professional
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateAppointmentRequest  true  "Appointment details"
// @Success      201   {object}  response.Envelope{data=models.Appointment}
// @Failure      400   {object}  response.Envelope
// @Router       /professional/appointments [post]
func (h *Handler) CreateAppointment(c *gin.Context) {
	var req models.CreateAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	appt, err := h.service.CreateAppointment(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Appointment created", appt)
}

// UpdateAppointment godoc
// @Summary      Update appointment
// @Description  Updates an existing appointment (reschedule, status change, notes).
// @Tags         professional
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        appointment_id  path  string                         true  "Appointment UUID"
// @Param        body            body  models.UpdateAppointmentRequest  true  "Fields to update"
// @Success      200   {object}  response.Envelope{data=models.Appointment}
// @Failure      400   {object}  response.Envelope
// @Failure      404   {object}  response.Envelope
// @Router       /professional/appointments/{appointment_id} [patch]
func (h *Handler) UpdateAppointment(c *gin.Context) {
	var req models.UpdateAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	apptID := c.Param("appointment_id")
	appt, err := h.service.UpdateAppointment(userID, apptID, &req)
	if err != nil {
		response.NotFound(c, "Appointment")
		return
	}
	response.OK(c, "Appointment updated", appt)
}

// CancelAppointment godoc
// @Summary      Cancel appointment
// @Description  Cancels a scheduled appointment.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        appointment_id  path  string  true  "Appointment UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /professional/appointments/{appointment_id}/cancel [post]
func (h *Handler) CancelAppointment(c *gin.Context) {
	userID := middleware.GetUserID(c)
	apptID := c.Param("appointment_id")
	if err := h.service.CancelAppointment(userID, apptID); err != nil {
		response.NotFound(c, "Appointment")
		return
	}
	response.OK(c, "Appointment cancelled", nil)
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

// ListSessions godoc
// @Summary      List therapy sessions
// @Description  Returns paginated session logs for the professional.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.TherapySession}
// @Failure      401  {object}  response.Envelope
// @Router       /professional/sessions [get]
func (h *Handler) ListSessions(c *gin.Context) {
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

// CreateSession godoc
// @Summary      Log a therapy session
// @Description  Records a new session log (SOAP notes, duration, outcomes).
// @Tags         professional
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateSessionRequest  true  "Session data"
// @Success      201   {object}  response.Envelope{data=models.TherapySession}
// @Failure      400   {object}  response.Envelope
// @Router       /professional/sessions [post]
func (h *Handler) CreateSession(c *gin.Context) {
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	session, err := h.service.CreateSession(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Session logged", session)
}

// GetSession godoc
// @Summary      Get session detail
// @Description  Returns a single session log by ID.
// @Tags         professional
// @Security     BearerAuth
// @Produce      json
// @Param        session_id  path  string  true  "Session UUID"
// @Success      200  {object}  response.Envelope{data=models.TherapySession}
// @Failure      404  {object}  response.Envelope
// @Router       /professional/sessions/{session_id} [get]
func (h *Handler) GetSession(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sessionID := c.Param("session_id")
	session, err := h.service.GetSession(userID, sessionID)
	if err != nil {
		response.NotFound(c, "Session")
		return
	}
	response.OK(c, "Session retrieved", session)
}
