// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — preserves the system admin (admin@corecold.com) using its EXISTING
// bcrypt password hash, so the already-issued admin password stays EXACTLY the
// same. Run this INSTEAD of `npm run db:bootstrap-prod` whenever you do NOT want
// a newly generated password. Idempotent: ON CONFLICT it re-asserts the same hash.
// Connection comes from .env (set DATABASE_URL for the production database).
//   npm run db:restore-admin   (or: node server/db/restore-admin.js)
//
// After restoring the admin it runs a FINAL ENVIRONMENT CHECK and exits non-zero
// if either fails, so a misconfigured deploy is caught immediately:
//   • ADMIN_NOTIFICATION_EMAIL is set to corecold.support@gmail.com (the deposit/
//     alert destination), and
//   • ENCRYPTION_SECRET is loaded (without it, stored keystores can't be decrypted).
//
// ⚠ SECURITY: this file embeds the admin credential's bcrypt hash. Keep it
//   gitignored / hand it to the operator out-of-band — do not publish it.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';
import { connect } from './pool.js';

// The operational destination for admin alerts — asserted at the end of this run.
const EXPECTED_ADMIN_NOTIFICATION_EMAIL = 'corecold.support@gmail.com';

const STATEMENTS = [
  "INSERT INTO users (id, email, password_hash, full_name, role, recovery_phrase_hash, is_active, created_at, updated_at, is_blocked, withdrawal_block_message)\n  VALUES ('00000000-0000-0000-0000-000000000001', 'admin@corecold.com', '$2b$12$71ZVbjY92/nuddemvO3TU.fKNYBM6FNFXw9jDf10uYvvyeYL.NBea', 'CoreCold Admin', 'admin', NULL, TRUE, '2026-06-18T18:42:44.416Z', '2026-06-29T16:23:21.887Z', TRUE, NULL)\n  ON CONFLICT (email) DO UPDATE\n    SET password_hash = EXCLUDED.password_hash,\n        full_name     = EXCLUDED.full_name,\n        role          = EXCLUDED.role;"
];

const client = await connect();
let restored = false;
try {
  await client.query('BEGIN');
  for (const sql of STATEMENTS) await client.query(sql);
  await client.query('COMMIT');
  restored = true;
  console.log('✓ Admin credential preserved — admin@corecold.com (existing password unchanged).');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('✗ Admin restore FAILED:', err.message);
} finally {
  client.release();
}

if (!restored) process.exit(1);

// ── Final environment verification ────────────────────────────────────────────
console.log('\nVerifying environment…');
let ok = true;

// 1) ENCRYPTION_SECRET must be loaded — without it every app-encrypted keystore is
//    unreadable. (config.js enforces strength at server boot; here we just assert
//    it's present so a fresh/missing env is caught now, not at runtime.)
const encSecret = process.env.ENCRYPTION_SECRET || '';
if (encSecret.length > 0) {
  console.log(`✓ ENCRYPTION_SECRET is loaded (${encSecret.length} chars).`);
} else {
  console.error('✗ ENCRYPTION_SECRET is NOT loaded — set it in the environment before serving traffic.');
  ok = false;
}

// 2) ADMIN_NOTIFICATION_EMAIL must be the expected alert destination.
const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || '';
if (adminEmail === EXPECTED_ADMIN_NOTIFICATION_EMAIL) {
  console.log(`✓ ADMIN_NOTIFICATION_EMAIL is set to ${EXPECTED_ADMIN_NOTIFICATION_EMAIL}.`);
} else {
  console.error(`✗ ADMIN_NOTIFICATION_EMAIL is "${adminEmail || '(unset)'}" — expected ${EXPECTED_ADMIN_NOTIFICATION_EMAIL}. Fix it in .env.`);
  ok = false;
}

console.log(ok ? '\n✓ All checks passed.' : '\n✗ One or more checks failed — review the warnings above.');
process.exit(ok ? 0 : 1);
