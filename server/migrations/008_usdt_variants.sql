-- ============================================================================
-- VaultX — split USDT into two on-chain variants.
--   usdt_trc20  → TRC-20 token on the user's TRON address (TRON Nile)
--   usdt_erc20  → ERC-20 token on the user's ETH address  (Ethereum Sepolia)
-- The old single 'usdt' DB-simulated balance becomes the TRC-20 variant; an
-- ERC-20 balance row (default 0) is added for every user. Addresses are NOT
-- stored for either variant — they map to the existing TRON/ETH addresses in
-- code (users.hydrate / users.listAll). On-chain truth comes from the aggregator.
-- ============================================================================

UPDATE balances SET asset = 'usdt_trc20' WHERE asset = 'usdt';

INSERT INTO balances (user_id, asset, amount)
  SELECT DISTINCT user_id, 'usdt_erc20', 0 FROM balances
  ON CONFLICT (user_id, asset) DO NOTHING;
