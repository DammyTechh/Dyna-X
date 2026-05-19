package models

import (
	"time"
)

// ─── Roles ────────────────────────────────────────────────────────────────────

type Role string

const (
	RoleAdmin                 Role = "admin"
	RoleProsthetist           Role = "prosthetist"
	RoleOrthotist             Role = "orthotist"
	RolePhysiotherapist       Role = "physiotherapist"
	RoleOccupationalTherapist Role = "occupational_therapist"
	RoleSpeechTherapist       Role = "speech_therapist"
	RoleMentalHealthClinician Role = "mental_health_clinician"
	RolePatient               Role = "patient"
)

// ─── User & Auth ──────────────────────────────────────────────────────────────

type User struct {
	ID        string    `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Role      Role      `json:"role" db:"role"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Profile struct {
	ID             string    `json:"id" db:"id"`
	UserID         string    `json:"user_id" db:"user_id"`
	FullName       string    `json:"full_name" db:"full_name"`
	PhoneNumber    *string   `json:"phone_number,omitempty" db:"phone_number"`
	AvatarURL      *string   `json:"avatar_url,omitempty" db:"avatar_url"`
	DateOfBirth    *string   `json:"date_of_birth,omitempty" db:"date_of_birth"`
	Gender         *string   `json:"gender,omitempty" db:"gender"`
	Address        *string   `json:"address,omitempty" db:"address"`
	City           *string   `json:"city,omitempty" db:"city"`
	Country        *string   `json:"country,omitempty" db:"country"`
	PersonalCode   *string   `json:"personal_code,omitempty" db:"personal_code"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// ─── Auth Request / Response DTOs ────────────────────────────────────────────

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required,min=2,max=100"`
	Role     Role   `json:"role" validate:"required,oneof=patient physiotherapist prosthetist orthotist occupational_therapist speech_therapist mental_health_clinician"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	ExpiresIn    int64   `json:"expires_in"`
	TokenType    string  `json:"token_type"`
	User         User    `json:"user"`
	Profile      Profile `json:"profile"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" validate:"required"`
	Password string `json:"password" validate:"required,min=8"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

// ─── Professional Profile ─────────────────────────────────────────────────────

type ProfessionalProfile struct {
	ID                    string    `json:"id" db:"id"`
	UserID                string    `json:"user_id" db:"user_id"`
	FullName              string    `json:"full_name" db:"full_name"`
	Email                 *string   `json:"email,omitempty" db:"email"`
	PhoneNumber           *string   `json:"phone_number,omitempty" db:"phone_number"`
	ProfessionalType      string    `json:"professional_type" db:"professional_type"`
	LicenseNumber         *string   `json:"license_number,omitempty" db:"license_number"`
	LicenseType           *string   `json:"license_type,omitempty" db:"license_type"`
	Credentials           *string   `json:"credentials,omitempty" db:"credentials"`
	Specializations       []string  `json:"specializations,omitempty" db:"specializations"`
	ExperienceYears       *int      `json:"experience_years,omitempty" db:"experience_years"`
	Bio                   *string   `json:"bio,omitempty" db:"bio"`
	ClinicName            *string   `json:"clinic_name,omitempty" db:"clinic_name"`
	ClinicCode            *string   `json:"clinic_code,omitempty" db:"clinic_code"`
	PersonalCode          *string   `json:"personal_code,omitempty" db:"personal_code"`
	SessionRate           *float64  `json:"session_rate,omitempty" db:"session_rate"`
	VirtualSessionEnabled bool      `json:"virtual_sessions_enabled" db:"virtual_sessions_enabled"`
	InPersonEnabled       bool      `json:"in_person_sessions_enabled" db:"in_person_sessions_enabled"`
	ApprovalStatus        string    `json:"approval_status" db:"approval_status"`
	IsApproved            bool      `json:"is_approved" db:"is_approved"`
	AvatarURL             *string   `json:"avatar_url,omitempty" db:"avatar_url"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

type UpdateProfessionalProfileRequest struct {
	FullName              *string  `json:"full_name,omitempty" validate:"omitempty,min=2,max=100"`
	PhoneNumber           *string  `json:"phone_number,omitempty"`
	Bio                   *string  `json:"bio,omitempty" validate:"omitempty,max=1000"`
	ClinicName            *string  `json:"clinic_name,omitempty"`
	LicenseNumber         *string  `json:"license_number,omitempty"`
	Specializations       []string `json:"specializations,omitempty"`
	ExperienceYears       *int     `json:"experience_years,omitempty"`
	SessionRate           *float64 `json:"session_rate,omitempty"`
	VirtualSessionEnabled *bool    `json:"virtual_sessions_enabled,omitempty"`
	InPersonEnabled       *bool    `json:"in_person_sessions_enabled,omitempty"`
}

// ─── Patient Profile ──────────────────────────────────────────────────────────

type PatientProfile struct {
	ID                   string    `json:"id" db:"id"`
	UserID               string    `json:"user_id" db:"user_id"`
	FullName             string    `json:"full_name" db:"full_name"`
	Email                *string   `json:"email,omitempty" db:"email"`
	PhoneNumber          *string   `json:"phone_number,omitempty" db:"phone_number"`
	DateOfBirth          *string   `json:"date_of_birth,omitempty" db:"date_of_birth"`
	Gender               *string   `json:"gender,omitempty" db:"gender"`
	Condition            *string   `json:"condition,omitempty" db:"condition"`
	DiagnosisNotes       *string   `json:"diagnosis_notes,omitempty" db:"diagnosis_notes"`
	AssignedProfessional *string   `json:"assigned_professional_id,omitempty" db:"assigned_professional_id"`
	PersonalCode         *string   `json:"personal_code,omitempty" db:"personal_code"`
	EmergencyContact     *string   `json:"emergency_contact,omitempty" db:"emergency_contact"`
	Address              *string   `json:"address,omitempty" db:"address"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

type UpdatePatientProfileRequest struct {
	FullName         *string `json:"full_name,omitempty" validate:"omitempty,min=2,max=100"`
	PhoneNumber      *string `json:"phone_number,omitempty"`
	DateOfBirth      *string `json:"date_of_birth,omitempty"`
	Gender           *string `json:"gender,omitempty"`
	EmergencyContact *string `json:"emergency_contact,omitempty"`
	Address          *string `json:"address,omitempty"`
}

// ─── Professional PIN Connection ──────────────────────────────────────────────

type ConnectToProfessionalRequest struct {
	ProfessionalCode string `json:"professional_code" validate:"required"`
}

type ProfessionalConnection struct {
	ID             string    `json:"id" db:"id"`
	PatientID      string    `json:"patient_id" db:"patient_id"`
	ProfessionalID string    `json:"professional_id" db:"professional_id"`
	Status         string    `json:"status" db:"status"`
	ConnectedAt    time.Time `json:"connected_at" db:"connected_at"`
}

// ─── Appointments ─────────────────────────────────────────────────────────────

type Appointment struct {
	ID              string     `json:"id" db:"id"`
	PatientID       string     `json:"patient_id" db:"patient_id"`
	ProfessionalID  string     `json:"professional_id" db:"professional_id"`
	Title           string     `json:"title" db:"title"`
	Description     *string    `json:"description,omitempty" db:"description"`
	ScheduledAt     time.Time  `json:"scheduled_at" db:"scheduled_at"`
	DurationMinutes int        `json:"duration_minutes" db:"duration_minutes"`
	SessionType     string     `json:"session_type" db:"session_type"` // virtual | in_person
	Status          string     `json:"status" db:"status"`             // scheduled | completed | cancelled | no_show
	MeetingURL      *string    `json:"meeting_url,omitempty" db:"meeting_url"`
	Notes           *string    `json:"notes,omitempty" db:"notes"`
	CompletedAt     *time.Time `json:"completed_at,omitempty" db:"completed_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateAppointmentRequest struct {
	PatientID       string `json:"patient_id" validate:"required,uuid"`
	Title           string `json:"title" validate:"required,min=3,max=200"`
	Description     string `json:"description,omitempty"`
	ScheduledAt     string `json:"scheduled_at" validate:"required"`
	DurationMinutes int    `json:"duration_minutes" validate:"required,min=15,max=480"`
	SessionType     string `json:"session_type" validate:"required,oneof=virtual in_person"`
	MeetingURL      string `json:"meeting_url,omitempty"`
}

type UpdateAppointmentRequest struct {
	Title           *string `json:"title,omitempty"`
	Description     *string `json:"description,omitempty"`
	ScheduledAt     *string `json:"scheduled_at,omitempty"`
	DurationMinutes *int    `json:"duration_minutes,omitempty"`
	Status          *string `json:"status,omitempty" validate:"omitempty,oneof=scheduled completed cancelled no_show"`
	MeetingURL      *string `json:"meeting_url,omitempty"`
	Notes           *string `json:"notes,omitempty"`
}

// ─── Session / Therapy Log ────────────────────────────────────────────────────

type TherapySession struct {
	ID             string     `json:"id" db:"id"`
	PatientID      string     `json:"patient_id" db:"patient_id"`
	ProfessionalID string     `json:"professional_id" db:"professional_id"`
	AppointmentID  *string    `json:"appointment_id,omitempty" db:"appointment_id"`
	SessionDate    time.Time  `json:"session_date" db:"session_date"`
	DurationMins   int        `json:"duration_minutes" db:"duration_minutes"`
	SessionType    string     `json:"session_type" db:"session_type"`
	Status         string     `json:"status" db:"status"`
	SubjectiveNote *string    `json:"subjective_note,omitempty" db:"subjective_note"`
	ObjectiveNote  *string    `json:"objective_note,omitempty" db:"objective_note"`
	AssessmentNote *string    `json:"assessment_note,omitempty" db:"assessment_note"`
	PlanNote       *string    `json:"plan_note,omitempty" db:"plan_note"`
	GoalsAchieved  *bool      `json:"goals_achieved,omitempty" db:"goals_achieved"`
	PatientRating  *int       `json:"patient_rating,omitempty" db:"patient_rating"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateSessionRequest struct {
	PatientID      string `json:"patient_id" validate:"required,uuid"`
	AppointmentID  string `json:"appointment_id,omitempty"`
	SessionDate    string `json:"session_date" validate:"required"`
	DurationMins   int    `json:"duration_minutes" validate:"required,min=5"`
	SessionType    string `json:"session_type" validate:"required,oneof=virtual in_person"`
	SubjectiveNote string `json:"subjective_note,omitempty"`
	ObjectiveNote  string `json:"objective_note,omitempty"`
	AssessmentNote string `json:"assessment_note,omitempty"`
	PlanNote       string `json:"plan_note,omitempty"`
}

// ─── EMR / Clinical Notes ─────────────────────────────────────────────────────

type ClinicalNote struct {
	ID              string    `json:"id" db:"id"`
	PatientID       string    `json:"patient_id" db:"patient_id"`
	ProfessionalID  string    `json:"professional_id" db:"professional_id"`
	SessionID       *string   `json:"session_id,omitempty" db:"session_id"`
	NoteType        string    `json:"note_type" db:"note_type"` // soap | progress | assessment | referral
	Title           string    `json:"title" db:"title"`
	Content         string    `json:"content" db:"content"`
	DiagnosisCodes  []string  `json:"diagnosis_codes,omitempty" db:"diagnosis_codes"`
	IsConfidential  bool      `json:"is_confidential" db:"is_confidential"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type CreateClinicalNoteRequest struct {
	PatientID      string   `json:"patient_id" validate:"required,uuid"`
	SessionID      string   `json:"session_id,omitempty"`
	NoteType       string   `json:"note_type" validate:"required,oneof=soap progress assessment referral"`
	Title          string   `json:"title" validate:"required,min=3,max=200"`
	Content        string   `json:"content" validate:"required,min=10"`
	DiagnosisCodes []string `json:"diagnosis_codes,omitempty"`
	IsConfidential bool     `json:"is_confidential"`
}

// ─── Care Plans ───────────────────────────────────────────────────────────────

type CarePlan struct {
	ID             string     `json:"id" db:"id"`
	PatientID      string     `json:"patient_id" db:"patient_id"`
	ProfessionalID string     `json:"professional_id" db:"professional_id"`
	Title          string     `json:"title" db:"title"`
	Description    *string    `json:"description,omitempty" db:"description"`
	Goals          []string   `json:"goals,omitempty" db:"goals"`
	StartDate      string     `json:"start_date" db:"start_date"`
	EndDate        *string    `json:"end_date,omitempty" db:"end_date"`
	Status         string     `json:"status" db:"status"` // active | completed | paused | cancelled
	ProgressNotes  *string    `json:"progress_notes,omitempty" db:"progress_notes"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateCarePlanRequest struct {
	PatientID   string   `json:"patient_id" validate:"required,uuid"`
	Title       string   `json:"title" validate:"required,min=3,max=200"`
	Description string   `json:"description,omitempty"`
	Goals       []string `json:"goals,omitempty"`
	StartDate   string   `json:"start_date" validate:"required"`
	EndDate     string   `json:"end_date,omitempty"`
}

// ─── Exercise Plans ───────────────────────────────────────────────────────────

type ExercisePlan struct {
	ID             string      `json:"id" db:"id"`
	PatientID      string      `json:"patient_id" db:"patient_id"`
	ProfessionalID string      `json:"professional_id" db:"professional_id"`
	Title          string      `json:"title" db:"title"`
	Description    *string     `json:"description,omitempty" db:"description"`
	Exercises      interface{} `json:"exercises" db:"exercises"` // JSONB
	FrequencyPerWeek int       `json:"frequency_per_week" db:"frequency_per_week"`
	DurationWeeks  int         `json:"duration_weeks" db:"duration_weeks"`
	Status         string      `json:"status" db:"status"`
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at" db:"updated_at"`
}

// ─── Prosthetic Devices ───────────────────────────────────────────────────────

type DeviceMeasurement struct {
	ID             string      `json:"id" db:"id"`
	PatientID      string      `json:"patient_id" db:"patient_id"`
	ProfessionalID string      `json:"professional_id" db:"professional_id"`
	DeviceType     string      `json:"device_type" db:"device_type"`
	BodyRegion     string      `json:"body_region" db:"body_region"`
	Measurements   interface{} `json:"measurements" db:"measurements"` // JSONB
	Notes          *string     `json:"notes,omitempty" db:"notes"`
	Status         string      `json:"status" db:"status"` // draft | submitted | approved | fabricating | delivered
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at" db:"updated_at"`
}

type CreateDeviceMeasurementRequest struct {
	PatientID    string      `json:"patient_id" validate:"required,uuid"`
	DeviceType   string      `json:"device_type" validate:"required"`
	BodyRegion   string      `json:"body_region" validate:"required"`
	Measurements interface{} `json:"measurements" validate:"required"`
	Notes        string      `json:"notes,omitempty"`
}

// ─── Messages / Chat ──────────────────────────────────────────────────────────

type Message struct {
	ID             string     `json:"id" db:"id"`
	ConversationID string     `json:"conversation_id" db:"conversation_id"`
	SenderID       string     `json:"sender_id" db:"sender_id"`
	SenderType     string     `json:"sender_type" db:"sender_type"` // patient | professional | admin
	Content        string     `json:"content" db:"content"`
	FileURL        *string    `json:"file_url,omitempty" db:"file_url"`
	FileName       *string    `json:"file_name,omitempty" db:"file_name"`
	IsRead         bool       `json:"is_read" db:"is_read"`
	ReadAt         *time.Time `json:"read_at,omitempty" db:"read_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type SendMessageRequest struct {
	Content  string `json:"content" validate:"required,min=1,max=5000"`
	FileURL  string `json:"file_url,omitempty"`
	FileName string `json:"file_name,omitempty"`
}

type Conversation struct {
	ID               string     `json:"id" db:"id"`
	PatientID        *string    `json:"patient_id,omitempty" db:"patient_id"`
	ProfessionalID   *string    `json:"professional_id,omitempty" db:"professional_id"`
	AdminID          *string    `json:"admin_id,omitempty" db:"admin_id"`
	LastMessage      *string    `json:"last_message,omitempty" db:"last_message"`
	LastMessageAt    *time.Time `json:"last_message_at,omitempty" db:"last_message_at"`
	UnreadCount      int        `json:"unread_count" db:"unread_count"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}

// ─── TheraPay ─────────────────────────────────────────────────────────────────

type TheraPay struct {
	ID                  string     `json:"id" db:"id"`
	PatientID           string     `json:"patient_id" db:"patient_id"`
	ProfessionalID      string     `json:"professional_id" db:"professional_id"`
	PlanType            string     `json:"plan_type" db:"plan_type"` // session | bundle | subscription | installment
	TotalAmount         float64    `json:"total_amount" db:"total_amount"`
	AmountPaid          float64    `json:"amount_paid" db:"amount_paid"`
	SessionsTotal       *int       `json:"sessions_total,omitempty" db:"sessions_total"`
	SessionsUsed        *int       `json:"sessions_used,omitempty" db:"sessions_used"`
	Status              string     `json:"status" db:"status"`
	NextPaymentDate     *time.Time `json:"next_payment_date,omitempty" db:"next_payment_date"`
	InstallmentAmount   *float64   `json:"installment_amount,omitempty" db:"installment_amount"`
	InstallmentInterval *string    `json:"installment_interval,omitempty" db:"installment_interval"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateTherapayRequest struct {
	PatientID           string  `json:"patient_id" validate:"required,uuid"`
	PlanType            string  `json:"plan_type" validate:"required,oneof=session bundle subscription installment"`
	TotalAmount         float64 `json:"total_amount" validate:"required,gt=0"`
	SessionsTotal       *int    `json:"sessions_total,omitempty"`
	InstallmentAmount   *float64 `json:"installment_amount,omitempty"`
	InstallmentInterval *string `json:"installment_interval,omitempty"`
}

// ─── Notifications ────────────────────────────────────────────────────────────

type Notification struct {
	ID        string     `json:"id" db:"id"`
	UserID    string     `json:"user_id" db:"user_id"`
	Type      string     `json:"type" db:"type"`
	Title     string     `json:"title" db:"title"`
	Body      string     `json:"body" db:"body"`
	Data      interface{} `json:"data,omitempty" db:"data"`
	IsRead    bool       `json:"is_read" db:"is_read"`
	ReadAt    *time.Time `json:"read_at,omitempty" db:"read_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

type AIConversation struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	UserRole  string    `json:"user_role" db:"user_role"`
	Input     string    `json:"input" db:"input"`
	Response  string    `json:"response" db:"response"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type AIQueryRequest struct {
	Input          string `json:"input" validate:"required,min=3,max=5000"`
	ConversationID string `json:"conversation_id,omitempty"`
	Context        string `json:"context,omitempty"` // patient_id context for richer AI
}

// ─── Admin ────────────────────────────────────────────────────────────────────

type AdminStats struct {
	TotalUsers          int64 `json:"total_users"`
	TotalPatients       int64 `json:"total_patients"`
	TotalProfessionals  int64 `json:"total_professionals"`
	PendingApprovals    int64 `json:"pending_approvals"`
	TotalSessions       int64 `json:"total_sessions"`
	ActiveCarePlans     int64 `json:"active_care_plans"`
	TotalRevenue        float64 `json:"total_revenue"`
	SessionsThisMonth   int64 `json:"sessions_this_month"`
}

type AssignProfessionalRequest struct {
	PatientID      string `json:"patient_id" validate:"required,uuid"`
	ProfessionalID string `json:"professional_id" validate:"required,uuid"`
	Role           string `json:"role" validate:"required"`
}

type ApproveProfessionalRequest struct {
	IsApproved bool   `json:"is_approved" validate:"required"`
	Notes      string `json:"notes,omitempty"`
}

// ─── Pagination ───────────────────────────────────────────────────────────────

type PaginationQuery struct {
	Page     int    `form:"page,default=1" validate:"min=1"`
	PageSize int    `form:"page_size,default=20" validate:"min=1,max=100"`
	Search   string `form:"search"`
	SortBy   string `form:"sort_by"`
	SortDir  string `form:"sort_dir,default=desc" validate:"oneof=asc desc"`
}

func (p *PaginationQuery) Offset() int {
	return (p.Page - 1) * p.PageSize
}
