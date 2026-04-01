# ───────────── BUILD STAGE ─────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy toàn bộ source trước
COPY . .

# Tạo go.sum + tải dependency
RUN go mod tidy

# Build binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o payment-service .

# ───────────── RUN STAGE ─────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/payment-service .

EXPOSE 8004
CMD ["./payment-service"]