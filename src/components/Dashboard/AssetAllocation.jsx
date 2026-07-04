import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

// Portfolio Allocation donut for the regular user dashboard.
// Reads STRICTLY from AppContext balances (the DB-simulated values admins
// control). The real on-chain truth is intentionally NOT shown here — that
// lives only in the admin "Chain Tools" diagnostics screen.
const RADIUS = 70
const CIRC   = 2 * Math.PI * RADIUS
const CX = 110, CY = 110, R = RADIUS

export default function AssetAllocation() {
  const { assets } = useApp()
  const [hovered, setHovered] = useState(null)

  const total = assets.reduce((s, a) => s + a.price * a.balance, 0)

  let cumulative = 0
  const segments = assets.map(a => {
    const value  = a.price * a.balance
    const pct    = total > 0 ? value / total : 0   // guard empty ($0) portfolios
    const len    = pct * CIRC
    const offset = CIRC - cumulative * CIRC
    cumulative  += pct
    return { ...a, value, pct, len, offset }
  })

  const active = hovered !== null ? segments[hovered] : null

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Portfolio Allocation</h3>

      {/* On mobile: stack donut above legend; on sm+: side by side */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1">

        {/* Donut — scales to fill available width, capped at 200px */}
        <div className="w-full max-w-[180px] sm:max-w-[220px] shrink-0 mx-auto sm:mx-0">
          <svg viewBox="0 0 220 220" className="w-full h-auto">
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke="rgba(255,255,255,0.04)" strokeWidth="28" />

            {segments.map((seg, i) => (
              <circle key={seg.id}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={hovered === i ? 32 : 26}
                strokeDasharray={`${seg.len} ${CIRC - seg.len}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="round"
                className="donut-segment"
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: 'rotate(-90deg)',
                  opacity: hovered !== null && hovered !== i ? 0.35 : 1,
                  filter: hovered === i ? `drop-shadow(0 0 8px ${seg.color}88)` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}

            <text x={CX} y={CY - 10} textAnchor="middle" fill="#EAECEF"
              fontSize="13" fontWeight="700" fontFamily="JetBrains Mono,monospace">
              {active ? active.symbol : 'Total'}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fill="#B7BDC6"
              fontSize="11" fontFamily="JetBrains Mono,monospace">
              {active
                ? `${(active.pct * 100).toFixed(1)}%`
                : `$${(total / 1000).toFixed(1)}k`}
            </text>
            <text x={CX} y={CY + 26} textAnchor="middle" fill="#474D57"
              fontSize="9" fontFamily="JetBrains Mono,monospace">
              {active
                ? `$${active.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : 'portfolio'}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 flex-1 w-full">
          {segments.map((seg, i) => (
            <div key={seg.id}
              className="flex items-center gap-3 cursor-pointer group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered !== null && hovered !== i ? 0.4 : 1, transition: 'opacity .2s' }}>

              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                   style={{ background: seg.color, boxShadow: hovered === i ? `0 0 8px ${seg.color}88` : 'none' }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-white">{seg.symbol}</span>
                  <span className="text-xs font-num text-gray-300">
                    ${seg.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/6 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                       style={{ width: `${seg.pct * 100}%`, background: seg.color }} />
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-600 font-num">{seg.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })} {seg.symbol}</span>
                  <span className="text-xs text-gray-500">{(seg.pct * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
