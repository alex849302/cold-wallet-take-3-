// Deposit detection data access: watermark bookkeeping + the admin deposit feed.
import crypto from 'node:crypto';
import { query, connect } from '../db/pool.js';

const EPS = 1e-9; // ignore sub-dust float noise when comparing balances

// Compare a freshly-read on-chain balance to the stored watermark for (user, asset).
// If it increased, record a deposit_alert for the delta and advance the watermark
// (all in one transaction). Returns the deposit amount detected (0 if none).
export async function detectDeposit({ userId, asset, onchain, address }) {
  const client = await connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT amount FROM onchain_watermarks WHERE user_id = $1 AND asset = $2 FOR UPDATE',
      [userId, asset]
    );
    const prev = rows.length ? Number(rows[0].amount) : 0;

    let delta = 0;
    if (onchain > prev + EPS) {
      delta = onchain - prev;
      await client.query(
        `INSERT INTO deposit_alerts (id, user_id, asset, amount, onchain_balance, address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), userId, asset, delta, onchain, address || null]
      );
    }

    // Advance the watermark to the current on-chain balance (also tracks
    // decreases, e.g. an admin moving funds, without alerting).
    await client.query(
      `INSERT INTO onchain_watermarks (user_id, asset, amount, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()`,
      [userId, asset, onchain]
    );

    await client.query('COMMIT');
    return delta;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Admin-only feed of detected deposits, newest first, joined with the user.
export async function listDepositAlerts(limit = 50) {
  const { rows } = await query(
    `SELECT d.id, d.asset, d.amount, d.onchain_balance, d.address, d.detected_at,
            u.email, u.full_name
       FROM deposit_alerts d
       JOIN users u ON u.id = d.user_id
      ORDER BY d.detected_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    asset: r.asset,
    amount: Number(r.amount),
    onchainBalance: Number(r.onchain_balance),
    address: r.address,
    detectedAt: new Date(r.detected_at).getTime(),
    userEmail: r.email,
    userName: r.full_name,
  }));
}
