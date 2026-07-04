// Support chat data access (PostgreSQL). A "thread" is all messages for one user_id.
import crypto from 'node:crypto';
import { query } from '../db/pool.js';

const mapMsg = (r) => ({
  id: r.id,
  sender: r.sender,
  text: r.body,
  ts: new Date(r.created_at).getTime(),
  read: r.read_at != null,
});

export async function messagesForUser(userId) {
  const { rows } = await query(
    'SELECT * FROM support_messages WHERE user_id = $1 ORDER BY created_at ASC', [userId]
  );
  return rows.map(mapMsg);
}

export async function listThreads() {
  const { rows } = await query(
    `SELECT m.*, u.full_name AS user_name, u.email AS user_email
       FROM support_messages m
       JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at ASC`
  );

  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { uid: r.user_id, name: r.user_name || 'Unknown user', email: r.user_email || '', messages: [] });
    }
    byUser.get(r.user_id).messages.push(mapMsg(r));
  }

  return [...byUser.values()]
    .map((t) => {
      const last = t.messages[t.messages.length - 1];
      return { ...t, lastTs: last?.ts || 0, lastText: last?.text || '', lastSender: last?.sender || '' };
    })
    .sort((a, b) => b.lastTs - a.lastTs);
}

/**
 * Mark every unread ADMIN reply in a user's thread as read. Called when the
 * user opens their support ticket chat. Returns the number of rows cleared so
 * callers can short-circuit redundant refreshes. User-authored messages are
 * left untouched — only admin replies count toward the user's unread badge.
 */
export async function markUserThreadRead(userId) {
  const { rowCount } = await query(
    `UPDATE support_messages
        SET read_at = now()
      WHERE user_id = $1 AND sender = 'admin' AND read_at IS NULL`,
    [userId]
  );
  return rowCount;
}

export async function addMessage(userId, sender, text) {
  const body = String(text || '').trim();
  if (!body) {
    const err = new Error('Message cannot be empty.');
    err.code = 'EMPTY';
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO support_messages (id, user_id, sender, body) VALUES ($1, $2, $3, $4) RETURNING *`,
    [crypto.randomUUID(), userId, sender, body]
  );
  return mapMsg(rows[0]);
}
