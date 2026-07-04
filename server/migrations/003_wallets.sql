-- ============================================================================
-- VaultX — generated ETH wallets (PostgreSQL)
-- Stores ONLY the public address + an ENCRYPTED JSON keystore (scrypt + AES-256,
-- produced by ethers wallet.encrypt). The raw private key / mnemonic is NEVER
-- stored or logged in plaintext.
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT NOT NULL UNIQUE,
  keystore   JSONB NOT NULL,            -- ethers encrypted keystore (NOT the raw key)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_wallets_user ON generated_wallets(user_id);
