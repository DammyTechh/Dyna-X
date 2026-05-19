package emr

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles EMR / clinical notes endpoints.
type Handler struct {
	service Service
}

type Service interface {
	CreateNote(professionalID string, req *models.CreateClinicalNoteRequest) (*models.ClinicalNote, error)
	GetNotes(professionalID, patientID string, q *models.PaginationQuery) ([]models.ClinicalNote, int64, error)
	GetNote(professionalID, noteID string) (*models.ClinicalNote, error)
	UpdateNote(professionalID, noteID string, content string) (*models.ClinicalNote, error)
	DeleteNote(professionalID, noteID string) error
	CreateCarePlan(professionalID string, req *models.CreateCarePlanRequest) (*models.CarePlan, error)
	GetCarePlans(professionalID, patientID string) ([]models.CarePlan, error)
	UpdateCarePlan(professionalID, planID string, status, notes *string) (*models.CarePlan, error)
	CreateDeviceMeasurement(professionalID string, req *models.CreateDeviceMeasurementRequest) (*models.DeviceMeasurement, error)
	GetDeviceMeasurements(professionalID, patientID string) ([]models.DeviceMeasurement, error)
	UpdateDeviceStatus(professionalID, deviceID, status string) (*models.DeviceMeasurement, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// ─── Clinical Notes ───────────────────────────────────────────────────────────

// CreateNote godoc
// @Summary      Create a clinical note
// @Description  Creates a new clinical note (SOAP, progress, assessment, referral) for a patient.
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateClinicalNoteRequest  true  "Note payload"
// @Success      201   {object}  response.Envelope{data=models.ClinicalNote}
// @Failure      400   {object}  response.Envelope
// @Failure      401   {object}  response.Envelope
// @Router       /emr/notes [post]
func (h *Handler) CreateNote(c *gin.Context) {
	var req models.CreateClinicalNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	note, err := h.service.CreateNote(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Clinical note created", note)
}

// ListNotes godoc
// @Summary      List clinical notes
// @Description  Returns paginated clinical notes for a specific patient.
// @Tags         emr
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  query  string  true   "Patient UUID"
// @Param        page        query  int     false  "Page"
// @Param        page_size   query  int     false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.ClinicalNote}
// @Failure      400  {object}  response.Envelope
// @Router       /emr/notes [get]
func (h *Handler) ListNotes(c *gin.Context) {
	patientID := c.Query("patient_id")
	if patientID == "" {
		response.BadRequest(c, "MISSING_PARAM", "patient_id query parameter is required")
		return
	}
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	notes, total, err := h.service.GetNotes(userID, patientID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, notes, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetNote godoc
// @Summary      Get a clinical note
// @Description  Returns a single clinical note by ID.
// @Tags         emr
// @Security     BearerAuth
// @Produce      json
// @Param        note_id  path  string  true  "Note UUID"
// @Success      200  {object}  response.Envelope{data=models.ClinicalNote}
// @Failure      404  {object}  response.Envelope
// @Router       /emr/notes/{note_id} [get]
func (h *Handler) GetNote(c *gin.Context) {
	userID := middleware.GetUserID(c)
	noteID := c.Param("note_id")
	note, err := h.service.GetNote(userID, noteID)
	if err != nil {
		response.NotFound(c, "Note")
		return
	}
	response.OK(c, "Note retrieved", note)
}

// UpdateNote godoc
// @Summary      Update clinical note content
// @Description  Updates the content of an existing clinical note.
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        note_id  path  string  true  "Note UUID"
// @Param        body     body  object  true  "Updated content"
// @Success      200  {object}  response.Envelope{data=models.ClinicalNote}
// @Failure      404  {object}  response.Envelope
// @Router       /emr/notes/{note_id} [patch]
func (h *Handler) UpdateNote(c *gin.Context) {
	var body struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "content field is required")
		return
	}
	userID := middleware.GetUserID(c)
	noteID := c.Param("note_id")
	note, err := h.service.UpdateNote(userID, noteID, body.Content)
	if err != nil {
		response.NotFound(c, "Note")
		return
	}
	response.OK(c, "Note updated", note)
}

// DeleteNote godoc
// @Summary      Delete a clinical note
// @Description  Permanently deletes a clinical note (only by creator).
// @Tags         emr
// @Security     BearerAuth
// @Produce      json
// @Param        note_id  path  string  true  "Note UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /emr/notes/{note_id} [delete]
func (h *Handler) DeleteNote(c *gin.Context) {
	userID := middleware.GetUserID(c)
	noteID := c.Param("note_id")
	if err := h.service.DeleteNote(userID, noteID); err != nil {
		response.NotFound(c, "Note")
		return
	}
	response.OK(c, "Note deleted", nil)
}

// ─── Care Plans ───────────────────────────────────────────────────────────────

// CreateCarePlan godoc
// @Summary      Create care plan
// @Description  Creates a new rehabilitation care plan for a patient.
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateCarePlanRequest  true  "Care plan payload"
// @Success      201   {object}  response.Envelope{data=models.CarePlan}
// @Failure      400   {object}  response.Envelope
// @Router       /emr/care-plans [post]
func (h *Handler) CreateCarePlan(c *gin.Context) {
	var req models.CreateCarePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	plan, err := h.service.CreateCarePlan(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Care plan created", plan)
}

// ListCarePlans godoc
// @Summary      List care plans for a patient
// @Description  Returns all care plans for a specific patient.
// @Tags         emr
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  query  string  true  "Patient UUID"
// @Success      200  {object}  response.Envelope{data=[]models.CarePlan}
// @Failure      400  {object}  response.Envelope
// @Router       /emr/care-plans [get]
func (h *Handler) ListCarePlans(c *gin.Context) {
	patientID := c.Query("patient_id")
	if patientID == "" {
		response.BadRequest(c, "MISSING_PARAM", "patient_id query parameter is required")
		return
	}
	userID := middleware.GetUserID(c)
	plans, err := h.service.GetCarePlans(userID, patientID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Care plans retrieved", plans)
}

// UpdateCarePlan godoc
// @Summary      Update care plan
// @Description  Updates a care plan status and progress notes.
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        plan_id  path  string  true  "Care plan UUID"
// @Param        body     body  object  true  "Status and notes"
// @Success      200  {object}  response.Envelope{data=models.CarePlan}
// @Failure      404  {object}  response.Envelope
// @Router       /emr/care-plans/{plan_id} [patch]
func (h *Handler) UpdateCarePlan(c *gin.Context) {
	var body struct {
		Status *string `json:"status"`
		Notes  *string `json:"progress_notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	planID := c.Param("plan_id")
	plan, err := h.service.UpdateCarePlan(userID, planID, body.Status, body.Notes)
	if err != nil {
		response.NotFound(c, "Care plan")
		return
	}
	response.OK(c, "Care plan updated", plan)
}

// ─── Device Measurements (P&O) ────────────────────────────────────────────────

// CreateDeviceMeasurement godoc
// @Summary      Create device measurement record
// @Description  Records prosthetic or orthotic measurements for a patient (P&O professionals only).
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateDeviceMeasurementRequest  true  "Measurement payload"
// @Success      201   {object}  response.Envelope{data=models.DeviceMeasurement}
// @Failure      400   {object}  response.Envelope
// @Router       /emr/devices [post]
func (h *Handler) CreateDeviceMeasurement(c *gin.Context) {
	var req models.CreateDeviceMeasurementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	device, err := h.service.CreateDeviceMeasurement(userID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Device measurement recorded", device)
}

// ListDeviceMeasurements godoc
// @Summary      List device measurements for a patient
// @Description  Returns all prosthetic/orthotic measurement records for a patient.
// @Tags         emr
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  query  string  true  "Patient UUID"
// @Success      200  {object}  response.Envelope{data=[]models.DeviceMeasurement}
// @Failure      400  {object}  response.Envelope
// @Router       /emr/devices [get]
func (h *Handler) ListDeviceMeasurements(c *gin.Context) {
	patientID := c.Query("patient_id")
	if patientID == "" {
		response.BadRequest(c, "MISSING_PARAM", "patient_id query parameter is required")
		return
	}
	userID := middleware.GetUserID(c)
	devices, err := h.service.GetDeviceMeasurements(userID, patientID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Device measurements retrieved", devices)
}

// UpdateDeviceStatus godoc
// @Summary      Update device status
// @Description  Updates the fabrication/delivery status of a device measurement.
// @Tags         emr
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        device_id  path  string  true  "Device UUID"
// @Param        body       body  object  true  "New status"
// @Success      200  {object}  response.Envelope{data=models.DeviceMeasurement}
// @Failure      404  {object}  response.Envelope
// @Router       /emr/devices/{device_id}/status [patch]
func (h *Handler) UpdateDeviceStatus(c *gin.Context) {
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "status field is required")
		return
	}
	userID := middleware.GetUserID(c)
	deviceID := c.Param("device_id")
	device, err := h.service.UpdateDeviceStatus(userID, deviceID, body.Status)
	if err != nil {
		response.NotFound(c, "Device")
		return
	}
	response.OK(c, "Device status updated", device)
}
