// User data access (PostgreSQL). The only place that reads/writes users,
// balances and wallet_addresses. Passwords are stored as bcrypt hashes.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, connect } from '../db/pool.js';
import { generateUserWallet } from '../lib/hdwallet.js';
import { encrypt } from '../lib/encryption.js';
import { config } from '../config.js';

// Assets that carry a (DB-simulated) balance: 4 native chains + 2 USDT variants.
const ASSETS = ['btc', 'eth', 'sol', 'tron', 'usdt_trc20', 'usdt_erc20'];
// Assets with their OWN on-chain address record. The USDT variants are absent:
// USDT-TRC20 lives on the TRON address, USDT-ERC20 on the ETH address.
const ADDRESS_ASSETS = ['btc', 'eth', 'sol', 'tron'];
const SALT_ROUNDS = 10;

// Shown to a user when their withdrawal is blocked and no admin has authored a
// custom message. Kept here so the API guard and the data layer agree.
export const DEFAULT_WITHDRAWAL_BLOCK_MESSAGE =
  'Withdrawals are currently disabled for your account. Please contact support.';

async function hydrate(client, userRow) {
  if (!userRow) return null;

  // Admins are SYSTEM accounts: no keystore, no HD-derived addresses, no
  // balances. Bypass all wallet loading and return empty wallet collections.
  if (userRow.role === 'admin') {
    return {
      uid: userRow.id,
      email: userRow.email,
      displayName: userRow.full_name,
      role: userRow.role,
      isBlocked: userRow.is_blocked ?? true,
      withdrawalBlockMessage: userRow.withdrawal_block_message ?? null,
      balances: {},
      addresses: {},
      createdAt: userRow.created_at,
    };
  }

  const [{ rows: balRows }, { rows: addrRows }] = await Promise.all([
    client.query('SELECT asset, amount FROM balances WHERE user_id = $1', [userRow.id]),
    client.query('SELECT asset, address FROM wallet_addresses WHERE user_id = $1', [userRow.id]),
  ]);

  const balances = Object.fromEntries(ASSETS.map((a) => [a, 0]));
  for (const r of balRows) balances[r.asset] = Number(r.amount);

  const addresses = {};
  for (const r of addrRows) addresses[r.asset] = r.address;
  // USDT variants are tokens on existing chains (no separate address records):
  if (addresses.tron) addresses.usdt_trc20 = addresses.tron; // TRC-20 on TRON
  if (addresses.eth)  addresses.usdt_erc20 = addresses.eth;  // ERC-20 on Ethereum

  return {
    uid: userRow.id,
    email: userRow.email,
    displayName: userRow.full_name,
    role: userRow.role,
    isBlocked: userRow.is_blocked ?? true,
    withdrawalBlockMessage: userRow.withdrawal_block_message ?? null,
    balances,
    addresses,
    createdAt: userRow.created_at,
  };
}

// Raw lookup that INCLUDES the password hash — for the login check only.
export async function findByEmailWithHash(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  return rows[0] ?? null;
}

export async function getById(id) {
  const client = await connect();
  try {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    return hydrate(client, rows[0]);
  } finally {
    client.release();
  }
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Return just the bcrypt hash for a user id (for verify / change-password flows).
export async function getHashById(userId) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return rows[0]?.password_hash ?? null;
}

// Set a new password (hashes it). Caller must verify the current password first.
export async function updatePassword(userId, newPlainPassword) {
  const passwordHash = await bcrypt.hash(newPlainPassword, SALT_ROUNDS);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
}

// Create a user with a hashed password, zeroed balances, and unique addresses.
export async function createUser({ name, email, password }) {
  const normEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = crypto.randomUUID();

  const client = await connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [normEmail]);
    if (exists.rowCount > 0) {
      const err = new Error('An account with this email already exists.');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }

    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'user')`,
      [id, normEmail, passwordHash, name?.trim() || null]
    );

    // Real permanent HD wallet: ONE mnemonic → ETH (0x…), TRON (T…), BTC ('1…'
    // mainnet) and SOL (ed25519) addresses, all genuinely owned.
    const wallet = await generateUserWallet(config.walletKeystorePassword);
    await client.query(
      `INSERT INTO user_wallets (user_id, keystore, eth_address, tron_address, sol_address, btc_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      // Keystore is AES-256-GCM encrypted before it ever reaches the database.
      [id, encrypt(wallet.keystore), wallet.ethAddress, wallet.tronAddress, wallet.solAddress, wallet.btcAddress]
    );

    // All four chain addresses are real & HD-derived. USDT gets NO address record
    // of its own — it's a TRC-20 token on the TRON address.
    const addresses = {
      btc: wallet.btcAddress,
      eth: wallet.ethAddress,
      sol: wallet.solAddress,
      tron: wallet.tronAddress,
    };
    for (const asset of ADDRESS_ASSETS) {
      await client.query(
        'INSERT INTO wallet_addresses (id, user_id, asset, address) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), id, asset, addresses[asset]]
      );
    }
    // Balance rows (DB-simulated, admin-controlled) exist for every asset.
    for (const asset of ASSETS) {
      await client.query('INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, 0)', [id, asset]);
    }

    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    const hydrated = await hydrate(client, rows[0]);
    await client.query('COMMIT');
    // Return the user plus the real 12-word mnemonic so the register route can
    // show it to the user ONCE at signup. Never returned again after this.
    return { user: hydrated, mnemonic: wallet.mnemonic };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Every WALLET user, hydrated with balances + addresses (admin user-management
// view). Admins are excluded — they're system accounts, not wallet users, so
// they never appear in user lists or counts.
export async function listAll() {
  const [{ rows: userRows }, { rows: balRows }, { rows: addrRows }] = await Promise.all([
    query("SELECT * FROM users WHERE role <> 'admin' ORDER BY created_at ASC"),
    query('SELECT user_id, asset, amount FROM balances'),
    query('SELECT user_id, asset, address FROM wallet_addresses'),
  ]);

  const balByUser = new Map();
  for (const r of balRows) {
    if (!balByUser.has(r.user_id)) balByUser.set(r.user_id, {});
    balByUser.get(r.user_id)[r.asset] = Number(r.amount);
  }
  const addrByUser = new Map();
  for (const r of addrRows) {
    if (!addrByUser.has(r.user_id)) addrByUser.set(r.user_id, {});
    addrByUser.get(r.user_id)[r.asset] = r.address;
  }

  return userRows.map((u) => {
    const addresses = addrByUser.get(u.id) || {};
    if (addresses.tron) addresses.usdt_trc20 = addresses.tron; // TRC-20 on TRON
    if (addresses.eth)  addresses.usdt_erc20 = addresses.eth;  // ERC-20 on Ethereum
    return {
      uid: u.id,
      email: u.email,
      displayName: u.full_name,
      role: u.role,
      isBlocked: u.is_blocked ?? true,
      withdrawalBlockMessage: u.withdrawal_block_message ?? null,
      balances: { ...Object.fromEntries(ASSETS.map((a) => [a, 0])), ...(balByUser.get(u.id) || {}) },
      addresses,
      createdAt: u.created_at,
    };
  });
}

// Lightweight withdrawal-block lookup for the transaction-create guard.
export async function getWithdrawalStatus(userId) {
  const { rows } = await query(
    'SELECT is_blocked, withdrawal_block_message FROM users WHERE id = $1',
    [userId]
  );
  const row = rows[0];
  return {
    isBlocked: row ? (row.is_blocked ?? true) : true,
    message: row?.withdrawal_block_message || null,
  };
}

// Admin: enable/disable withdrawals for a user and set the custom message.
export async function setWithdrawalBlock(userId, { blocked, message }) {
  const client = await connect();
  try {
    const { rows } = await client.query(
      `UPDATE users
          SET is_blocked = $2,
              withdrawal_block_message = $3
        WHERE id = $1
        RETURNING id`,
      [userId, !!blocked, message?.trim() ? message.trim() : null]
    );
    if (rows.length === 0) return null;
    const { rows: full } = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    return hydrate(client, full[0]);
  } finally {
    client.release();
  }
}

// Set a user's balances to exact values (admin balance editor). Returns the
// updated user PLUS `credits` — the per-asset INCREASES (deposits) the admin just
// applied, so the caller can notify the user that funds arrived.
const EPS = 1e-9;
export async function setBalances(userId, balances) {
  const client = await connect();
  try {
    await client.query('BEGIN');

    // Snapshot current balances so we can detect what increased.
    const { rows: beforeRows } = await client.query(
      'SELECT asset, amount FROM balances WHERE user_id = $1', [userId]
    );
    const before = Object.fromEntries(beforeRows.map((r) => [r.asset, Number(r.amount)]));

    const credits = [];
    for (const asset of ASSETS) {
      const amount = Math.max(0, Number(balances[asset]) || 0);
      const prev = before[asset] ?? 0;
      if (amount - prev > EPS) credits.push({ assetId: asset, amount: amount - prev, newBalance: amount });

      const res = await client.query(
        'UPDATE balances SET amount = $3 WHERE user_id = $1 AND asset = $2',
        [userId, asset, amount]
      );
      if (res.rowCount === 0) {
        await client.query('INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, $3)', [userId, asset, amount]);
      }
    }

    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const updated = await hydrate(client, rows[0]);
    await client.query('COMMIT');
    return { user: updated, credits };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
