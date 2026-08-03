// Package scheduler runs periodic jobs that fire time-based reminders:
// appointment reminders, follow-up check-in reminders, TheraPay payment
// reminders, and unread-message emails. Each job is idempotent — it marks rows
// as reminded so a reminder is never sent twice.
package scheduler

import (
	"context"
	"strconv"
	"time"

	"github.com/dynalimb/dynax-backend/internal/repository"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
	"github.com/dynalimb/dynax-backend/internal/services/email"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

// Scheduler holds the dependencies the jobs need.
type Scheduler struct {
	pool   *db.Pool
	mailer *email.Client
	notif  *repository.NotificationRepository
}

// New builds a Scheduler.
func New(pool *db.Pool, mailer *email.Client, notif *repository.NotificationRepository) *Scheduler {
	return &Scheduler{pool: pool, mailer: mailer, notif: notif}
}

// Start launches the scheduler loop in a background goroutine. It runs once
// shortly after boot and then every `interval`. It stops when ctx is cancelled.
func (s *Scheduler) Start(ctx context.Context, interval time.Duration) {
	go func() {
		time.Sleep(25 * time.Second) // let the server finish booting
		s.RunOnce(ctx)
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				s.RunOnce(ctx)
			}
		}
	}()
}

// RunOnce executes every job a single time. It is safe to call from an HTTP
// trigger (e.g. an external cron) as well as from the internal loop.
func (s *Scheduler) RunOnce(ctx context.Context) {
	log := logger.Get()
	jobs := []struct {
		name string
		fn   func(context.Context) (int, error)
	}{
		{"appointment_reminders", s.appointmentReminders},
		{"followup_reminders", s.followUpReminders},
		{"therapay_reminders", s.therapayReminders},
		{"missed_messages", s.missedMessages},
		{"rehab_credit_escalation", s.rehabCreditEscalation},
	}
	for _, j := range jobs {
		n, err := j.fn(ctx)
		if err != nil {
			log.Error().Err(err).Str("job", j.name).Msg("scheduler job failed")
			continue
		}
		if n > 0 {
			log.Info().Int("count", n).Str("job", j.name).Msg("scheduler job ran")
		}
	}
}

// appointmentReminders emails + notifies patients about sessions in the next 24h.
func (s *Scheduler) appointmentReminders(ctx context.Context) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.patient_id, u.email,
		       COALESCE(pp.full_name, ''), COALESCE(tp.full_name, 'your professional'),
		       to_char(a.scheduled_at, 'Dy, Mon FMDD at FMHH12:MI AM'),
		       a.session_type::text
		FROM public.appointments a
		JOIN public.dynax_users u ON u.id = a.patient_id
		LEFT JOIN public.patient_profiles   pp ON pp.user_id = a.patient_id
		LEFT JOIN public.therapist_profiles tp ON tp.user_id = a.professional_id
		WHERE a.status = 'scheduled'
		  AND a.reminder_sent_at IS NULL
		  AND a.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'`)
	if err != nil {
		return 0, err
	}
	type item struct{ id, patientID, emailAddr, name, prof, when, stype string }
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.patientID, &it.emailAddr, &it.name, &it.prof, &it.when, &it.stype); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, it)
	}
	rows.Close()
	for _, it := range items {
		_ = s.mailer.SendAppointmentReminder(it.emailAddr, it.name, it.prof, it.when, it.stype)
		_ = s.notif.Create(ctx, it.patientID, "appointment_reminder", "Upcoming session",
			"You have a session with "+it.prof+" within 24 hours.", map[string]string{"appointment_id": it.id})
		_, _ = s.pool.Exec(ctx, `UPDATE public.appointments SET reminder_sent_at = NOW() WHERE id = $1`, it.id)
	}
	return len(items), nil
}

// followUpReminders emails + notifies patients (and their professional) when a
// scheduled follow-up becomes due.
func (s *Scheduler) followUpReminders(ctx context.Context) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT f.id, f.patient_id, f.professional_id, u.email, COALESCE(pp.full_name, '')
		FROM public.follow_ups f
		JOIN public.dynax_users u ON u.id = f.patient_id
		LEFT JOIN public.patient_profiles pp ON pp.user_id = f.patient_id
		WHERE f.status = 'scheduled'
		  AND f.reminded_at IS NULL
		  AND f.due_date <= CURRENT_DATE`)
	if err != nil {
		return 0, err
	}
	type item struct{ id, patientID, profID, emailAddr, name string }
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.patientID, &it.profID, &it.emailAddr, &it.name); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, it)
	}
	rows.Close()
	for _, it := range items {
		_ = s.mailer.SendFollowUpReminder(it.emailAddr, it.name)
		_ = s.notif.Create(ctx, it.patientID, "general", "Time for your check-in",
			"Your scheduled follow-up check-in is due.", map[string]string{"follow_up_id": it.id})
		_ = s.notif.Create(ctx, it.profID, "general", "Follow-up due",
			"A patient follow-up is now due.", map[string]string{"follow_up_id": it.id})
		_, _ = s.pool.Exec(ctx, `UPDATE public.follow_ups SET reminded_at = NOW() WHERE id = $1`, it.id)
	}
	return len(items), nil
}

// therapayReminders emails + notifies patients with an outstanding balance whose
// next payment is due (or overdue).
func (s *Scheduler) therapayReminders(ctx context.Context) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t.id, t.patient_id, u.email, COALESCE(pp.full_name, ''),
		       to_char(t.total_amount - t.amount_paid, 'FM999,999,999.00'),
		       COALESCE(to_char(t.next_payment_date, 'Mon FMDD, YYYY'), '')
		FROM public.therapay_plans t
		JOIN public.dynax_users u ON u.id = t.patient_id
		LEFT JOIN public.patient_profiles pp ON pp.user_id = t.patient_id
		WHERE t.status = 'active'
		  AND t.amount_paid < t.total_amount
		  AND t.next_payment_date IS NOT NULL
		  AND t.next_payment_date <= CURRENT_DATE + INTERVAL '2 days'
		  AND t.reminder_sent_at IS NULL`)
	if err != nil {
		return 0, err
	}
	type item struct{ id, patientID, emailAddr, name, amount, due string }
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.patientID, &it.emailAddr, &it.name, &it.amount, &it.due); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, it)
	}
	rows.Close()
	for _, it := range items {
		_ = s.mailer.SendPaymentReminder(it.emailAddr, it.name, "₦"+it.amount, it.due)
		_ = s.notif.Create(ctx, it.patientID, "payment_due", "Payment reminder",
			"You have an outstanding TheraPay balance of ₦"+it.amount+".", map[string]string{"plan_id": it.id})
		_, _ = s.pool.Exec(ctx, `UPDATE public.therapay_plans SET reminder_sent_at = NOW() WHERE id = $1`, it.id)
	}
	return len(items), nil
}

// rehabCreditEscalation nudges admin about Rehab Credit repayment checks whose
// due date has passed while still marked 'upcoming'.
//
// This job is deliberately informational. Mediloan is the lender and has no
// API, so an overdue due date only means "nobody has looked yet" — it is NOT
// evidence the patient missed a payment. The job therefore never marks a check
// missed, never touches a plan's status, and never advances the escalation
// ladder; it only tells admin to go read Mediloan's report and mark the checks
// accordingly. Idempotent: each check is only ever nudged once.
func (s *Scheduler) rehabCreditEscalation(ctx context.Context) (int, error) {
	var overdue int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		  FROM public.rehab_repayment_checks c
		  JOIN public.rehab_credit_plans p ON p.id = c.plan_id
		 WHERE c.status = 'upcoming'
		   AND c.due_date < CURRENT_DATE
		   AND c.overdue_notified_at IS NULL
		   AND p.status IN ('active','suspended')`).Scan(&overdue)
	if err != nil {
		return 0, err
	}
	if overdue == 0 {
		return 0, nil
	}

	admins, err := s.pool.Query(ctx,
		`SELECT id FROM public.dynax_users WHERE role = 'admin' AND is_active = TRUE`)
	if err != nil {
		return 0, err
	}
	var adminIDs []string
	for admins.Next() {
		var id string
		if err := admins.Scan(&id); err != nil {
			admins.Close()
			return 0, err
		}
		adminIDs = append(adminIDs, id)
	}
	admins.Close()

	count := strconv.Itoa(overdue)
	for _, id := range adminIDs {
		_ = s.notif.Create(ctx, id, "rehab_credit_update", "Rehab Credit repayments need review",
			count+" repayment checks are now overdue for review. Check Mediloan's report and mark each one on time or missed.",
			map[string]string{"overdue_count": count})
	}

	// Mark the batch nudged so the same checks don't re-notify next cycle.
	if _, err := s.pool.Exec(ctx, `
		UPDATE public.rehab_repayment_checks c
		   SET overdue_notified_at = NOW()
		  FROM public.rehab_credit_plans p
		 WHERE p.id = c.plan_id
		   AND c.status = 'upcoming'
		   AND c.due_date < CURRENT_DATE
		   AND c.overdue_notified_at IS NULL
		   AND p.status IN ('active','suspended')`); err != nil {
		return 0, err
	}
	return overdue, nil
}

// missedMessages emails users who have unread messages older than an hour.
func (s *Scheduler) missedMessages(ctx context.Context) (int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT x.recipient_id, u.email, COALESCE(pp.full_name, ''), COUNT(*)
		FROM (
		  SELECT m.id,
		    CASE
		      WHEN m.sender_id = c.patient_id      THEN COALESCE(c.professional_id, c.admin_id)
		      WHEN m.sender_id = c.professional_id THEN COALESCE(c.patient_id, c.admin_id)
		      ELSE COALESCE(c.patient_id, c.professional_id)
		    END AS recipient_id
		  FROM public.messages m
		  JOIN public.conversations c ON c.id = m.conversation_id
		  WHERE m.is_read = FALSE
		    AND m.email_notified_at IS NULL
		    AND m.created_at < NOW() - INTERVAL '1 hour'
		) x
		JOIN public.dynax_users u ON u.id = x.recipient_id
		LEFT JOIN public.patient_profiles pp ON pp.user_id = x.recipient_id
		WHERE x.recipient_id IS NOT NULL
		GROUP BY x.recipient_id, u.email, pp.full_name`)
	if err != nil {
		return 0, err
	}
	type item struct {
		recipientID, emailAddr, name string
		count                        int
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.recipientID, &it.emailAddr, &it.name, &it.count); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, it)
	}
	rows.Close()
	for _, it := range items {
		_ = s.mailer.SendMissedMessages(it.emailAddr, it.name, it.count)
	}
	// Mark the whole batch notified so we don't email again next cycle.
	_, _ = s.pool.Exec(ctx, `
		UPDATE public.messages SET email_notified_at = NOW()
		WHERE is_read = FALSE AND email_notified_at IS NULL AND created_at < NOW() - INTERVAL '1 hour'`)
	return len(items), nil
}
