# CoreCold — Production Deployment Runbook

A single, ordered blueprint to take CoreCold from source to live. Run the steps
top-to-bottom. Companion files:
[`ecosystem.config.cjs`](../ecosystem.config.cjs) ·
[`nginx-corecold.conf`](./nginx-corecold.conf) ·
[`DEPLOYMENT.md`](./DEPLOYMENT.md) (deeper detail).

```
            ┌─────────────┐      /            ┌──────────────────────┐
  Browser → │    Nginx    │ ───────────────►  │  static dist/ (SPA)  │
  (HTTPS)   │  :443 TLS   │ ─── /api ──────►  │  Node API (PM2) :4000 │ ──► Managed
            └─────────────┘                   └──────────────────────┘     PostgreSQL
```

> **No Prisma / ORM.** Schema is managed by a built-in, forward-only SQL
> migration runner (`npm run db:migrate`). The data-safe procedure is in Step 4.

---

## 0. Prerequisites (on the host)

- **Node.js 18+** and **npm**, **PM2** (`npm i -g pm2`), **Nginx**, a TLS cert
  (e.g. Let's Encrypt/certbot).
- A **managed PostgreSQL** instance + its SSL connection string (`DATABASE_URL`).
- The repo checked out at the deploy path, e.g. `/var/www/corecold`.

```bash
cd /var/www/corecold
npm ci                     # install exact dependencies
```

## 1. Generate strong secrets (once)

```bash
npm run gen:secrets        # prints JWT_SECRET + WALLET_KEYSTORE_PASSWORD
```
Store them in your secrets manager. ⚠️ **`WALLET_KEYSTORE_PASSWORD` decrypts every
user keystore — set it once and never rotate it while wallets exist.**

## 2. Build the frontend → `dist/`

```bash
# Root-domain deploy: ensure vite.config.js uses base: '/'  (it ships with a
# subpath base that would 404 assets). Then:
npm run build              # outputs dist/  (served by Nginx in Step 6)
```

## 3. Inject environment / secrets

Fill the placeholders in [`ecosystem.config.cjs`](../ecosystem.config.cjs) on a
**host-local, gitignored** copy — or export them into the environment and let PM2
inherit them. Required: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
`WALLET_KEYSTORE_PASSWORD`, `ENCRYPTION_SECRET`, `SMTP_*`, `APP_BASE_URL`,
`RPC_URL`, and `ALLOWED_ORIGINS` (comma-separated origins allowed to call the API).
(`NODE_ENV=production` auto-enforces verified DB TLS and rejects placeholder secrets.)

## 4. Run database migrations (safe, no data loss)

The runner applies each `server/migrations/NNN_*.sql` **once**, in a transaction,
tracked in `schema_migrations`. Re-running **skips** applied files — it never
drops or wipes data. **Take a DB snapshot first** (or rely on the provider's
point-in-time restore).

```bash
export NODE_ENV=production
export DATABASE_URL="postgresql://USER:PASSWORD@DB_HOST:5432/corecold_db?sslmode=require"
export JWT_SECRET="…"  WALLET_KEYSTORE_PASSWORD="…"   # required for the app to boot

npm run db:migrate         # → "✓ done — N new migration(s) applied."
```

### Admin account — pick ONE path

> 🔴 **For this deployment we are PRESERVING the existing admin credential.**
> Use **Option A**. Do **NOT** run `npm run db:bootstrap-prod` — it generates a
> brand-new password and would overwrite the one already documented.

**Option A — Preserve the existing admin password (USE THIS).**
The admin's stored value is a one-way **bcrypt hash**; copying that exact hash to
production keeps the password identical. Two equivalent ways:

```bash
# A1) Seed/restore the admin row carrying its existing hash (recommended).
#     This script embeds the current admin record (incl. the bcrypt hash) and
#     upserts it — the already-issued password works unchanged.
node server/db/restore-admin.js        # → "✓ Admin credential preserved …"
```

```sql
-- A2) Manual hash insert (raw SQL). Paste the EXISTING bcrypt hash — copy it from
--     the staging DB:  SELECT password_hash FROM users WHERE email='admin@corecold.com';
--     Never put the plaintext password here; only the hash.
INSERT INTO users (id, email, password_hash, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001',
        'admin@corecold.com',
        '<PASTE_EXISTING_BCRYPT_HASH>',
        'CoreCold Admin', 'admin')
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, role = 'admin';
```

**Option B — Issue a NEW admin password instead (only if you do NOT need the old one).**
Removes test/mock users and resets the admin to a freshly generated password,
printed once:

```bash
npm run db:bootstrap-prod      # ⚠ CHANGES the admin password — prints the new one
```

> ❌ **Never run in production:** `npm run db:seed` (demo fixtures),
> `npm run db:dev` (embedded local PG), `node server/db/clean-users.js` (DESTRUCTIVE).
> And for this deployment, **do not run `db:bootstrap-prod`** (Option B) — it would
> replace the admin password you intend to keep.

## 5. Start the API under PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save                   # persist process list
pm2 startup                # auto-start on reboot (run the command it prints)
pm2 logs corecold-api      # tail logs
```
The API now listens on `127.0.0.1:4000`.

## 6. Configure Nginx (TLS + static + API proxy)

```bash
sudo cp deploy/nginx-corecold.conf /etc/nginx/sites-available/corecold.conf
sudo ln -s /etc/nginx/sites-available/corecold.conf /etc/nginx/sites-enabled/
# Edit it: set server_name, root (…/dist), and ssl_certificate / ssl_certificate_key.
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Verify the deployment

```bash
curl -s https://yourdomain.com/api/health           # {"status":"ok","db":"connected",…}
curl -sI https://yourdomain.com/api/health | grep -iE 'strict-transport|x-frame-options'  # Helmet headers
curl -sI https://yourdomain.com/                    # 200, serves the SPA
```
- Log in as the admin in the browser.
- Confirm brute-force protection: >10 rapid `/api/auth/login` posts return **429**.

---

## Ongoing operations

| Task | Command |
|---|---|
| Deploy an update | `git pull && npm ci && npm run build && npm run db:migrate && pm2 reload corecold-api` |
| Schema change | **Add** a new `server/migrations/NNN_*.sql` (never edit an applied one), then `npm run db:migrate` |
| App logs / status | `pm2 logs corecold-api` · `pm2 status` |
| Rollback a bad migration | Restore the pre-migration DB snapshot; fix the SQL; re-run |

**Security reminders:** keep `.env` and any filled `ecosystem.config.cjs` out of
git; rotate the SMTP app password before go-live; serve only over HTTPS.
