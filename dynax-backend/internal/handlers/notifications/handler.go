package notifications

import (
	"os"

	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

type Service interface {
	GetNotifications(userID string, q *models.PaginationQuery) ([]models.Notification, int64, error)
	MarkRead(userID, notificationID string) error
	MarkAllRead(userID string) error
	GetUnreadCount(userID string) (int64, error)
	UpdatePreferences(userID string, prefs map[string]interface{}) error
	GetPreferences(userID string) (map[string]interface{}, error)
	SaveSubscription(userID, endpoint, p256dh, auth string) error
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// ListNotifications godoc
// @Summary      List notifications
// @Description  Returns paginated in-app notifications for the authenticated user.
// @Tags         notifications
// @Security     BearerAuth
// @Produce      json
// @Param        page       query  int  false  "Page"
// @Param        page_size  query  int  false  "Page size"
// @Success      200  {object}  response.Envelope{data=[]models.Notification}
// @Failure      401  {object}  response.Envelope
// @Router       /notifications [get]
func (h *Handler) ListNotifications(c *gin.Context) {
	var q models.PaginationQuery
	_ = c.ShouldBindQuery(&q)
	userID := middleware.GetUserID(c)
	notifs, total, err := h.service.GetNotifications(userID, &q)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	totalPages := int((total + int64(q.PageSize) - 1) / int64(q.PageSize))
	response.Paginated(c, notifs, &response.Meta{
		Page: q.Page, PageSize: q.PageSize, Total: total, TotalPages: totalPages,
	})
}

// MarkRead godoc
// @Summary      Mark a notification as read
// @Description  Marks a single notification as read.
// @Tags         notifications
// @Security     BearerAuth
// @Produce      json
// @Param        notification_id  path  string  true  "Notification UUID"
// @Success      200  {object}  response.Envelope
// @Failure      404  {object}  response.Envelope
// @Router       /notifications/{notification_id}/read [post]
func (h *Handler) MarkRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	notifID := c.Param("notification_id")
	if err := h.service.MarkRead(userID, notifID); err != nil {
		response.NotFound(c, "Notification")
		return
	}
	response.OK(c, "Notification marked as read", nil)
}

// MarkAllRead godoc
// @Summary      Mark all notifications as read
// @Description  Marks all the user's notifications as read.
// @Tags         notifications
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /notifications/read-all [post]
func (h *Handler) MarkAllRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if err := h.service.MarkAllRead(userID); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "All notifications marked as read", nil)
}

// GetUnreadCount godoc
// @Summary      Get unread notification count
// @Description  Returns the number of unread notifications for the authenticated user.
// @Tags         notifications
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /notifications/unread-count [get]
func (h *Handler) GetUnreadCount(c *gin.Context) {
	userID := middleware.GetUserID(c)
	count, err := h.service.GetUnreadCount(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Unread count", gin.H{"unread_count": count})
}

// GetPreferences godoc
// @Summary      Get notification preferences
// @Description  Returns the user's notification preference settings.
// @Tags         notifications
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /notifications/preferences [get]
func (h *Handler) GetPreferences(c *gin.Context) {
	userID := middleware.GetUserID(c)
	prefs, err := h.service.GetPreferences(userID)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Preferences retrieved", prefs)
}

// UpdatePreferences godoc
// @Summary      Update notification preferences
// @Description  Updates the user's notification preference settings.
// @Tags         notifications
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "Preference settings"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /notifications/preferences [patch]
func (h *Handler) UpdatePreferences(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.service.UpdatePreferences(userID, body); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Preferences updated", nil)
}

// VapidPublicKey returns the server's VAPID public key so the browser can subscribe.
func (h *Handler) VapidPublicKey(c *gin.Context) {
	response.OK(c, "VAPID key", map[string]string{"public_key": os.Getenv("VAPID_PUBLIC_KEY")})
}

// SubscribePush stores a browser web-push subscription for the current user.
func (h *Handler) SubscribePush(c *gin.Context) {
	var body struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Endpoint == "" || body.Keys.P256dh == "" || body.Keys.Auth == "" {
		response.BadRequest(c, "INVALID_SUBSCRIPTION", "A valid push subscription is required")
		return
	}
	if err := h.service.SaveSubscription(middleware.GetUserID(c), body.Endpoint, body.Keys.P256dh, body.Keys.Auth); err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Subscribed to push notifications", nil)
}
