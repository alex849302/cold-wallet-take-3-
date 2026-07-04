// On-chain deposit watcher.
//
// Periodically reads every (non-admin) user's REAL on-chain balances and, when a
// balance rises above the last-seen watermark, records an ADMIN-ONLY deposit
// alert (+ optional admin email). Users are never notified. The admin console
// surfaces these via GET /api/admin/deposit-alerts.
//
// NOTE: this polls public RPCs (updateAllPortfolioBalances → ~6 calls/user). Fine
// for a handful of users; for scale, use a dedicated node or webhook provider.
import { query } from '../db/pool.js';
import { updateAllPortfolioBalances } from './cryptoService.js';
import { detectDeposit } from '../repositories/deposits.js';
import { notifyAdminDeposit } from './mailer.js';

const WATCHED_ASSETS = ['btc', 'eth', 'sol', 'tron', 'usdt_trc20', 'usdt_erc20'];

export const ASSET_UNIT = {
  btc: 'BTC', eth: 'ETH', sol: 'SOL', tron: 'TRX',
  usdt_trc20: 'USDT', usdt_erc20: 'USDT',
};
export const ASSET_LABEL = {
  btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana', tron: 'TRON',
  usdt_trc20: 'USDT (TRC-20)', usdt_erc20: 'USDT (ERC-20)',
};

let _running = false;

// Set DEPOSIT_DEBUG=1 to log EVERY address read each scan (chatty); otherwise we
// only log scan summaries, detections, errors, and email outcomes.
const DEBUG = process.env.DEPOSIT_DEBUG === '1';
const log = (...a) => console.log('[deposit-watcher]', ...a);

// Scan every wallet user once. Returns the number of deposits detected.
export async function scanDeposits() {
  const startedAt = Date.now();
  const { rows: users } = await query(
    "SELECT id, email, full_name FROM users WHERE role <> 'admin'"
  );
  log(`scan start — ${users.length} wallet user(s)`);

  let detected = 0;
  let readErrors = 0;
  for (const u of users) {
    let portfolio;
    try {
      portfolio = await updateAllPortfolioBalances(u.id); // live on-chain reads
    } catch (err) {
      // Previously swallowed silently — now surfaced so a dead RPC is visible.
      readErrors += 1;
      console.error(`[deposit-watcher] balance read FAILED for ${u.email}: ${err.message}`);
      continue; // one user's dead RPC shouldn't stop the whole scan
    }

    for (const asset of WATCHED_ASSETS) {
      const b = portfolio.balances[asset];
      if (!b || b.ok === false || b.balance == null) {
        if (DEBUG) log(`  ${u.email} ${asset}: skip (${b?.error || 'no balance/address'})`);
        continue;
      }
      const onchain = Number(b.balance);
      if (!Number.isFinite(onchain)) continue;
      if (DEBUG) log(`  ${u.email} ${asset} @ ${b.address} = ${onchain}`);

      const delta = await detectDeposit({ userId: u.id, asset, onchain, address: b.address });
      if (delta > 0) {
        detected += 1;
        log(`💰 DEPOSIT: ${u.email} +${delta} ${ASSET_UNIT[asset]} (${asset}) at ${b.address} → on-chain now ${onchain}`);
        // Best-effort admin email — never let a mail hiccup break the scan. Log
        // BOTH outcomes so "detected but no email" is immediately diagnosable.
        notifyAdminDeposit({
          userEmail: u.email, userName: u.full_name,
          asset, amount: delta, address: b.address,
        })
          .then((sent) => log(sent
            ? `   ✉  admin email sent for ${u.email} ${asset}`
            : `   ✉  admin email SKIPPED (mail disabled or no ADMIN_NOTIFICATION_EMAIL)`))
          .catch((e) => console.error(`[deposit-watcher] admin email FAILED for ${u.email} ${asset}: ${e.message}`));
      }
    }
  }

  const ms = Date.now() - startedAt;
  log(`scan done — ${detected} deposit(s), ${readErrors} read error(s), ${ms}ms`);
  return detected;
}

// Start the periodic watcher. One scan runs immediately; overlapping runs are
// skipped so a slow scan can't stack up.
export function startDepositWatcher(intervalMs = 60_000) {
  const tick = async () => {
    if (_running) return;
    _running = true;
    try { await scanDeposits(); }
    catch (err) { console.error('Deposit scan failed:', err.message); }
    finally { _running = false; }
  };
  tick(); // initial scan on boot
  const id = setInterval(tick, intervalMs);
  id.unref?.();
  return id;
}
