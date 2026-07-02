// Package push delivers Web Push notifications to a user's stored browser
// subscriptions. It is wired in through repository.OnNotify so that every
// in-app notification also fires a push.
//
// This file lives in _pushaddon/ (a directory Go's build ignores) so it never
// affects your live build until you deliberately enable it. To turn it on:
//
//  1. From the backend root, add the one dependency it needs:
//        go get github.com/SherClockHolmes/webpush-go
//
//  2. Move this file into the build tree:
//        mkdir -p internal/push && mv _pushaddon/push.go internal/push/push.go
//
//  3. In cmd/server/main.go, right after `notifRepo := repository.NewNotificationRepository(pool)`,
//     add these two lines (and add the import "github.com/dynalimb/dynax-backend/internal/push"):
//        pushSender := push.New(notifRepo)
//        repository.OnNotify = pushSender.Send
//
//  4. Generate a VAPID keypair once (any web-push VAPID generator works, e.g.
//     `npx web-push generate-vapid-keys`) and set these env vars on Render:
//        VAPID_PUBLIC_KEY   = <public key>
//        VAPID_PRIVATE_KEY  = <private key>
//     The same VAPID_PUBLIC_KEY is what the browser fetches from
//     GET /api/v1/notifications/push/vapid-key, so it must match.
//
//  5. Tidy and deploy:
//        go mod tidy
//
// After that, every notification created via repository.Create also sends a
// push to that user's subscribed devices.
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

// Sender holds the VAPID keys and the subscription store.
type Sender struct {
	notif   *repository.NotificationRepository
	pub     string
	priv    string
	subject string
}

// New builds a Sender from the VAPID_* environment variables.
func New(notif *repository.NotificationRepository) *Sender {
	return &Sender{
		notif:   notif,
		pub:     os.Getenv("VAPID_PUBLIC_KEY"),
		priv:    os.Getenv("VAPID_PRIVATE_KEY"),
		subject: "mailto:support@dynax.app",
	}
}

// Send delivers a push to every device the user has subscribed. It is safe to
// assign directly to repository.OnNotify. If VAPID keys are unset it no-ops.
func (s *Sender) Send(userID, title, body string) {
	if s.pub == "" || s.priv == "" {
		return
	}
	ctx := context.Background()
	subs, err := s.notif.ListSubscriptions(ctx, userID)
	if err != nil {
		return
	}
	payload, _ := json.Marshal(map[string]string{"title": title, "body": body, "url": "/dashboard"})
	for _, sub := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      s.subject,
			VAPIDPublicKey:  s.pub,
			VAPIDPrivateKey: s.priv,
			TTL:             60,
		})
		if err != nil {
			logger.Get().Warn().Err(err).Msg("push send failed")
			continue
		}
		if resp != nil {
			// 404/410 means the subscription is dead — prune it.
			if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
				_ = s.notif.DeleteSubscription(ctx, sub.Endpoint)
			}
			resp.Body.Close()
		}
	}
}
