import React, { useEffect, useRef, useState } from 'react'
import { Activity, Cpu, Wifi, ShieldCheck } from 'lucide-react'

/* ── Live Node System Monitor ───────────────────────────────
   A vertical, high-tech status widget. The block height ticks up
   and latency jitters client-side to read as a live feed. Purely
   presentational — no backend calls (backend stays untouched). */
export default function NodeMonitor({ startBlock = 25416000 }) {
  const [block, setBlock]   = useState(startBlock)
  const [latency, setLatency] = useState(42)
  const [bars, setBars]     = useState(() => Array.from({ length: 28 }, () => 20 + Math.random() * 70))
  const tick = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      tick.current += 1
      // New block roughly every ~3 ticks (Ethereum ~12s; sped up for feel).
      if (tick.current % 3 === 0) setBlock(b => b + 1)
      setLatency(30 + Math.round(Math.random() * 40))
      setBars(prev => [...prev.slice(1), 20 + Math.random() * 75])
    }, 1400)
    return () => clearInterval(id)
  }, [])

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="flex items-center gap-2 readout-label">
        <Icon size={12} className="text-neon-green" /> {label}
      </span>
      <span className={`font-mono text-xs ${accent ? 'text-emerald-400' : 'text-gray-200'}`}>{value}</span>
    </div>
  )

  return (
    <div className="cyber-card rounded-2xl p-5 h-full flex flex-col overflow-hidden relative scanline">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-70 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-neon-green" />
          </span>
          <h3 className="text-sm font-bold text-white tracking-wide">Node Monitor</h3>
        </div>
        <span className="readout-label text-emerald-400">● ONLINE</span>
      </div>

      {/* Live "throughput" bars */}
      <div className="flex items-end gap-[3px] h-16 mb-4">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm transition-all duration-700"
            style={{ height: `${h}%`, background: `rgba(0,230,118,${0.25 + (i / bars.length) * 0.6})` }} />
        ))}
      </div>

      {/* Readouts */}
      <div className="flex-1">
        <Stat icon={ShieldCheck} label="Network" value="ETH · Mainnet" accent />
        <Stat icon={Cpu}         label="Block"   value={`#${block.toLocaleString('en-US')}`} accent />
        <Stat icon={Wifi}        label="Latency" value={`${latency} ms`} />
        <Stat icon={Activity}    label="Peers"   value="128 / 128" />
      </div>

      {/* Sync bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="readout-label">Chain Sync</span>
          <span className="font-mono text-[11px] text-emerald-400">100%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full w-full rounded-full" style={{ background: 'linear-gradient(90deg,#00E676,#00BFA5)' }} />
        </div>
      </div>
    </div>
  )
}
