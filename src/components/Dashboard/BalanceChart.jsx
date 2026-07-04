/**
 * BalanceChart — live price-history chart for a selected coin.
 * Data source: CoinGecko /coins/{id}/market_chart  (via useCoinChart)
 * Falls back gracefully to mock data when the API is unavailable.
 */
import React, { useState, useMemo, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Wifi, WifiOff, Zap } from 'lucide-react'
import useCoinChart from '../../hooks/useCoinChart'

/* ── Chart geometry ────────────────────────────────── */
const W = 800, H = 220
const PAD = { top: 16, right: 16, bottom: 36, left: 62 }
const IW  = W - PAD.left - PAD.right
const IH  = H - PAD.top  - PAD.bottom

/* ── Range options (days value maps to CoinGecko param) */
const RANGES = [
  { key: '1D',  days: 1   },
  { key: '7D',  days: 7   },
  { key: '30D', days: 30  },
  { key: '1Y',  days: 365 },
]

/* ── Helpers ───────────────────────────────────────── */
function buildPath(pts) {
  if (pts.length < 2) return { line: '', area: '' }
  let line = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cpX = (pts[i - 1].x + pts[i].x) / 2
    line += ` C ${cpX} ${pts[i - 1].y} ${cpX} ${pts[i].y} ${pts[i].x} ${pts[i].y}`
  }
  const area = line
    + ` L ${pts[pts.length - 1].x} ${H - PAD.bottom}`
    + ` L ${pts[0].x} ${H - PAD.bottom} Z`
  return { line, area }
}

function fmtUSD(n) {
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(1) + 'k'
  if (n < 1)     return '$' + n.toFixed(4)
  return '$' + n.toFixed(2)
}

/* ── Loading skeleton ─────────────────────────────── */
function ChartSkeleton() {
  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="shimmer h-8 w-48 rounded-lg" />
      <div className="shimmer h-4 w-24 rounded" />
      <div className="shimmer rounded-xl" style={{ height: 180 }} />
    </div>
  )
}

/* ── Error / rate-limit banner ────────────────────── */
function ChartError({ error, isLive, onRetry }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-neon-amber/8 border border-neon-amber/20 text-xs text-neon-amber">
        {error?.type === 'ratelimit'
          ? <><AlertCircle size={13} className="shrink-0" /> {error.message}</>
          : <><WifiOff size={13} className="shrink-0" /> {error?.message ?? 'Could not reach API'}</>
        }
        <button onClick={onRetry}
          className="ml-auto flex items-center gap-1 text-neon-blue hover:underline">
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    </div>
  )
}

/* ── X-axis sample indices (5 evenly spaced labels) ─ */
function xLabels(pts) {
  if (!pts?.length) return []
  const indices = [0, Math.floor(pts.length/4), Math.floor(pts.length/2), Math.floor(pts.length*3/4), pts.length-1]
  return [...new Set(indices)]
}

/* ── Main component ───────────────────────────────── */
export default function BalanceChart({ coinId = 'bitcoin', symbol = 'BTC', assetColor = '#00E676' }) {
  const [range,     setRange]   = useState('7D')
  const [hoverIdx,  setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  const days = RANGES.find(r => r.key === range)?.days ?? 7
  const { data, loading, error, isLive, refetch } = useCoinChart(coinId, days)

  /* ── Compute SVG points + path ─────────────────── */
  const { pts, line, area, minV, maxV } = useMemo(() => {
    if (!data?.length) return {}
    const vals = data.map(d => d.value)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const rng  = maxV - minV || 1
    const toX  = i => PAD.left + (i / (data.length - 1)) * IW
    const toY  = v => PAD.top  + IH - ((v - minV) / rng) * IH * 0.88 - IH * 0.06
    const pts  = data.map((d, i) => ({ ...d, x: toX(i), y: toY(d.value) }))
    const { line, area } = buildPath(pts)
    return { pts, line, area, minV, maxV }
  }, [data])

  const isUp       = pts?.length > 1 && pts[pts.length - 1].value >= pts[0].value
  const chartColor = isUp ? assetColor : '#FF6B6B'
  const hoverPt    = hoverIdx !== null ? pts?.[hoverIdx] : null

  const firstVal = pts?.[0]?.value ?? 0
  const lastVal  = pts?.[pts.length - 1]?.value ?? 0
  const changeAbs = lastVal - firstVal
  const changePct = firstVal > 0 ? (changeAbs / firstVal) * 100 : 0

  /* ── Mouse handling ─────────────────────────────── */
  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !pts?.length) return
    const rect   = svgRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (W / rect.width)
    // binary-search nearest point for performance
    let lo = 0, hi = pts.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pts[mid].x < mouseX) lo = mid + 1; else hi = mid
    }
    const best = (lo > 0 && Math.abs(pts[lo-1].x - mouseX) < Math.abs(pts[lo].x - mouseX)) ? lo-1 : lo
    setHoverIdx(best)
  }, [pts])

  /* ── Displayed value (hover or latest) ─────────── */
  const dispValue  = hoverPt ? hoverPt.value  : lastVal
  const dispLabel  = hoverPt ? hoverPt.date   : null

  return (
    <div className="w-full">
      {/* Header row: price + range selector */}
      <div className="flex items-end justify-between mb-3">
        <div>
          {loading ? (
            <div className="space-y-1">
              <div className="shimmer h-7 w-40 rounded-lg" />
              <div className="shimmer h-4 w-24 rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-white font-num">
                  {fmtUSD(dispValue)}
                </p>
                {/* Live / Demo badge */}
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isLive
                    ? 'bg-neon-green/12 text-neon-green border border-neon-green/25'
                    : 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20'
                }`}>
                  {isLive ? <><Zap size={10} /> Live</> : <><WifiOff size={10} /> Demo</>}
                </span>
              </div>
              {dispLabel ? (
                <p className="text-xs text-gray-500 mt-0.5">{dispLabel}</p>
              ) : (
                <p className={`text-xs flex items-center gap-1 mt-0.5 ${isUp ? 'text-neon-green' : 'text-neon-red'}`}>
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isUp ? '+' : ''}{fmtUSD(changeAbs)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%) · {range}
                </p>
              )}
            </>
          )}
        </div>

        {/* Range buttons */}
        <div className="flex gap-1 shrink-0">
          {RANGES.map(r => (
            <button key={r.key}
              onClick={() => { setRange(r.key); setHoverIdx(null) }}
              disabled={loading}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                range === r.key
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}>
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner (non-blocking — still shows fallback chart below) */}
      {error && <ChartError error={error} isLive={isLive} onRetry={refetch} />}

      {/* Chart area */}
      {loading ? (
        <ChartSkeleton />
      ) : pts?.length > 1 ? (
        <div className="relative w-full" onMouseLeave={() => setHoverIdx(null)}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={handleMouseMove}
            style={{ cursor: 'crosshair' }}
          >
            <defs>
              <linearGradient id={`cg-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={chartColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0"    />
              </linearGradient>
            </defs>

            {/* Horizontal grid + Y labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y   = PAD.top + IH * pct
              const val = maxV - (maxV - minV) * pct
              return (
                <g key={pct}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <text x={PAD.left - 6} y={y + 4} textAnchor="end"
                    fill="#474D57" fontSize="10" fontFamily="JetBrains Mono,monospace">
                    {fmtUSD(val)}
                  </text>
                </g>
              )
            })}

            {/* X-axis date labels */}
            {pts && xLabels(pts).map(i => (
              <text key={i} x={pts[i].x} y={H - 4} textAnchor="middle"
                fill="#474D57" fontSize="9" fontFamily="JetBrains Mono,monospace">
                {pts[i].date}
              </text>
            ))}

            {/* Area fill */}
            <path d={area} fill={`url(#cg-${coinId})`} />

            {/* Line */}
            <path d={line} fill="none" stroke={chartColor} strokeWidth="1.8" strokeLinejoin="round" />

            {/* Hover indicator */}
            {hoverPt && (
              <>
                <line x1={hoverPt.x} y1={PAD.top} x2={hoverPt.x} y2={H - PAD.bottom}
                  stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4 3" />
                <circle cx={hoverPt.x} cy={hoverPt.y} r="10"
                  fill={chartColor} opacity="0.12" />
                <circle cx={hoverPt.x} cy={hoverPt.y} r="4.5"
                  fill={chartColor} stroke="#1E2329" strokeWidth="2.5" />
              </>
            )}
          </svg>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
          No chart data available
        </div>
      )}
    </div>
  )
}
