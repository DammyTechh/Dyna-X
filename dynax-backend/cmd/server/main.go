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

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	adminH "github.com/dynalimb/dynax-backend/internal/handlers/admin"
	aiH "github.com/dynalimb/dynax-backend/internal/handlers/ai"
	authH "github.com/dynalimb/dynax-backend/internal/handlers/auth"
	emrH "github.com/dynalimb/dynax-backend/internal/handlers/emr"
	msgH "github.com/dynalimb/dynax-backend/internal/handlers/sessions"
	notifH "github.com/dynalimb/dynax-backend/internal/handlers/notifications"
	patientH "github.com/dynalimb/dynax-backend/internal/handlers/patient"
	profH "github.com/dynalimb/dynax-backend/internal/handlers/professional"
	therapayH "github.com/dynalimb/dynax-backend/internal/handlers/therapay"
	"github.com/dynalimb/dynax-backend/internal/server"
	"github.com/dynalimb/dynax-backend/internal/services"
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

	// ── Services (wire real implementations here) ─────────────────────────────
	// In production these would connect to Supabase via pgx + supabase-go.
	// The service layer is defined by the interfaces in each handler package.
	svcAuth := services.NewAuthService(cfg, jwtMgr)
	svcProf := services.NewProfessionalService(cfg)
	svcPatient := services.NewPatientService(cfg)
	svcEMR := services.NewEMRService(cfg)
	svcTheraPay := services.NewTherapayService(cfg)
	svcAdmin := services.NewAdminService(cfg)
	svcNotif := services.NewNotificationService(cfg)
	svcAI := services.NewAIService(cfg)
	svcMsg := services.NewMessagingService(cfg)

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
	}

	// ── Router ────────────────────────────────────────────────────────────────
	r := server.NewRouter(cfg, jwtMgr, handlers)

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
