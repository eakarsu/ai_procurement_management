import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';
import { auditMutation } from './middleware/audit';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth';
import vendorRoutes from './routes/vendors';
import bidRoutes from './routes/bids';

dotenv.config();
export const app = express();
export const server = createServer(app);
const requestTotals = new Map<string, number>();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true, allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use((req, res, next) => {
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  res.setHeader('X-Request-Id', requestId);
  const started = Date.now();
  res.on('finish', () => {
    const key = `${req.method}:${res.statusCode}`;
    requestTotals.set(key, (requestTotals.get(key) || 0) + 1);
    console.log(JSON.stringify({ level: 'info', event: 'http_request', requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started }));
  });
  next();
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', authRoutes);
app.use('/api/vendors', authenticateToken, auditMutation, vendorRoutes);
app.use('/api/bids', authenticateToken, auditMutation, bidRoutes);

// Generated dashboards and generic model calls are prototypes, not an
// authoritative procurement record. They remain unavailable in production.
if (process.env.ENABLE_EXPERIMENTAL_ROUTES === 'true' && process.env.NODE_ENV !== 'production') {
  app.use('/api/compliance', authenticateToken, require('./routes/compliance').default);
  app.use('/api/dashboard', authenticateToken, require('./routes/dashboard').default);
  app.use('/api/ai', authenticateToken, require('./routes/ai').default);
}

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'healthy' }));
app.get('/api/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; return res.json({ success: true, status: 'ready', database: 'ok' }); }
  catch { return res.status(503).json({ success: false, status: 'not_ready', database: 'error' }); }
});
app.get('/api/metrics', (_req, res) => res.type('text/plain').send([...requestTotals.entries()].map(([key, value]) => {
  const [method, status] = key.split(':');
  return `http_requests_total{method="${method}",status="${status}"} ${value}`;
}).join('\n') + '\n'));
app.use(errorHandler);

export function startServer() {
  const missing = ['DATABASE_URL'].filter(key => !process.env[key]);
  if (missing.length || (process.env.AUTH_MODE !== 'oidc' && (process.env.JWT_SECRET?.length ?? 0) < 32)) throw new Error(`Unsafe configuration: missing ${missing.join(', ') || 'a JWT_SECRET of at least 32 characters for local authentication'}`);
  if (process.env.NODE_ENV === 'production' && (process.env.AUTH_MODE !== 'oidc' || !process.env.OIDC_ISSUER?.startsWith('https://') || !process.env.OIDC_AUDIENCE || !process.env.OIDC_JWKS_URL?.startsWith('https://'))) throw new Error('Production requires AUTH_MODE=oidc and HTTPS OIDC configuration');
  const port = Number(process.env.PORT || 3001);
  return server.listen(port, () => console.log(JSON.stringify({ level: 'info', event: 'server_started', port })));
}

if (require.main === module) startServer();
