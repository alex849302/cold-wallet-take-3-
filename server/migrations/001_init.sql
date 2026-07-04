-- ============================================================================
-- VaultX — initial schema (PostgreSQL)
-- Idempotent: safe to run repeatedly.   npm run db:migrate
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- --- Enumerated types --------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_role          AS ENUM ('user', 'admin');               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type   AS ENUM ('send','receive','buy','sell','swap'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_status AS ENUM ('pending','completed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status    AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- Shared updated_at trigger ----------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- --- users ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                CITEXT UNIQUE,
  password_hash        TEXT        NOT NULL,
  full_name            TEXT,
  role                 user_role   NOT NULL DEFAULT 'user',
  recovery_phrase_hash TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- wallet_addresses -------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL,
  address    TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset)
);
CREATE INDEX IF NOT EXISTS idx_wallet_addresses_user ON wallet_addresses(user_id);

-- --- balances ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS balances (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL,
  amount     NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset)
);
DROP TRIGGER IF EXISTS trg_balances_updated_at ON balances;
CREATE TRIGGER trg_balances_updated_at BEFORE UPDATE ON balances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- transactions -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         transaction_type   NOT NULL,
  status       transaction_status NOT NULL DEFAULT 'pending',
  asset_id     TEXT NOT NULL,
  asset        TEXT NOT NULL,
  amount       NUMERIC(38, 18) NOT NULL CHECK (amount > 0),
  usd_value    NUMERIC(20, 2)  NOT NULL DEFAULT 0,
  from_address TEXT,
  to_address   TEXT,
  tx_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- approval_requests ------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  requested_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         approval_status NOT NULL DEFAULT 'pending',
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  decision_note  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
