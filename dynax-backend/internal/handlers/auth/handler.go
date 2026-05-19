package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

// Handler holds dependencies for auth endpoints.
type Handler struct {
	service Service
}

// Service defines the auth business logic contract.
type Service interface {
	Register(req *models.RegisterRequest) (*models.AuthResponse, error)
	Login(req *models.LoginRequest) (*models.AuthResponse, error)
	RefreshToken(refreshToken string) (*models.AuthResponse, error)
	ForgotPassword(email string) error
	ResetPassword(token, newPassword string) error
	ChangePassword(userID, currentPassword, newPassword string) error
	Logout(userID, token string) error
}

func NewHandler(svc Service) *Handler {
	return &Handler{service: svc}
}

// Register godoc
// @Summary      Register a new user
// @Description  Creates a new user account (patient or professional). An email verification is sent on success.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      models.RegisterRequest  true  "Registration payload"
// @Success      201   {object}  response.Envelope{data=models.AuthResponse}
// @Failure      400   {object}  response.Envelope
// @Failure      409   {object}  response.Envelope
// @Router       /auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if err := validate(&req); err != nil {
		response.UnprocessableEntity(c, "Validation failed", err)
		return
	}

	authResp, err := h.service.Register(&req)
	if err != nil {
		handleAuthError(c, err)
		return
	}
	response.Created(c, "Account created successfully. Please verify your email.", authResp)
}

// Login godoc
// @Summary      Login
// @Description  Authenticates a user and returns JWT access + refresh tokens.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      models.LoginRequest  true  "Login credentials"
// @Success      200   {object}  response.Envelope{data=models.AuthResponse}
// @Failure      400   {object}  response.Envelope
// @Failure      401   {object}  response.Envelope
// @Router       /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if err := validate(&req); err != nil {
		response.UnprocessableEntity(c, "Validation failed", err)
		return
	}

	authResp, err := h.service.Login(&req)
	if err != nil {
		handleAuthError(c, err)
		return
	}
	response.OK(c, "Login successful", authResp)
}

// RefreshToken godoc
// @Summary      Refresh access token
// @Description  Exchanges a valid refresh token for a new access token pair.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      models.RefreshTokenRequest  true  "Refresh token"
// @Success      200   {object}  response.Envelope{data=models.AuthResponse}
// @Failure      401   {object}  response.Envelope
// @Router       /auth/refresh [post]
func (h *Handler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}

	authResp, err := h.service.RefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Invalid or expired refresh token")
		return
	}
	response.OK(c, "Token refreshed", authResp)
}

// ForgotPassword godoc
// @Summary      Request password reset
// @Description  Sends a password reset email to the provided address (via Resend).
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      models.ForgotPasswordRequest  true  "Email address"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /auth/forgot-password [post]
func (h *Handler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	// Always return success to prevent email enumeration
	_ = h.service.ForgotPassword(req.Email)
	response.OK(c, "If an account exists for that email, a reset link has been sent.", nil)
}

// ResetPassword godoc
// @Summary      Reset password using token
// @Description  Resets the user's password using the token received via email.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      models.ResetPasswordRequest  true  "Token + new password"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Router       /auth/reset-password [post]
func (h *Handler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if err := validate(&req); err != nil {
		response.UnprocessableEntity(c, "Validation failed", err)
		return
	}
	if err := h.service.ResetPassword(req.Token, req.Password); err != nil {
		response.BadRequest(c, "INVALID_TOKEN", "Token is invalid or expired")
		return
	}
	response.OK(c, "Password reset successfully", nil)
}

// ChangePassword godoc
// @Summary      Change password (authenticated)
// @Description  Allows an authenticated user to change their own password.
// @Tags         auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.ChangePasswordRequest  true  "Current + new password"
// @Success      200   {object}  response.Envelope
// @Failure      400   {object}  response.Envelope
// @Failure      401   {object}  response.Envelope
// @Router       /auth/change-password [post]
func (h *Handler) ChangePassword(c *gin.Context) {
	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "INVALID_PAYLOAD", "Request body is malformed")
		return
	}
	if err := validate(&req); err != nil {
		response.UnprocessableEntity(c, "Validation failed", err)
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.service.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		response.BadRequest(c, "INVALID_CREDENTIALS", "Current password is incorrect")
		return
	}
	response.OK(c, "Password changed successfully", nil)
}

// Logout godoc
// @Summary      Logout
// @Description  Invalidates the current session token.
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Failure      401  {object}  response.Envelope
// @Router       /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	userID := middleware.GetUserID(c)
	token := extractToken(c)
	_ = h.service.Logout(userID, token)
	response.OK(c, "Logged out successfully", nil)
}

// Me godoc
// @Summary      Get current user
// @Description  Returns the authenticated user's profile.
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope{data=models.User}
// @Failure      401  {object}  response.Envelope
// @Router       /auth/me [get]
func (h *Handler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	email, _ := c.Get(middleware.CtxEmail)
	role, _ := c.Get(middleware.CtxRole)
	response.OK(c, "Current user", gin.H{
		"user_id": userID,
		"email":   email,
		"role":    role,
	})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func extractToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if len(header) > 7 {
		return header[7:]
	}
	return ""
}

func handleAuthError(c *gin.Context, err error) {
	// Map known errors to HTTP responses
	switch err.Error() {
	case "email_already_exists":
		response.Conflict(c, "An account with this email already exists")
	case "invalid_credentials":
		response.Unauthorized(c, "Invalid email or password")
	case "account_disabled":
		response.Forbidden(c, "Your account has been disabled. Contact support.")
	case "email_not_verified":
		response.Forbidden(c, "Please verify your email address before logging in")
	default:
		response.InternalError(c, err)
	}
}

// validate uses go-playground/validator on the request struct.
func validate(s interface{}) map[string]string {
	// Placeholder — the real validator is wired in the service/validator package.
	return nil
}
