-- ============================================================================
-- VaultX — extend the permanent per-user wallet with SOL + BTC addresses.
-- All four chains derive from the SAME BIP-39 mnemonic (see lib/hdwallet.js):
--   ETH/TRON/BTC = secp256k1 HD nodes · SOL = ed25519 (SLIP-0010) from the seed.
-- Columns are nullable so existing rows stay valid until backfilled
-- (npm run db:backfill-sol-btc). UNIQUE permits multiple NULLs in Postgres.
-- ============================================================================

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS sol_address TEXT UNIQUE;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS btc_address TEXT UNIQUE;
