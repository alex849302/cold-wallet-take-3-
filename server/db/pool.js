// PostgreSQL connection pool.
//
// Two connection modes, both env-driven (no hardcoded credentials):
//   • PRODUCTION / managed PG (Render, Supabase, Neon, RDS, …): set DATABASE_URL
//     to a single connection string. TLS is then mandatory and verified.
//   • LOCAL DEV / self-hosted: set the discrete DB_HOST/DB_PORT/DB_USER/
//     DB_PASSWORD/DB_NAME vars (DB_SSL off by default).
// Exposes pg-style helpers used across the repositories:
//   • query(text, params) -> { rows, rowCount }
//   • connect()           -> a client for transactions (.query/.release)
// SQL uses $1, $2 … placeholders.
import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
const connectionString = process.env.DATABASE_URL || '';

// SSL policy:
//   • production → TLS is REQUIRED and the server cert is VERIFIED
//     (rejectUnauthorized: true). Supply DB_SSL_CA if the provider needs a CA.
//   • development → opt-in via DB_SSL=true; verification on unless explicitly
//     disabled. Local Postgres stays plaintext (DB_SSL unset/false).
function buildSslConfig() {
  if (isProduction) {
    const ssl = { rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) ssl.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
    return ssl;
  }
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return false;
  const rejectUnauthorized =
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false';
  const ssl = { rejectUnauthorized };
  if (process.env.DB_SSL_CA) ssl.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
  return ssl;
}

function buildPoolConfig() {
  const base = {
    ssl: buildSslConfig(),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };

  // Preferred in production: a single generic connection string.
  if (connectionString) return { ...base, connectionString };

  // Otherwise assemble from discrete vars (local dev / self-hosted).
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Database is not configured: set DATABASE_URL, or all of ${required.join(', ')}. ` +
        'Copy .env.example to .env and fill it in.'
    );
  }
  return {
    ...base,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

export const pool = new Pool(buildPoolConfig());

// Don't let a transient idle-client error crash the whole API process.
pool.on('error', (err) => {
  console.error('Unexpected idle PostgreSQL client error:', err.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export function connect() {
  return pool.connect();
}

export default pool;
