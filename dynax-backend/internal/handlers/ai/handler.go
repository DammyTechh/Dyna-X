package ai

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler handles AI assistant endpoints.
type Handler struct {
	service Service
}

type Service interface {
	Query(userID, role string, req *models.AIQueryRequest) (*models.AIConversation, error)
	GetHistory(userID string, q *models.PaginationQuery) ([]models.AIConversation, int64, error)
	GetConversation(userID, conversationID string) ([]models.AIConversation, error)
	DeleteConversation(userID, conversationID string) error
	GenerateSOAPNote(userID string, sessionContext map[string]interface{}) (string, error)
	GenerateCarePlanSuggestion(userID, patientID string) (string, error)
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// Query godoc
// @Summary      Send a message to the DynaX AI assistant
// @Description  Queries the AI assistant with context-aware prompting based on user role (professional, patient, admin).
// @Tags         ai
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.AIQueryRequest  true  "AI query"
// @Success      200   {object}  response.Envelope{data=models.AIConversation}
// @Failure      400   {object}  response.Envelope
// @Failure      401   {object}  response.Envelope
// @Router       /ai/query [post]
func (h *Handler) Query(c *gin.Context) {
	var req models.AIQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	role := middleware.GetRole(c)

	result, err := h.service.Query(userID, role, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "AI response generated", result)
}

// GetHistory godoc
// @Summary      Get AI conversation history
// @Description  Returns paginated AI assistant conversation history for the current user.
// @Tags         ai
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.AIConversation}
// @Failure      401  {object}  response.Envelope
// @Router       /ai/history [get]
func (h *Handler) GetHistory(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	history, total, err := h.service.GetHistory(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, history, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// GetConversation godoc
// @Summary      Get a full AI conversation thread
// @Description  Returns all messages in a specific AI conversation thread.
// @Tags         ai
// @Security     BearerAuth
// @Produce      json
// @Param        conversation_id  path  string  true  "Conversation UUID"
// @Success      200  {object}  response.Envelope{data=[]models.AIConversation}
// @Failure      404  {object}  response.Envelope
// @Router       /ai/conversations/{conversation_id} [get]
func (h *Handler) GetConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convID := c.Param("conversation_id")
	messages, err := h.service.GetConversation(userID, convID)
	if err != nil {
		response.NotFound(c, "Conversation")
		return
	}
	response.OK(c, "Conversation retrieved", messages)
}

// DeleteConversation godoc
// @Summary      Delete an AI conversation
// @Description  Permanently deletes an AI conversation thread and all its messages.
// @Tags         ai
// @Security     BearerAuth
// @Produce      json
// @Param        conversation_id  path  string  true  "Conversation UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /ai/conversations/{conversation_id} [delete]
func (h *Handler) DeleteConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convID := c.Param("conversation_id")
	if err := h.service.DeleteConversation(userID, convID); err != nil {
		response.NotFound(c, "Conversation")
		return
	}
	response.OK(c, "Conversation deleted", nil)
}

// GenerateSOAPNote godoc
// @Summary      AI-generate a SOAP note
// @Description  Generates a pre-filled SOAP note based on session context using AI (professional only).
// @Tags         ai
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "Session context (patient_id, session_id, observations)"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /ai/generate/soap-note [post]
func (h *Handler) GenerateSOAPNote(c *gin.Context) {
	var ctx map[string]interface{}
	if err := c.ShouldBindJSON(&ctx); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	note, err := h.service.GenerateSOAPNote(userID, ctx)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "SOAP note generated", gin.H{"soap_note": note})
}

// GenerateCarePlanSuggestion godoc
// @Summary      AI-generate care plan suggestions
// @Description  Generates AI-powered rehabilitation care plan suggestions for a patient.
// @Tags         ai
// @Security     BearerAuth
// @Produce      json
// @Param        patient_id  path  string  true  "Patient UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /ai/generate/care-plan/{patient_id} [post]
func (h *Handler) GenerateCarePlanSuggestion(c *gin.Context) {
	userID := middleware.GetUserID(c)
	patientID := c.Param("patient_id")
	suggestion, err := h.service.GenerateCarePlanSuggestion(userID, patientID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Care plan suggestion generated", gin.H{"suggestion": suggestion})
}
