// Server-side market-data service.
//
// The browser fetches prices/charts from OUR /api/market/* endpoints instead of
// hitting a public exchange directly. That means at most ONE upstream call per
// 60s (spot prices) or per chart-range TTL — no per-client rate limiting, and no
// CORS hoops. Each upstream has a provider FALLBACK CHAIN (CoinGecko →
// CryptoCompare) so a single provider outage/429 never drops us to demo data.
//
// Everything is cached in-memory; if every provider fails we serve the last good
// cache (marked `stale:true`) and, before the first success, a static baseline.

const TIMEOUT_MS = 8_000;

// Coins we serve. id = CoinGecko id · sym = our symbol · cc = CryptoCompare fsym.
const COINS = [
  { id: 'bitcoin',  sym: 'BTC', cc: 'BTC' },
  { id: 'ethereum', sym: 'ETH', cc: 'ETH' },
  { id: 'solana',   sym: 'SOL', cc: 'SOL' },
  { id: 'tron',     sym: 'TRX', cc: 'TRX' },
];
const SYM_BY_CGID = Object.fromEntries(COINS.map(c => [c.id, c]));
export const SUPPORTED_CHART_COINS = COINS.map(c => c.id);

// Static baseline so the API always returns something usable even before the
// first successful upstream fetch (always reported as stale / source 'fallback').
const FALLBACK = {
  BTC: { price: 67234.5, change24h: 0 },
  ETH: { price: 3521.8,  change24h: 0 },
  SOL: { price: 178.45,  change24h: 0 },
  TRX: { price: 0.12,    change24h: 0 },
};
const withUsdt = (m) => ({ ...m, USDT: { price: 1, change24h: 0 } });

const CHART_TTL = { 1: 3 * 60_000, 7: 10 * 60_000, 30: 30 * 60_000, 365: 60 * 60_000 };

/* ── State ─────────────────────────────────────────────── */
let priceCache = { prices: withUsdt(FALLBACK), source: 'fallback', fetchedAt: 0 };
const chartCache = new Map(); // `${coinId}-${days}` -> { points, source, fetchedAt }

/* ── Fetch helpers ─────────────────────────────────────── */
function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}
async function getJson(url) {
  const res = await withTimeout(fetch(url, { headers: { accept: 'application/json' } }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Spot-price providers ──────────────────────────────── */
async function pricesFromCoinGecko() {
  const ids = COINS.map(c => c.id).join(',');
  const j = await getJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  );
  const out = {};
  for (const c of COINS) {
    const row = j[c.id];
    if (!row || typeof row.usd !== 'number') continue;
    out[c.sym] = { price: row.usd, change24h: row.usd_24h_change ?? 0 };
  }
  if (!out.BTC) throw new Error('coingecko: empty payload');
  return withUsdt(out);
}

async function pricesFromCryptoCompare() {
  const fsyms = COINS.map(c => c.cc).join(',');
  const j = await getJson(
    `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`
  );
  const raw = j?.RAW;
  if (!raw) throw new Error('cryptocompare: no RAW block');
  const out = {};
  for (const c of COINS) {
    const row = raw[c.cc]?.USD;
    if (!row || typeof row.PRICE !== 'number') continue;
    out[c.sym] = { price: row.PRICE, change24h: row.CHANGEPCT24HOUR ?? 0 };
  }
  if (!out.BTC) throw new Error('cryptocompare: empty payload');
  return withUsdt(out);
}

const PRICE_PROVIDERS = [
  { name: 'coingecko',     fn: pricesFromCoinGecko },
  { name: 'cryptocompare', fn: pricesFromCryptoCompare },
];

// Refresh the spot-price cache through the provider chain. Keeps the previous
// cache on total failure (never throws).
export async function refreshPrices() {
  for (const p of PRICE_PROVIDERS) {
    try {
      const prices = await p.fn();
      priceCache = { prices, source: p.name, fetchedAt: Date.now() };
      return priceCache;
    } catch (err) {
      console.warn(`[priceService] ${p.name} prices failed: ${err.message}`);
    }
  }
  return priceCache; // all providers down — serve last good (or baseline)
}

export function getPrices() {
  const ageMs = Date.now() - priceCache.fetchedAt;
  const stale = priceCache.source === 'fallback' || ageMs > 90_000;
  return { prices: priceCache.prices, source: priceCache.source, fetchedAt: priceCache.fetchedAt, stale, ageMs };
}

/* ── Chart providers ───────────────────────────────────── */
async function chartFromCoinGecko(coinId, days) {
  const j = await getJson(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  );
  const arr = j?.prices;
  if (!Array.isArray(arr) || !arr.length) throw new Error('coingecko: empty chart');
  return arr.map(([t, c]) => ({ t, c })).filter(p => p.c > 0);
}

async function chartFromCryptoCompare(coinId, days) {
  const c = SYM_BY_CGID[coinId];
  if (!c) throw new Error('unknown coin');
  let endpoint = 'histohour', limit = 168, aggregate = 1;
  if (days <= 1)       { endpoint = 'histominute'; limit = 288; aggregate = 5; }
  else if (days <= 7)  { endpoint = 'histohour';   limit = 84;  aggregate = 2; }
  else if (days <= 30) { endpoint = 'histohour';   limit = 90;  aggregate = 8; }
  else                 { endpoint = 'histoday';    limit = 365; aggregate = 1; }
  const j = await getJson(
    `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${c.cc}&tsym=USD&limit=${limit}&aggregate=${aggregate}`
  );
  const arr = j?.Data?.Data;
  if (!Array.isArray(arr) || !arr.length) throw new Error('cryptocompare: empty chart');
  return arr.map(d => ({ t: d.time * 1000, c: d.close })).filter(p => p.c > 0);
}

const CHART_PROVIDERS = [
  { name: 'coingecko',     fn: chartFromCoinGecko },
  { name: 'cryptocompare', fn: chartFromCryptoCompare },
];

// On-demand chart with per-range TTL cache + provider fallback. Never throws.
export async function getChart(coinId, days) {
  const key = `${coinId}-${days}`;
  const ttl = CHART_TTL[days] ?? 10 * 60_000;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return { points: cached.points, source: cached.source, fetchedAt: cached.fetchedAt, stale: false };
  }
  for (const p of CHART_PROVIDERS) {
    try {
      const points = await p.fn(coinId, days);
      const entry = { points, source: p.name, fetchedAt: Date.now() };
      chartCache.set(key, entry);
      return { ...entry, stale: false };
    } catch (err) {
      console.warn(`[priceService] ${p.name} chart ${key} failed: ${err.message}`);
    }
  }
  if (cached) return { points: cached.points, source: cached.source, fetchedAt: cached.fetchedAt, stale: true };
  return { points: null, source: 'none', fetchedAt: 0, stale: true };
}

/* ── Markets (top-100 by market cap, CoinMarketCap-style) ─ */
let marketsCache = { coins: [], source: 'none', fetchedAt: 0 }
const MARKETS_TTL = 60_000

async function fetchMarkets() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets'
    + '?vs_currency=usd&order=market_cap_desc&per_page=100&page=1'
    + '&sparkline=true&price_change_percentage=1h%2C24h%2C7d'
  const arr = await getJson(url)
  if (!Array.isArray(arr) || !arr.length) throw new Error('coingecko markets empty')
  // Slim the payload down to just what the table needs.
  return arr.map(c => ({
    id: c.id,
    rank: c.market_cap_rank,
    name: c.name,
    symbol: (c.symbol || '').toUpperCase(),
    image: c.image,
    price: c.current_price,
    pct1h: c.price_change_percentage_1h_in_currency,
    pct24h: c.price_change_percentage_24h_in_currency,
    pct7d: c.price_change_percentage_7d_in_currency,
    marketCap: c.market_cap,
    volume24h: c.total_volume,
    circulating: c.circulating_supply,
    sparkline: c.sparkline_in_7d?.price ?? [],
  }))
}

// Top-100 markets with a 60s cache. Serves last-good (stale) on failure.
export async function getMarkets() {
  if (marketsCache.coins.length && Date.now() - marketsCache.fetchedAt < MARKETS_TTL) {
    return { coins: marketsCache.coins, source: marketsCache.source, fetchedAt: marketsCache.fetchedAt, stale: false }
  }
  try {
    const coins = await fetchMarkets()
    marketsCache = { coins, source: 'coingecko', fetchedAt: Date.now() }
    return { coins, source: 'coingecko', fetchedAt: marketsCache.fetchedAt, stale: false }
  } catch (err) {
    console.warn(`[priceService] markets failed: ${err.message}`)
    if (marketsCache.coins.length) {
      return { coins: marketsCache.coins, source: marketsCache.source, fetchedAt: marketsCache.fetchedAt, stale: true }
    }
    return { coins: [], source: 'none', fetchedAt: 0, stale: true }
  }
}

/* ── Periodic refresh ──────────────────────────────────── */
export function startPriceRefresh(intervalMs = 60_000) {
  refreshPrices(); // prime immediately on boot
  const id = setInterval(refreshPrices, intervalMs);
  if (id.unref) id.unref(); // don't keep the process alive just for this
  return id;
}
