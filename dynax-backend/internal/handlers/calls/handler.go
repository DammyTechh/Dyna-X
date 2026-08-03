// Package calls exposes the endpoints used to signal an incoming call. The
// notification it creates fires repository.OnNotify, so a web push goes out to
// the recipient's subscribed devices immediately.
package calls

import (
	"github.com/gin-gonic/gin"

	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

type Handler struct {
	service Service
}

// Service is the slice of notification behaviour this handler needs.
type Service interface {
	CreateNotification(userID, ntype, title, body string, data interface{}) error
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

type notifyRequest struct {
	RecipientID string `json:"recipient_id" binding:"required,uuid"`
	RoomID      string `json:"room_id"      binding:"required"`
	CallerName  string `json:"caller_name"  binding:"required"`
}

// Notify godoc
// @Summary      Notify a user of an incoming call
// @Description  Creates a call_incoming notification for the recipient, which also
// @Description  triggers a web push to their subscribed devices.
// @Tags         notifications
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "recipient_id, room_id, caller_name"
// @Success      200  {object}  response.Envelope
// @Failure      400  {object}  response.Envelope
// @Router       /calls/notify [post]
func (h *Handler) Notify(c *gin.Context) {
	var body notifyRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "recipient_id, room_id and caller_name are required")
		return
	}

	callerID := middleware.GetUserID(c)
	data := map[string]string{
		"type":      "call_incoming",
		"room_id":   body.RoomID,
		"caller_id": callerID,
		"call_url":  "/dashboard/messages?call=" + body.RoomID,
	}

	err := h.service.CreateNotification(
		body.RecipientID,
		"call_incoming",
		body.CallerName+" is calling you",
		"Tap to join the call",
		data,
	)
	if err != nil {
		response.InternalError(c, err)
		return
	}

	response.OK(c, "Call notification sent", gin.H{"room_id": body.RoomID})
}
