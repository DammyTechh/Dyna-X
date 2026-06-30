package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// MessagingRepository handles conversations and messages.
type MessagingRepository struct{ db *db.Pool }

func NewMessagingRepository(db *db.Pool) *MessagingRepository { return &MessagingRepository{db: db} }

func (r *MessagingRepository) ListConversations(ctx context.Context, userID string) ([]models.Conversation, error) {
	const q = `
		SELECT id, patient_id, professional_id, admin_id, last_message, last_message_at,
		       CASE WHEN patient_id=$1 THEN unread_patient_count
		            WHEN professional_id=$1 THEN unread_professional_count
		            ELSE unread_admin_count END AS unread,
		       created_at
		FROM public.conversations
		WHERE (patient_id=$1 OR professional_id=$1 OR admin_id=$1) AND is_archived=FALSE
		ORDER BY last_message_at DESC NULLS LAST`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Conversation{}
	for rows.Next() {
		var c models.Conversation
		if err := rows.Scan(&c.ID, &c.PatientID, &c.ProfessionalID, &c.AdminID,
			&c.LastMessage, &c.LastMessageAt, &c.UnreadCount, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetOrCreate finds (or creates) a conversation containing both users.
func (r *MessagingRepository) GetOrCreate(ctx context.Context, userID, userRole, targetID, targetRole string) (*models.Conversation, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`SELECT id FROM public.conversations
		 WHERE (patient_id=$1 OR professional_id=$1 OR admin_id=$1)
		   AND (patient_id=$2 OR professional_id=$2 OR admin_id=$2) LIMIT 1`,
		userID, targetID).Scan(&id)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		patient, professional, admin := assignParticipants(userID, userRole, targetID, targetRole)
		if err := r.db.QueryRow(ctx,
			`INSERT INTO public.conversations (patient_id, professional_id, admin_id)
			 VALUES ($1,$2,$3) RETURNING id`, patient, professional, admin).Scan(&id); err != nil {
			return nil, err
		}
	}
	return r.findConversation(ctx, id)
}

// GetByID returns a conversation (with participants) by id.
func (r *MessagingRepository) GetByID(ctx context.Context, id string) (*models.Conversation, error) {
	return r.findConversation(ctx, id)
}

func (r *MessagingRepository) findConversation(ctx context.Context, id string) (*models.Conversation, error) {
	c := &models.Conversation{}
	err := r.db.QueryRow(ctx,
		`SELECT id, patient_id, professional_id, admin_id, last_message, last_message_at, 0, created_at
		 FROM public.conversations WHERE id=$1`, id).
		Scan(&c.ID, &c.PatientID, &c.ProfessionalID, &c.AdminID, &c.LastMessage, &c.LastMessageAt, &c.UnreadCount, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func assignParticipants(userID, userRole, targetID, targetRole string) (patient, professional, admin *string) {
	set := func(role, id string) {
		switch role {
		case "patient":
			patient = strptr(id)
		case "admin":
			admin = strptr(id)
		default:
			professional = strptr(id)
		}
	}
	set(userRole, userID)
	set(targetRole, targetID)
	return
}

func strptr(s string) *string { return &s }

func (r *MessagingRepository) ListMessages(ctx context.Context, conversationID string, q *models.PaginationQuery) ([]models.Message, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.messages WHERE conversation_id=$1 AND is_deleted=FALSE`,
		conversationID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, conversation_id, sender_id, sender_type, content, file_url, file_name, is_read, read_at, created_at
		 FROM public.messages WHERE conversation_id=$1 AND is_deleted=FALSE
		 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
		conversationID, q.PageSize, q.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.Message{}
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderType, &m.Content,
			&m.FileURL, &m.FileName, &m.IsRead, &m.ReadAt, &m.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, rows.Err()
}

func (r *MessagingRepository) SendMessage(ctx context.Context, conversationID, senderID, senderType string, req *models.SendMessageRequest) (*models.Message, error) {
	const q = `
		INSERT INTO public.messages (conversation_id, sender_id, sender_type, content, file_url, file_name)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, conversation_id, sender_id, sender_type, content, file_url, file_name, is_read, read_at, created_at`
	m := &models.Message{}
	err := r.db.QueryRow(ctx, q, conversationID, senderID, senderType, req.Content,
		nilIfEmptyStr(req.FileURL), nilIfEmptyStr(req.FileName)).
		Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderType, &m.Content,
			&m.FileURL, &m.FileName, &m.IsRead, &m.ReadAt, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	// Update conversation summary + bump the recipients' unread counters.
	_, _ = r.db.Exec(ctx,
		`UPDATE public.conversations SET
		   last_message=$2, last_message_at=NOW(), updated_at=NOW(),
		   unread_patient_count = unread_patient_count + CASE WHEN $3='patient' THEN 0 ELSE 1 END,
		   unread_professional_count = unread_professional_count + CASE WHEN $3='professional' THEN 0 ELSE 1 END,
		   unread_admin_count = unread_admin_count + CASE WHEN $3='admin' THEN 0 ELSE 1 END
		 WHERE id=$1`, conversationID, req.Content, senderType)
	return m, nil
}

func (r *MessagingRepository) MarkRead(ctx context.Context, userID, conversationID string) error {
	_, _ = r.db.Exec(ctx,
		`UPDATE public.messages SET is_read=TRUE, read_at=NOW()
		 WHERE conversation_id=$1 AND sender_id<>$2 AND is_read=FALSE`, conversationID, userID)
	return r.db.ExecOne(ctx,
		`UPDATE public.conversations SET
		   unread_patient_count = CASE WHEN patient_id=$2 THEN 0 ELSE unread_patient_count END,
		   unread_professional_count = CASE WHEN professional_id=$2 THEN 0 ELSE unread_professional_count END,
		   unread_admin_count = CASE WHEN admin_id=$2 THEN 0 ELSE unread_admin_count END
		 WHERE id=$1`, conversationID, userID)
}
