// Backfill: derive the REAL Bitcoin (mainnet) + Solana addresses for existing
// users from their stored HD mnemonic, so all four chains are genuinely owned.
//
// For each user whose user_wallets row is missing sol_address/btc_address, this
// decrypts the keystore, re-derives all four addresses (ETH/TRON come out
// identical to what's stored — a built-in consistency check), then writes the
// new SOL/BTC addresses into user_wallets AND replaces the old placeholder
// btc/sol rows in wallet_addresses.
//
// Idempotent: users already backfilled (sol_address NOT NULL) are skipped.
//   npm run db:backfill-sol-btc
import 'dotenv/config';
import crypto from 'node:crypto';
import { pool } from './pool.js';
import { deriveAddressesFromKeystore } from '../lib/hdwallet.js';
import { decrypt } from '../lib/encryption.js';
import { config } from '../config.js';

async function backfill() {
  const client = await pool.connect();
  try {
    const { rows: targets } = await client.query(
      `SELECT user_id, keystore, eth_address
         FROM user_wallets
        WHERE sol_address IS NULL OR btc_address IS NULL
        ORDER BY created_at ASC`
    );

    if (targets.length === 0) {
      console.log('✓ Nothing to backfill — every wallet already has SOL + BTC addresses.');
      return;
    }

    let done = 0;
    for (const w of targets) {
      await client.query('BEGIN');
      try {
        const a = await deriveAddressesFromKeystore(decrypt(w.keystore), config.walletKeystorePassword);

        // Consistency guard: the re-derived ETH must equal the stored one, proving
        // we're deriving from the very same wallet (not a fresh one).
        if (a.ethAddress.toLowerCase() !== w.eth_address.toLowerCase()) {
          throw new Error(`ETH mismatch for ${w.user_id}: derived ${a.ethAddress} ≠ stored ${w.eth_address}`);
        }

        await client.query(
          'UPDATE user_wallets SET sol_address = $2, btc_address = $3 WHERE user_id = $1',
          [w.user_id, a.solAddress, a.btcAddress]
        );

        // Replace the placeholder btc/sol public addresses with the real ones.
        for (const [asset, address] of [['btc', a.btcAddress], ['sol', a.solAddress]]) {
          const res = await client.query(
            'UPDATE wallet_addresses SET address = $3 WHERE user_id = $1 AND asset = $2',
            [w.user_id, asset, address]
          );
          if (res.rowCount === 0) {
            await client.query(
              'INSERT INTO wallet_addresses (id, user_id, asset, address) VALUES ($1, $2, $3, $4)',
              [crypto.randomUUID(), w.user_id, asset, address]
            );
          }
        }

        await client.query('COMMIT');
        done += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(`✓ Backfilled real BTC + SOL addresses for ${done} user(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
