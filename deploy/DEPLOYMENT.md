# CoreCold — Production Deployment Notes (for DevOps / SysAdmin)

Companion files: [`ecosystem.config.cjs`](../ecosystem.config.cjs) (PM2),
[`nginx-corecold.conf`](./nginx-corecold.conf) (reverse proxy).

---

## ⚠️ This project does NOT use Prisma

There is **no ORM**. The schema is managed by a small, **forward-only SQL
migration runner** (`server/db/migrate.js`) over the `pg` driver. Ignore any
"Prisma" expectation — use the steps below.

---

## 1. Build the frontend (static `dist/`)

```bash
npm ci
npm run build      # → produces dist/  (this is what Nginx serves)
```

> **Heads-up:** `vite.config.js` currently sets `base: '/website_7de9a28b/'` for
> builds. For a **root-domain** deploy change it to `base: '/'` (or make it
> env-driven) **before** building, otherwise the hashed asset URLs will 404.

---

## 2. Database migrations (safe & non-destructive)

The runner applies each `server/migrations/NNN_*.sql` file **exactly once**,
inside a transaction, and records applied files in the `schema_migrations`
table. Re-running is safe — already-applied files are **skipped**. It **never**
drops or wipes data.

```bash
# Point at the managed PostgreSQL instance (use the provider's SSL-required URL):
export DATABASE_URL="postgresql://USER:PASSWORD@DB_HOST:5432/corecold_db?sslmode=require"
export NODE_ENV=production                       # forces verified TLS to the DB
export JWT_SECRET="<strong-value>"               # config.js requires these to boot
export WALLET_KEYSTORE_PASSWORD="<strong-value>" # (npm run gen:secrets)

npm run db:migrate
```

**Expected output:** `✓ done — N new migration(s) applied.`
**Verify:** `SELECT filename, applied_at FROM schema_migrations ORDER BY filename;`

### ❌ Never run these against production
| Command | Why |
|---|---|
| `npm run db:seed` | Inserts **demo** users + wallets (development fixtures). |
| `npm run db:dev` | Spins up an **embedded local** Postgres (development only). |
| `node server/db/clean-users.js` | **DESTRUCTIVE** — wipes user data. |

### Admin account — preserve the existing credential (this deployment)

We are keeping the **already-issued** admin password. The stored value is a
one-way **bcrypt hash**, so copying that exact hash to production keeps the
password identical. **Do NOT run `npm run db:bootstrap-prod`** — it would
generate a new password and overwrite the one you documented.

```bash
# Preserve: upsert the admin row carrying its existing bcrypt hash.
node server/db/restore-admin.js     # → "✓ Admin credential preserved …"
```

Equivalent raw-SQL path (manual hash insert) — paste the existing hash from
`SELECT password_hash FROM users WHERE email='admin@corecold.com';` on staging:

```sql
INSERT INTO users (id, email, password_hash, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@corecold.com',
        '<EXISTING_BCRYPT_HASH>', 'CoreCold Admin', 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';
```

> Only if you ever want a *fresh* admin password instead, run
> `npm run db:bootstrap-prod` (it also wipes test users and prints the new one).
> Never ship default credentials (e.g. `admin123`).

`server/db/restore-admin.js` embeds the admin's bcrypt hash — treat it as a
secret: keep it gitignored or hand it to the operator out-of-band.

---

## 3. Run the API under PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup          # auto-restart on reboot
```

Secrets: fill the `env_production` placeholders only on a **host-local,
gitignored** copy — or omit the secret lines and export them into the host /
systemd environment (PM2 inherits `process.env`). The API listens on
`127.0.0.1:4000`; health check: `GET /api/health`.

In production the app sets `trust proxy = 1`, so behind Nginx the login
rate-limiter keys on the **real client IP** (via `X-Forwarded-For`).

---

## 4. Nginx

Use [`nginx-corecold.conf`](./nginx-corecold.conf): TLS termination, static
`dist/`, SPA fallback, and `/api → 127.0.0.1:4000`. Replace the `server_name`,
`root`, and `ssl_certificate*` placeholders.

---

## Migration safety / rollback

- Migrations are **forward-only**: to change schema, **add a new
  `NNN_*.sql`** file — never edit an already-applied migration.
- Take a **DB snapshot** (or rely on the provider's point-in-time restore)
  **before** each migration so any change is reversible.
- The runner is transactional per file: a failing migration rolls back and is
  **not** recorded, so you can fix the SQL and re-run.
