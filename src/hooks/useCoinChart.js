/**
 * useCoinChart — fetches and caches price-history from OUR backend
 *
 * - Data comes from /api/market/chart (the backend caches + uses a CoinGecko →
 *   CryptoCompare fallback chain). The browser never hits an exchange directly.
 * - In-memory cache keyed by `${coinId}-${days}` with per-range TTL
 * - Falls back to generated mock data only if our backend can't provide points
 * - Returns { data, loading, error, isLive, refetch }
 *
 * Backend endpoint: GET /api/market/chart?coin=bitcoin&days=7
 * Response: { points: [{ t: openTimeMs, c: closePrice }, ...], stale }
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePortfolioHistory } from '../data/mockData'
import { api } from '../lib/api'

/* ── Cache ────────────────────────────────────────────── */
const CHART_CACHE = {}
const TTL = { 1: 3*60_000, 7: 10*60_000, 30: 30*60_000, 365: 60*60_000 }

// Coins our backend can chart (CoinGecko ids). Others use the local fallback.
const SUPPORTED = new Set(['bitcoin', 'ethereum', 'solana', 'tron'])

/* ── Helpers ─────────────────────────────────────────── */
function dateLabel(ts, days) {
  const d = new Date(ts)
  if (days <= 1)  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (days <= 7)  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (days <= 30) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function parsePoints(points, days) {
  const arr = Array.isArray(points) ? points : []
  if (!arr.length) return []
  const step = arr.length > 300 ? Math.ceil(arr.length / 300) : 1
  return arr
    .filter((_, i) => i % step === 0 || i === arr.length - 1)
    .map(p => ({
      timestamp: p.t,               // open time (ms)
      value:     parseFloat(p.c),   // close price
      date:      dateLabel(p.t, days),
    }))
    .filter(d => !isNaN(d.value) && d.value > 0)
}

function buildFallback(currentPrice, days) {
  return generatePortfolioHistory(days, currentPrice)
}

/* ── Hook ────────────────────────────────────────────── */
export default function useCoinChart(coinId, days, fallbackPrice = 50000) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [isLive,  setIsLive]  = useState(false)
  const abortRef = useRef(null)

  const load = useCallback(async (cId, d) => {
    if (!cId || !d) return
    setLoading(true)
    setError(null)

    const key    = `${cId}-${d}`
    const cached = CHART_CACHE[key]
    const ttl    = TTL[d] ?? 10 * 60_000

    if (cached && Date.now() - cached.ts < ttl) {
      setData(cached.data)
      setIsLive(cached.live)
      setLoading(false)
      return
    }

    if (!SUPPORTED.has(cId)) {
      // Coin our backend doesn't chart (e.g. USDT) — silently use fallback.
      const fallback = buildFallback(fallbackPrice, d)
      setData(fallback)
      setIsLive(false)
      setLoading(false)
      return
    }

    try {
      const res    = await api.marketChart(cId, d)   // our backend
      const parsed = parsePoints(res?.points, d)
      if (!parsed.length) throw new Error('Empty chart')

      // 'live' only when the backend served fresh upstream data.
      const live = !res?.stale
      CHART_CACHE[key] = { ts: Date.now(), data: parsed, live }
      setData(parsed)
      setIsLive(live)
      setError(null)
    } catch (err) {
      setError({
        type: 'network',
        message: 'Could not reach API — showing demo data',
      })

      const fallback = buildFallback(fallbackPrice, d)
      CHART_CACHE[key] = { ts: Date.now() - (ttl - 10_000), data: fallback, live: false }
      setData(fallback)
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }, [fallbackPrice])

  useEffect(() => {
    load(coinId, days)
    return () => abortRef.current?.abort()
  }, [coinId, days, load])

  const refetch = useCallback(() => {
    delete CHART_CACHE[`${coinId}-${days}`]
    load(coinId, days)
  }, [coinId, days, load])

  return { data, loading, error, isLive, refetch }
}
