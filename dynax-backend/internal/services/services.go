// Package services provides concrete service implementations.
// These stubs satisfy the handler interfaces and show WHERE to plug in
// real Supabase/pgx queries. Replace each stub body with actual DB calls.
package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository"
	"github.com/dynalimb/dynax-backend/internal/services/email"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

// ─── Auth Service ─────────────────────────────────────────────────────────────

type AuthService struct {
	cfg    *config.Config
	jwtMgr *auth.Manager
	users  *repository.UserRepository
	profs  *repository.ProfessionalRepository
	otps   *repository.TokenRepository
	mailer *email.Client
}

func NewAuthService(
	cfg *config.Config,
	jwtMgr *auth.Manager,
	users *repository.UserRepository,
	profs *repository.ProfessionalRepository,
	otps *repository.TokenRepository,
	mailer *email.Client,
) *AuthService {
	return &AuthService{cfg: cfg, jwtMgr: jwtMgr, users: users, profs: profs, otps: otps, mailer: mailer}
}

const (
	otpVerify    = "verify"
	otpReset     = "reset"
	otpTTLVerify = 15 * time.Minute
	otpTTLReset  = 15 * time.Minute
)

// generateOTP returns a cryptographically-random 6-digit code.
func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// issueOTP creates + emails a fresh OTP for the given purpose.
func (s *AuthService) issueOTP(ctx context.Context, userID, email, name, purpose string) error {
	code, err := generateOTP()
	if err != nil {
		return err
	}
	ttl := otpTTLVerify
	if purpose == otpReset {
		ttl = otpTTLReset
	}
	if err := s.otps.Create(ctx, userID, hashCode(code), purpose, time.Now().Add(ttl)); err != nil {
		return err
	}

	var mailErr error
	switch purpose {
	case otpVerify:
		mailErr = s.mailer.SendVerificationOTP(email, name, code)
	case otpReset:
		mailErr = s.mailer.SendPasswordResetOTP(email, name, code)
	}
	if mailErr != nil {
		logger.Get().Error().Err(mailErr).Str("to", email).Str("purpose", purpose).Msg("failed to send OTP email")
	}
	return mailErr
}

func (s *AuthService) Register(req *models.RegisterRequest) (*models.AuthResponse, error) {
	ctx := context.Background()

	exists, err := s.users.EmailExists(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("email_already_exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), s.cfg.Security.BcryptCost)
	if err != nil {
		return nil, err
	}

	u, err := s.users.CreateLocal(ctx, req.Email, req.Role, string(hash))
	if err != nil {
		return nil, err
	}

	// Role-specific profile.
	switch req.Role {
	case models.RolePatient:
		if err := s.users.CreatePatientProfile(ctx, u.ID, req.FullName, req.Email); err != nil {
			return nil, err
		}
	default:
		if err := s.profs.Create(ctx, u.ID, req.FullName, req.Email, req.Role); err != nil {
			return nil, err
		}
	}

	// Send the verification OTP (best-effort; user can request a resend).
	_ = s.issueOTP(ctx, u.ID, req.Email, req.FullName, otpVerify)

	// No tokens are issued until the email is verified.
	return &models.AuthResponse{TokenType: "Bearer", User: *u}, nil
}

func (s *AuthService) Login(req *models.LoginRequest) (*models.AuthResponse, error) {
	ctx := context.Background()

	cred, err := s.users.GetCredentialsByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if cred == nil || cred.PasswordHash == "" {
		return nil, errors.New("invalid_credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid_credentials")
	}
	if !cred.IsActive {
		return nil, errors.New("account_disabled")
	}
	if !cred.IsVerified {
		return nil, errors.New("email_not_verified")
	}

	_ = s.users.UpdateLastLogin(ctx, cred.ID)

	pair, err := s.jwtMgr.Generate(cred.ID, cred.Email, cred.Role)
	if err != nil {
		return nil, err
	}
	return &models.AuthResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    int64(time.Until(pair.ExpiresAt).Seconds()),
		TokenType:    "Bearer",
		User: models.User{
			ID:    cred.ID,
			Email: cred.Email,
			Role:  cred.Role,
		},
	}, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (*models.AuthResponse, error) {
	claims, err := s.jwtMgr.Validate(refreshToken)
	if err != nil {
		return nil, errors.New("invalid_token")
	}
	if claims.Issuer != "dynax-api-refresh" {
		return nil, errors.New("invalid_token")
	}
	pair, err := s.jwtMgr.Generate(claims.UserID, claims.Email, claims.Role)
	if err != nil {
		return nil, err
	}
	return &models.AuthResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    int64(time.Until(pair.ExpiresAt).Seconds()),
		TokenType:    "Bearer",
		User:         models.User{ID: claims.UserID, Email: claims.Email, Role: claims.Role},
	}, nil
}

func (s *AuthService) ForgotPassword(email string) error {
	ctx := context.Background()
	cred, err := s.users.GetCredentialsByEmail(ctx, email)
	if err != nil || cred == nil {
		return nil // silent — don't reveal whether the email exists
	}
	_ = s.issueOTP(ctx, cred.ID, cred.Email, "", otpReset)
	return nil
}

func (s *AuthService) ResetPassword(email, code, newPassword string) error {
	ctx := context.Background()
	cred, err := s.users.GetCredentialsByEmail(ctx, email)
	if err != nil || cred == nil {
		return errors.New("invalid_code")
	}
	if err := s.otps.Consume(ctx, cred.ID, hashCode(code), otpReset); err != nil {
		return errors.New("invalid_code")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), s.cfg.Security.BcryptCost)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, cred.ID, string(hash))
}

func (s *AuthService) VerifyEmail(email, code string) error {
	ctx := context.Background()
	cred, err := s.users.GetCredentialsByEmail(ctx, email)
	if err != nil || cred == nil {
		return errors.New("invalid_code")
	}
	if cred.IsVerified {
		return nil // already verified — treat as success
	}
	if err := s.otps.Consume(ctx, cred.ID, hashCode(code), otpVerify); err != nil {
		return errors.New("invalid_code")
	}
	if err := s.users.SetVerified(ctx, cred.ID); err != nil {
		return err
	}
	// Welcome email after successful verification (best-effort).
	_ = s.mailer.SendWelcome(cred.Email, "", string(cred.Role))
	return nil
}

func (s *AuthService) ResendVerification(email string) error {
	ctx := context.Background()
	cred, err := s.users.GetCredentialsByEmail(ctx, email)
	if err != nil || cred == nil || cred.IsVerified {
		return nil // silent / no-op
	}
	_ = s.issueOTP(ctx, cred.ID, cred.Email, "", otpVerify)
	return nil
}

func (s *AuthService) ChangePassword(userID, current, newPwd string) error {
	ctx := context.Background()
	hash, err := s.users.GetPasswordHash(ctx, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(current)) != nil {
		return errors.New("invalid_credentials")
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPwd), s.cfg.Security.BcryptCost)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, userID, string(newHash))
}

func (s *AuthService) Logout(userID, token string) error {
	// Stateless JWT: nothing to do server-side. (Optionally blacklist in Redis.)
	return nil
}

// ─── Professional Service ─────────────────────────────────────────────────────

type ProfessionalService struct {
	cfg      *config.Config
	users    *repository.UserRepository
	profs    *repository.ProfessionalRepository
	appts    *repository.AppointmentRepository
	sessions *repository.SessionRepository
	conns    *repository.ConnectionRepository
	notif    *repository.NotificationRepository
	mailer   *email.Client
}

func NewProfessionalService(
	cfg *config.Config,
	users *repository.UserRepository,
	profs *repository.ProfessionalRepository,
	appts *repository.AppointmentRepository,
	sessions *repository.SessionRepository,
	conns *repository.ConnectionRepository,
	notif *repository.NotificationRepository,
	mailer *email.Client,
) *ProfessionalService {
	return &ProfessionalService{cfg: cfg, users: users, profs: profs, appts: appts, sessions: sessions, conns: conns, notif: notif, mailer: mailer}
}

func (s *ProfessionalService) GetProfile(userID string) (*models.ProfessionalProfile, error) {
	ctx := context.Background()
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, errors.New("not_found")
	}
	return s.profs.FindByUserID(ctx, userID, u.Role)
}

func (s *ProfessionalService) UpdateProfile(userID string, req *models.UpdateProfessionalProfileRequest) (*models.ProfessionalProfile, error) {
	ctx := context.Background()
	u, err := s.users.FindByID(ctx, userID)
	if err != nil || u == nil {
		return nil, errors.New("not_found")
	}
	if err := s.profs.UpdateProfile(ctx, userID, u.Role, req); err != nil {
		return nil, err
	}
	return s.profs.FindByUserID(ctx, userID, u.Role)
}

func (s *ProfessionalService) GetMyPatients(userID string, q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	return s.profs.ListPatients(context.Background(), userID, q)
}

func (s *ProfessionalService) GetPatient(professionalID, patientID string) (*models.PatientProfile, error) {
	ctx := context.Background()
	ok, err := s.conns.Exists(ctx, patientID, professionalID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("not_connected")
	}
	return s.users.GetPatientProfile(ctx, patientID)
}

func (s *ProfessionalService) GeneratePersonalCode(userID string) (string, error) {
	ctx := context.Background()
	u, err := s.users.FindByID(ctx, userID)
	if err != nil || u == nil {
		return "", errors.New("not_found")
	}
	p, err := s.profs.FindByUserID(ctx, userID, u.Role)
	if err != nil {
		return "", err
	}
	if p == nil || p.PersonalCode == nil || *p.PersonalCode == "" {
		return "", errors.New("no_personal_code")
	}
	return *p.PersonalCode, nil
}

// ShareCodeWithPatient emails the professional's DX PIN to a patient they have
// met in person, so the patient can enter it on their dashboard to connect.
func (s *ProfessionalService) ShareCodeWithPatient(userID, patientEmail string) error {
	ctx := context.Background()
	u, err := s.users.FindByID(ctx, userID)
	if err != nil || u == nil {
		return errors.New("not_found")
	}
	p, err := s.profs.FindByUserID(ctx, userID, u.Role)
	if err != nil {
		return err
	}
	name := "Your provider"
	if p != nil && p.FullName != "" {
		name = p.FullName
	}

	// Issue a fresh one-time PIN tied to this professional + patient email,
	// valid for 7 days, and email it to the patient.
	pin := dxPin()
	if err := s.conns.CreateDxPin(ctx, userID, string(u.Role), patientEmail, pin, 7*24*time.Hour); err != nil {
		return err
	}
	return s.mailer.SendDxPin(patientEmail, name, u.Email, pin)
}

func (s *ProfessionalService) GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	return s.appts.ListByProfessional(context.Background(), userID, q)
}

func (s *ProfessionalService) CreateAppointment(userID string, req *models.CreateAppointmentRequest) (*models.Appointment, error) {
	ctx := context.Background()
	when, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return nil, errors.New("invalid_scheduled_at")
	}

	a := &models.Appointment{
		PatientID:       req.PatientID,
		ProfessionalID:  userID,
		Title:           req.Title,
		Description:     nilIfEmpty(req.Description),
		ScheduledAt:     when,
		DurationMinutes: req.DurationMinutes,
		SessionType:     req.SessionType,
		MeetingURL:      nilIfEmpty(req.MeetingURL),
	}
	created, err := s.appts.Create(ctx, a)
	if err != nil {
		return nil, err
	}

	// Notify the patient (best-effort).
	s.sendAppointmentEmail(ctx, userID, req.PatientID, when, req.SessionType)
	return created, nil
}

func (s *ProfessionalService) sendAppointmentEmail(ctx context.Context, professionalID, patientID string, when time.Time, sessionType string) {
	patientUser, _ := s.users.FindByID(ctx, patientID)
	if patientUser == nil {
		return
	}
	patientName := "there"
	if pp, _ := s.users.GetPatientProfile(ctx, patientID); pp != nil {
		patientName = pp.FullName
	}
	profName := "your provider"
	if pu, _ := s.users.FindByID(ctx, professionalID); pu != nil {
		if pf, _ := s.profs.FindByUserID(ctx, professionalID, pu.Role); pf != nil {
			profName = pf.FullName
		}
	}
	_ = s.mailer.SendAppointmentReminder(patientUser.Email, patientName, profName,
		when.Format("Mon, 02 Jan 2006 15:04"), sessionType)
}

func (s *ProfessionalService) UpdateAppointment(userID, appointmentID string, req *models.UpdateAppointmentRequest) (*models.Appointment, error) {
	ctx := context.Background()
	if req.ScheduledAt != nil {
		if when, perr := time.Parse(time.RFC3339, *req.ScheduledAt); perr == nil {
			if err := s.appts.Reschedule(ctx, appointmentID, when); err != nil {
				return nil, err
			}
			if appt, ferr := s.appts.FindByID(ctx, appointmentID); ferr == nil && appt != nil {
				_ = s.notif.Create(ctx, appt.PatientID, "appointment_rescheduled", "New time proposed",
					"Your professional proposed a new appointment time.", map[string]string{"appointment_id": appointmentID})
			}
		}
	}
	if req.Status != nil {
		if err := s.appts.UpdateStatus(ctx, appointmentID, *req.Status); err != nil {
			return nil, err
		}
	}
	appt, err := s.appts.FindByID(ctx, appointmentID)
	if err == nil && appt != nil && req.Status != nil {
		switch *req.Status {
		case "scheduled":
			_ = s.notif.Create(ctx, appt.PatientID, "appointment_reminder", "Appointment confirmed",
				"Your appointment request was approved.", map[string]string{"appointment_id": appointmentID})
		case "rejected":
			_ = s.notif.Create(ctx, appt.PatientID, "appointment_cancelled", "Appointment declined",
				"Your appointment request was declined. Try another time.", map[string]string{"appointment_id": appointmentID})
		case "cancelled":
			_ = s.notif.Create(ctx, appt.PatientID, "appointment_cancelled", "Appointment cancelled",
				"Your appointment was cancelled.", map[string]string{"appointment_id": appointmentID})
		}
	}
	return appt, err
}

func (s *ProfessionalService) CancelAppointment(userID, appointmentID string) error {
	return s.appts.UpdateStatus(context.Background(), appointmentID, "cancelled")
}

func (s *ProfessionalService) GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	return s.sessions.ListByProfessional(context.Background(), userID, q)
}

func (s *ProfessionalService) CreateSession(userID string, req *models.CreateSessionRequest) (*models.TherapySession, error) {
	ctx := context.Background()
	when, err := parseFlexibleTime(req.SessionDate)
	if err != nil {
		return nil, errBadDate
	}
	// Resolve the professional's discipline for the record (falls back gracefully).
	profType := "professional"
	if u, _ := s.users.FindByID(ctx, userID); u != nil && string(u.Role) != "" {
		profType = string(u.Role)
	}
	sess := &models.TherapySession{
		PatientID:        req.PatientID,
		ProfessionalID:   userID,
		ProfessionalType: profType,
		AppointmentID:    nilIfEmpty(req.AppointmentID),
		SessionDate:      when,
		DurationMins:     req.DurationMins,
		SessionType:      req.SessionType,
		SubjectiveNote:   nilIfEmpty(req.SubjectiveNote),
		ObjectiveNote:    nilIfEmpty(req.ObjectiveNote),
		AssessmentNote:   nilIfEmpty(req.AssessmentNote),
		PlanNote:         nilIfEmpty(req.PlanNote),
	}
	return s.sessions.Create(ctx, sess)
}

func (s *ProfessionalService) GetSession(userID, sessionID string) (*models.TherapySession, error) {
	return s.sessions.FindByID(context.Background(), sessionID)
}

// ─── Patient Service ──────────────────────────────────────────────────────────

type PatientService struct {
	cfg      *config.Config
	users    *repository.UserRepository
	profs    *repository.ProfessionalRepository
	appts    *repository.AppointmentRepository
	sessions *repository.SessionRepository
	conns    *repository.ConnectionRepository
	emr      *repository.EMRRepository
	notif    *repository.NotificationRepository
	mailer   *email.Client
}

func NewPatientService(
	cfg *config.Config,
	users *repository.UserRepository,
	profs *repository.ProfessionalRepository,
	appts *repository.AppointmentRepository,
	sessions *repository.SessionRepository,
	conns *repository.ConnectionRepository,
	emr *repository.EMRRepository,
	notif *repository.NotificationRepository,
	mailer *email.Client,
) *PatientService {
	return &PatientService{cfg: cfg, users: users, profs: profs, appts: appts, sessions: sessions, conns: conns, emr: emr, notif: notif, mailer: mailer}
}

func (s *PatientService) GetProfile(userID string) (*models.PatientProfile, error) {
	return s.users.GetPatientProfile(context.Background(), userID)
}

func (s *PatientService) UpdateProfile(userID string, req *models.UpdatePatientProfileRequest) (*models.PatientProfile, error) {
	ctx := context.Background()
	if err := s.users.UpdatePatientProfile(ctx, userID, req); err != nil {
		return nil, err
	}
	return s.users.GetPatientProfile(ctx, userID)
}

func (s *PatientService) ConnectToProfessional(userID string, req *models.ConnectToProfessionalRequest) (*models.ProfessionalConnection, error) {
	ctx := context.Background()

	// Primary flow: the patient enters just the one-time DX-PIN. The PIN alone
	// identifies the professional who issued it.
	if req.Pin != "" {
		proID, profType, ok, err := s.conns.ConsumeDxPinByCode(ctx, req.Pin, userID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, errors.New("invalid_or_expired_pin")
		}
		conn, err := s.conns.Create(ctx, userID, proID, profType, userID)
		if err != nil {
			return nil, err
		}
		if pu, _ := s.users.FindByID(ctx, proID); pu != nil {
			patientName := "a patient"
			if pp, _ := s.users.GetPatientProfile(ctx, userID); pp != nil {
				patientName = pp.FullName
			}
			_ = s.mailer.SendPatientConnected(pu.Email, "", patientName)
		}
		return conn, nil
	}

	// Legacy flow: direct professional code.
	if req.ProfessionalCode == "" {
		return nil, errors.New("invalid_payload")
	}
	prof, err := s.profs.FindByPersonalCode(ctx, req.ProfessionalCode)
	if err != nil {
		return nil, err
	}
	if prof == nil {
		return nil, errors.New("professional_not_found")
	}

	conn, err := s.conns.Create(ctx, userID, prof.UserID, prof.ProfessionalType, userID)
	if err != nil {
		return nil, err
	}
	if pu, _ := s.users.FindByID(ctx, prof.UserID); pu != nil {
		patientName := "a patient"
		if pp, _ := s.users.GetPatientProfile(ctx, userID); pp != nil {
			patientName = pp.FullName
		}
		_ = s.mailer.SendPatientConnected(pu.Email, prof.FullName, patientName)
	}
	return conn, nil
}

func (s *PatientService) DisconnectFromProfessional(userID, professionalID string) error {
	return s.conns.End(context.Background(), userID, professionalID)
}

func (s *PatientService) GetMyProfessionals(userID string) ([]models.ProfessionalProfile, error) {
	ctx := context.Background()
	refs, err := s.conns.ListForPatient(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]models.ProfessionalProfile, 0, len(refs))
	for _, ref := range refs {
		p, err := s.profs.FindByUserID(ctx, ref.ProfessionalID, professionalRoleFromType(ref.ProfessionalType))
		if err == nil && p != nil {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (s *PatientService) GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	return s.appts.ListByPatient(context.Background(), userID, q)
}

// RequestAppointment lets a patient request a slot with a connected professional.
func (s *PatientService) RequestAppointment(userID string, req *models.RequestAppointmentRequest) (*models.Appointment, error) {
	ctx := context.Background()
	when, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return nil, errors.New("invalid_scheduled_at")
	}
	a := &models.Appointment{
		PatientID:       userID,
		ProfessionalID:  req.ProfessionalID,
		Title:           req.Title,
		Description:     nilIfEmpty(req.Description),
		ScheduledAt:     when,
		DurationMinutes: req.DurationMinutes,
		SessionType:     req.SessionType,
	}
	created, err := s.appts.CreateRequest(ctx, a)
	if err != nil {
		return nil, err
	}
	_ = s.notif.Create(ctx, req.ProfessionalID, "appointment_reminder", "New appointment request",
		"A patient requested an appointment: "+req.Title, map[string]string{"appointment_id": created.ID})
	return created, nil
}

// CancelAppointment cancels the patient's own appointment.
func (s *PatientService) CancelAppointment(userID, appointmentID string) error {
	ctx := context.Background()
	appt, _ := s.appts.FindByID(ctx, appointmentID)
	if err := s.appts.CancelByPatient(ctx, appointmentID, userID); err != nil {
		return err
	}
	if appt != nil {
		_ = s.notif.Create(ctx, appt.ProfessionalID, "appointment_cancelled", "Appointment cancelled",
			"A patient cancelled their appointment.", map[string]string{"appointment_id": appointmentID})
	}
	return nil
}

// RescheduleAppointment proposes a new time (re-enters the requested state).
func (s *PatientService) RescheduleAppointment(userID, appointmentID string, req *models.RescheduleAppointmentRequest) (*models.Appointment, error) {
	ctx := context.Background()
	when, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return nil, errors.New("invalid_scheduled_at")
	}
	if err := s.appts.RescheduleByPatient(ctx, appointmentID, userID, when); err != nil {
		return nil, err
	}
	appt, _ := s.appts.FindByID(ctx, appointmentID)
	if appt != nil {
		_ = s.notif.Create(ctx, appt.ProfessionalID, "appointment_rescheduled", "Reschedule requested",
			"A patient proposed a new appointment time.", map[string]string{"appointment_id": appointmentID})
	}
	return appt, nil
}

func (s *PatientService) GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	return s.sessions.ListByPatient(context.Background(), userID, q)
}

func (s *PatientService) GetCarePlans(userID string) ([]models.CarePlan, error) {
	return s.emr.ListCarePlansForPatient(context.Background(), userID)
}

func (s *PatientService) UpdateCarePlanTasks(userID, planID string, tasks json.RawMessage) (*models.CarePlan, error) {
	return s.emr.UpdateCarePlanTasks(context.Background(), userID, planID, tasks)
}

func (s *PatientService) ListFollowUps(userID string) ([]models.FollowUp, error) {
	return s.emr.ListFollowUpsForPatient(context.Background(), userID)
}

func (s *PatientService) RespondFollowUp(userID, id string, req *models.RespondFollowUpRequest) (*models.FollowUp, error) {
	ctx := context.Background()
	f, err := s.emr.RespondFollowUp(ctx, id, userID, req.Response, req.NeedsReevaluation)
	if err != nil {
		return nil, err
	}
	if f != nil {
		title := "Follow-up response received"
		body := "A patient submitted their follow-up check-in."
		if f.NeedsReevaluation {
			title = "Patient may need re-evaluation"
			body = "A patient's follow-up response was flagged for re-evaluation."
		}
		_ = s.notif.Create(ctx, f.ProfessionalID, "general", title, body, map[string]string{"follow_up_id": f.ID})
	}
	return f, nil
}

func (s *PatientService) GetRehabHistory(userID string, q *models.PaginationQuery) ([]interface{}, int64, error) {
	return []interface{}{}, 0, nil
}

// ─── shared helpers ───────────────────────────────────────────────────────────

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// errBadDate is returned when a client sends an unparseable session date.
var errBadDate = errors.New("invalid_session_date")

// parseFlexibleTime accepts the common date formats a browser/form will send —
// RFC3339, datetime-local ("2006-01-02T15:04"), with seconds, or date-only —
// so a session log never 500s just because the input lacked a timezone.
func parseFlexibleTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, errBadDate
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errBadDate
}

func professionalRoleFromType(t string) models.Role {
	switch t {
	case "physiotherapist":
		return models.RolePhysiotherapist
	case "prosthetist", "both":
		return models.RoleProsthetist
	case "orthotist":
		return models.RoleOrthotist
	case "occupational_therapist":
		return models.RoleOccupationalTherapist
	case "speech_therapist":
		return models.RoleSpeechTherapist
	case "mental_health_clinician":
		return models.RoleMentalHealthClinician
	default:
		return models.RolePhysiotherapist
	}
}

// ─── EMR Service ─────────────────────────────────────────────────────────────

type EMRService struct {
	cfg   *config.Config
	emr   *repository.EMRRepository
	users *repository.UserRepository
	notif *repository.NotificationRepository
}

func NewEMRService(cfg *config.Config, emr *repository.EMRRepository, users *repository.UserRepository, notif *repository.NotificationRepository) *EMRService {
	return &EMRService{cfg: cfg, emr: emr, users: users, notif: notif}
}

// ── Patient Records ──
func (s *EMRService) CreatePatientRecord(professionalID string, req *models.CreatePatientRecordRequest) (*models.PatientRecord, error) {
	return s.emr.CreatePatientRecord(context.Background(), professionalID, req)
}
func (s *EMRService) ListPatientRecords(professionalID string) ([]models.PatientRecord, error) {
	return s.emr.ListPatientRecords(context.Background(), professionalID)
}
func (s *EMRService) GetPatientRecord(professionalID, recordID string) (*models.PatientRecord, error) {
	return s.emr.GetPatientRecord(context.Background(), professionalID, recordID)
}
func (s *EMRService) UpdatePatientRecord(professionalID, recordID string, req *models.CreatePatientRecordRequest) (*models.PatientRecord, error) {
	return s.emr.UpdatePatientRecord(context.Background(), professionalID, recordID, req)
}

func (s *EMRService) CreateNote(professionalID string, req *models.CreateClinicalNoteRequest) (*models.ClinicalNote, error) {
	return s.emr.CreateNote(context.Background(), professionalID, req)
}
func (s *EMRService) GetNotes(professionalID, patientID string, q *models.PaginationQuery) ([]models.ClinicalNote, int64, error) {
	return s.emr.ListNotes(context.Background(), professionalID, patientID, q)
}
func (s *EMRService) GetNote(professionalID, noteID string) (*models.ClinicalNote, error) {
	return s.emr.GetNote(context.Background(), professionalID, noteID)
}
func (s *EMRService) UpdateNote(professionalID, noteID, content string) (*models.ClinicalNote, error) {
	ctx := context.Background()
	if err := s.emr.UpdateNote(ctx, professionalID, noteID, content); err != nil {
		return nil, err
	}
	return s.emr.GetNote(ctx, professionalID, noteID)
}
func (s *EMRService) DeleteNote(professionalID, noteID string) error {
	return s.emr.DeleteNote(context.Background(), professionalID, noteID)
}

func (s *EMRService) CreateCarePlan(professionalID string, req *models.CreateCarePlanRequest) (*models.CarePlan, error) {
	ctx := context.Background()
	plan, err := s.emr.CreateCarePlan(ctx, professionalID, req)
	if err != nil {
		return nil, err
	}
	shared := req.SharedWithPatient == nil || *req.SharedWithPatient
	if shared {
		_ = s.notif.Create(ctx, req.PatientID, "care_plan_updated", "New care plan",
			"Your care team created a new care plan: "+req.Title, map[string]string{"care_plan_id": plan.ID})
	}
	return plan, nil
}

// CreateFollowUp schedules a follow-up (e.g. at discharge) and notifies the patient.
func (s *EMRService) CreateFollowUp(professionalID string, req *models.CreateFollowUpRequest) (*models.FollowUp, error) {
	ctx := context.Background()
	f, err := s.emr.CreateFollowUp(ctx, professionalID, req)
	if err != nil {
		return nil, err
	}
	_ = s.notif.Create(ctx, req.PatientID, "general", "Follow-up scheduled",
		"Your care team scheduled a follow-up check-in.", map[string]string{"follow_up_id": f.ID})
	return f, nil
}

func (s *EMRService) ListFollowUpsForProfessional(professionalID string) ([]models.FollowUp, error) {
	return s.emr.ListFollowUpsForProfessional(context.Background(), professionalID)
}
func (s *EMRService) GetCarePlans(professionalID, patientID string) ([]models.CarePlan, error) {
	return s.emr.ListCarePlans(context.Background(), professionalID, patientID)
}
func (s *EMRService) UpdateCarePlan(professionalID, planID string, status, notes *string) (*models.CarePlan, error) {
	return s.emr.UpdateCarePlan(context.Background(), professionalID, planID, status, notes)
}

func (s *EMRService) CreateDeviceMeasurement(professionalID string, req *models.CreateDeviceMeasurementRequest) (*models.DeviceMeasurement, error) {
	return s.emr.CreateDevice(context.Background(), professionalID, req)
}
func (s *EMRService) GetDeviceMeasurements(professionalID, patientID string) ([]models.DeviceMeasurement, error) {
	return s.emr.ListDevices(context.Background(), professionalID, patientID)
}
func (s *EMRService) UpdateDeviceStatus(professionalID, deviceID, status string) (*models.DeviceMeasurement, error) {
	return s.emr.UpdateDeviceStatus(context.Background(), professionalID, deviceID, status)
}

// Device share + comments (3D editor collaboration).

func shareToken() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// dxPin returns a short, human-friendly one-time connection PIN. The charset
// omits ambiguous characters (0/O, 1/I/L) so patients can type it from email.
func dxPin() string {
	const cs = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	out := make([]byte, len(b))
	for i := range b {
		out[i] = cs[int(b[i])%len(cs)]
	}
	return string(out)
}

func (s *EMRService) CreateDeviceShare(professionalID, deviceID, permission string) (*repository.DeviceShare, error) {
	ctx := context.Background()
	share, err := s.emr.CreateShare(ctx, deviceID, shareToken(), permission, professionalID)
	if err != nil {
		return nil, err
	}
	share.URL = s.cfg.App.FrontendURL + "/share/" + share.Token
	return share, nil
}

func (s *EMRService) GetSharedDevice(token string) (*models.DeviceMeasurement, string, error) {
	ctx := context.Background()
	deviceID, permission, err := s.emr.GetShareByToken(ctx, token)
	if err != nil {
		return nil, "", err
	}
	dev, err := s.emr.FindDeviceByID(ctx, deviceID)
	return dev, permission, err
}

func (s *EMRService) ListDeviceComments(deviceID string) ([]repository.DeviceComment, error) {
	return s.emr.ListComments(context.Background(), deviceID)
}

func (s *EMRService) AddDeviceComment(deviceID, authorID, authorRole, content string) (*repository.DeviceComment, error) {
	ctx := context.Background()
	name := authorRole
	if u, _ := s.users.FindByID(ctx, authorID); u != nil && u.Email != "" {
		name = u.Email
		if at := indexByte(u.Email, '@'); at > 0 {
			name = u.Email[:at]
		}
	}
	return s.emr.AddComment(ctx, deviceID, authorID, name, authorRole, content)
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// ─── TheraPay Service ─────────────────────────────────────────────────────────

type TherapayService struct {
	cfg     *config.Config
	billing *repository.BillingRepository
	notif   *repository.NotificationRepository
}

func NewTherapayService(cfg *config.Config, billing *repository.BillingRepository, notif *repository.NotificationRepository) *TherapayService {
	return &TherapayService{cfg: cfg, billing: billing, notif: notif}
}

func (s *TherapayService) CreatePlan(professionalID string, req *models.CreateTherapayRequest) (*models.TheraPay, error) {
	ctx := context.Background()
	plan, err := s.billing.CreatePlan(ctx, professionalID, req)
	if err != nil {
		return nil, err
	}
	_ = s.notif.Create(ctx, req.PatientID, "payment_due", "New payment plan",
		"A new TheraPay plan has been set up for you.", map[string]string{"plan_id": plan.ID})
	return plan, nil
}
func (s *TherapayService) GetPlans(userID string, q *models.PaginationQuery) ([]models.TheraPay, int64, error) {
	return s.billing.ListByUser(context.Background(), userID, q)
}
func (s *TherapayService) GetPlan(userID, planID string) (*models.TheraPay, error) {
	return s.billing.Get(context.Background(), planID)
}
func (s *TherapayService) RecordPayment(professionalID, planID string, amount float64, notes string) (*models.TheraPay, error) {
	return s.billing.RecordPayment(context.Background(), planID, amount, notes, professionalID)
}
func (s *TherapayService) CancelPlan(professionalID, planID string) error {
	return s.billing.Cancel(context.Background(), planID)
}
func (s *TherapayService) GetPatientBalance(patientID string) (map[string]interface{}, error) {
	return s.billing.PatientBalance(context.Background(), patientID)
}
func (s *TherapayService) ApplyApplication(patientID string, data map[string]interface{}) (interface{}, error) {
	return s.billing.CreateApplication(context.Background(), patientID, data)
}
func (s *TherapayService) GetApplications(userID, role string, q *models.PaginationQuery) ([]interface{}, int64, error) {
	return s.billing.ListApplications(context.Background(), userID, role == "admin", q)
}

// ReviewApplication approves/rejects a TheraPay application and notifies the
// patient (and professional, if one is attached).
func (s *TherapayService) ReviewApplication(reviewerID, appID, status, notes string) error {
	ctx := context.Background()
	patientID, profID, err := s.billing.ReviewApplication(ctx, appID, reviewerID, status, notes)
	if err != nil {
		return err
	}
	title := "TheraPay application approved"
	body := "Your TheraPay financing application was approved."
	if status == "rejected" {
		title = "TheraPay application declined"
		body = "Your TheraPay financing application was declined."
	}
	_ = s.notif.Create(ctx, patientID, "payment_received", title, body, map[string]string{"application_id": appID})
	if profID != nil && *profID != "" {
		_ = s.notif.Create(ctx, *profID, "payment_received", "TheraPay decision",
			"A TheraPay application you're linked to was "+status+".", map[string]string{"application_id": appID})
	}
	return nil
}

// ─── Admin Service ────────────────────────────────────────────────────────────

type AdminService struct {
	cfg    *config.Config
	admin  *repository.AdminRepository
	users  *repository.UserRepository
	profs  *repository.ProfessionalRepository
	conns  *repository.ConnectionRepository
	notif  *repository.NotificationRepository
	mailer *email.Client
}

func NewAdminService(cfg *config.Config, admin *repository.AdminRepository, users *repository.UserRepository, profs *repository.ProfessionalRepository, conns *repository.ConnectionRepository, notif *repository.NotificationRepository, mailer *email.Client) *AdminService {
	return &AdminService{cfg: cfg, admin: admin, users: users, profs: profs, conns: conns, notif: notif, mailer: mailer}
}

func (s *AdminService) Announce(title, body, audience string) error {
	if audience == "" {
		audience = "all"
	}
	return s.notif.Broadcast(context.Background(), audience, title, body)
}

func (s *AdminService) GetStats() (*models.AdminStats, error) {
	return s.admin.Stats(context.Background())
}
func (s *AdminService) ListUsers(q *models.PaginationQuery) ([]models.User, int64, error) {
	return s.admin.ListUsers(context.Background(), q)
}
func (s *AdminService) GetUser(userID string) (*models.User, error) {
	return s.users.FindByID(context.Background(), userID)
}
func (s *AdminService) DeactivateUser(adminID, userID string) error {
	return s.admin.SetActive(context.Background(), userID, false)
}
func (s *AdminService) ReactivateUser(adminID, userID string) error {
	return s.admin.SetActive(context.Background(), userID, true)
}
func (s *AdminService) ListProfessionals(q *models.PaginationQuery, status string) ([]models.ProfessionalProfile, int64, error) {
	return s.admin.ListProfessionals(context.Background(), q, status)
}
func (s *AdminService) ApproveProfessional(adminID, professionalID string, req *models.ApproveProfessionalRequest) (*models.ProfessionalProfile, error) {
	ctx := context.Background()
	u, err := s.users.FindByID(ctx, professionalID)
	if err != nil || u == nil {
		return nil, errors.New("not_found")
	}
	if err := s.profs.SetApprovalStatus(ctx, professionalID, u.Role, req.IsApproved, adminID); err != nil {
		return nil, err
	}
	prof, _ := s.profs.FindByUserID(ctx, professionalID, u.Role)
	name := ""
	if prof != nil {
		name = prof.FullName
	}
	if req.IsApproved {
		_ = s.mailer.SendProfessionalApproved(u.Email, name)
		_ = s.notif.Create(ctx, professionalID, "general", "Account approved", "Your professional account has been approved.", nil)
	} else {
		_ = s.mailer.SendProfessionalRejected(u.Email, name, req.Notes)
	}
	return prof, nil
}
func (s *AdminService) ListPatients(q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	return s.admin.ListPatients(context.Background(), q)
}
func (s *AdminService) AssignProfessional(adminID string, req *models.AssignProfessionalRequest) error {
	ctx := context.Background()
	patientID := req.PatientID
	if patientID == "" && req.PatientEmail != "" {
		u, err := s.users.FindByEmail(ctx, req.PatientEmail)
		if err != nil {
			return err
		}
		if u == nil {
			return errors.New("patient_not_found")
		}
		patientID = u.ID
	}
	if patientID == "" {
		return errors.New("patient_required")
	}
	if _, err := s.conns.Create(ctx, patientID, req.ProfessionalID, req.Role, adminID); err != nil {
		return err
	}
	_ = s.notif.Create(ctx, patientID, "general", "You're connected",
		"An admin connected you with a professional. You can now book and message them.", nil)
	_ = s.notif.Create(ctx, req.ProfessionalID, "general", "New patient connected",
		"An admin connected a patient to your care.", nil)
	return nil
}
func (s *AdminService) ListSessions(q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	return s.admin.ListSessions(context.Background(), q)
}
func (s *AdminService) GetAuditLogs(q *models.PaginationQuery) ([]interface{}, int64, error) {
	return s.admin.AuditLogs(context.Background(), q)
}
func (s *AdminService) GetAnalytics(period string) (map[string]interface{}, error) {
	dist, err := s.admin.RoleDistribution(context.Background())
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"role_distribution": dist,
		"sessions_per_day":  []interface{}{},
		"registrations":     []interface{}{},
		"period":            period,
	}, nil
}

// ─── Notification Service ─────────────────────────────────────────────────────

type NotificationService struct {
	cfg   *config.Config
	notif *repository.NotificationRepository
}

func NewNotificationService(cfg *config.Config, notif *repository.NotificationRepository) *NotificationService {
	return &NotificationService{cfg: cfg, notif: notif}
}

func (s *NotificationService) GetNotifications(userID string, q *models.PaginationQuery) ([]models.Notification, int64, error) {
	return s.notif.List(context.Background(), userID, q)
}
func (s *NotificationService) MarkRead(userID, notificationID string) error {
	return s.notif.MarkRead(context.Background(), userID, notificationID)
}
func (s *NotificationService) MarkAllRead(userID string) error {
	return s.notif.MarkAllRead(context.Background(), userID)
}
func (s *NotificationService) GetUnreadCount(userID string) (int64, error) {
	return s.notif.UnreadCount(context.Background(), userID)
}
func (s *NotificationService) UpdatePreferences(userID string, prefs map[string]interface{}) error {
	return nil // preferences are not persisted yet
}
func (s *NotificationService) SaveSubscription(userID, endpoint, p256dh, auth string) error {
	return s.notif.SaveSubscription(context.Background(), userID, endpoint, p256dh, auth)
}

func (s *NotificationService) GetPreferences(userID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"email_notifications":   true,
		"push_notifications":    true,
		"appointment_reminders": true,
	}, nil
}

// ─── AI Service ───────────────────────────────────────────────────────────────

type AIService struct{ cfg *config.Config }

func NewAIService(cfg *config.Config) *AIService { return &AIService{cfg: cfg} }

// systemPromptFor tailors the assistant to the caller's clinical role.
func systemPromptFor(role string) string {
	base := "You are DynaX Assistant, a careful clinical aide for a rehabilitation " +
		"platform. Be concise, evidence-aware, and never fabricate patient data. " +
		"Always remind the user that you do not replace professional judgement."
	switch role {
	case "physiotherapist":
		return base + " Focus on physiotherapy assessment, exercise prescription and progression."
	case "prosthetist", "orthotist":
		return base + " Focus on prosthetic/orthotic fitting, alignment, socket design and gait."
	case "patient":
		return base + " Use plain, encouraging language a patient can understand. Avoid diagnosis."
	default:
		return base
	}
}

// chatComplete calls the OpenAI Chat Completions API and returns the reply text.
func (s *AIService) chatComplete(ctx context.Context, system, user string) (string, error) {
	if s.cfg.OpenAI.APIKey == "" {
		return "", errors.New("openai_not_configured")
	}

	body := map[string]interface{}{
		"model": s.cfg.OpenAI.Model,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature": 0.4,
	}
	raw, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.openai.com/v1/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.OpenAI.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.Get().Error().Int("status", resp.StatusCode).Str("body", string(data)).Msg("openai error")
		return "", fmt.Errorf("openai request failed: %d", resp.StatusCode)
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("openai returned no choices")
	}
	return parsed.Choices[0].Message.Content, nil
}

func (s *AIService) Query(userID, role string, req *models.AIQueryRequest) (*models.AIConversation, error) {
	reply, err := s.chatComplete(context.Background(), systemPromptFor(role), req.Input)
	if err != nil {
		return nil, err
	}
	return &models.AIConversation{
		ID:       uuid.New().String(),
		UserID:   userID,
		UserRole: role,
		Input:    req.Input,
		Response: reply,
	}, nil
}

func (s *AIService) GetHistory(userID string, q *models.PaginationQuery) ([]models.AIConversation, int64, error) {
	return nil, 0, nil
}
func (s *AIService) GetConversation(userID, convID string) ([]models.AIConversation, error) {
	return nil, nil
}
func (s *AIService) DeleteConversation(userID, convID string) error { return nil }

func (s *AIService) GenerateSOAPNote(userID string, sessionContext map[string]interface{}) (string, error) {
	ctxBytes, _ := json.Marshal(sessionContext)
	prompt := "Write a concise clinical SOAP note from this session context. " +
		"Return four labelled sections (S, O, A, P). Context JSON:\n" + string(ctxBytes)
	return s.chatComplete(context.Background(), systemPromptFor("physiotherapist"), prompt)
}

func (s *AIService) GenerateCarePlanSuggestion(userID, patientID string) (string, error) {
	prompt := fmt.Sprintf("Suggest a structured rehabilitation care plan outline for patient %s. "+
		"Use goals, interventions, frequency and review milestones. Keep it general and safe.", patientID)
	return s.chatComplete(context.Background(), systemPromptFor("physiotherapist"), prompt)
}

// ─── Messaging Service ────────────────────────────────────────────────────────

type MessagingService struct {
	cfg   *config.Config
	msg   *repository.MessagingRepository
	users *repository.UserRepository
	notif *repository.NotificationRepository
}

func NewMessagingService(cfg *config.Config, msg *repository.MessagingRepository, users *repository.UserRepository, notif *repository.NotificationRepository) *MessagingService {
	return &MessagingService{cfg: cfg, msg: msg, users: users, notif: notif}
}

func (s *MessagingService) GetConversations(userID string) ([]models.Conversation, error) {
	return s.msg.ListConversations(context.Background(), userID)
}

func (s *MessagingService) GetOrCreateConversation(userID, targetID string) (*models.Conversation, error) {
	ctx := context.Background()
	userRole, targetRole := "professional", "patient"
	if u, _ := s.users.FindByID(ctx, userID); u != nil {
		userRole = string(u.Role)
	}
	if t, _ := s.users.FindByID(ctx, targetID); t != nil {
		targetRole = string(t.Role)
	}
	return s.msg.GetOrCreate(ctx, userID, userRole, targetID, targetRole)
}

func (s *MessagingService) GetMessages(userID, conversationID string, q *models.PaginationQuery) ([]models.Message, int64, error) {
	return s.msg.ListMessages(context.Background(), conversationID, q)
}

func (s *MessagingService) SendMessage(userID, senderType, conversationID string, req *models.SendMessageRequest) (*models.Message, error) {
	ctx := context.Background()
	msg, err := s.msg.SendMessage(ctx, conversationID, userID, senderType, req)
	if err != nil {
		return nil, err
	}
	// Notify the other participant in-app (best-effort).
	if conv, _ := s.msg.GetByID(ctx, conversationID); conv != nil {
		recipient := otherParticipant(conv, userID)
		if recipient != "" {
			preview := req.Content
			if len(preview) > 80 {
				preview = preview[:80] + "…"
			}
			_ = s.notif.Create(ctx, recipient, "message_received", "New message", preview,
				map[string]string{"conversation_id": conversationID})
		}
	}
	return msg, nil
}

// StartAdminConversation opens (or returns) a conversation between the caller and an admin.
func (s *MessagingService) StartAdminConversation(userID string) (*models.Conversation, error) {
	ctx := context.Background()
	admin, err := s.users.FindFirstAdmin(ctx)
	if err != nil {
		return nil, err
	}
	if admin == nil {
		return nil, errors.New("no_admin_available")
	}
	userRole := "patient"
	if u, _ := s.users.FindByID(ctx, userID); u != nil {
		userRole = string(u.Role)
	}
	return s.msg.GetOrCreate(ctx, userID, userRole, admin.ID, "admin")
}

// otherParticipant returns the participant id that isn't the sender.
func otherParticipant(conv *models.Conversation, senderID string) string {
	for _, p := range []*string{conv.PatientID, conv.ProfessionalID, conv.AdminID} {
		if p != nil && *p != "" && *p != senderID {
			return *p
		}
	}
	return ""
}

func (s *MessagingService) MarkConversationRead(userID, conversationID string) error {
	return s.msg.MarkRead(context.Background(), userID, conversationID)
}
