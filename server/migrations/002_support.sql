-- ============================================================================
-- VaultX — support chat messages (PostgreSQL)
-- One row per message; user_id is the thread owner (the customer).
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread
  ON support_messages (user_id, created_at);
