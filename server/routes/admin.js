// Admin-only account routes. Gated by authRequired + adminRequired (a valid
// admin JWT), so only an authenticated admin can reach these.
import { Router } from 'express';
import * as users from '../repositories/users.js';
import * as deposits from '../repositories/deposits.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(authRequired, adminRequired);

// GET /api/admin/deposit-alerts → admin-only feed of detected on-chain deposits.
router.get('/deposit-alerts', async (_req, res, next) => {
  try {
    res.json(await deposits.listDepositAlerts());
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/change-password  { currentPassword, newPassword }
// Verifies the admin's current password (bcrypt) and stores the new one (hashed).
router.post('/change-password', authLimiter, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one.' });
    }

    const hash = await users.getHashById(req.user.sub);
    if (!hash || !(await users.verifyPassword(currentPassword, hash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await users.updatePassword(req.user.sub, newPassword);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
