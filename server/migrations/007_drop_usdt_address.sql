-- ============================================================================
-- VaultX — fix USDT address architecture.
-- USDT is a TRC-20 token: it lives on the user's permanent TRON address, NOT on
-- a separate (and previously fake '0x…') record. Remove all standalone USDT
-- address rows; the app now maps USDT → the TRON address in code (users.hydrate
-- / users.listAll), and the aggregator already reads the TRC-20 balance from the
-- TRON address via TronWeb. DB-simulated USDT *balances* are untouched.
-- ============================================================================

DELETE FROM wallet_addresses WHERE asset = 'usdt';
