package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment.
type Config struct {
	App      AppConfig
	DB       DBConfig
	JWT      JWTConfig
	Redis    RedisConfig
	Resend   ResendConfig
	OpenAI   OpenAIConfig
	Storage  StorageConfig
	Security SecurityConfig
	Log      LogConfig
}

type AppConfig struct {
	Env     string
	Port    string
	Name    string
	Version string
}

type DBConfig struct {
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	DatabaseURL            string
}

type JWTConfig struct {
	Secret             string
	ExpiryHours        time.Duration
	RefreshExpiryHours time.Duration
}

type RedisConfig struct {
	URL      string
	Password string
}

type ResendConfig struct {
	APIKey    string
	FromEmail string
	FromName  string
}

type OpenAIConfig struct {
	APIKey string
	Model  string
}

type StorageConfig struct {
	BucketDocs    string
	BucketDevices string
	BucketAvatars string
}

type SecurityConfig struct {
	BcryptCost          int
	RateLimitRPS        float64
	RateLimitBurst      int
	CORSAllowedOrigins  []string
}

type LogConfig struct {
	Level  string
	Format string
}

// Load reads config from environment (and optional .env file).
func Load() (*Config, error) {
	// Load .env if present (non-fatal if missing in production).
	_ = godotenv.Load()

	cfg := &Config{}

	// App
	cfg.App = AppConfig{
		Env:     getEnv("APP_ENV", "development"),
		Port:    getEnv("APP_PORT", "8080"),
		Name:    getEnv("APP_NAME", "DynaX API"),
		Version: getEnv("APP_VERSION", "1.0.0"),
	}

	// DB
	cfg.DB = DBConfig{
		SupabaseURL:            mustEnv("SUPABASE_URL"),
		SupabaseAnonKey:        mustEnv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
		DatabaseURL:            mustEnv("DATABASE_URL"),
	}

	// JWT
	jwtExpiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	jwtRefresh, _ := strconv.Atoi(getEnv("JWT_REFRESH_EXPIRY_HOURS", "168"))
	cfg.JWT = JWTConfig{
		Secret:             mustEnv("JWT_SECRET"),
		ExpiryHours:        time.Duration(jwtExpiry) * time.Hour,
		RefreshExpiryHours: time.Duration(jwtRefresh) * time.Hour,
	}

	// Redis
	cfg.Redis = RedisConfig{
		URL:      getEnv("REDIS_URL", "redis://localhost:6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
	}

	// Resend
	cfg.Resend = ResendConfig{
		APIKey:    mustEnv("RESEND_API_KEY"),
		FromEmail: getEnv("RESEND_FROM_EMAIL", "noreply@dynalimb.com"),
		FromName:  getEnv("RESEND_FROM_NAME", "DynaX Platform"),
	}

	// OpenAI
	cfg.OpenAI = OpenAIConfig{
		APIKey: getEnv("OPENAI_API_KEY", ""),
		Model:  getEnv("OPENAI_MODEL", "gpt-4o"),
	}

	// Storage
	cfg.Storage = StorageConfig{
		BucketDocs:    getEnv("STORAGE_BUCKET_DOCS", "dynax-documents"),
		BucketDevices: getEnv("STORAGE_BUCKET_DEVICES", "dynax-devices"),
		BucketAvatars: getEnv("STORAGE_BUCKET_AVATARS", "dynax-avatars"),
	}

	// Security
	bcryptCost, _ := strconv.Atoi(getEnv("BCRYPT_COST", "12"))
	rlRPS, _ := strconv.ParseFloat(getEnv("RATE_LIMIT_RPS", "10"), 64)
	rlBurst, _ := strconv.Atoi(getEnv("RATE_LIMIT_BURST", "20"))
	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
	cfg.Security = SecurityConfig{
		BcryptCost:         bcryptCost,
		RateLimitRPS:       rlRPS,
		RateLimitBurst:     rlBurst,
		CORSAllowedOrigins: strings.Split(corsRaw, ","),
	}

	// Log
	cfg.Log = LogConfig{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}
