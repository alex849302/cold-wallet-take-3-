-- ============================================================================
-- VaultX — withdrawal block (per-user)
-- Blocks Send/withdrawal by default for every account; admins can enable it
-- per user and attach a custom rejection message.
-- Idempotent: safe to run repeatedly.   npm run db:migrate
-- ============================================================================

-- Every account (existing + future) is blocked from withdrawing by default.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT TRUE;

-- Optional admin-authored message shown to the user when a withdrawal is blocked.
ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_block_message TEXT;

-- Block all existing users (the column default only covers rows inserted later).
UPDATE users SET is_blocked = TRUE;
