-- ============================================================================
-- VaultX — drop the legacy on-demand generated_wallets table.
-- Superseded by the permanent per-user wallet model (migration 004,
-- user_wallets). The old "Generate New Address" button + POST /api/wallet/generate
-- were removed; this table is no longer written or read.
-- ============================================================================

DROP TABLE IF EXISTS generated_wallets;
