package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// ─── Models ──────────────────────────────────────────────

type Payment struct {
	ID          int       `json:"id"`
	OrderID     string    `json:"order_id"`
	UserID      string    `json:"user_id"`
	Amount      float64   `json:"amount"`
	Method      string    `json:"method"` // CREDIT_CARD, BANK_TRANSFER, MOMO, VNPAY, COD
	Status      string    `json:"status"` // PENDING, SUCCESS, FAILED, REFUNDED
	TxnRef      string    `json:"txn_ref,omitempty"`
	FailReason  string    `json:"fail_reason,omitempty"`
	RefundedAt  *time.Time `json:"refunded_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreatePaymentReq struct {
	OrderID string  `json:"order_id" binding:"required"`
	UserID  string  `json:"user_id"  binding:"required"`
	Amount  float64 `json:"amount"   binding:"required,gt=0"`
	Method  string  `json:"method"   binding:"required"`
}

type PaymentStats struct {
	Total        int     `json:"total"`
	Success      int     `json:"success"`
	Failed       int     `json:"failed"`
	Pending      int     `json:"pending"`
	Refunded     int     `json:"refunded"`
	TotalRevenue float64 `json:"total_revenue"`
	ByMethod     map[string]int `json:"by_method"`
}

// ─── In-memory store (replace with DB in production) ─────

var (
	mu       sync.RWMutex
	payments []Payment
	nextID   = 1
	logURL   = getEnv("LOG_SERVICE_URL", "http://log-service:8006")
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── Log Helper ──────────────────────────────────────────

func sendLog(service, action, detail string, status int) {
	go func() {
		body, _ := json.Marshal(map[string]interface{}{
			"service":   service,
			"action":    action,
			"detail":    detail,
			"status":    status,
			"level":     logLevel(status),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		resp, err := http.Post(logURL+"/api/logs", "application/json", bytes.NewBuffer(body))
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func logLevel(status int) string {
	if status >= 500 {
		return "ERROR"
	} else if status >= 400 {
		return "WARN"
	}
	return "INFO"
}

// ─── Payment Gateway Stubs ───────────────────────────────

func processPayment(method string, amount float64) (string, bool) {
	// In production: call VNPay, MoMo, etc.
	txnRef := fmt.Sprintf("TXN-%d-%d", time.Now().Unix(), nextID)
	switch method {
	case "COD":
		return txnRef, true // Cash on delivery always succeeds
	case "MOMO", "VNPAY", "CREDIT_CARD", "BANK_TRANSFER":
		// Simulate 95% success rate
		return txnRef, time.Now().UnixNano()%20 != 0
	default:
		return "", false
	}
}

// ─── Handlers ────────────────────────────────────────────

func getPayments(c *gin.Context) {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]Payment, len(payments))
	copy(result, payments)

	// Filter by user_id if provided
	if uid := c.Query("user_id"); uid != "" {
		filtered := result[:0]
		for _, p := range result {
			if p.UserID == uid {
				filtered = append(filtered, p)
			}
		}
		result = filtered
	}

	sendLog("payment-service", "GET_PAYMENTS", fmt.Sprintf("count=%d", len(result)), 200)
	c.JSON(200, gin.H{"data": result, "total": len(result)})
}

func getPaymentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}

	mu.RLock()
	defer mu.RUnlock()

	for _, p := range payments {
		if p.ID == id {
			sendLog("payment-service", "GET_PAYMENT", fmt.Sprintf("id=%d", id), 200)
			c.JSON(200, p)
			return
		}
	}
	c.JSON(404, gin.H{"error": "Thanh toán không tồn tại"})
}

func createPayment(c *gin.Context) {
	var req CreatePaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	validMethods := map[string]bool{"CREDIT_CARD": true, "BANK_TRANSFER": true, "MOMO": true, "VNPAY": true, "COD": true}
	if !validMethods[req.Method] {
		c.JSON(400, gin.H{"error": "Phương thức thanh toán không hợp lệ. Dùng: CREDIT_CARD, BANK_TRANSFER, MOMO, VNPAY, COD"})
		return
	}

	txnRef, success := processPayment(req.Method, req.Amount)
	status := "SUCCESS"
	failReason := ""
	if !success {
		status = "FAILED"
		failReason = "Giao dịch bị từ chối bởi ngân hàng"
	}

	mu.Lock()
	payment := Payment{
		ID:        nextID,
		OrderID:   req.OrderID,
		UserID:    req.UserID,
		Amount:    req.Amount,
		Method:    req.Method,
		Status:    status,
		TxnRef:    txnRef,
		FailReason: failReason,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	nextID++
	payments = append(payments, payment)
	mu.Unlock()

	httpStatus := 201
	if !success {
		httpStatus = 402
	}
	sendLog("payment-service", "CREATE_PAYMENT",
		fmt.Sprintf("orderId=%s, method=%s, amount=%.2f, status=%s", req.OrderID, req.Method, req.Amount, status),
		httpStatus)
	c.JSON(httpStatus, payment)
}

func refundPayment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	for i, p := range payments {
		if p.ID == id {
			if p.Status != "SUCCESS" {
				c.JSON(400, gin.H{"error": "Chỉ có thể hoàn tiền giao dịch thành công"})
				return
			}
			now := time.Now()
			payments[i].Status     = "REFUNDED"
			payments[i].RefundedAt = &now
			payments[i].UpdatedAt  = now
			sendLog("payment-service", "REFUND_PAYMENT", fmt.Sprintf("id=%d, orderId=%s", id, p.OrderID), 200)
			c.JSON(200, payments[i])
			return
		}
	}
	c.JSON(404, gin.H{"error": "Thanh toán không tồn tại"})
}

func getStats(c *gin.Context) {
	mu.RLock()
	defer mu.RUnlock()

	stats := PaymentStats{ByMethod: make(map[string]int)}
	for _, p := range payments {
		stats.Total++
		stats.ByMethod[p.Method]++
		switch p.Status {
		case "SUCCESS":
			stats.Success++
			stats.TotalRevenue += p.Amount
		case "FAILED":
			stats.Failed++
		case "PENDING":
			stats.Pending++
		case "REFUNDED":
			stats.Refunded++
		}
	}
	c.JSON(200, stats)
}

// ─── Main ─────────────────────────────────────────────────

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "payment-service"})
	})

	api := r.Group("/api/payments")
	{
		api.GET("",          getPayments)
		api.GET("/stats",    getStats)
		api.GET("/:id",      getPaymentByID)
		api.POST("",         createPayment)
		api.PUT("/:id/refund", refundPayment)
	}

	port := getEnv("PORT", "8004")
	log.Printf("🚀 Payment service running on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

// silence unused import
var _ = sql.Open
var _ = fmt.Sprintf
