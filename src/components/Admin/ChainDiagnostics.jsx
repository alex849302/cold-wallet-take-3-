import React, { useState, useEffect, useMemo } from 'react'
import { Activity, RefreshCw, ChevronDown, AlertCircle, CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react'
import { useUsers } from '../../context/UsersContext'
import { useMarket } from '../../context/MarketContext'
import { useOnchainPortfolio } from '../../hooks/useOnchainPortfolio'
import { ASSETS } from '../../data/mockData'

// The six assets the aggregator reads on-chain (4 native chains + 2 USDT variants).
const CHAINS = ['btc', 'eth', 'sol', 'tron', 'usdt_trc20', 'usdt_erc20']
const META = Object.fromEntries(ASSETS.map(a => [a.id, a]))
// Short, distinguishable labels (both USDT variants share the 'USDT' symbol).
const LABELS = {
  btc: 'BTC', eth: 'ETH', sol: 'SOL', tron: 'TRX',
  usdt_trc20: 'USDT·TRC20', usdt_erc20: 'USDT·ERC20',
}
const EPS = 1e-6 // tolerance for "DB == chain"

/* ── Donut geometry ─────────────────────────────────────── */
const RADIUS = 70, CIRC = 2 * Math.PI * RADIUS, CX = 110, CY = 110

function Donut({ segments, total, centerLabel }) {
  let cumulative = 0
  return (
    <svg viewBox="0 0 220 220" className="w-full h-auto max-w-[220px] mx-auto">
      <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="28" />
      {segments.map(seg => {
        const pct = total > 0 ? seg.value / total : 0
        const len = pct * CIRC
        const offset = CIRC - cumulative * CIRC
        cumulative += pct
        return (
          <circle key={seg.id} cx={CX} cy={CY} r={RADIUS} fill="none"
            stroke={seg.color} strokeWidth={26}
            strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transformOrigin: `${CX}px ${CY}px`, transform: 'rotate(-90deg)', transition: 'all .4s ease' }} />
        )
      })}
      <text x={CX} y={CY - 6} textAnchor="middle" fill="#EAECEF" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono,monospace">
        {centerLabel}
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" fill="#474D57" fontSize="9" fontFamily="JetBrains Mono,monospace">
        on-chain
      </text>
    </svg>
  )
}

/* ── Status badge ───────────────────────────────────────── */
function StatusBadge({ ok, synced }) {
  if (ok === false) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neon-red/12 text-neon-red border border-neon-red/25">
      <WifiOff size={11} /> Unreachable
    </span>
  )
  return synced ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neon-green/12 text-neon-green border border-neon-green/25">
      <CheckCircle2 size={11} /> Synced
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neon-amber/12 text-neon-amber border border-neon-amber/25">
      <AlertTriangle size={11} /> Mismatched
    </span>
  )
}

const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 })

/* ── Main ───────────────────────────────────────────────── */
export default function ChainDiagnostics() {
  const { users } = useUsers()
  const { getPrice } = useMarket()
  const [userId, setUserId] = useState('')

  // Default to the first user once the list loads.
  useEffect(() => {
    if (!userId && users.length) setUserId(users[0].uid)
  }, [users, userId])

  const { onchain, detail, loading, refreshing, error, fetchedAt, refresh } = useOnchainPortfolio(userId)

  const selectedUser = users.find(u => u.uid === userId)
  const simulated = selectedUser?.balances || {}

  const rows = useMemo(() => CHAINS.map(id => {
    const m = META[id]
    const sim = Number(simulated[id] ?? 0)
    const live = Number(onchain[id] ?? 0)
    const price = getPrice(m.symbol) || m.price
    const ok = detail[id]?.ok
    return {
      id, symbol: LABELS[id] || m.symbol, name: m.name, color: m.color,
      sim, live, price, liveValue: live * price,
      ok, synced: ok !== false && Math.abs(sim - live) < EPS,
      error: detail[id]?.error,
    }
  }), [simulated, onchain, detail, getPrice])

  const liveTotal = rows.reduce((s, r) => s + r.liveValue, 0)
  const segments = rows.filter(r => r.liveValue > 0).map(r => ({ id: r.id, color: r.color, value: r.liveValue }))
  const mismatches = rows.filter(r => r.ok !== false && !r.synced).length

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
          <Activity size={16} className="text-neon-green" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white">On-Chain Diagnostics</h2>
          <p className="text-xs text-gray-500">Compare DB-simulated balances against the real blockchain · admin only</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neon-green/10 border border-neon-green/20 text-[10px] font-medium text-neon-green shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> Live · on-chain
        </span>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* User selector + refresh */}
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="label-xs mb-1.5 block">Inspect user</label>
            <div className="relative">
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="wallet-input appearance-none pr-10 cursor-pointer">
                {users.length === 0 && <option value="">No users</option>}
                {users.map(u => (
                  <option key={u.uid} value={u.uid} style={{ background: '#1E2329' }}>
                    {(u.displayName || u.email)} — {u.email}{u.role === 'admin' ? ' (admin)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <button onClick={refresh} disabled={!userId || loading || refreshing}
            className="h-11 px-4 flex items-center justify-center gap-2 shrink-0 rounded-xl text-sm font-medium border border-white/10 text-gray-300 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Request error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            <p className="text-xs">Reading {(selectedUser?.displayName || 'user')}'s balances from the chains…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: live on-chain donut */}
            <div className="flex flex-col">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Live On-Chain Allocation</p>
              <Donut segments={segments} total={liveTotal}
                centerLabel={liveTotal > 0 ? `$${(liveTotal).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$0'} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                    <span className="text-xs text-gray-400">{r.symbol}</span>
                  </div>
                ))}
              </div>
              {liveTotal === 0 && (
                <p className="text-[10px] text-gray-600 text-center mt-3">
                  No on-chain funds — fund the user's on-chain addresses to populate.
                </p>
              )}
              {fetchedAt && (
                <p className="text-[10px] text-gray-600 text-center mt-1">Updated {new Date(fetchedAt).toLocaleTimeString()}</p>
              )}
            </div>

            {/* RIGHT: DB vs on-chain comparison */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">DB ⇄ Chain Comparison</p>
                {mismatches > 0 && (
                  <span className="text-[11px] text-neon-amber font-semibold">{mismatches} mismatch{mismatches === 1 ? '' : 'es'}</span>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/8">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/2">
                      {['Asset', 'Simulated (DB)', 'On-Chain', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-b border-white/4 last:border-0">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                            <span className="text-xs font-semibold text-white">{r.symbol}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs font-num text-gray-300 whitespace-nowrap">{fmt(r.sim)}</td>
                        <td className="px-3 py-3 text-xs font-num whitespace-nowrap">
                          {r.ok === false
                            ? <span className="text-neon-red" title={r.error}>—</span>
                            : <span className="text-neon-green">{fmt(r.live)}</span>}
                        </td>
                        <td className="px-3 py-3"><StatusBadge ok={r.ok} synced={r.synced} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                <span className="text-neon-green">Synced</span> = DB matches chain ·
                <span className="text-neon-amber"> Mismatched</span> = values differ (expected while balances are simulated)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
