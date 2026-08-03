// @title           DynaX API
// @version         1.0
// @description     Rehabilitation & Prosthetic Care Platform — Backend API
// @termsOfService  https://dynalimb.com/terms

// @contact.name   Dynalimb Technologies
// @contact.email  support@dynalimb.com
// @contact.url    https://dynalimb.com

// @license.name  Proprietary
// @license.url   https://dynalimb.com/license

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description  Enter your bearer token in the format: **Bearer &lt;token&gt;**

// @tag.name auth             @tag.description Authentication & user management
// @tag.name professional     @tag.description Professional clinic & patient management
// @tag.name patient          @tag.description Patient dashboard & connection
// @tag.name emr              @tag.description Mini EMR — notes, care plans, devices
// @tag.name sessions         @tag.description Therapy session logging
// @tag.name therapay         @tag.description TheraPay flexible payment system
// @tag.name messaging        @tag.description In-app messaging
// @tag.name notifications    @tag.description Notification management
// @tag.name ai               @tag.description AI assistant & SOAP generation
// @tag.name admin            @tag.description Admin-only platform management

package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/gin-gonic/gin"

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	adminH "github.com/dynalimb/dynax-backend/internal/handlers/admin"
	aiH "github.com/dynalimb/dynax-backend/internal/handlers/ai"
	authH "github.com/dynalimb/dynax-backend/internal/handlers/auth"
	callsH "github.com/dynalimb/dynax-backend/internal/handlers/calls"
	emrH "github.com/dynalimb/dynax-backend/internal/handlers/emr"
	notifH "github.com/dynalimb/dynax-backend/internal/handlers/notifications"
	patientH "github.com/dynalimb/dynax-backend/internal/handlers/patient"
	profH "github.com/dynalimb/dynax-backend/internal/handlers/professional"
	rehabH "github.com/dynalimb/dynax-backend/internal/handlers/rehabcredit"
	msgH "github.com/dynalimb/dynax-backend/internal/handlers/sessions"
	therapayH "github.com/dynalimb/dynax-backend/internal/handlers/therapay"
	"github.com/dynalimb/dynax-backend/internal/repository"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
	"github.com/dynalimb/dynax-backend/internal/scanner"
	"github.com/dynalimb/dynax-backend/internal/scheduler"
	"github.com/dynalimb/dynax-backend/internal/server"
	"github.com/dynalimb/dynax-backend/internal/services"
	"github.com/dynalimb/dynax-backend/internal/services/email"
	"github.com/dynalimb/dynax-backend/internal/services/push"
	"github.com/dynalimb/dynax-backend/internal/studio"
	"github.com/dynalimb/dynax-backend/pkg/logger"
)

func main() {
	// ── Config ────────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// ── Logger ────────────────────────────────────────────────────────────────
	logger.Init(cfg.Log.Level, cfg.Log.Format)
	log.Info().
		Str("env", cfg.App.Env).
		Str("port", cfg.App.Port).
		Msg("Starting DynaX API")

	// ── JWT ───────────────────────────────────────────────────────────────────
	jwtMgr := auth.NewManager(cfg.JWT.Secret, cfg.JWT.ExpiryHours, cfg.JWT.RefreshExpiryHours)

	// ── Database ──────────────────────────────────────────────────────────────
	pool, err := db.Connect(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()

	// ── Repositories & email ──────────────────────────────────────────────────
	userRepo := repository.NewUserRepository(pool)
	profRepo := repository.NewProfessionalRepository(pool)
	tokenRepo := repository.NewTokenRepository(pool)
	apptRepo := repository.NewAppointmentRepository(pool)
	sessionRepo := repository.NewSessionRepository(pool)
	connRepo := repository.NewConnectionRepository(pool)
	emrRepo := repository.NewEMRRepository(pool)
	billingRepo := repository.NewBillingRepository(pool)
	adminRepo := repository.NewAdminRepository(pool)
	msgRepo := repository.NewMessagingRepository(pool)
	notifRepo := repository.NewNotificationRepository(pool)
	rehabRepo := repository.NewRehabCreditRepository(pool)
	mailer := email.New(cfg)

	// ── Web push ──────────────────────────────────────────────────────────────
	// Every notification created through notifRepo.Create fires OnNotify, which
	// delivers the same event as a browser push to the user's subscribed devices.
	pushSender := push.NewSender(notifRepo)
	if pushSender.IsConfigured() {
		repository.OnNotify = func(userID, ntype, title, body string, data interface{}) {
			pushSender.SendToUser(userID, title, body, push.Flatten(ntype, data))
		}
		log.Info().Msg("web push sender active")
	} else {
		log.Warn().Msg("VAPID keys not set — web push disabled")
	}

	// ── Services ──────────────────────────────────────────────────────────────
	svcAuth := services.NewAuthService(cfg, jwtMgr, userRepo, profRepo, tokenRepo, mailer)
	// Built before the professional service, which calls into it when a session
	// is logged against an active Rehab Credit plan.
	svcRehab := services.NewRehabCreditService(cfg, rehabRepo, notifRepo)
	svcProf := services.NewProfessionalService(cfg, userRepo, profRepo, apptRepo, sessionRepo, connRepo, notifRepo, svcRehab, mailer)
	svcPatient := services.NewPatientService(cfg, userRepo, profRepo, apptRepo, sessionRepo, connRepo, emrRepo, notifRepo, mailer)
	svcEMR := services.NewEMRService(cfg, emrRepo, userRepo, notifRepo)
	svcTheraPay := services.NewTherapayService(cfg, billingRepo, notifRepo)
	svcAdmin := services.NewAdminService(cfg, adminRepo, userRepo, profRepo, connRepo, notifRepo, mailer)
	svcNotif := services.NewNotificationService(cfg, notifRepo)
	svcAI := services.NewAIService(cfg)
	svcMsg := services.NewMessagingService(cfg, msgRepo, userRepo, notifRepo)

	// ── Handlers ──────────────────────────────────────────────────────────────
	handlers := &server.Handlers{
		Auth:          authH.NewHandler(svcAuth),
		Professional:  profH.NewHandler(svcProf),
		Patient:       patientH.NewHandler(svcPatient),
		EMR:           emrH.NewHandler(svcEMR),
		TheraPay:      therapayH.NewHandler(svcTheraPay),
		Admin:         adminH.NewHandler(svcAdmin),
		Notifications: notifH.NewHandler(svcNotif),
		AI:            aiH.NewHandler(svcAI),
		Messaging:     msgH.NewHandler(svcMsg),
		Calls:         callsH.NewHandler(svcNotif),
		RehabCredit:   rehabH.NewHandler(svcRehab),
		Studio:        studio.NewHandler(pool),
		Scanner:       scanner.NewHandler(pool),
	}

	// ── Router ────────────────────────────────────────────────────────────────
	r := server.NewRouter(cfg, jwtMgr, handlers)

	// ── Scheduler (email + in-app reminders) ──────────────────────────────────
	sched := scheduler.New(pool, mailer, notifRepo)
	sched.Start(context.Background(), 15*time.Minute)

	// Secured manual trigger so an external cron can also run the jobs.
	r.POST("/internal/scheduler/run", func(c *gin.Context) {
		token := os.Getenv("SCHEDULER_TOKEN")
		if token == "" || c.GetHeader("X-Scheduler-Token") != token {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		go sched.RunOnce(context.Background())
		c.JSON(http.StatusOK, gin.H{"status": "scheduler triggered"})
	})

	// ── HTTP server with graceful shutdown ────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("addr", srv.Addr).Msg("HTTP server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server error")
		}
	}()

	// Wait for interrupt signal (Ctrl+C / SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Forced shutdown")
	}
	log.Info().Msg("Server stopped gracefully")
}
