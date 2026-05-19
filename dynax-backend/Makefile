.PHONY: run build test swagger lint tidy docker-up docker-down migrate

# ─── Config ───────────────────────────────────────────────────────────────────
APP_NAME    = dynax-backend
MAIN        = ./cmd/server/main.go
BINARY      = ./bin/$(APP_NAME)
SWAGGER_OUT = ./docs/swagger

# ─── Development ──────────────────────────────────────────────────────────────

## run: start the API server with hot-reload (requires air)
run:
	@air -c .air.toml || go run $(MAIN)

## build: compile the binary
build:
	@echo "Building $(APP_NAME)..."
	@go build -ldflags="-s -w" -o $(BINARY) $(MAIN)
	@echo "Binary: $(BINARY)"

## test: run all unit + integration tests
test:
	@go test ./... -v -race -timeout 60s

## test-cover: run tests with coverage report
test-cover:
	@go test ./... -coverprofile=coverage.out
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

## tidy: sync go.mod + go.sum
tidy:
	@go mod tidy
	@go mod verify

## lint: run golangci-lint
lint:
	@golangci-lint run ./...

# ─── Swagger ──────────────────────────────────────────────────────────────────

## swagger: regenerate Swagger docs from annotations
swagger:
	@which swag > /dev/null || go install github.com/swaggo/swag/cmd/swag@latest
	@swag init -g $(MAIN) --output $(SWAGGER_OUT) --parseDependency --parseInternal
	@echo "Swagger docs generated at $(SWAGGER_OUT)"

# ─── Docker ───────────────────────────────────────────────────────────────────

## docker-up: start postgres + redis via docker-compose
docker-up:
	@docker-compose up -d

## docker-down: stop docker services
docker-down:
	@docker-compose down

## docker-build: build the Docker image
docker-build:
	@docker build -t $(APP_NAME):latest .

# ─── Database ─────────────────────────────────────────────────────────────────

## migrate: apply the migration to Supabase (requires DATABASE_URL)
migrate:
	@echo "Applying migration..."
	@psql $$DATABASE_URL -f ./migrations/001_dynax_complete_schema.sql
	@echo "Migration complete"

## migrate-dry: validate SQL without applying
migrate-dry:
	@psql $$DATABASE_URL --dry-run -f ./migrations/001_dynax_complete_schema.sql 2>&1 | head -50

# ─── Utils ────────────────────────────────────────────────────────────────────

## clean: remove build artifacts
clean:
	@rm -rf ./bin ./coverage.out ./coverage.html

## help: list available make targets
help:
	@grep -E '^## ' Makefile | sed 's/## //'
