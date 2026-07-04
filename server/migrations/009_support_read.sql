-- ============================================================================
-- VaultX — support message read-tracking (PostgreSQL)
-- Adds a per-message read marker so the user side can compute, straight from
-- the database, how many admin replies they have NOT yet opened. A NULL
-- `read_at` means unread. Only admin messages are ever marked read by the user
-- (a user never needs to "read" their own messages), but the column is generic.
-- ============================================================================

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Fast lookup of a user's unread admin replies (partial index on the open ones).
CREATE INDEX IF NOT EXISTS idx_support_messages_unread
  ON support_messages (user_id)
  WHERE read_at IS NULL AND sender = 'admin';
