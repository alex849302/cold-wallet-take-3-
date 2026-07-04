// Wallet routes (authenticated).
//   GET  /api/wallet/:address/onchain-balance → live on-chain balance for an address
//   POST /api/wallet/reveal-seed             → caller's OWN BIP-39 recovery phrase
import { Router } from 'express';
import { getAddressBalances } from '../lib/cryptoService.js';
import { authRequired } from '../middleware/auth.js';
import * as users from '../repositories/users.js';
import { getUserMnemonic } from '../repositories/wallets.js';

const router = Router();
router.use(authRequired);

// Reveal the LOGGED-IN user's own recovery phrase (decrypts their keystore).
// Re-verifies the account password in this same request so the seed is never
// returned on the strength of the session token alone — defence in depth for
// private-key material. This is the real BIP-39 mnemonic generated at signup,
// recovered from the encrypted keystore (NOT a stored plaintext phrase).
router.post('/reveal-seed', async (req, res, next) => {
  try {
    const { password } = req.body ?? {};
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    const hash = await users.getHashById(req.user.sub);
    if (!hash || !(await users.verifyPassword(password, hash))) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const phrase = await getUserMnemonic(req.user.sub);
    if (!phrase) {
      return res.status(404).json({ error: 'No recoverable recovery phrase for this account.' });
    }
    const words = phrase.split(' ');
    res.json({ phrase, words, wordCount: words.length });
  } catch (err) {
    next(err);
  }
});

// Real on-chain balance for any address, read live from the configured network.
// Multi-chain: detects BTC / ETH / SOL / TRON from the address format and routes
// to the matching configured endpoint, returning native (+ USDT) balances.
router.get('/:address/onchain-balance', async (req, res) => {
  try {
    res.json(await getAddressBalances(req.params.address));
  } catch (err) {
    if (err.code === 'BAD_ADDRESS') {
      return res.status(400).json({ error: err.message });
    }
    // Network/RPC failure (unreachable, throttled, timed out) → 503, not a crash.
    return res.status(503).json({
      error: 'Could not reach the blockchain network.',
      detail: err.shortMessage || err.message,
    });
  }
});

export default router;

