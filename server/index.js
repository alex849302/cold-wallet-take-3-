// VaultX backend API.
// The only tier that talks to the database. The React frontend calls these HTTP
// endpoints; all configuration comes from environment variables (see pool.js).
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool, query } from './db/pool.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import supportRoutes from './routes/support.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import walletRoutes from './routes/wallet.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import { logChainConnection } from './lib/provider.js';
import { startPriceRefresh } from './lib/priceService.js';
import { startDepositWatcher } from './lib/depositWatcher.js';

const app = express();

// In production we sit behind one reverse proxy (nginx / load balancer), so
// trust a single hop — this makes req.ip the real client IP for rate limiting.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);

// Security HTTP headers: clickjacking (X-Frame-Options), MIME sniffing
// (X-Content-Type-Options), HSTS, no X-Powered-By, a baseline CSP, etc.
app.use(helmet());

// CORS: in production, whitelist origins via ALLOWED_ORIGINS (comma-separated).
// If it's unset (local dev), stay permissive so the Vite dev server just works.
function buildCorsOptions() {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.length === 0) return {}; // permissive default (cors() reflects origin)
  return {
    origin(origin, cb) {
      // Allow same-origin / non-browser clients (no Origin header: curl, health checks).
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  };
}
app.use(cors(buildCorsOptions()));
app.use(express.json());

// --- Health check: confirms the API is up AND the DB connection works. ------
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await query('SELECT now() AS server_time');
    res.json({ status: 'ok', db: 'connected', serverTime: rows[0].server_time });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
  }
});

// --- Feature routes ----------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);

// --- Centralised error handler. ---------------------------------------------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`VaultX API listening on http://localhost:${config.port}`);
  // Verify blockchain RPC connectivity on startup (logs network + block number).
  logChainConnection();
  // Warm the market-data cache and keep it fresh (one upstream call per 60s,
  // shared by every browser — see lib/priceService.js).
  startPriceRefresh(60_000);
  // Watch users' real on-chain addresses and raise ADMIN-ONLY alerts on incoming
  // deposits (users are not notified). Override the cadence via DEPOSIT_SCAN_MS.
  startDepositWatcher(Number(process.env.DEPOSIT_SCAN_MS) || 60_000);
});

// Graceful shutdown so the DB pool drains cleanly.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}

// Never let an unhandled async error take the whole API down (avoids 502 spirals).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
