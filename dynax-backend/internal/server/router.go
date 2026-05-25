package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	adminH "github.com/dynalimb/dynax-backend/internal/handlers/admin"
	aiH "github.com/dynalimb/dynax-backend/internal/handlers/ai"
	authH "github.com/dynalimb/dynax-backend/internal/handlers/auth"
	emrH "github.com/dynalimb/dynax-backend/internal/handlers/emr"
	notifH "github.com/dynalimb/dynax-backend/internal/handlers/notifications"
	patientH "github.com/dynalimb/dynax-backend/internal/handlers/patient"
	profH "github.com/dynalimb/dynax-backend/internal/handlers/professional"
	msgH "github.com/dynalimb/dynax-backend/internal/handlers/sessions"
	therapayH "github.com/dynalimb/dynax-backend/internal/handlers/therapay"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"

	_ "github.com/dynalimb/dynax-backend/docs/swagger" // swagger docs
)

// Handlers aggregates all route handler dependencies.
type Handlers struct {
	Auth          *authH.Handler
	Professional  *profH.Handler
	Patient       *patientH.Handler
	EMR           *emrH.Handler
	TheraPay      *therapayH.Handler
	Admin         *adminH.Handler
	Notifications *notifH.Handler
	AI            *aiH.Handler
	Messaging     *msgH.Handler
}

// NewRouter constructs and returns the gin engine with all routes registered.
func NewRouter(cfg *config.Config, jwtMgr *auth.Manager, h *Handlers) *gin.Engine {
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// ── Global middleware ──────────────────────────────────────────────────────
	rl := middleware.NewRateLimiterStore(cfg.Security.RateLimitRPS, cfg.Security.RateLimitBurst)

	r.Use(
		middleware.Recovery(),
		middleware.RequestID(),
		middleware.SecurityHeaders(),
		middleware.CORS(cfg),
		middleware.RequestLogger(),
		middleware.RateLimit(rl),
	)

	// ── Health check (public) ─────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": cfg.App.Name,
			"version": cfg.App.Version,
		})
	})

	// ── Swagger UI ────────────────────────────────────────────────────────────
	r.GET("/swagger/*any", ginSwagger.WrapHandler(
		swaggerFiles.NewHandler(),
		ginSwagger.URL("/swagger/doc.json"),
		ginSwagger.InstanceName("swagger"),
	))

	// ── API v1 ────────────────────────────────────────────────────────────────
	v1 := r.Group("/api/v1")

	// ── Public auth routes (no JWT required) ──────────────────────────────────
	authGroup := v1.Group("/auth")
	{
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/refresh", h.Auth.RefreshToken)
		authGroup.POST("/forgot-password", h.Auth.ForgotPassword)
		authGroup.POST("/reset-password", h.Auth.ResetPassword)
	}

	// ── Protected routes (JWT required) ───────────────────────────────────────
	protected := v1.Group("")
	protected.Use(middleware.Authenticate(jwtMgr))
	{
		// ── Auth (self) ────────────────────────────────────────────────────────
		protected.GET("/auth/me", h.Auth.Me)
		protected.POST("/auth/logout", h.Auth.Logout)
		protected.POST("/auth/change-password", h.Auth.ChangePassword)

		// ── Notifications (all roles) ─────────────────────────────────────────
		notif := protected.Group("/notifications")
		{
			notif.GET("", h.Notifications.ListNotifications)
			notif.GET("/unread-count", h.Notifications.GetUnreadCount)
			notif.POST("/read-all", h.Notifications.MarkAllRead)
			notif.POST("/:notification_id/read", h.Notifications.MarkRead)
			notif.GET("/preferences", h.Notifications.GetPreferences)
			notif.PATCH("/preferences", h.Notifications.UpdatePreferences)
		}

		// ── Messaging (all roles) ─────────────────────────────────────────────
		msg := protected.Group("/messages")
		{
			msg.GET("/conversations", h.Messaging.ListConversations)
			msg.POST("/conversations/:conversation_id", h.Messaging.GetOrCreateConversation)
			msg.GET("/conversations/:conversation_id/messages", h.Messaging.GetMessages)
			msg.POST("/conversations/:conversation_id/messages", h.Messaging.SendMessage)
			msg.POST("/conversations/:conversation_id/read", h.Messaging.MarkConversationRead)
		}

		// ── AI assistant (all roles) ──────────────────────────────────────────
		aiGroup := protected.Group("/ai")
		{
			aiGroup.POST("/query", h.AI.Query)
			aiGroup.GET("/history", h.AI.GetHistory)
			aiGroup.GET("/conversations/:conversation_id", h.AI.GetConversation)
			aiGroup.DELETE("/conversations/:conversation_id", h.AI.DeleteConversation)

			// Professional-only AI tools
			aiPro := aiGroup.Group("")
			aiPro.Use(middleware.RequireAdminOrProfessional())
			{
				aiPro.POST("/generate/soap-note", h.AI.GenerateSOAPNote)
				aiPro.POST("/generate/care-plan/:patient_id", h.AI.GenerateCarePlanSuggestion)
			}
		}

		// ── Patient routes ────────────────────────────────────────────────────
		patient := protected.Group("/patient")
		patient.Use(middleware.RequireRole(models.RolePatient))
		{
			patient.GET("/profile", h.Patient.GetProfile)
			patient.PATCH("/profile", h.Patient.UpdateProfile)
			patient.POST("/connect", h.Patient.ConnectToProfessional)
			patient.DELETE("/connect/:professional_id", h.Patient.DisconnectFromProfessional)
			patient.GET("/professionals", h.Patient.GetMyProfessionals)
			patient.GET("/appointments", h.Patient.GetAppointments)
			patient.GET("/sessions", h.Patient.GetSessions)
			patient.GET("/care-plans", h.Patient.GetCarePlans)
			patient.GET("/rehab-history", h.Patient.GetRehabHistory)
		}

		// ── Professional routes (any professional role) ────────────────────────
		professional := protected.Group("/professional")
		professional.Use(middleware.RequireAdminOrProfessional())
		{
			professional.GET("/profile", h.Professional.GetProfile)
			professional.PATCH("/profile", h.Professional.UpdateProfile)
			professional.POST("/generate-code", h.Professional.GeneratePersonalCode)

			// Patients under this professional
			professional.GET("/patients", h.Professional.ListPatients)
			professional.GET("/patients/:patient_id", h.Professional.GetPatient)

			// Appointments
			professional.GET("/appointments", h.Professional.ListAppointments)
			professional.POST("/appointments", h.Professional.CreateAppointment)
			professional.PATCH("/appointments/:appointment_id", h.Professional.UpdateAppointment)
			professional.POST("/appointments/:appointment_id/cancel", h.Professional.CancelAppointment)

			// Sessions
			professional.GET("/sessions", h.Professional.ListSessions)
			professional.POST("/sessions", h.Professional.CreateSession)
			professional.GET("/sessions/:session_id", h.Professional.GetSession)
		}

		// ── EMR routes (professionals + admin) ────────────────────────────────
		emr := protected.Group("/emr")
		emr.Use(middleware.RequireAdminOrProfessional())
		{
			// Clinical Notes
			emr.POST("/notes", h.EMR.CreateNote)
			emr.GET("/notes", h.EMR.ListNotes)
			emr.GET("/notes/:note_id", h.EMR.GetNote)
			emr.PATCH("/notes/:note_id", h.EMR.UpdateNote)
			emr.DELETE("/notes/:note_id", h.EMR.DeleteNote)

			// Care Plans
			emr.POST("/care-plans", h.EMR.CreateCarePlan)
			emr.GET("/care-plans", h.EMR.ListCarePlans)
			emr.PATCH("/care-plans/:plan_id", h.EMR.UpdateCarePlan)

			// Prosthetic / Orthotic Devices (P&O only, but admin too)
			emr.POST("/devices", h.EMR.CreateDeviceMeasurement)
			emr.GET("/devices", h.EMR.ListDeviceMeasurements)
			emr.PATCH("/devices/:device_id/status", h.EMR.UpdateDeviceStatus)
		}

		// ── TheraPay routes ───────────────────────────────────────────────────
		therapay := protected.Group("/therapay")
		{
			// Plans — professionals create, patients and professionals read
			therapay.POST("/plans", middleware.RequireAdminOrProfessional(), h.TheraPay.CreatePlan)
			therapay.GET("/plans", h.TheraPay.ListPlans)
			therapay.GET("/plans/:plan_id", h.TheraPay.GetPlan)
			therapay.POST("/plans/:plan_id/payments", middleware.RequireAdminOrProfessional(), h.TheraPay.RecordPayment)
			therapay.POST("/plans/:plan_id/cancel", middleware.RequireAdminOrProfessional(), h.TheraPay.CancelPlan)

			// Balance — patients view own; professionals/admin view any
			therapay.GET("/balance/:patient_id", h.TheraPay.GetPatientBalance)

			// Applications — patients apply; admin/professional review
			therapay.POST("/apply", middleware.RequireRole(models.RolePatient), h.TheraPay.ApplyForTheraPay)
			therapay.GET("/applications", middleware.RequireAdminOrProfessional(), h.TheraPay.ListApplications)
		}

		// ── Admin routes (admin only) ─────────────────────────────────────────
		admin := protected.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/stats", h.Admin.GetStats)
			admin.GET("/analytics", h.Admin.GetAnalytics)
			admin.GET("/audit-logs", h.Admin.GetAuditLogs)

			// Users
			admin.GET("/users", h.Admin.ListUsers)
			admin.POST("/users/:user_id/deactivate", h.Admin.DeactivateUser)
			admin.POST("/users/:user_id/reactivate", h.Admin.ReactivateUser)

			// Professionals
			admin.GET("/professionals", h.Admin.ListProfessionals)
			admin.POST("/professionals/:professional_id/approve", h.Admin.ApproveProfessional)

			// Patients
			admin.GET("/patients", h.Admin.ListPatients)

			// Assignment
			admin.POST("/assign", h.Admin.AssignProfessional)
		}
	}

	// ── 404 handler ───────────────────────────────────────────────────────────
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "ROUTE_NOT_FOUND",
				"message": "The requested endpoint does not exist",
			},
		})
	})

	return r
}
