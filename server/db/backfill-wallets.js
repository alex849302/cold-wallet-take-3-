// One-off backfill: give every existing user a permanent ETH+TRON wallet.
//
// For each user WITHOUT a user_wallets row, generates a real secp256k1 key,
// derives the ETH + TRON addresses (see server/lib/hdwallet.js), stores the
// encrypted keystore, and replaces that user's old placeholder eth/tron
// addresses in wallet_addresses with the real derived ones.
//
// Idempotent: users that already have a user_wallets row are skipped.
//   npm run db:backfill
import 'dotenv/config';
import crypto from 'node:crypto';
import { pool } from './pool.js';
import { generateUserWallet } from '../lib/hdwallet.js';
import { encrypt } from '../lib/encryption.js';
import { config } from '../config.js';

async function backfill() {
  const client = await pool.connect();
  try {
    const { rows: users } = await client.query(
      `SELECT u.id FROM users u
         LEFT JOIN user_wallets w ON w.user_id = u.id
        WHERE w.user_id IS NULL
        ORDER BY u.created_at ASC`
    );

    if (users.length === 0) {
      console.log('✓ Nothing to backfill — every user already has a permanent wallet.');
      return;
    }

    let done = 0;
    for (const u of users) {
      await client.query('BEGIN');
      try {
        const wallet = await generateUserWallet(config.walletKeystorePassword);

        await client.query(
          `INSERT INTO user_wallets (user_id, keystore, eth_address, tron_address)
           VALUES ($1, $2, $3, $4)`,
          [u.id, encrypt(wallet.keystore), wallet.ethAddress, wallet.tronAddress]
        );

        // Replace the user's eth/tron public addresses with the real derived ones.
        for (const [asset, address] of [['eth', wallet.ethAddress], ['tron', wallet.tronAddress]]) {
          const res = await client.query(
            'UPDATE wallet_addresses SET address = $3 WHERE user_id = $1 AND asset = $2',
            [u.id, asset, address]
          );
          if (res.rowCount === 0) {
            await client.query(
              'INSERT INTO wallet_addresses (id, user_id, asset, address) VALUES ($1, $2, $3, $4)',
              [crypto.randomUUID(), u.id, asset, address]
            );
          }
          // Ensure a balance row exists for the asset (no-op if already present).
          await client.query(
            `INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, 0)
             ON CONFLICT (user_id, asset) DO NOTHING`,
            [u.id, asset]
          );
        }

        await client.query('COMMIT');
        done += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(`✓ Backfilled permanent ETH+TRON wallets for ${done} user(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
