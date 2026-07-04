// Public market-data endpoints. The browser calls these instead of hitting an
// exchange directly, so rate limits are handled once, server-side. No auth.
import { Router } from 'express';
import { getPrices, getChart, getMarkets, SUPPORTED_CHART_COINS } from '../lib/priceService.js';

const router = Router();

// Current spot prices (server-side cached, refreshed every 60s via the chain).
router.get('/prices', (_req, res) => {
  res.json(getPrices());
});

// Top-100 cryptocurrencies by market cap (CoinMarketCap-style table data).
router.get('/coins', async (_req, res) => {
  try {
    res.json(await getMarkets());
  } catch (err) {
    res.status(502).json({ coins: [], source: 'none', stale: true });
  }
});

// Price history for a coin.
//   coin = CoinGecko id (bitcoin | ethereum | solana | tron)
//   days = 1 | 7 | 30 | 365
router.get('/chart', async (req, res) => {
  const coin = String(req.query.coin || '').toLowerCase();
  const days = Number(req.query.days) || 7;
  if (!SUPPORTED_CHART_COINS.includes(coin)) {
    return res.status(400).json({ error: 'unsupported coin', points: null, stale: true });
  }
  try {
    res.json(await getChart(coin, days));
  } catch (err) {
    res.status(502).json({ error: 'chart fetch failed', points: null, stale: true });
  }
});

export default router;
