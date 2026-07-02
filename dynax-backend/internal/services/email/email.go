package email

import (
	"fmt"
	"time"

	"github.com/resend/resend-go/v2"

	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

// Brand constants — single source of truth for email styling/links.
const (
	appURL = "https://dynax.app"
	// Email logo must be an absolute, publicly reachable URL. It points at the
	// live frontend. Change this to https://dynax.app/... once that domain is live.
	logoURL   = "https://dynax.app/images/logo-light.png"
	supportTo = "support@dynax.app"
	orgName   = "Dynalimb Technologies"
	brandFrom = "#1D4ED8"
	brandTo   = "#0D9488"
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

// ── Shared layout ─────────────────────────────────────────────────────────────

// layout wraps body content in the branded DynaX email shell (header bar with
// logo, white card, footer). `preheader` is hidden inbox-preview text.
func layout(preheader, body string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">%s</span>
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:%s;background:linear-gradient(135deg,%s,%s);padding:26px 40px;text-align:center;">
            <img src="%s" alt="DynaX" height="36" style="height:36px;width:auto;display:inline-block;">
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            %s
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eef2f7;">
            <p style="margin:0 0 6px;color:#94a3b8;font-size:13px;line-height:1.6;">
              Need help? Contact us at <a href="mailto:%s" style="color:#2563eb;text-decoration:none;">%s</a>.
            </p>
            <p style="margin:0;color:#cbd5e1;font-size:12px;line-height:1.6;">
              DynaX — Connected rehabilitation, prosthetics &amp; therapy care.<br>
              &copy; %s, a product of %s. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;color:#cbd5e1;font-size:11px;">You received this email because you have a DynaX account.</p>
    </td></tr>
  </table>
</body>
</html>`, preheader, brandFrom, brandFrom, brandTo, logoURL, body, supportTo, supportTo, currentYear(), orgName)
}

// button renders a branded CTA button.
func button(label, url, color string) string {
	if color == "" {
		color = "#2563eb"
	}
	return fmt.Sprintf(`
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr><td style="border-radius:10px;background:%s;">
    <a href="%s" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">%s</a>
  </td></tr>
</table>`, color, url, label)
}

func h1(text string) string {
	return fmt.Sprintf(`<h1 style="margin:0 0 14px;color:#0f172a;font-size:23px;font-weight:700;line-height:1.3;">%s</h1>`, text)
}

func p(text string) string {
	return fmt.Sprintf(`<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.65;">%s</p>`, text)
}

func currentYear() string { return fmt.Sprintf("%d", time.Now().Year()) }

// ── Templates ─────────────────────────────────────────────────────────────────

// SendWelcome sends the onboarding welcome email.
func (c *Client) SendWelcome(to, name, role string) error {
	body := h1(fmt.Sprintf("Welcome to DynaX, %s!", name)) +
		p(fmt.Sprintf("Your account has been created as a <strong>%s</strong>. You can now sign in and start using the platform.", role)) +
		button("Get started →", appURL+"/auth/login", "")
	return c.send(to, "Welcome to DynaX — your rehabilitation platform", layout("Your DynaX account is ready.", body))
}

// otpEmail builds a branded OTP email body.
func (c *Client) otpEmail(name, code, heading, intro string) string {
	greeting := "there"
	if name != "" {
		greeting = name
	}
	codeBox := fmt.Sprintf(`
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
  <tr><td style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;padding:18px 30px;text-align:center;">
    <span style="font-size:34px;font-weight:700;letter-spacing:12px;color:#2563eb;font-family:'Courier New',monospace;">%s</span>
  </td></tr>
</table>`, code)
	body := h1(heading) +
		p(fmt.Sprintf("Hi %s, %s", greeting, intro)) +
		codeBox +
		p("This code expires in <strong>15 minutes</strong>. For your security, never share it with anyone.") +
		`<p style="margin:8px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>`
	return layout("Your DynaX verification code", body)
}

// SendVerificationOTP emails a 6-digit account verification code.
func (c *Client) SendVerificationOTP(to, name, code string) error {
	html := c.otpEmail(name, code,
		"Verify your email",
		"use the code below to confirm your email address and activate your DynaX account.")
	return c.send(to, "Your DynaX verification code", html)
}

// SendPasswordResetOTP emails a 6-digit password-reset code.
func (c *Client) SendPasswordResetOTP(to, name, code string) error {
	html := c.otpEmail(name, code,
		"Reset your password",
		"we received a request to reset your DynaX password. Use the code below to continue.")
	return c.send(to, "Your DynaX password reset code", html)
}

// SendPasswordReset sends a password reset link.
func (c *Client) SendPasswordReset(to, name, resetURL string) error {
	body := h1("Password reset request") +
		p(fmt.Sprintf("Hi %s, we received a request to reset your DynaX password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.", name)) +
		button("Reset password", resetURL, "#dc2626") +
		`<p style="margin:8px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>`
	return c.send(to, "Reset your DynaX password", layout("Reset your DynaX password", body))
}

// SendProfessionalApproved notifies a professional their account is approved.
func (c *Client) SendProfessionalApproved(to, name string) error {
	body := h1(fmt.Sprintf("You're approved, %s! 🎉", name)) +
		p("Your professional account on DynaX has been reviewed and <strong>approved</strong>. You can now accept patients, schedule sessions, and access all professional features.") +
		button("Go to dashboard →", appURL+"/dashboard/professional", "#16a34a")
	return c.send(to, "Your DynaX professional account is approved", layout("Your DynaX account is approved.", body))
}

// SendProfessionalRejected notifies a professional their account was rejected.
func (c *Client) SendProfessionalRejected(to, name, notes string) error {
	body := h1("Application update") +
		p(fmt.Sprintf("Hi %s, after reviewing your application we are unable to approve your account at this time.", name)) +
		fmt.Sprintf(`<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 18px;border-radius:8px;margin:0 0 16px;">
      <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;"><strong>Reviewer notes:</strong> %s</p>
    </div>`, notes) +
		p(fmt.Sprintf(`Please contact <a href="mailto:%s" style="color:#2563eb;text-decoration:none;">%s</a> if you believe this was an error or have questions.`, supportTo, supportTo))
	return c.send(to, "Update on your DynaX professional application", layout("An update on your DynaX application.", body))
}

// SendAppointmentReminder sends an appointment reminder.
func (c *Client) SendAppointmentReminder(to, patientName, professionalName, datetime, sessionType string) error {
	body := h1("Session reminder") +
		p(fmt.Sprintf("Hi %s,", patientName)) +
		p(fmt.Sprintf("You have an upcoming <strong>%s session</strong> with <strong>%s</strong> scheduled for:", sessionType, professionalName)) +
		fmt.Sprintf(`<div style="background:#eff6ff;border-radius:10px;padding:20px;margin:0 0 8px;text-align:center;">
      <p style="margin:0;color:#1d4ed8;font-size:19px;font-weight:700;">%s</p>
    </div>`, datetime) +
		button("View details →", appURL+"/dashboard/patient/appointments", "")
	return c.send(to, fmt.Sprintf("Reminder: session with %s", professionalName), layout("Your upcoming DynaX session.", body))
}

// SendPatientConnected notifies a professional a patient has connected.
func (c *Client) SendPatientConnected(to, professionalName, patientName string) error {
	body := h1("New patient connected") +
		p(fmt.Sprintf("Hi %s, <strong>%s</strong> has used your personal code to connect with you on DynaX. You can now view their profile and schedule appointments.", professionalName, patientName)) +
		button("View patient →", appURL+"/dashboard/professional/patients", "")
	return c.send(to, fmt.Sprintf("%s has connected with you on DynaX", patientName), layout("A new patient connected on DynaX.", body))
}

// SendDxPin emails a professional's DX PIN to a patient they have met, so the
// patient can enter it on their dashboard to connect.
func (c *Client) SendDxPin(to, professionalName, professionalEmail, code string) error {
	pinBox := fmt.Sprintf(`
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
  <tr><td style="background:%s;border-radius:12px;padding:16px 30px;text-align:center;">
    <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#ffffff;font-family:'Courier New',monospace;">%s</span>
  </td></tr>
</table>`, brandTo, code)
	body := h1(fmt.Sprintf("Connect with %s on DynaX", professionalName)) +
		p(fmt.Sprintf("%s (%s) has invited you to connect on DynaX. Sign in (or create your free patient account), open your dashboard, and enter the DX-PIN below to link your care.", professionalName, professionalEmail)) +
		pinBox +
		p("You only need the PIN above to connect.") +
		button("Go to my dashboard →", appURL+"/dashboard/patient", "") +
		`<p style="margin:8px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">If you don't recognise this invitation you can safely ignore this email.</p>`
	return c.send(to, fmt.Sprintf("Your DynaX connection PIN from %s", professionalName), layout("Your DynaX connection PIN.", body))
}

// SendPaymentReminder reminds a patient of an outstanding TheraPay balance.
func (c *Client) SendPaymentReminder(to, patientName, amount, dueDate string) error {
	greeting := "there"
	if patientName != "" {
		greeting = patientName
	}
	due := ""
	if dueDate != "" {
		due = p(fmt.Sprintf("Your next payment is due on <strong>%s</strong>.", dueDate))
	}
	body := h1("Payment reminder") +
		p(fmt.Sprintf("Hi %s,", greeting)) +
		p("This is a friendly reminder about your TheraPay plan. You have an outstanding balance of:") +
		fmt.Sprintf(`<div style="background:#fff7ed;border-radius:10px;padding:20px;margin:0 0 8px;text-align:center;">
      <p style="margin:0;color:#c2410c;font-size:22px;font-weight:700;">%s</p>
    </div>`, amount) +
		due +
		button("View my payments →", appURL+"/dashboard/patient/payments", "#ea580c")
	return c.send(to, "Reminder: your TheraPay balance", layout("A reminder about your TheraPay balance.", body))
}

// SendFollowUpReminder nudges a patient to complete a scheduled check-in.
func (c *Client) SendFollowUpReminder(to, patientName string) error {
	greeting := "there"
	if patientName != "" {
		greeting = patientName
	}
	body := h1("Time for your check-in") +
		p(fmt.Sprintf("Hi %s,", greeting)) +
		p("Your care team scheduled a follow-up check-in and it's now due. It only takes a minute — let them know how you've been doing since your last visit.") +
		button("Complete my check-in →", appURL+"/dashboard/patient/follow-ups", "")
	return c.send(to, "Your DynaX check-in is due", layout("Your follow-up check-in is due.", body))
}

// SendMissedMessages tells a user they have unread messages waiting.
func (c *Client) SendMissedMessages(to, name string, count int) error {
	greeting := "there"
	if name != "" {
		greeting = name
	}
	noun := "message"
	if count != 1 {
		noun = "messages"
	}
	body := h1("You have unread messages") +
		p(fmt.Sprintf("Hi %s,", greeting)) +
		p(fmt.Sprintf("You have <strong>%d unread %s</strong> waiting on DynaX. Sign in to read and reply.", count, noun)) +
		button("Open messages →", appURL+"/dashboard/messages", "")
	return c.send(to, "You have unread messages on DynaX", layout("You have unread messages waiting.", body))
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
