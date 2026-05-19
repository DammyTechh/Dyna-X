package sessions

import (
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
	"github.com/gin-gonic/gin"
)

// Handler handles messaging / chat endpoints.
type Handler struct {
	service Service
}

type Service interface {
	GetConversations(userID string) ([]models.Conversation, error)
	GetOrCreateConversation(userID, targetID string) (*models.Conversation, error)
	GetMessages(userID, conversationID string, q *models.PaginationQuery) ([]models.Message, int64, error)
	SendMessage(userID, senderType, conversationID string, req *models.SendMessageRequest) (*models.Message, error)
	MarkConversationRead(userID, conversationID string) error
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// ListConversations godoc
// @Summary      List conversations
// @Description  Returns all conversations (chats) the authenticated user participates in.
// @Tags         messaging
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=[]models.Conversation}
// @Failure      401  {object}  response.Envelope
// @Router       /messages/conversations [get]
func (h *Handler) ListConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convs, err := h.service.GetConversations(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Conversations retrieved", convs)
}

// GetOrCreateConversation godoc
// @Summary      Get or create a conversation
// @Description  Returns an existing conversation with a user or creates a new one.
// @Tags         messaging
// @Security     BearerAuth
// @Produce      json
// @Param        conversation_id  path  string  true  "Target user UUID"
// @Success      200  {object}  response.Envelope{data=models.Conversation}
// @Failure      404  {object}  response.Envelope
// @Router       /messages/conversations/{conversation_id} [post]
func (h *Handler) GetOrCreateConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	targetID := c.Param("conversation_id")
	conv, err := h.service.GetOrCreateConversation(userID, targetID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Conversation ready", conv)
}

// GetMessages godoc
// @Summary      Get messages in a conversation
// @Description  Returns paginated messages in a specific conversation.
// @Tags         messaging
// @Security     BearerAuth
// @Produce      json
// @Param        conversation_id  path   string  true   "Conversation UUID"
// @Param        page             query  int     false  "Page"
// @Param        page_size        query  int     false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.Message}
// @Failure      403  {object}  response.Envelope
// @Router       /messages/conversations/{conversation_id}/messages [get]
func (h *Handler) GetMessages(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	convID := c.Param("conversation_id")
	msgs, total, err := h.service.GetMessages(userID, convID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, msgs, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// SendMessage godoc
// @Summary      Send a message
// @Description  Sends a message in a conversation.
// @Tags         messaging
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        conversation_id  path  string                     true  "Conversation UUID"
// @Param        body             body  models.SendMessageRequest  true  "Message content"
// @Success      201  {object}  response.Envelope{data=models.Message}
// @Failure      400  {object}  response.Envelope
// @Router       /messages/conversations/{conversation_id}/messages [post]
func (h *Handler) SendMessage(c *gin.Context) {
	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	role := middleware.GetRole(c)
	convID := c.Param("conversation_id")

	// Map role to sender_type
	senderType := "professional"
	if role == "patient" {
		senderType = "patient"
	} else if role == "admin" {
		senderType = "admin"
	}

	msg, err := h.service.SendMessage(userID, senderType, convID, &req)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Message sent", msg)
}

// MarkConversationRead godoc
// @Summary      Mark conversation as read
// @Description  Marks all messages in a conversation as read by the current user.
// @Tags         messaging
// @Security     BearerAuth
// @Produce      json
// @Param        conversation_id  path  string  true  "Conversation UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /messages/conversations/{conversation_id}/read [post]
func (h *Handler) MarkConversationRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convID := c.Param("conversation_id")
	if err := h.service.MarkConversationRead(userID, convID); err != nil {
		response.NotFound(c, "Conversation")
		return
	}
	response.OK(c, "Conversation marked as read", nil)
}
