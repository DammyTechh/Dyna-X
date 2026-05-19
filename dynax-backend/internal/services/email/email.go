package email

import (
	"fmt"

	"github.com/resend/resend-go/v2"

	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

// Client wraps the Resend API client with DynaX-specific helpers.
type Client struct {
	client    *resend.Client
	fromEmail string
	fromName  string
}

// New creates a new email client from config.
func New(cfg *config.Config) *Client {
	return &Client{
		client:    resend.NewClient(cfg.Resend.APIKey),
		fromEmail: cfg.Resend.FromEmail,
		fromName:  cfg.Resend.FromName,
	}
}

func (c *Client) from() string {
	return fmt.Sprintf("%s <%s>", c.fromName, c.fromEmail)
}

// ── Template helpers ──────────────────────────────────────────────────────────

// SendWelcome sends the onboarding welcome email.
func (c *Client) SendWelcome(to, name, role string) error {
	subject := "Welcome to DynaX — Your Rehabilitation Platform"
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">Welcome to DynaX, %s!</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Your account has been created as a <strong>%s</strong>. 
      You can now log in and start using the platform.
    </p>
    <a href="https://dynax.dynalimb.com/login"
       style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
      Get Started →
    </a>
    <p style="color:#888;font-size:14px;margin-top:32px;">
      Need help? Reply to this email or contact support@dynalimb.com
    </p>
  </div>
</body>
</html>`, name, role)

	return c.send(to, subject, html)
}

// SendPasswordReset sends a password reset link.
func (c *Client) SendPasswordReset(to, name, resetURL string) error {
	subject := "Reset Your DynaX Password"
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">Password Reset Request</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Hi %s, we received a request to reset your DynaX password.
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <a href="%s"
       style="display:inline-block;background:#dc2626;color:#fff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
      Reset Password
    </a>
    <p style="color:#888;font-size:14px;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`, name, resetURL)

	return c.send(to, subject, html)
}

// SendProfessionalApproved notifies a professional their account is approved.
func (c *Client) SendProfessionalApproved(to, name string) error {
	subject := "🎉 Your DynaX Professional Account is Approved!"
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">You're Approved, %s!</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Your professional account on DynaX has been reviewed and <strong>approved</strong>.
      You can now accept patients, schedule sessions, and access all professional features.
    </p>
    <a href="https://dynax.dynalimb.com/professional/dashboard"
       style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
      Go to Dashboard →
    </a>
  </div>
</body>
</html>`, name)

	return c.send(to, subject, html)
}

// SendProfessionalRejected notifies a professional their account was rejected.
func (c *Client) SendProfessionalRejected(to, name, notes string) error {
	subject := "Update on Your DynaX Professional Application"
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">Application Update</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Hi %s, after reviewing your application we are unable to approve your account at this time.
    </p>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin:20px 0;">
      <p style="color:#991b1b;margin:0;font-size:15px;"><strong>Reviewer notes:</strong> %s</p>
    </div>
    <p style="color:#555;font-size:16px;">
      Please contact <a href="mailto:support@dynalimb.com">support@dynalimb.com</a> 
      if you believe this was an error or have questions.
    </p>
  </div>
</body>
</html>`, name, notes)

	return c.send(to, subject, html)
}

// SendAppointmentReminder sends an appointment reminder.
func (c *Client) SendAppointmentReminder(to, patientName, professionalName, datetime, sessionType string) error {
	subject := fmt.Sprintf("Reminder: Session with %s Tomorrow", professionalName)
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">Session Reminder</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">Hi %s,</p>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      You have an upcoming <strong>%s session</strong> with <strong>%s</strong> scheduled for:
    </p>
    <div style="background:#eff6ff;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#1d4ed8;font-size:20px;font-weight:700;margin:0;">%s</p>
    </div>
    <a href="https://dynax.dynalimb.com/appointments"
       style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
      View Details →
    </a>
  </div>
</body>
</html>`, patientName, sessionType, professionalName, datetime)

	return c.send(to, subject, html)
}

// SendPatientConnected notifies a professional a patient has connected.
func (c *Client) SendPatientConnected(to, professionalName, patientName string) error {
	subject := fmt.Sprintf("New Patient: %s has connected with you", patientName)
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;">
    <img src="https://dynalimb.com/logo.png" alt="DynaX" style="height:40px;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;">New Patient Connected</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Hi %s, <strong>%s</strong> has used your personal code to connect with you on DynaX.
      You can now view their profile and schedule appointments.
    </p>
    <a href="https://dynax.dynalimb.com/professional/patients"
       style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
      View Patient →
    </a>
  </div>
</body>
</html>`, professionalName, patientName)

	return c.send(to, subject, html)
}

// ── Core send ─────────────────────────────────────────────────────────────────

func (c *Client) send(to, subject, html string) error {
	params := &resend.SendEmailRequest{
		From:    c.from(),
		To:      []string{to},
		Subject: subject,
		Html:    html,
	}

	resp, err := c.client.Emails.Send(params)
	if err != nil {
		logger.Get().Error().Err(err).Str("to", to).Str("subject", subject).Msg("email send failed")
		return err
	}

	logger.Get().Info().Str("id", resp.Id).Str("to", to).Str("subject", subject).Msg("email sent")
	return nil
}
