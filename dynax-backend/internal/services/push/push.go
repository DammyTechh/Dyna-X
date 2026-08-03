// Package push delivers Web Push notifications to a user's stored browser
// subscriptions. It is wired in through repository.OnNotify so that every
// in-app notification also fires a push.
package push

import (
	"context"
	"encoding/json"
	"net/http"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/dynalimb/dynax-backend/internal/repository"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

// Flatten turns a notification's arbitrary data payload into the flat
// string map the service worker reads, always carrying the notification type
// so sw.js can branch on it (e.g. "call_incoming" gets answer/decline actions).
func Flatten(ntype string, data interface{}) map[string]string {
	out := map[string]string{"type": ntype}
	if data == nil {
		return out
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return out
	}
	var fields map[string]interface{}
	if err := json.Unmarshal(raw, &fields); err != nil {
		return out
	}
	for k, v := range fields {
		if k == "type" {
			continue // never let a payload override the real notification type
		}
		switch t := v.(type) {
		case string:
			out[k] = t
		case nil:
			// skip
		default:
			if b, err := json.Marshal(t); err == nil {
				out[k] = string(b)
			}
		}
	}
	return out
}

// Sender holds the VAPID credentials and the subscription store.
type Sender struct {
	notif      *repository.NotificationRepository
	vapidPub   string
	vapidPriv  string
	vapidEmail string
}

// NewSender builds a Sender from the VAPID_* environment variables.
func NewSender(notif *repository.NotificationRepository) *Sender {
	return &Sender{
		notif:      notif,
		vapidPub:   os.Getenv("VAPID_PUBLIC_KEY"),
		vapidPriv:  os.Getenv("VAPID_PRIVATE_KEY"),
		vapidEmail: os.Getenv("VAPID_CONTACT_EMAIL"),
	}
}

// IsConfigured reports whether a VAPID keypair is present.
func (s *Sender) IsConfigured() bool {
	return s.vapidPub != "" && s.vapidPriv != ""
}

// SendToUser delivers a push to every device the user has subscribed. It is
// safe to call from a goroutine and no-ops when VAPID keys are unset.
func (s *Sender) SendToUser(userID, title, body string, data map[string]string) {
	if !s.IsConfigured() {
		return
	}
	ctx := context.Background()
	subs, err := s.notif.ListSubscriptions(ctx, userID)
	if err != nil || len(subs) == 0 {
		return
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"title": title,
		"body":  body,
		"data":  data,
		"icon":  "/icons/icon-192.png",
		"badge": "/icons/icon-192.png",
	})

	subject := s.vapidEmail
	if subject == "" {
		subject = "support@dynax.app"
	}

	for _, sub := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      "mailto:" + subject,
			VAPIDPublicKey:  s.vapidPub,
			VAPIDPrivateKey: s.vapidPriv,
			TTL:             30,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			logger.Get().Warn().Err(err).Str("user_id", userID).Msg("push send failed")
			continue
		}
		// 404/410 means the subscription is dead — prune it.
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			_ = s.notif.DeleteSubscription(ctx, sub.Endpoint)
		}
		resp.Body.Close()
	}
}
