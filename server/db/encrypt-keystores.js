// One-off migration: encrypt any keystores that were stored BEFORE app-level
// encryption was introduced. Idempotent — rows already encrypted are skipped.
//   npm run db:encrypt-keystores
//
// Run once after deploying the encryption layer if the database already holds
// pre-encryption wallets. New wallets are encrypted at creation, so a fresh
// production database never needs this.
import 'dotenv/config';
import { pool } from './pool.js';
import { encrypt, isEncrypted } from '../lib/encryption.js';

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT user_id, keystore FROM user_wallets');
    let encrypted = 0;
    let already = 0;
    for (const r of rows) {
      if (!r.keystore || isEncrypted(r.keystore)) { already += 1; continue; }
      await client.query('UPDATE user_wallets SET keystore = $2 WHERE user_id = $1',
        [r.user_id, encrypt(r.keystore)]);
      encrypted += 1;
    }
    console.log(`✓ Encrypted ${encrypted} plaintext keystore(s); ${already} already encrypted/empty.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('encrypt-keystores failed:', err.message); process.exit(1); });
