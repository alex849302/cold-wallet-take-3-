/**
 * MarketContext — price feed served by OUR backend
 *
 * - Fetches from /api/market/prices (the backend caches + refreshes every 60s
 *   through a CoinGecko → CryptoCompare fallback chain). The browser never hits
 *   an exchange directly, so there are no per-client rate limits.
 * - Polls our backend every 60s; caches last good response in localStorage.
 * - Falls back to cached / static data on any failure.
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo
} from 'react'
import { ASSETS } from '../data/mockData'
import { api } from '../lib/api'

/* ── Constants ───────────────────────────────────────── */
const CACHE_KEY    = 'vaultx_price_cache'
const CACHE_TTL    = 5 * 60_000
const POLL_INTERVAL = 60_000      // backend fetch cadence (the baseline)
const LIVE_TICK     = 3_000       // synthetic "live market" movement cadence

/* ── Symbol maps ─────────────────────────────────────── */
// CoinGecko IDs — kept for compatibility with useCoinChart
export const COIN_ID = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  SOL:  'solana',
  TRX:  'tron',
  USDT: 'tether',
}

/* ── Static fallback ─────────────────────────────────── */
const STATIC_FALLBACK = Object.fromEntries(
  ASSETS.map(a => [a.symbol, {
    price:     a.price,
    change24h: a.change24h,
    marketCap: 0,
    volume24h: 0,
    coinId:    COIN_ID[a.symbol] ?? a.id,
    isFallback: true,
  }])
)

/* ── Cache helpers ────────────────────────────────────── */
function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (c && Date.now() - c.ts < CACHE_TTL) return c.data
  } catch { /* ignore */ }
  return null
}
function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* ignore */ }
}

/* ── Backend payload → normalized price map ──────────── */
// Backend shape: { prices: { BTC:{price,change24h}, ... }, source, stale, ... }
function normalise(payload) {
  const out = {}
  const src = payload?.prices || {}
  const isFallback = !!payload?.stale
  for (const [sym, p] of Object.entries(src)) {
    out[sym] = {
      price:     Number(p.price)     || 0,
      change24h: Number(p.change24h) || 0,
      marketCap: 0,
      volume24h: 0,
      coinId:    COIN_ID[sym] ?? sym.toLowerCase(),
      isFallback,
    }
  }
  // USDT is a stablecoin — pin to $1 if the backend didn't include it.
  if (!out.USDT) {
    out.USDT = { price: 1.0, change24h: 0, marketCap: 0, volume24h: 0, coinId: 'tether', isFallback: false }
  }
  return out
}

/* ── Live-market fluctuation ──────────────────────────────
   Random-walk each price ±0.2% around a FIXED baseline (the last real fetch),
   so numbers/charts move like a live market between fetches without drifting
   away from the true price. USDT (stablecoin) stays pinned at $1. */
function fluctuate(baseline) {
  const out = {}
  for (const [sym, p] of Object.entries(baseline)) {
    if (sym === 'USDT') { out[sym] = { ...p, price: 1 }; continue }
    const wobble = 1 + (Math.random() - 0.5) * 0.004          // ±0.2%
    out[sym] = {
      ...p,
      price:     +(p.price * wobble).toFixed(2),
      change24h: +(p.change24h + (Math.random() - 0.5) * 0.04).toFixed(2),
    }
  }
  return out
}

/* ── Context ─────────────────────────────────────────── */
const MarketContext = createContext(null)

export function MarketProvider({ children }) {
  const [prices,      setPrices]      = useState(() => readCache() ?? STATIC_FALLBACK)
  const [status,      setStatus]      = useState('idle')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [retryIn,     setRetryIn]     = useState(0)

  // The last REAL price map. Fluctuation oscillates around this so it never
  // drifts from the true value. Seeded with cache/fallback for instant movement.
  const baselineRef = useRef(readCache() ?? STATIC_FALLBACK)

  const fetchPrices = useCallback(async (silent = false) => {
    if (!silent) setStatus(s => s === 'idle' ? 'loading' : s)
    try {
      const payload = await api.marketPrices()   // our backend (cached + fallback chain)
      const data = normalise(payload)

      if (!data.BTC?.price) throw new Error('Unexpected response shape')

      baselineRef.current = data        // new baseline for the live fluctuation
      setPrices(data)
      writeCache(data)
      setLastUpdated(Date.now())
      // 'live' only when the backend returned fresh upstream data; 'cached' when
      // it's serving its own stale/fallback snapshot (upstream temporarily down).
      setStatus(payload?.stale ? 'cached' : 'live')
      setRetryIn(0)
    } catch (err) {
      if (err.name === 'AbortError') return
      const cached = readCache()
      if (cached) { baselineRef.current = cached; setPrices(cached); setStatus('cached') }
      else        { setStatus('error') }
    }
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(() => fetchPrices(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchPrices])

  // Live-market movement: every 3s, nudge prices around the last real baseline
  // so the UI feels alive between Binance fetches. Cleared on unmount.
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(fluctuate(baselineRef.current))
      setLastUpdated(Date.now())
    }, LIVE_TICK)
    return () => clearInterval(id)
  }, [])

  // retryIn countdown (used when status hits 'ratelimit' theoretically)
  useEffect(() => {
    if (retryIn <= 0) return
    const id = setTimeout(() => setRetryIn(n => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(id)
  }, [retryIn])

  /* ── Convenience helpers ─────────────────────────────── */
  const getPrice  = useCallback((sym) => prices[sym.toUpperCase()]?.price    ?? 0,  [prices])
  const getChange = useCallback((sym) => prices[sym.toUpperCase()]?.change24h ?? 0,  [prices])
  const getCoinId = useCallback((sym) => prices[sym.toUpperCase()]?.coinId   ?? COIN_ID[sym.toUpperCase()] ?? sym.toLowerCase(), [prices])

  const value = useMemo(() => ({
    prices, status, lastUpdated, retryIn,
    getPrice, getChange, getCoinId,
    isLive:   status === 'live',
    isCached: status === 'cached',
    refetch:  () => fetchPrices(),
  }), [prices, status, lastUpdated, retryIn, getPrice, getChange, getCoinId, fetchPrices])

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be inside <MarketProvider>')
  return ctx
}
