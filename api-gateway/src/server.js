const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(morgan('combined'));

// ─── Rate Limiting ───────────────────────────────────────
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } });
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { error: 'Too many auth requests' } });
app.use(globalLimiter);

// ─── Service URLs ────────────────────────────────────────
const SERVICES = {
  auth:         process.env.AUTH_SERVICE_URL         || 'http://auth-service:8001',
  product:      process.env.PRODUCT_SERVICE_URL      || 'http://product-service:8002',
  order:        process.env.ORDER_SERVICE_URL        || 'http://order-service:8003',
  payment:      process.env.PAYMENT_SERVICE_URL      || 'http://payment-service:8004',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8005',
  log:          process.env.LOG_SERVICE_URL          || 'http://log-service:8006',
};

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretKey1234567890123456789012345';

// ─── Log Helper ──────────────────────────────────────────
async function sendLog(data) {
  try {
    await axios.post(`${SERVICES.log}/api/logs`, {
      service:   'api-gateway',
      action:    data.action || 'REQUEST',
      detail:    data.detail || '',
      method:    data.method,
      path:      data.path,
      status:    data.status,
      ip:        data.ip,
      userId:    data.userId || null,
      userAgent: data.userAgent || '',
      level:     data.status >= 500 ? 'ERROR' : data.status >= 400 ? 'WARN' : 'INFO',
      timestamp: new Date().toISOString(),
    }, { timeout: 2000 });
  } catch (_) {}
}

// ─── Request Logger Middleware ───────────────────────────
app.use((req, res, next) => {
  const user = req.user || {};
  res.on('finish', () => sendLog({
    action:    'HTTP_REQUEST',
    detail:    `${req.method} ${req.originalUrl}`,
    method:    req.method,
    path:      req.originalUrl,
    status:    res.statusCode,
    ip:        req.ip,
    userId:    user.email,
    userAgent: req.headers['user-agent'],
  }));
  next();
});

// ─── JWT Verify Middleware ───────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    req.headers['x-user-email'] = decoded.sub || decoded.email || '';
    req.headers['x-user-role']  = decoded.role || 'USER';
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// ─── Proxy Helper ────────────────────────────────────────
const proxy = (target) => createProxyMiddleware({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      sendLog({ action: 'PROXY_ERROR', detail: err.message, path: req.originalUrl, status: 502, ip: req.ip });
      res.status(502).json({ error: 'Service unavailable' });
    },
  },
});

// ─── Routes ──────────────────────────────────────────────

// Auth — public (register/login) + rate limit
app.use('/api/auth/register', authLimiter, proxy(SERVICES.auth));
app.use('/api/auth/login',    authLimiter, proxy(SERVICES.auth));
app.use('/api/auth/validate', proxy(SERVICES.auth));
app.use('/api/auth',          requireAuth, proxy(SERVICES.auth));

// Products — GET public, write requires auth
app.get('/api/products',          proxy(SERVICES.product));
app.get('/api/products/:id',      proxy(SERVICES.product));
app.use('/api/products',          requireAuth, proxy(SERVICES.product));

// Orders — requires auth
app.use('/api/orders', requireAuth, proxy(SERVICES.order));

// Payments — requires auth
app.use('/api/payments', requireAuth, proxy(SERVICES.payment));

// Notifications — requires auth
app.use('/api/notifications', requireAuth, proxy(SERVICES.notification));

// Logs — ADMIN only (protect log service)
app.use('/api/logs', requireAdmin, proxy(SERVICES.log));

// ─── Health ──────────────────────────────────────────────
app.get('/health', async (_, res) => {
  const checks = {};
  await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const r = await axios.get(`${url}/health`, { timeout: 3000 });
        checks[name] = r.data?.status || 'ok';
      } catch {
        checks[name] = 'unreachable';
      }
    })
  );
  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 207).json({ status: allOk ? 'ok' : 'degraded', services: checks });
});

// ─── 404 ─────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 API Gateway running on port ${PORT}`));
