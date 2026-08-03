package repository

import (
	"context"
	"encoding/json"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// NotificationRepository handles in-app notifications.
type NotificationRepository struct{ db *db.Pool }

func NewNotificationRepository(db *db.Pool) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) List(ctx context.Context, userID string, q *models.PaginationQuery) ([]models.Notification, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.notifications WHERE user_id=$1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, type, title, body, data, is_read, read_at, created_at
		 FROM public.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		userID, q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		var data []byte
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &data, &n.IsRead, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		if len(data) > 0 {
			_ = json.Unmarshal(data, &n.Data)
		}
		out = append(out, n)
	}
	return out, total, rows.Err()
}

func (r *NotificationRepository) MarkRead(ctx context.Context, userID, id string) error {
	return r.db.ExecOne(ctx,
		`UPDATE public.notifications SET is_read=TRUE, read_at=NOW() WHERE id=$1 AND user_id=$2`, id, userID)
}

func (r *NotificationRepository) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.notifications SET is_read=TRUE, read_at=NOW() WHERE user_id=$1 AND is_read=FALSE`, userID)
	return err
}

func (r *NotificationRepository) UnreadCount(ctx context.Context, userID string) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM public.notifications WHERE user_id=$1 AND is_read=FALSE`, userID).Scan(&n)
	return n, err
}

// Create pushes a new notification (used by other services).
// OnNotify, if set, is invoked (in a goroutine) after every notification is
// created. It exists so an optional web-push sender can deliver a push for the
// same event without this package depending on any push library. Default nil.
// The notification's type and data payload are passed through so the push can
// carry the same routing information the in-app notification has (e.g. the
// room_id and call_url of an incoming call).
var OnNotify func(userID, ntype, title, body string, data interface{})

func (r *NotificationRepository) Create(ctx context.Context, userID, ntype, title, body string, data interface{}) error {
	raw, _ := json.Marshal(data)
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.notifications (user_id, type, title, body, data)
		 VALUES ($1,$2::notification_type,$3,$4,$5::jsonb)`,
		userID, ntype, title, body, string(raw))
	if err == nil && OnNotify != nil {
		go OnNotify(userID, ntype, title, body, data)
	}
	return err
}

// Broadcast creates a 'general' notification for every active user, optionally
// filtered by role ("all", "patient", "physiotherapist", ...).
func (r *NotificationRepository) Broadcast(ctx context.Context, audience, title, body string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.notifications (user_id, type, title, body)
		 SELECT id, 'general'::notification_type, $1, $2
		 FROM public.dynax_users
		 WHERE ($3 = 'all' OR role::text = $3) AND is_active = true`,
		title, body, audience)
	return err
}

// ─── Web push subscriptions ───────────────────────────────────────────────────

// PushSubscription is a stored browser push endpoint for a user.
type PushSubscription struct {
	UserID   string
	Endpoint string
	P256dh   string
	Auth     string
}

// SaveSubscription upserts a browser push subscription (unique by endpoint).
func (r *NotificationRepository) SaveSubscription(ctx context.Context, userID, endpoint, p256dh, auth string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
		userID, endpoint, p256dh, auth)
	return err
}

// DeleteSubscription removes a subscription by endpoint (e.g. on unsubscribe or 410 Gone).
func (r *NotificationRepository) DeleteSubscription(ctx context.Context, endpoint string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM public.push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}

// ListSubscriptions returns all push subscriptions for a user (used by the optional push sender).
func (r *NotificationRepository) ListSubscriptions(ctx context.Context, userID string) ([]PushSubscription, error) {
	rows, err := r.db.Query(ctx, `SELECT user_id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PushSubscription{}
	for rows.Next() {
		var s PushSubscription
		if err := rows.Scan(&s.UserID, &s.Endpoint, &s.P256dh, &s.Auth); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
