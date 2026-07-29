# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -extldflags '-static'" \
    -o /app/bin/dynax-backend ./cmd/server/main.go

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Alpine (not scratch) so ffmpeg is available. ffmpeg converts non-MP4 capture
# videos (Android/Chrome WebM) to MP4 before reconstruction. The Go binary is
# statically linked (CGO_ENABLED=0), so it runs on Alpine unchanged.
FROM alpine:3.20

RUN apk add --no-cache ffmpeg ca-certificates tzdata

COPY --from=builder /app/bin/dynax-backend /dynax-backend

EXPOSE 8080
ENTRYPOINT ["/dynax-backend"]
