# 🏗️ Microservices Architecture — Full Stack

> 6 ngôn ngữ lập trình · 7 services · Docker Compose ready

---

## 📐 Kiến trúc tổng quan

```
Client (Web / Mobile / Browser)
          │
          ▼
  ┌─────────────────────────────────────────┐
  │         API Gateway  :8000              │
  │   Node.js · JWT Auth · Rate Limit       │
  └──┬──────┬──────┬──────┬──────┬──────┬──┘
     │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼
  Auth  Product Order Payment Notif  Log
  :8001  :8002  :8003   :8004  :8005 :8006
  Java   Python   C#     Go    PHP   Node
     │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼
  PgSQL  Mongo  MySQL   PgSQL  MySQL
  Redis (cache / queue)
```

---

## 🧩 Services

| Service              | Ngôn ngữ       | Port | Database    | Mô tả                             |
|----------------------|----------------|------|-------------|-----------------------------------|
| API Gateway          | Node.js/Express| 8000 | —           | Routing, JWT verify, Rate limit   |
| Auth Service         | Java/Spring Boot| 8001| PostgreSQL  | Đăng ký, đăng nhập, JWT, roles   |
| Product Service      | Python/FastAPI  | 8002| MongoDB     | CRUD sản phẩm, tìm kiếm          |
| Order Service        | C#/.NET 8       | 8003| PostgreSQL  | Quản lý đơn hàng, trạng thái     |
| Payment Service      | Go/Gin          | 8004| In-memory*  | Thanh toán, hoàn tiền, thống kê  |
| Notification Service | PHP/Laravel 11  | 8005| MySQL       | Email, SMS, Push, đọc/chưa đọc   |
| Log Service          | Node.js/Express | 8006| File + Mem  | Ghi log, thống kê, export CSV    |

> *Payment có thể kết nối PostgreSQL trong production

---

## 👤 Phân quyền (Roles)

| Role    | Quyền                                                                |
|---------|----------------------------------------------------------------------|
| `USER`  | Xem sản phẩm, đặt hàng, thanh toán, xem thông báo của mình         |
| `STAFF` | Tất cả USER + xem log, xem tất cả đơn hàng, thống kê               |
| `ADMIN` | Tất cả STAFF + xóa log, quản lý users, đổi role, xóa đơn hàng      |

---

## 🚀 Chạy project

### Yêu cầu
- Docker Desktop >= 4.x
- Docker Compose >= 2.x

### Khởi động

```bash
# Clone và vào thư mục
cd microservices

# Build và chạy tất cả services
docker compose up --build

# Chạy nền
docker compose up -d --build

# Xem log
docker compose logs -f api-gateway
docker compose logs -f auth-service
```

### Dừng

```bash
docker compose down          # Dừng nhưng giữ data
docker compose down -v       # Dừng và xóa toàn bộ data
```

---

## 🔌 API Endpoints

### Auth Service (`/api/auth`)

| Method | Endpoint                        | Auth       | Mô tả                    |
|--------|---------------------------------|------------|--------------------------|
| POST   | `/api/auth/register`            | Public     | Đăng ký tài khoản        |
| POST   | `/api/auth/login`               | Public     | Đăng nhập, nhận JWT      |
| POST   | `/api/auth/validate?token=...`  | Public     | Kiểm tra token hợp lệ    |
| GET    | `/api/auth/profile`             | User+       | Xem thông tin bản thân   |
| PUT    | `/api/auth/profile`             | User+       | Cập nhật profile          |
| GET    | `/api/auth/admin/users`         | Admin      | Danh sách tất cả users   |
| PUT    | `/api/auth/admin/users/:id/role`| Admin      | Đổi role user            |
| PUT    | `/api/auth/admin/users/:id/toggle`| Admin    | Khóa/mở khóa tài khoản  |

### Product Service (`/api/products`)

| Method | Endpoint                        | Auth       | Mô tả                    |
|--------|---------------------------------|------------|--------------------------|
| GET    | `/api/products`                 | Public     | Danh sách sản phẩm       |
| GET    | `/api/products/categories`      | Public     | Danh mục sản phẩm        |
| GET    | `/api/products/:id`             | Public     | Chi tiết sản phẩm        |
| POST   | `/api/products`                 | User+       | Thêm sản phẩm            |
| PUT    | `/api/products/:id`             | User+       | Cập nhật sản phẩm        |
| PATCH  | `/api/products/:id/stock`       | User+       | Điều chỉnh tồn kho       |
| DELETE | `/api/products/:id`             | User+       | Xóa sản phẩm             |

### Order Service (`/api/orders`)

| Method | Endpoint                        | Auth       | Mô tả                    |
|--------|---------------------------------|------------|--------------------------|
| GET    | `/api/orders`                   | Staff/Admin | Tất cả đơn hàng         |
| GET    | `/api/orders/user/:userId`      | User+       | Đơn hàng của user        |
| GET    | `/api/orders/:id`               | User+       | Chi tiết đơn hàng        |
| POST   | `/api/orders`                   | User+       | Tạo đơn hàng             |
| PUT    | `/api/orders/:id/status`        | User+       | Cập nhật trạng thái      |
| GET    | `/api/orders/stats`             | Staff/Admin | Thống kê đơn hàng        |
| DELETE | `/api/orders/:id`               | Admin       | Xóa đơn hàng             |

### Payment Service (`/api/payments`)

| Method | Endpoint                        | Auth       | Mô tả                    |
|--------|---------------------------------|------------|--------------------------|
| GET    | `/api/payments`                 | User+       | Danh sách thanh toán     |
| GET    | `/api/payments/stats`           | Staff/Admin | Thống kê doanh thu       |
| GET    | `/api/payments/:id`             | User+       | Chi tiết thanh toán      |
| POST   | `/api/payments`                 | User+       | Tạo thanh toán mới       |
| PUT    | `/api/payments/:id/refund`      | User+       | Hoàn tiền                |

**Phương thức thanh toán:** `CREDIT_CARD` · `BANK_TRANSFER` · `MOMO` · `VNPAY` · `COD`

### Notification Service (`/api/notifications`)

| Method | Endpoint                               | Auth       | Mô tả                  |
|--------|----------------------------------------|------------|------------------------|
| GET    | `/api/notifications`                   | Staff/Admin | Tất cả thông báo      |
| GET    | `/api/notifications/stats`             | Staff/Admin | Thống kê thông báo    |
| GET    | `/api/notifications/user/:userId`      | User+       | Thông báo của user     |
| POST   | `/api/notifications/send-email`        | User+       | Gửi email              |
| POST   | `/api/notifications/send-sms`          | User+       | Gửi SMS                |
| POST   | `/api/notifications/send-push`         | User+       | Gửi push notification  |
| PUT    | `/api/notifications/:id/read`          | User+       | Đánh dấu đã đọc        |
| PUT    | `/api/notifications/user/:id/read-all` | User+       | Đánh dấu tất cả đã đọc |

### Log Service (`/api/logs`) — Admin & Staff only

| Method | Endpoint                  | Mô tả                                   |
|--------|---------------------------|-----------------------------------------|
| GET    | `/api/logs`               | Xem log (filter: service, level, date)  |
| GET    | `/api/logs/stats`         | Thống kê: error rate, top errors        |
| GET    | `/api/logs/services`      | Danh sách các service đang log          |
| GET    | `/api/logs/export/csv`    | Export CSV                              |
| GET    | `/api/logs/:id`           | Chi tiết 1 log                          |
| DELETE | `/api/logs`               | Xóa log (Admin only)                    |

---

## 📋 Ví dụ sử dụng

### 1. Đăng ký & đăng nhập

```bash
# Đăng ký
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@test.com","password":"Admin123!","role":"ADMIN"}'

# Đăng nhập
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!"}'
# → nhận được token

export TOKEN="eyJhbGci..."
```

### 2. Tạo đơn hàng

```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "totalAmount": 1499.98,
    "items": [
      {"productId": 1, "productName": "Laptop Pro", "quantity": 1, "price": 999.99},
      {"productId": 2, "productName": "Phone X",    "quantity": 1, "price": 499.99}
    ]
  }'
```

### 3. Xem log (Admin)

```bash
# Tất cả log lỗi
curl http://localhost:8000/api/logs?level=ERROR \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Log của auth-service hôm nay
curl "http://localhost:8000/api/logs?service=auth-service&from=2024-01-01" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Thống kê
curl http://localhost:8000/api/logs/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Export CSV
curl http://localhost:8000/api/logs/export/csv \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o logs.csv
```

---

## 🗂️ Cấu trúc thư mục

```
microservices/
├── docker-compose.yml
├── scripts/
│   └── init-multi-db.sh          # Tạo nhiều PostgreSQL databases
│
├── api-gateway/                  # Node.js - JWT verify, routing
│   ├── src/server.js
│   ├── package.json
│   └── Dockerfile
│
├── auth-service/                 # Java Spring Boot - Auth, Users, Roles
│   ├── src/main/java/com/microservices/auth/
│   │   ├── AuthApplication.java
│   │   ├── config/SecurityConfig.java
│   │   ├── controller/AuthController.java
│   │   ├── dto/Dtos.java
│   │   ├── model/User.java
│   │   ├── repository/UserRepository.java
│   │   ├── security/JwtUtil.java
│   │   └── service/{AuthService,LogService}.java
│   ├── src/main/resources/application.properties
│   ├── pom.xml
│   └── Dockerfile
│
├── product-service/              # Python FastAPI - Products, Search
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── order-service/                # C# .NET 8 - Orders, Status workflow
│   ├── Controllers/OrderController.cs
│   ├── Data/AppDbContext.cs
│   ├── Models/Order.cs
│   ├── Services/{IOrderService,OrderServiceImpl,LogService}.cs
│   ├── Program.cs
│   ├── OrderService.csproj
│   ├── appsettings.json
│   └── Dockerfile
│
├── payment-service/              # Go Gin - Payment, Refund, Stats
│   ├── main.go
│   ├── go.mod
│   └── Dockerfile
│
├── notification-service/         # PHP Laravel 11 - Email, SMS, Push
│   ├── app/Http/Controllers/NotificationController.php
│   ├── app/Models/Notification.php
│   ├── app/Services/LogService.php
│   ├── bootstrap/app.php
│   ├── database/migrations/...
│   ├── routes/api.php
│   ├── composer.json
│   └── Dockerfile
│
└── log-service/                  # Node.js - Centralized logging
    ├── src/server.js
    ├── package.json
    └── Dockerfile
```

---

## 🔒 Bảo mật

- **JWT** verify tại API Gateway — services không cần tự verify
- **Rate limiting**: 200 req/15min global, 20 req/15min cho auth endpoints
- **Log Service** chỉ ADMIN mới truy cập được qua Gateway
- Passwords hash bằng **BCrypt** (cost factor 10)
- Token expire sau **24 giờ**
- Header `X-User-Email` và `X-User-Role` được Gateway inject — services tin tưởng header này

---

## 📊 Health Check

```bash
# Gateway health (bao gồm tất cả services)
curl http://localhost:8000/health

# Từng service
curl http://localhost:8001/api/auth/health  # Auth
curl http://localhost:8002/health           # Product
curl http://localhost:8003/health           # Order
curl http://localhost:8004/health           # Payment
curl http://localhost:8005/api/health       # Notification
curl http://localhost:8006/health           # Log
```
#   m i c r o s e r v i c e _ d o c k e r  
 