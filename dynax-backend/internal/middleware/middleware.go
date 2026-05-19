package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"

	"github.com/dynalimb/dynax-backend/internal/auth"
	"github.com/dynalimb/dynax-backend/internal/config"
	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

const (
	CtxUserID  = "user_id"
	CtxEmail   = "email"
	CtxRole    = "role"
	CtxClaims  = "claims"
)

// ─── CORS ─────────────────────────────────────────────────────────────────────

func CORS(cfg *config.Config) gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     cfg.Security.CORSAllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Request-ID", "X-Idempotency-Key"},
		ExposeHeaders:    []string{"X-Request-ID", "X-Total-Count"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// ─── Request Logger ───────────────────────────────────────────────────────────

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		c.Next()
		log.Info().
			Str("method", c.Request.Method).
			Str("path", path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Str("ip", c.ClientIP()).
			Msg("request")
	}
}

// ─── Security Headers ─────────────────────────────────────────────────────────

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		c.Next()
	}
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiterStore struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	rps      float64
	burst    int
}

func NewRateLimiterStore(rps float64, burst int) *RateLimiterStore {
	store := &RateLimiterStore{
		limiters: make(map[string]*ipLimiter),
		rps:      rps,
		burst:    burst,
	}
	go store.cleanup()
	return store
}

func (s *RateLimiterStore) Get(ip string) *rate.Limiter {
	s.mu.Lock()
	defer s.mu.Unlock()
	if l, ok := s.limiters[ip]; ok {
		l.lastSeen = time.Now()
		return l.limiter
	}
	l := rate.NewLimiter(rate.Limit(s.rps), s.burst)
	s.limiters[ip] = &ipLimiter{limiter: l, lastSeen: time.Now()}
	return l
}

func (s *RateLimiterStore) cleanup() {
	for range time.Tick(5 * time.Minute) {
		s.mu.Lock()
		for ip, l := range s.limiters {
			if time.Since(l.lastSeen) > 10*time.Minute {
				delete(s.limiters, ip)
			}
		}
		s.mu.Unlock()
	}
}

func RateLimit(store *RateLimiterStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.Get(c.ClientIP()).Allow() {
			response.TooManyRequests(c)
			return
		}
		c.Next()
	}
}

// ─── JWT Authentication ───────────────────────────────────────────────────────

func Authenticate(jwtMgr *auth.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			response.Unauthorized(c, "Authorization header is required")
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			response.Unauthorized(c, "Invalid authorization header format. Use: Bearer <token>")
			return
		}

		claims, err := jwtMgr.Validate(parts[1])
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			return
		}

		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxEmail, claims.Email)
		c.Set(CtxRole, string(claims.Role))
		c.Set(CtxClaims, claims)
		c.Next()
	}
}

// ─── Role-Based Access Control ────────────────────────────────────────────────

// RequireRole returns a middleware that allows only the specified roles.
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[string(r)] = true
	}
	return func(c *gin.Context) {
		role, _ := c.Get(CtxRole)
		if !allowed[role.(string)] {
			response.Forbidden(c, "You do not have permission to access this resource")
			return
		}
		c.Next()
	}
}

// RequireAdmin is a convenience wrapper for admin-only routes.
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin)
}

// RequireProfessional allows any clinical professional role.
func RequireProfessional() gin.HandlerFunc {
	return RequireRole(
		models.RoleProsthetist,
		models.RoleOrthotist,
		models.RolePhysiotherapist,
		models.RoleOccupationalTherapist,
		models.RoleSpeechTherapist,
		models.RoleMentalHealthClinician,
	)
}

// RequireAdminOrProfessional allows admin and any professional.
func RequireAdminOrProfessional() gin.HandlerFunc {
	return RequireRole(
		models.RoleAdmin,
		models.RoleProsthetist,
		models.RoleOrthotist,
		models.RolePhysiotherapist,
		models.RoleOccupationalTherapist,
		models.RoleSpeechTherapist,
		models.RoleMentalHealthClinician,
	)
}

// ─── Request ID ───────────────────────────────────────────────────────────────

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = generateID()
		}
		c.Set("request_id", id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

func generateID() string {
	// simple timestamp-based id; production should use uuid
	return strings.ReplaceAll(time.Now().Format("20060102150405.000000000"), ".", "")
}

// ─── Recover (panic handler) ──────────────────────────────────────────────────

func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().Interface("panic", err).Str("path", c.Request.URL.Path).Msg("panic recovered")
				c.AbortWithStatusJSON(http.StatusInternalServerError, map[string]interface{}{
					"success": false,
					"error": map[string]string{
						"code":    "INTERNAL_ERROR",
						"message": "An unexpected error occurred",
					},
				})
			}
		}()
		c.Next()
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// GetUserID extracts the authenticated user ID from the context.
func GetUserID(c *gin.Context) string {
	id, _ := c.Get(CtxUserID)
	if id == nil {
		return ""
	}
	return id.(string)
}

// GetRole extracts the authenticated user role from the context.
func GetRole(c *gin.Context) string {
	role, _ := c.Get(CtxRole)
	if role == nil {
		return ""
	}
	return role.(string)
}
