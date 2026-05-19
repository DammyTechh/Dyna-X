package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Envelope wraps all API responses in a consistent shape.
type Envelope struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// APIError carries machine-readable error detail.
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// Meta carries pagination and context metadata.
type Meta struct {
	Page       int   `json:"page,omitempty"`
	PageSize   int   `json:"page_size,omitempty"`
	Total      int64 `json:"total,omitempty"`
	TotalPages int   `json:"total_pages,omitempty"`
}

// ─── Success helpers ──────────────────────────────────────────────────────────

func OK(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, Envelope{Success: true, Message: message, Data: data})
}

func Created(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusCreated, Envelope{Success: true, Message: message, Data: data})
}

func Paginated(c *gin.Context, data interface{}, meta *Meta) {
	c.JSON(http.StatusOK, Envelope{Success: true, Data: data, Meta: meta})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// ─── Error helpers ────────────────────────────────────────────────────────────

func BadRequest(c *gin.Context, code, message string, details ...interface{}) {
	var d interface{}
	if len(details) > 0 {
		d = details[0]
	}
	c.AbortWithStatusJSON(http.StatusBadRequest, Envelope{
		Success: false,
		Error:   &APIError{Code: code, Message: message, Details: d},
	})
}

func Unauthorized(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, Envelope{
		Success: false,
		Error:   &APIError{Code: "UNAUTHORIZED", Message: message},
	})
}

func Forbidden(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusForbidden, Envelope{
		Success: false,
		Error:   &APIError{Code: "FORBIDDEN", Message: message},
	})
}

func NotFound(c *gin.Context, resource string) {
	c.AbortWithStatusJSON(http.StatusNotFound, Envelope{
		Success: false,
		Error:   &APIError{Code: "NOT_FOUND", Message: resource + " not found"},
	})
}

func Conflict(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusConflict, Envelope{
		Success: false,
		Error:   &APIError{Code: "CONFLICT", Message: message},
	})
}

func UnprocessableEntity(c *gin.Context, message string, details interface{}) {
	c.AbortWithStatusJSON(http.StatusUnprocessableEntity, Envelope{
		Success: false,
		Error:   &APIError{Code: "VALIDATION_ERROR", Message: message, Details: details},
	})
}

func TooManyRequests(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusTooManyRequests, Envelope{
		Success: false,
		Error:   &APIError{Code: "RATE_LIMITED", Message: "Too many requests. Please slow down."},
	})
}

func InternalError(c *gin.Context, err error) {
	c.AbortWithStatusJSON(http.StatusInternalServerError, Envelope{
		Success: false,
		Error:   &APIError{Code: "INTERNAL_ERROR", Message: "An unexpected error occurred"},
	})
}
