// Package services provides concrete service implementations.
// These stubs satisfy the handler interfaces and show WHERE to plug in
// real Supabase/pgx queries. Replace each stub body with actual DB calls.
package services

import (
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/internal/models"
)

// ─── Auth Service ─────────────────────────────────────────────────────────────

type AuthService struct {
	cfg    *config.Config
	jwtMgr *auth.Manager
}

func NewAuthService(cfg *config.Config, jwtMgr *auth.Manager) *AuthService {
	return &AuthService{cfg: cfg, jwtMgr: jwtMgr}
}

func (s *AuthService) Register(req *models.RegisterRequest) (*models.AuthResponse, error) {
	// TODO: 1. Hash password with bcrypt  2. Insert into dynax_users + supabase auth
	//       3. Insert role-specific profile  4. Generate personal_code  5. Send welcome email via Resend
	userID := uuid.New().String()
	tokens, _ := s.jwtMgr.Generate(userID, req.Email, req.Role)
	return &models.AuthResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    int64(tokens.ExpiresAt.Sub(time.Now()).Seconds()),
		TokenType:    "Bearer",
		User:         models.User{ID: userID, Email: req.Email, Role: req.Role},
	}, nil
}

func (s *AuthService) Login(req *models.LoginRequest) (*models.AuthResponse, error) {
	// TODO: 1. Fetch user by email  2. Compare bcrypt hash  3. Check is_active + is_verified
	//       4. Update last_login_at  5. Generate tokens
	return nil, errors.New("invalid_credentials") // replace with real logic
}

func (s *AuthService) RefreshToken(refreshToken string) (*models.AuthResponse, error) {
	// TODO: Validate refresh token, generate new pair
	return nil, errors.New("invalid_token")
}

func (s *AuthService) ForgotPassword(email string) error {
	// TODO: 1. Look up user  2. Generate reset token (store hashed in DB with expiry)
	//       3. Send reset email via Resend
	return nil
}

func (s *AuthService) ResetPassword(token, newPassword string) error {
	// TODO: 1. Validate token (not expired, not used)  2. Hash new password
	//       3. Update user  4. Invalidate token
	return nil
}

func (s *AuthService) ChangePassword(userID, current, newPwd string) error {
	// TODO: Verify current password hash, update with new bcrypt hash
	return nil
}

func (s *AuthService) Logout(userID, token string) error {
	// TODO: Add token to Redis blacklist with TTL = remaining JWT lifetime
	return nil
}

// ─── Professional Service ─────────────────────────────────────────────────────

type ProfessionalService struct{ cfg *config.Config }

func NewProfessionalService(cfg *config.Config) *ProfessionalService {
	return &ProfessionalService{cfg: cfg}
}

func (s *ProfessionalService) GetProfile(userID string) (*models.ProfessionalProfile, error) {
	// TODO: Query therapist_profiles / po_professional_profiles by user_id
	return nil, errors.New("not_found")
}

func (s *ProfessionalService) UpdateProfile(userID string, req *models.UpdateProfessionalProfileRequest) (*models.ProfessionalProfile, error) {
	// TODO: PATCH the correct profile table, return updated record
	return nil, nil
}

func (s *ProfessionalService) GetMyPatients(userID string, q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	// TODO: JOIN professional_patient_connections + patient_profiles WHERE professional_id = userID AND status = 'active'
	return nil, 0, nil
}

func (s *ProfessionalService) GetPatient(professionalID, patientID string) (*models.PatientProfile, error) {
	// TODO: Verify connection exists, return patient_profiles record
	return nil, errors.New("not_found")
}

func (s *ProfessionalService) GeneratePersonalCode(userID string) (string, error) {
	// TODO: Call DB function generate_personal_code(), update profile table
	return "DX-TEST-0001", nil
}

func (s *ProfessionalService) GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	// TODO: SELECT FROM appointments WHERE professional_id = userID + pagination
	return nil, 0, nil
}

func (s *ProfessionalService) CreateAppointment(userID string, req *models.CreateAppointmentRequest) (*models.Appointment, error) {
	// TODO: Parse scheduled_at, INSERT into appointments, send reminder notification
	return &models.Appointment{ID: uuid.New().String(), ProfessionalID: userID}, nil
}

func (s *ProfessionalService) UpdateAppointment(userID, id string, req *models.UpdateAppointmentRequest) (*models.Appointment, error) {
	// TODO: PATCH appointments WHERE id = id AND professional_id = userID
	return nil, nil
}

func (s *ProfessionalService) CancelAppointment(userID, id string) error {
	// TODO: UPDATE appointments SET status = 'cancelled', cancelled_at = NOW() WHERE id = id
	return nil
}

func (s *ProfessionalService) GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	// TODO: SELECT FROM therapy_sessions WHERE professional_id = userID + pagination
	return nil, 0, nil
}

func (s *ProfessionalService) CreateSession(userID string, req *models.CreateSessionRequest) (*models.TherapySession, error) {
	// TODO: INSERT into therapy_sessions, optionally update appointment status
	return &models.TherapySession{ID: uuid.New().String(), ProfessionalID: userID}, nil
}

func (s *ProfessionalService) GetSession(userID, sessionID string) (*models.TherapySession, error) {
	// TODO: SELECT FROM therapy_sessions WHERE id = sessionID AND professional_id = userID
	return nil, errors.New("not_found")
}

// ─── Patient Service ──────────────────────────────────────────────────────────

type PatientService struct{ cfg *config.Config }

func NewPatientService(cfg *config.Config) *PatientService { return &PatientService{cfg: cfg} }

func (s *PatientService) GetProfile(userID string) (*models.PatientProfile, error) {
	return nil, errors.New("not_found")
}

func (s *PatientService) UpdateProfile(userID string, req *models.UpdatePatientProfileRequest) (*models.PatientProfile, error) {
	return nil, nil
}

func (s *PatientService) ConnectToProfessional(userID string, req *models.ConnectToProfessionalRequest) (*models.ProfessionalConnection, error) {
	// TODO: 1. Call find_professional_by_code(req.ProfessionalCode)
	//       2. Check not already connected  3. INSERT professional_patient_connections
	//       4. Send notification to professional
	return nil, errors.New("professional_not_found")
}

func (s *PatientService) DisconnectFromProfessional(userID, professionalID string) error {
	// TODO: UPDATE professional_patient_connections SET status = 'ended', ended_at = NOW()
	return nil
}

func (s *PatientService) GetMyProfessionals(userID string) ([]models.ProfessionalProfile, error) {
	// TODO: JOIN professional_patient_connections + each professional profile table
	return nil, nil
}

func (s *PatientService) GetAppointments(userID string, q *models.PaginationQuery) ([]models.Appointment, int64, error) {
	return nil, 0, nil
}

func (s *PatientService) GetSessions(userID string, q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	return nil, 0, nil
}

func (s *PatientService) GetCarePlans(userID string) ([]models.CarePlan, error) {
	return nil, nil
}

func (s *PatientService) GetRehabHistory(userID string, q *models.PaginationQuery) ([]interface{}, int64, error) {
	return nil, 0, nil
}

// ─── EMR Service ─────────────────────────────────────────────────────────────

type EMRService struct{ cfg *config.Config }

func NewEMRService(cfg *config.Config) *EMRService { return &EMRService{cfg: cfg} }

func (s *EMRService) CreateNote(professionalID string, req *models.CreateClinicalNoteRequest) (*models.ClinicalNote, error) {
	return &models.ClinicalNote{ID: uuid.New().String(), ProfessionalID: professionalID}, nil
}
func (s *EMRService) GetNotes(profID, patientID string, q *models.PaginationQuery) ([]models.ClinicalNote, int64, error) {
	return nil, 0, nil
}
func (s *EMRService) GetNote(profID, noteID string) (*models.ClinicalNote, error) {
	return nil, errors.New("not_found")
}
func (s *EMRService) UpdateNote(profID, noteID, content string) (*models.ClinicalNote, error) {
	return nil, nil
}
func (s *EMRService) DeleteNote(profID, noteID string) error { return nil }
func (s *EMRService) CreateCarePlan(profID string, req *models.CreateCarePlanRequest) (*models.CarePlan, error) {
	return &models.CarePlan{ID: uuid.New().String(), ProfessionalID: profID}, nil
}
func (s *EMRService) GetCarePlans(profID, patientID string) ([]models.CarePlan, error) {
	return nil, nil
}
func (s *EMRService) UpdateCarePlan(profID, planID string, status, notes *string) (*models.CarePlan, error) {
	return nil, nil
}
func (s *EMRService) CreateDeviceMeasurement(profID string, req *models.CreateDeviceMeasurementRequest) (*models.DeviceMeasurement, error) {
	return &models.DeviceMeasurement{ID: uuid.New().String(), ProfessionalID: profID}, nil
}
func (s *EMRService) GetDeviceMeasurements(profID, patientID string) ([]models.DeviceMeasurement, error) {
	return nil, nil
}
func (s *EMRService) UpdateDeviceStatus(profID, deviceID, status string) (*models.DeviceMeasurement, error) {
	return nil, nil
}

// ─── TheraPay Service ─────────────────────────────────────────────────────────

type TherapayService struct{ cfg *config.Config }

func NewTherapayService(cfg *config.Config) *TherapayService { return &TherapayService{cfg: cfg} }

func (s *TherapayService) CreatePlan(profID string, req *models.CreateTherapayRequest) (*models.TheraPay, error) {
	return &models.TheraPay{ID: uuid.New().String(), ProfessionalID: profID}, nil
}
func (s *TherapayService) GetPlans(userID string, q *models.PaginationQuery) ([]models.TheraPay, int64, error) {
	return nil, 0, nil
}
func (s *TherapayService) GetPlan(userID, planID string) (*models.TheraPay, error) {
	return nil, errors.New("not_found")
}
func (s *TherapayService) RecordPayment(profID, planID string, amount float64, notes string) (*models.TheraPay, error) {
	return nil, nil
}
func (s *TherapayService) CancelPlan(profID, planID string) error { return nil }
func (s *TherapayService) GetPatientBalance(patientID string) (map[string]interface{}, error) {
	return map[string]interface{}{"outstanding": 0, "credits": 0}, nil
}
func (s *TherapayService) ApplyApplication(patientID string, data map[string]interface{}) (interface{}, error) {
	return map[string]string{"id": uuid.New().String(), "status": "pending"}, nil
}
func (s *TherapayService) GetApplications(userID string, q *models.PaginationQuery) ([]interface{}, int64, error) {
	return nil, 0, nil
}

// ─── Admin Service ────────────────────────────────────────────────────────────

type AdminService struct{ cfg *config.Config }

func NewAdminService(cfg *config.Config) *AdminService { return &AdminService{cfg: cfg} }

func (s *AdminService) GetStats() (*models.AdminStats, error) {
	// TODO: Call get_platform_stats() DB function
	return &models.AdminStats{}, nil
}
func (s *AdminService) ListUsers(q *models.PaginationQuery) ([]models.User, int64, error) {
	return nil, 0, nil
}
func (s *AdminService) GetUser(userID string) (*models.User, error) { return nil, nil }
func (s *AdminService) DeactivateUser(adminID, userID string) error { return nil }
func (s *AdminService) ReactivateUser(adminID, userID string) error { return nil }
func (s *AdminService) ListProfessionals(q *models.PaginationQuery, status string) ([]models.ProfessionalProfile, int64, error) {
	return nil, 0, nil
}
func (s *AdminService) ApproveProfessional(adminID, profID string, req *models.ApproveProfessionalRequest) (*models.ProfessionalProfile, error) {
	// TODO: UPDATE professional profile, log audit, send approval/rejection email via Resend
	return nil, nil
}
func (s *AdminService) ListPatients(q *models.PaginationQuery) ([]models.PatientProfile, int64, error) {
	return nil, 0, nil
}
func (s *AdminService) AssignProfessional(adminID string, req *models.AssignProfessionalRequest) error {
	return nil
}
func (s *AdminService) ListSessions(q *models.PaginationQuery) ([]models.TherapySession, int64, error) {
	return []models.TherapySession{}, 0, nil
}
func (s *AdminService) GetAuditLogs(q *models.PaginationQuery) ([]interface{}, int64, error) {
	return nil, 0, nil
}
func (s *AdminService) GetAnalytics(period string) (map[string]interface{}, error) {
	return map[string]interface{}{"period": period}, nil
}

// ─── Notification Service ─────────────────────────────────────────────────────

type NotificationService struct{ cfg *config.Config }

func NewNotificationService(cfg *config.Config) *NotificationService {
	return &NotificationService{cfg: cfg}
}

func (s *NotificationService) GetNotifications(userID string, q *models.PaginationQuery) ([]models.Notification, int64, error) {
	return nil, 0, nil
}
func (s *NotificationService) MarkRead(userID, notifID string) error { return nil }
func (s *NotificationService) MarkAllRead(userID string) error       { return nil }
func (s *NotificationService) GetUnreadCount(userID string) (int64, error) {
	return 0, nil
}
func (s *NotificationService) UpdatePreferences(userID string, prefs map[string]interface{}) error {
	return nil
}
func (s *NotificationService) GetPreferences(userID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"email_enabled": true,
		"push_enabled":  true,
	}, nil
}

// ─── AI Service ───────────────────────────────────────────────────────────────

type AIService struct{ cfg *config.Config }

func NewAIService(cfg *config.Config) *AIService { return &AIService{cfg: cfg} }

func (s *AIService) Query(userID, role string, req *models.AIQueryRequest) (*models.AIConversation, error) {
	// TODO: 1. Build system prompt based on role  2. Call OpenAI API
	//       3. Store in ai_conversations  4. Return response
	return &models.AIConversation{
		ID:       uuid.New().String(),
		UserID:   userID,
		UserRole: role,
		Input:    req.Input,
		Response: "AI response placeholder — wire OpenAI here",
	}, nil
}

func (s *AIService) GetHistory(userID string, q *models.PaginationQuery) ([]models.AIConversation, int64, error) {
	return nil, 0, nil
}
func (s *AIService) GetConversation(userID, convID string) ([]models.AIConversation, error) {
	return nil, nil
}
func (s *AIService) DeleteConversation(userID, convID string) error { return nil }
func (s *AIService) GenerateSOAPNote(userID string, ctx map[string]interface{}) (string, error) {
	// TODO: Build patient context prompt → OpenAI → return structured SOAP
	return "S: ...\nO: ...\nA: ...\nP: ...", nil
}
func (s *AIService) GenerateCarePlanSuggestion(userID, patientID string) (string, error) {
	// TODO: Fetch patient history → OpenAI → return care plan suggestion
	return "Care plan suggestion placeholder", nil
}

// ─── Messaging Service ────────────────────────────────────────────────────────

type MessagingService struct{ cfg *config.Config }

func NewMessagingService(cfg *config.Config) *MessagingService { return &MessagingService{cfg: cfg} }

func (s *MessagingService) GetConversations(userID string) ([]models.Conversation, error) {
	return nil, nil
}
func (s *MessagingService) GetOrCreateConversation(userID, targetID string) (*models.Conversation, error) {
	return &models.Conversation{ID: uuid.New().String()}, nil
}
func (s *MessagingService) GetMessages(userID, convID string, q *models.PaginationQuery) ([]models.Message, int64, error) {
	return nil, 0, nil
}
func (s *MessagingService) SendMessage(userID, senderType, convID string, req *models.SendMessageRequest) (*models.Message, error) {
	return &models.Message{
		ID:             uuid.New().String(),
		ConversationID: convID,
		SenderID:       userID,
		SenderType:     senderType,
		Content:        req.Content,
		CreatedAt:      time.Now(),
	}, nil
}
func (s *MessagingService) MarkConversationRead(userID, convID string) error { return nil }
