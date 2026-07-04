// Transaction routes.
import { Router } from 'express';
import * as txns from '../repositories/transactions.js';
import { getWithdrawalStatus, DEFAULT_WITHDRAWAL_BLOCK_MESSAGE } from '../repositories/users.js';
import { notifyUserWithdrawalApproved } from '../lib/mailer.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const list = req.user.role === 'admin' ? await txns.listAll() : await txns.listForUser(req.user.sub);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/pending', adminRequired, async (_req, res, next) => {
  try {
    res.json(await txns.listPending());
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, assetId, asset, amount, usd, to, from, status, balanceDeltas } = req.body ?? {};
    if (!type || !assetId || !amount) {
      return res.status(400).json({ error: 'type, assetId and amount are required.' });
    }

    // Withdrawal block: only Send transactions are withdrawals. Swap/Buy/Sell are
    // unaffected. Enforced server-side so a blocked user cannot bypass the UI.
    if (String(type).toLowerCase() === 'send') {
      const { isBlocked, message } = await getWithdrawalStatus(req.user.sub);
      if (isBlocked) {
        return res.status(403).json({ error: message || DEFAULT_WITHDRAWAL_BLOCK_MESSAGE });
      }
    }

    const created = await txns.create({
      userId: req.user.sub, type, assetId, asset, amount, usd, to, from, status, balanceDeltas,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', adminRequired, async (req, res, next) => {
  try {
    // approve() flips the Send → Completed AND deducts the sender's balance.
    const updated = await txns.approve(req.params.id, req.user.sub);
    if (!updated) return res.status(409).json({ error: 'Transaction is not pending.' });
    res.json(updated);

    // The user's in-app "Transaction approved" alert derives automatically from
    // the status change; this adds the confirmation email. Best-effort.
    notifyUserWithdrawalApproved({
      userEmail: updated.userEmail, assetId: updated.assetId, amount: updated.amount, to: updated.to,
    }).catch((e) => console.error('User withdrawal-approved email failed:', e.message));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', adminRequired, async (req, res, next) => {
  try {
    const updated = await txns.cancel(req.params.id, req.user.sub);
    if (!updated) return res.status(409).json({ error: 'Transaction is not pending.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
