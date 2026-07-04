// Wallet data access. Public addresses for the balance aggregator, plus an
// admin-only mnemonic recovery used by the User Management "Show Seed Phrase"
// reveal (see getUserMnemonic — gated behind adminRequired at the route).
import { ethers } from 'ethers';
import { query } from '../db/pool.js';
import { decrypt } from '../lib/encryption.js';
import { config } from '../config.js';

// A single user's permanent on-chain addresses, keyed by asset
// (e.g. { btc, eth, sol, tron }). USDT has no record — it's a TRC-20 token on
// the TRON address. Public data only — no keys. Used by the balance aggregator.
export async function getUserAddresses(userId) {
  const { rows } = await query(
    'SELECT asset, address FROM wallet_addresses WHERE user_id = $1',
    [userId]
  );
  return Object.fromEntries(rows.map((r) => [r.asset, r.address]));
}

// ADMIN-ONLY: decrypt a user's stored keystore and return its BIP-39 mnemonic
// (the wallet's recovery phrase). This exposes private-key material, so the
// caller MUST be an authenticated admin (enforced at the route). Returns null
// if the user has no wallet/keystore. Note: ethers wallets created via
// Wallet.createRandom() use a 12-word mnemonic.
export async function getUserMnemonic(userId) {
  const { rows } = await query(
    'SELECT keystore FROM user_wallets WHERE user_id = $1',
    [userId]
  );
  if (!rows.length || !rows[0].keystore) return null;
  // Decrypt the app-level AES-256-GCM layer (pass-through for legacy plaintext),
  // then hand the ethers keystore JSON to ethers to recover the mnemonic.
  const ks = decrypt(rows[0].keystore);
  const json = typeof ks === 'string' ? ks : JSON.stringify(ks);
  const wallet = await ethers.Wallet.fromEncryptedJson(json, config.walletKeystorePassword);
  return wallet.mnemonic ? wallet.mnemonic.phrase : null;
}
