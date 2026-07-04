// Portfolio routes — ADMIN ONLY.
//
// Live on-chain balances are a diagnostic/debugging surface and must NEVER be
// exposed to regular end-users (their dashboard shows DB-simulated balances).
// Every route here requires an admin token; an admin queries a specific user by
// id for the "Chain Tools" diagnostics screen.
//
//   GET /api/portfolio/:userId/balances → live on-chain balances (ETH/SOL/BTC/USDT)
import { Router } from 'express';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { updateAllPortfolioBalances } from '../lib/cryptoService.js';

const router = Router();
router.use(authRequired, adminRequired); // admin-only for the entire router

router.get('/:userId/balances', async (req, res, next) => {
  try {
    res.json(await updateAllPortfolioBalances(req.params.userId));
  } catch (err) {
    next(err);
  }
});

export default router;
