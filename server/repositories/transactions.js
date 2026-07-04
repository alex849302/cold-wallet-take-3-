// Transaction data access + core money-movement logic (PostgreSQL).
// All multi-step mutations run inside a single SQL transaction.
import crypto from 'node:crypto';
import { query, connect } from '../db/pool.js';
import { randomTxHash } from '../lib/addresses.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function mapTx(r) {
  return {
    id: r.id,
    uid: r.user_id,
    userName: r.user_name ?? '',
    userEmail: r.user_email ?? '',
    type: cap(r.type),
    assetId: r.asset_id,
    asset: r.asset,
    amount: Number(r.amount),
    usd: Number(r.usd_value),
    status: cap(r.status),
    date: new Date(r.created_at).toISOString().slice(0, 10),
    createdAt: new Date(r.created_at).getTime(),
    hash: r.tx_hash,
    to: r.to_address,
    from: r.from_address,
  };
}

const SELECT_WITH_USER = `
  SELECT t.*, u.full_name AS user_name, u.email AS user_email
    FROM transactions t
    JOIN users u ON u.id = t.user_id`;

export async function listAll() {
  const { rows } = await query(`${SELECT_WITH_USER} ORDER BY t.created_at DESC`);
  return rows.map(mapTx);
}

export async function listForUser(userId) {
  const { rows } = await query(
    `${SELECT_WITH_USER} WHERE t.user_id = $1 ORDER BY t.created_at DESC`, [userId]
  );
  return rows.map(mapTx);
}

export async function listPending() {
  const { rows } = await query(`${SELECT_WITH_USER} WHERE t.status = 'pending' ORDER BY t.created_at DESC`);
  return rows.map(mapTx);
}

async function getByIdWithUser(client, id) {
  const { rows } = await client.query(`${SELECT_WITH_USER} WHERE t.id = $1`, [id]);
  return rows[0] ? mapTx(rows[0]) : null;
}

// Apply a signed delta to a (user, asset) balance. UPDATE-then-INSERT avoids the
// negative-delta CHECK violation that `INSERT ... ON CONFLICT` would hit.
async function applyDelta(client, userId, assetId, delta) {
  const res = await client.query(
    'UPDATE balances SET amount = amount + $3 WHERE user_id = $1 AND asset = $2',
    [userId, assetId, delta]
  );
  if (res.rowCount === 0) {
    await client.query('INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, $3)', [userId, assetId, delta]);
  }
}

// Create a transaction. Send → pending (+ approval request); Buy/Sell/Swap settle now.
export async function create({
  userId, type, assetId, asset, amount, usd, to, from, status = 'pending', balanceDeltas = null,
}) {
  const txType = String(type).toLowerCase();
  const txStatus = String(status).toLowerCase();
  const id = crypto.randomUUID();

  const client = await connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO transactions
         (id, user_id, type, status, asset_id, asset, amount, usd_value, from_address, to_address, tx_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, userId, txType, txStatus, assetId, asset, amount, usd ?? 0, from, to, randomTxHash()]
    );

    if (balanceDeltas) {
      for (const [aid, delta] of Object.entries(balanceDeltas)) {
        await applyDelta(client, userId, aid, delta);
      }
    }

    if (txType === 'send' && txStatus === 'pending') {
      await client.query(
        `INSERT INTO approval_requests (id, transaction_id, requested_by, status)
         VALUES ($1, $2, $3, 'pending')`,
        [crypto.randomUUID(), id, userId]
      );
    }

    const created = await getByIdWithUser(client, id);
    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Approve a pending Send → Completed (deduct sender; credit internal recipient + log Receive).
export async function approve(id, adminId) {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const { rows: txRows } = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    const tx = txRows[0];
    if (!tx || tx.status !== 'pending') {
      await client.query('ROLLBACK');
      return null;
    }

    const { rows: recRows } = await client.query(
      `SELECT user_id FROM wallet_addresses WHERE asset = $1 AND lower(address) = lower($2)`,
      [tx.asset_id, tx.to_address ?? '']
    );
    const recipientId = recRows[0]?.user_id ?? null;
    const isSelfSend = recipientId === tx.user_id;

    await applyDelta(client, tx.user_id, tx.asset_id, -Number(tx.amount));
    if (recipientId) await applyDelta(client, recipientId, tx.asset_id, Number(tx.amount));

    await client.query(`UPDATE transactions SET status = 'completed' WHERE id = $1`, [id]);
    await client.query(
      `UPDATE approval_requests SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE transaction_id = $1`,
      [id, adminId]
    );

    if (recipientId && !isSelfSend) {
      await client.query(
        `INSERT INTO transactions
           (id, user_id, type, status, asset_id, asset, amount, usd_value, from_address, to_address, tx_hash)
         VALUES ($1, $2, 'receive', 'completed', $3, $4, $5, $6, $7, $8, $9)`,
        [crypto.randomUUID(), recipientId, tx.asset_id, tx.asset, tx.amount, tx.usd_value,
         tx.from_address, tx.to_address, tx.tx_hash]
      );
    }

    const updated = await getByIdWithUser(client, id);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Cancel a pending Send → Rejected. Balances untouched.
export async function cancel(id, adminId) {
  const client = await connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `UPDATE transactions SET status = 'rejected' WHERE id = $1 AND status = 'pending'`, [id]
    );
    if (res.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE approval_requests SET status = 'rejected', reviewed_by = $2, reviewed_at = now() WHERE transaction_id = $1`,
      [id, adminId]
    );

    const updated = await getByIdWithUser(client, id);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
