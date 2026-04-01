const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Storage ─────────────────────────────────────────────
const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

let logs  = [];
let logId = 1;
const MAX_MEM_LOGS = 10000;

// Load last N lines from disk on startup
try {
  const raw  = fs.readFileSync(LOG_FILE, 'utf8').trim();
  const lines = raw ? raw.split('\n').slice(-MAX_MEM_LOGS) : [];
  logs = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  logId = logs.length ? Math.max(...logs.map(l => l.id || 0)) + 1 : 1;
  console.log(`Loaded ${logs.length} logs from disk`);
} catch (_) {}

function appendToFile(log) {
  fs.appendFile(LOG_FILE, JSON.stringify(log) + '\n', () => {});
}

// ─── POST /api/logs — Receive log from any service ───────
app.post('/api/logs', (req, res) => {
  const status = req.body.status || 200;
  const log = {
    id:        logId++,
    service:   req.body.service   || 'unknown',
    action:    req.body.action    || req.body.method || 'UNKNOWN',
    detail:    req.body.detail    || req.body.path   || '',
    status,
    ip:        req.body.ip        || req.ip,
    userId:    req.body.userId    || null,
    userAgent: req.body.userAgent || '',
    level:     req.body.level     || (status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'),
    timestamp: req.body.timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  logs.push(log);
  if (logs.length > MAX_MEM_LOGS) logs = logs.slice(-MAX_MEM_LOGS);
  appendToFile(log);

  res.status(201).json(log);
});

// ─── GET /api/logs — Query logs (Admin & Staff) ──────────
// Staff:  can filter by service, level, action, date
// Admin:  all of above + delete
app.get('/api/logs', (req, res) => {
  const {
    service, level, action, userId,
    from, to,
    limit = '50', page = '1',
    search,
  } = req.query;

  let result = [...logs];

  if (service) result = result.filter(l => l.service === service);
  if (level)   result = result.filter(l => l.level   === level.toUpperCase());
  if (action)  result = result.filter(l => l.action.includes(action.toUpperCase()));
  if (userId)  result = result.filter(l => l.userId  === userId);
  if (from)    result = result.filter(l => new Date(l.timestamp) >= new Date(from));
  if (to)      result = result.filter(l => new Date(l.timestamp) <= new Date(to));
  if (search)  result = result.filter(l =>
    l.detail.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  result = result.reverse(); // newest first

  const total    = result.length;
  const pageSize = Math.min(parseInt(limit), 200);
  const pageNum  = Math.max(parseInt(page), 1);
  const data     = result.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  res.json({
    total,
    page:      pageNum,
    limit:     pageSize,
    totalPages: Math.ceil(total / pageSize),
    data,
  });
});

// ─── GET /api/logs/stats — Dashboard stats ───────────────
app.get('/api/logs/stats', (req, res) => {
  const now    = new Date();
  const h1ago  = new Date(now - 60 * 60 * 1000);
  const h24ago = new Date(now - 24 * 60 * 60 * 1000);
  const d7ago  = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const stats = {
    total:     logs.length,
    last1h:    0,
    last24h:   0,
    last7d:    0,
    byService: {},
    byLevel:   { INFO: 0, WARN: 0, ERROR: 0 },
    byAction:  {},
    errorRate: '0%',
    topErrors: [],
  };

  const errorMap = {};

  logs.forEach(log => {
    const ts = new Date(log.timestamp);

    if (ts >= h1ago)  stats.last1h++;
    if (ts >= h24ago) stats.last24h++;
    if (ts >= d7ago)  stats.last7d++;

    stats.byService[log.service] = (stats.byService[log.service] || 0) + 1;

    if (stats.byLevel[log.level] !== undefined) {
      stats.byLevel[log.level]++;
    }

    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

    if (log.level === 'ERROR') {
      const key = `${log.service}:${log.action}`;
      errorMap[key] = (errorMap[key] || 0) + 1;
    }
  });

  stats.errorRate = logs.length > 0
    ? ((stats.byLevel.ERROR / logs.length) * 100).toFixed(2) + '%'
    : '0%';

  stats.topErrors = Object.entries(errorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  res.json(stats);
});

// ─── GET /api/logs/services — List all services ──────────
app.get('/api/logs/services', (req, res) => {
  const services = [...new Set(logs.map(l => l.service))].sort();
  res.json({ services });
});

// ─── GET /api/logs/export/csv — CSV export ───────────────
app.get('/api/logs/export/csv', (req, res) => {
  const header = 'id,service,action,detail,status,level,userId,ip,timestamp\n';
  const rows   = logs.map(l =>
    [l.id, `"${l.service}"`, `"${l.action}"`, `"${(l.detail||'').replace(/"/g,'""')}"`,
     l.status, l.level, `"${l.userId||''}"`, `"${l.ip||''}"`, `"${l.timestamp}"`].join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=logs_${Date.now()}.csv`);
  res.send('\uFEFF' + header + rows); // BOM for Excel UTF-8
});

// ─── GET /api/logs/:id — Single log detail ───────────────
app.get('/api/logs/:id', (req, res) => {
  const log = logs.find(l => l.id === parseInt(req.params.id));
  if (!log) return res.status(404).json({ error: 'Log not found' });
  res.json(log);
});

// ─── DELETE /api/logs — Clear logs (Admin only) ──────────
app.delete('/api/logs', (req, res) => {
  const { before, service } = req.query;

  if (service) {
    const before_count = logs.length;
    logs = logs.filter(l => l.service !== service);
    return res.json({ message: `Deleted ${before_count - logs.length} logs from service: ${service}` });
  }

  if (before) {
    const before_count = logs.length;
    logs = logs.filter(l => new Date(l.timestamp) >= new Date(before));
    return res.json({ message: `Deleted ${before_count - logs.length} logs before ${before}` });
  }

  const count = logs.length;
  logs  = [];
  logId = 1;
  fs.writeFileSync(LOG_FILE, '');
  res.json({ message: `Cleared all ${count} logs` });
});

// ─── Health ──────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status:    'ok',
  service:   'log-service',
  totalLogs: logs.length,
  memUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
}));

// ─── Start ───────────────────────────────────────────────
const PORT = process.env.PORT || 8006;
app.listen(PORT, () => console.log(`📋 Log service running on port ${PORT}`));
