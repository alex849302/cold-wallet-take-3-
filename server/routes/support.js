// Support chat routes.
import { Router } from 'express';
import * as support from '../repositories/support.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { notifyAdminNewSupportMessage } from '../lib/mailer.js';

const router = Router();
router.use(authRequired);

// --- User-facing: own thread ---
router.get('/messages', async (req, res, next) => {
  try {
    res.json(await support.messagesForUser(req.user.sub));
  } catch (err) {
    next(err);
  }
});

router.post('/messages', async (req, res, next) => {
  try {
    const msg = await support.addMessage(req.user.sub, 'user', req.body?.text);
    res.status(201).json(msg);
    // Immediate admin email alert. Fire-and-forget AFTER responding so a slow or
    // failed SMTP never blocks or breaks the user's message send.
    notifyAdminNewSupportMessage({ userEmail: req.user.email, text: msg.text })
      .catch((e) => console.error('Admin support-message email failed:', e.message));
  } catch (err) {
    if (err.code === 'EMPTY') return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Mark all admin replies in the caller's own thread as read. Fired when the
// user opens their ticket chat — clears the sidebar badge + unread dots.
router.post('/messages/read', async (req, res, next) => {
  try {
    const cleared = await support.markUserThreadRead(req.user.sub);
    res.json({ cleared });
  } catch (err) {
    next(err);
  }
});

// --- Admin: all threads + reply ---
router.get('/threads', adminRequired, async (_req, res, next) => {
  try {
    res.json(await support.listThreads());
  } catch (err) {
    next(err);
  }
});

router.post('/threads/:userId/messages', adminRequired, async (req, res, next) => {
  try {
    const msg = await support.addMessage(req.params.userId, 'admin', req.body?.text);
    res.status(201).json(msg);
  } catch (err) {
    if (err.code === 'EMPTY') return res.status(400).json({ error: err.message });
    next(err);
  }
});

export default router;
