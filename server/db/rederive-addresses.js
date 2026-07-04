// FORCE re-derivation of every user's on-chain addresses from their HD mnemonic.
//
// This WIPES each user's wallet_addresses rows (removing any old fake/placeholder
// records) and re-inserts the four TRUE, mathematically-derived addresses
// (BTC, ETH, SOL, TRON) recovered from the encrypted keystore's 12-word mnemonic.
// USDT has no address record — USDT-TRC20 maps to the TRON address and
// USDT-ERC20 to the ETH address in code. Balance rows are ensured for all
// six balance assets. A guard asserts the re-derived ETH equals the stored ETH,
// proving we're deriving from the very same wallet.
//
// DEPOSIT TRACKING: when an address actually CHANGES (e.g. the Solana path fix),
// the old on-chain watermark for that asset is a stale baseline that would
// suppress the next deposit alert. So for every asset whose address changed we
// reset its watermark — the deposit watcher then re-baselines against the NEW
// address on its next scan. Unchanged assets keep their watermark (no false alert).
//
// Idempotent + corrective: addresses are deterministic, so re-running is a no-op
// for already-correct users and a fix for any with stale/fake data.
//   npm run db:rederive
import 'dotenv/config';
import crypto from 'node:crypto';
import { pool } from './pool.js';
import { deriveAddressesFromKeystore } from '../lib/hdwallet.js';
import { decrypt } from '../lib/encryption.js';
import { config } from '../config.js';

const ADDRESS_ASSETS = ['btc', 'eth', 'sol', 'tron'];
const BALANCE_ASSETS = ['btc', 'eth', 'sol', 'tron', 'usdt_trc20', 'usdt_erc20'];

async function run() {
  const client = await pool.connect();
  try {
    const { rows: wallets } = await client.query(
      'SELECT user_id, keystore, eth_address FROM user_wallets ORDER BY created_at ASC'
    );
    if (wallets.length === 0) {
      console.log('No user_wallets found — nothing to re-derive.');
      return;
    }

    let fixed = 0;
    for (const w of wallets) {
      await client.query('BEGIN');
      try {
        const a = await deriveAddressesFromKeystore(decrypt(w.keystore), config.walletKeystorePassword);

        // Same-wallet guard: re-derived ETH must equal the stored ETH.
        if (a.ethAddress.toLowerCase() !== (w.eth_address || '').toLowerCase()) {
          throw new Error(`ETH mismatch for ${w.user_id}: derived ${a.ethAddress} ≠ stored ${w.eth_address}`);
        }

        const real = { btc: a.btcAddress, eth: a.ethAddress, sol: a.solAddress, tron: a.tronAddress };

        // Snapshot the CURRENT stored addresses BEFORE wiping, so we can tell
        // which ones actually changed and reset only those deposit watermarks.
        const { rows: oldRows } = await client.query(
          'SELECT asset, address FROM wallet_addresses WHERE user_id = $1', [w.user_id]
        );
        const oldAddr = Object.fromEntries(oldRows.map((r) => [r.asset, r.address]));

        // Wipe ALL of this user's address rows, then insert the four real ones.
        await client.query('DELETE FROM wallet_addresses WHERE user_id = $1', [w.user_id]);
        for (const asset of ADDRESS_ASSETS) {
          await client.query(
            'INSERT INTO wallet_addresses (id, user_id, asset, address) VALUES ($1, $2, $3, $4)',
            [crypto.randomUUID(), w.user_id, asset, real[asset]]
          );
        }

        // Keep user_wallets in sync with the derived values.
        await client.query(
          'UPDATE user_wallets SET sol_address = $2, btc_address = $3, tron_address = $4 WHERE user_id = $1',
          [w.user_id, a.solAddress, a.btcAddress, a.tronAddress]
        );

        // Ensure a balance row exists for every balance asset (no value changes).
        for (const asset of BALANCE_ASSETS) {
          await client.query(
            'INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, 0) ON CONFLICT (user_id, asset) DO NOTHING',
            [w.user_id, asset]
          );
        }

        // Reset deposit watermarks for every asset whose address CHANGED, so the
        // watcher re-baselines against the new address (USDT tokens ride on the
        // TRON/ETH addresses, so they follow those). Removes stale "old address"
        // tracking state — avoids both missed and phantom deposit alerts.
        const changed = new Set(ADDRESS_ASSETS.filter((x) => (oldAddr[x] || '') !== real[x]));
        if (changed.has('tron')) changed.add('usdt_trc20');
        if (changed.has('eth')) changed.add('usdt_erc20');
        if (changed.size) {
          await client.query(
            'DELETE FROM onchain_watermarks WHERE user_id = $1 AND asset = ANY($2)',
            [w.user_id, [...changed]]
          );
          console.log(`  ↻ ${w.user_id}: reset watermarks [${[...changed].join(', ')}] (address changed)`);
        }

        await client.query('COMMIT');
        fixed += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(`✓ Re-derived TRUE addresses (BTC/ETH/SOL/TRON) for ${fixed} user(s); wiped all placeholders.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
