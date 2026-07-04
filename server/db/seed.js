// Seed the database for a CLEAN, SINGLE-ADMIN install.
//
// This intentionally creates ONLY the system admin (admin@corecold.com) and
// NO demo users, balances, transactions or chat threads. A fresh setup is a
// clean slate — it can never be populated with throwaway demo accounts.
//
// It uses the SAME secure bcrypt hash as server/db/restore-admin.js, so
// `npm run db:seed` and `npm run db:restore-admin` are equivalent: both leave
// exactly one user — the admin — with the real production password.
//   npm run db:seed
import 'dotenv/config';
import { pool } from './pool.js';

// admin@corecold.com — bcrypt hash of the production admin password (the
// plaintext is NEVER stored here; hand it to the operator out-of-band).
// Identical to the hash embedded in server/db/restore-admin.js.
const ADMIN = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@corecold.com',
  passwordHash: '$2b$12$71ZVbjY92/nuddemvO3TU.fKNYBM6FNFXw9jDf10uYvvyeYL.NBea',
  name: 'CoreCold Admin',
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Idempotent upsert on email — re-asserts the admin (and its secure password)
    // without ever creating a second account.
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name     = EXCLUDED.full_name,
             role          = EXCLUDED.role`,
      [ADMIN.id, ADMIN.email, ADMIN.passwordHash, ADMIN.name]
    );
    await client.query('COMMIT');
    console.log('✓ Seeded single admin (admin@corecold.com) — no demo users created.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
