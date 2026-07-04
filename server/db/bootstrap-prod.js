// Production bootstrap — run ONCE against the production database after migrating.
//   npm run db:bootstrap-prod
//
// DESTRUCTIVE for non-admin users. It:
//   1. Deletes every non-admin (test/mock) user. All dependent rows — wallets,
//      addresses, balances, transactions, approvals, support — are removed
//      automatically by the ON DELETE CASCADE foreign keys.
//   2. Ensures the system admin (admin@corecold.com) exists with role 'admin'
//      and a freshly generated, strong, bcrypt-hashed password. Admins are
//      system accounts, so any wallet artifacts are stripped.
//   3. Prints the plaintext password ONCE so the operator can record it before
//      deployment. Only the bcrypt hash is stored — the plaintext is not recoverable.
import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const ADMIN_EMAIL = 'admin@corecold.com';
const ADMIN_UID   = '00000000-0000-0000-0000-000000000001';
const ADMIN_NAME  = 'CoreCold Admin';
const BCRYPT_COST = 12;

// ~192 bits of entropy, URL/shell-safe characters (A–Z a–z 0–9 - _).
const generatePassword = () => crypto.randomBytes(24).toString('base64url');

function dbTarget() {
  if (process.env.DATABASE_URL) {
    try { const u = new URL(process.env.DATABASE_URL); return `${u.host}${u.pathname}`; }
    catch { return 'DATABASE_URL'; }
  }
  return `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
}

async function bootstrap() {
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Remove every non-admin (test/mock) account — dependents cascade.
    const del = await client.query("DELETE FROM users WHERE role <> 'admin'");

    // 2) Upsert the admin with the new password (keyed on the unique email).
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name     = EXCLUDED.full_name,
             role          = 'admin'`,
      [ADMIN_UID, ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );

    // Admins hold no wallet/keys — strip any leftover wallet artifacts.
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    const adminId = rows[0].id;
    await client.query('DELETE FROM user_wallets    WHERE user_id = $1', [adminId]);
    await client.query('DELETE FROM wallet_addresses WHERE user_id = $1', [adminId]);
    await client.query('DELETE FROM balances         WHERE user_id = $1', [adminId]);

    await client.query('COMMIT');

    const line = '─'.repeat(64);
    console.log(`\n${line}`);
    console.log(' CoreCold — production bootstrap complete');
    console.log(line);
    console.log(` Database           : ${dbTarget()}`);
    console.log(` Test users removed : ${del.rowCount}`);
    console.log(` Admin email        : ${ADMIN_EMAIL}`);
    console.log(` Admin password     : ${password}`);
    console.log(line);
    console.log(' ⚠ Record this password in your secrets manager NOW — it is shown only');
    console.log('   once. Only the bcrypt hash is stored; the plaintext is NOT recoverable.');
    console.log(`${line}\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bootstrap FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrap();
