-- 011: store the wallet keystore as TEXT so it can hold an app-level
-- AES-256-GCM ciphertext ("enc:v1:…") instead of raw JSON.
--
-- Existing JSONB keystores are converted to their textual JSON form, which the
-- decrypt() pass-through still reads (and ethers can still parse). New writes are
-- encrypted before insert. Forward-only and non-destructive.
ALTER TABLE user_wallets
  ALTER COLUMN keystore TYPE TEXT USING keystore::text;
