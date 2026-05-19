package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/dynalimb/dynax-backend/internal/config"
)

// Pool wraps the pgx connection pool.
type Pool struct {
	*pgxpool.Pool
}

// Connect opens a pgx connection pool to Supabase Postgres.
func Connect(cfg *config.Config) (*Pool, error) {
	pgxCfg, err := pgxpool.ParseConfig(cfg.DB.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	// Pool settings tuned for Supabase session mode (Transaction pooling uses different limits).
	pgxCfg.MaxConns            = 20
	pgxCfg.MinConns            = 2
	pgxCfg.MaxConnIdleTime     = 5 * time.Minute
	pgxCfg.MaxConnLifetime     = 30 * time.Minute
	pgxCfg.HealthCheckPeriod   = 1 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, pgxCfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	log.Info().Str("host", pgxCfg.ConnConfig.Host).Msg("connected to Supabase Postgres")
	return &Pool{pool}, nil
}

// Close gracefully closes the pool.
func (p *Pool) Close() {
	p.Pool.Close()
	log.Info().Msg("database pool closed")
}

// ─── Query helpers ────────────────────────────────────────────────────────────

// ExecOne runs a query and returns an error if no rows were affected.
func (p *Pool) ExecOne(ctx context.Context, query string, args ...interface{}) error {
	tag, err := p.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no rows affected")
	}
	return nil
}

// Count runs a COUNT query and returns the result.
func (p *Pool) Count(ctx context.Context, query string, args ...interface{}) (int64, error) {
	var count int64
	err := p.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}
