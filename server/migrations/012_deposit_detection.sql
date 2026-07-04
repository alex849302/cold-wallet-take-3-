-- 012: on-chain deposit detection.
--
-- onchain_watermarks: the last on-chain balance we've already accounted for, per
--   user+asset. A deposit is detected when the live on-chain balance rises above
--   the watermark; the watermark is then advanced so each deposit alerts once.
-- deposit_alerts: an ADMIN-ONLY feed of detected deposits. Users are never
--   notified from this — it exists purely so the admin console can alert + act.

CREATE TABLE IF NOT EXISTS onchain_watermarks (
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset      TEXT    NOT NULL,
  amount     NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset)
);

CREATE TABLE IF NOT EXISTS deposit_alerts (
  id              UUID PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset           TEXT    NOT NULL,
  amount          NUMERIC NOT NULL,        -- the detected increase (deposit size)
  onchain_balance NUMERIC NOT NULL,        -- new total on-chain after the deposit
  address         TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deposit_alerts_detected_at_idx ON deposit_alerts (detected_at DESC);
