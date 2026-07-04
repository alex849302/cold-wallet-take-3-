-- ============================================================================
-- VaultX — permanent per-user HD wallet (PostgreSQL)
-- ONE keypair per user, created at registration. Both the ETH and TRON public
-- addresses are derived from it (TRON reuses the same secp256k1 key). Only the
-- ENCRYPTED keystore is stored here; the public addresses live in
-- wallet_addresses (asset = 'eth' / 'tron'). Raw keys are never persisted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_wallets (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  keystore     JSONB NOT NULL,            -- ethers encrypted keystore (NOT the raw key)
  eth_address  TEXT NOT NULL UNIQUE,      -- '0x...' (EIP-55 checksummed)
  tron_address TEXT NOT NULL UNIQUE,      -- 'T...'  (base58check, same key)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
