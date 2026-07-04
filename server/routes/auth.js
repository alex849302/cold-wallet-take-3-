// Authentication routes: register, login, and session restore (/me).
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import * as users from '../repositories/users.js';
import { authRequired, signToken } from '../middleware/auth.js';
import { authLimiter, accountLimiter } from '../middleware/rateLimit.js';
import { config } from '../config.js';
import { sendPasswordResetEmail, isMailEnabled } from '../lib/mailer.js';

const router = Router();

// POST /api/auth/register  { name, email, password }
router.post('/register', accountLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const { user, mnemonic } = await users.createUser({ name, email, password });
    // `mnemonic` is the real 12-word wallet phrase — sent ONCE so the signup
    // screen can display it. It's the same phrase the admin reveal shows later.
    res.status(201).json({ token: signToken(user), user, mnemonic });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: err.message });
    next(err);
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const row = await users.findByEmailWithHash(email);
    if (!row || !(await users.verifyPassword(password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const user = await users.getById(row.id);
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-password  (Bearer)  { password }
// Confirms the logged-in user's password — used to unlock the recovery phrase.
router.post('/verify-password', authLimiter, authRequired, async (req, res, next) => {
  try {
    const { password } = req.body ?? {};
    if (!password) return res.status(400).json({ error: 'Password is required.' });
    const hash = await users.getHashById(req.user.sub);
    if (!hash || !(await users.verifyPassword(password, hash))) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password  (Bearer)  { currentPassword, newPassword }
router.post('/change-password', authLimiter, authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
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

// POST /api/auth/forgot-password  { email }
// Generates a short-lived, single-purpose reset token and emails a reset link.
// Always responds 200 with a generic message so the endpoint can't be used to
// enumerate which emails have accounts.
router.post('/forgot-password', accountLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const generic = { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
    const row = await users.findByEmailWithHash(email);
    if (!row) return res.json(generic); // don't reveal non-existence

    // Stateless reset token: signed JWT, 1h expiry, scoped with purpose:'reset'
    // so it can't be replayed as a normal session token.
    const token = jwt.sign({ sub: row.id, purpose: 'reset' }, config.jwt.secret, { expiresIn: '1h' });
    const resetLink = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    if (isMailEnabled()) {
      try {
        await sendPasswordResetEmail(row.email, resetLink);
      } catch (mailErr) {
        console.error('Password-reset email failed:', mailErr.message);
        return res.status(502).json({ error: 'Could not send the reset email. Check SMTP settings.' });
      }
    } else {
      // No SMTP configured yet — log the link so the flow is testable in dev.
      console.log(`[forgot-password] SMTP disabled. Reset link for ${row.email}:\n  ${resetLink}`);
    }
    res.json(generic);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password  { token, password }
// Verifies the reset token and sets a new password.
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body ?? {};
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }
    if (payload.purpose !== 'reset' || !payload.sub) {
      return res.status(400).json({ error: 'This reset link is invalid.' });
    }

    await users.updatePassword(payload.sub, password);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (Bearer token) → current user, for session restore.
router.get('/me', authRequired, async (req, res, next) => {
  try {
    // Never let a browser/proxy serve a cached session — balances & wallet
    // addresses must always reflect the live DB (e.g. after a re-derivation).
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    const user = await users.getById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
