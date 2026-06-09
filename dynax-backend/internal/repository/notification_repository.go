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
func (r *NotificationRepository) Create(ctx context.Context, userID, ntype, title, body string, data interface{}) error {
	raw, _ := json.Marshal(data)
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.notifications (user_id, type, title, body, data)
		 VALUES ($1,$2::notification_type,$3,$4,$5::jsonb)`,
		userID, ntype, title, body, string(raw))
	return err
}
