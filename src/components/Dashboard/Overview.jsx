import React, { useEffect, useState } from 'react'
import {
  Wallet, TrendingUp, Layers,
  Send, Download, History, X, ArrowRight
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import SendForm from '../Wallet/SendForm'
import ReceiveForm from '../Wallet/ReceiveForm'
import NodeMonitor from '../common/NodeMonitor'

/* ── A single recent-activity row (terminal-styled) ─────── */
function TxRow({ tx }) {
  const cfg = {
    Receive: { color: 'text-neon-green', bg: 'bg-neon-green/10', sign: '+' },
    Send:    { color: 'text-neon-red',   bg: 'bg-neon-red/10',   sign: '-' },
    Swap:    { color: 'text-neon-teal',  bg: 'bg-neon-teal/10',  sign: '⇄' },
    Buy:     { color: 'text-neon-green', bg: 'bg-neon-green/10', sign: '+' },
    Sell:    { color: 'text-neon-red',   bg: 'bg-neon-red/10',   sign: '-' },
  }[tx.type] ?? { color: 'text-gray-400', bg: 'bg-gray-700/20', sign: '?' }

  return (
    <div className="terminal-card flex items-center gap-3 px-4 py-3 pl-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${cfg.bg} ${cfg.color}`}>
        {cfg.sign}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{tx.type} · {tx.asset}</p>
        <p className="text-xs text-gray-500 font-mono truncate">{(tx.hash || '').slice(0, 22)}…</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold font-mono ${cfg.color}`}>
          {cfg.sign === '⇄' ? '' : cfg.sign}{tx.amount.toFixed(4)} {tx.asset.split('→')[0]}
        </p>
        <p className="text-xs text-gray-500 font-mono">{tx.date}</p>
      </div>
    </div>
  )
}

/* ── Inline readout stat (mono, command-line feel) ──────── */
function Readout({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-neon-green" />
      </span>
      <div>
        <p className="readout-label">{label}</p>
        <p className="text-lg font-bold font-mono text-white leading-none mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function Overview() {
  const { assets, portfolioValue, transactions, navigate, refreshData } = useApp()
  const [modal, setModal] = useState(null) // null | 'send' | 'receive'

  useEffect(() => {
    const id = setInterval(refreshData, 1000)
    return () => clearInterval(id)
  }, [refreshData])

  const assetCount    = assets.filter(a => a.balance > 0).length
  const activeWallets = assets.filter(a => a.balance > 0).length
  const recent        = transactions.slice(0, 5)

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* ── Asymmetric row: Hero Status Banner (wide) + Node Monitor (vertical) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Hero Status Banner */}
        <div className="lg:col-span-2 cyber-card glow-emerald-strong rounded-2xl p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 tech-dots opacity-30 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="readout-label">Total Balance</span>
              <span className="flex items-center gap-1 readout-label text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> LIVE
              </span>
            </div>

            <p className="text-4xl sm:text-5xl font-black font-mono text-white leading-none tracking-tight">
              ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-400 font-mono mt-2">{assetCount} assets · from yesterday</p>

            <div className="h-px my-5 bg-gradient-to-r from-neon-green/30 via-white/8 to-transparent" />

            <div className="grid grid-cols-3 gap-4 mb-6">
              <Readout icon={TrendingUp} label="Transactions"   value={transactions.length} />
              <Readout icon={Wallet}     label="Active Wallets"  value={activeWallets} />
              <Readout icon={Layers}     label="Assets"          value={assetCount} />
            </div>

            {/* Quick actions — open in-dashboard overlays */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setModal('send')}
                className="group flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-neon-green/10 border border-neon-green/30 text-emerald-400 font-semibold hover:bg-neon-green/20 hover:glow-emerald transition-all">
                <Send size={17} /> Send <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 -ml-1 group-hover:ml-0 transition-all" />
              </button>
              <button onClick={() => setModal('receive')}
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-semibold hover:border-neon-green/30 hover:text-white transition-all">
                <Download size={17} /> Receive
              </button>
            </div>
          </div>
        </div>

        {/* Live Node System Monitor */}
        <div className="lg:col-span-1">
          <NodeMonitor />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="cyber-card rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <History size={16} className="text-neon-green" /> Recent Activity
          <span className="readout-label ml-auto">/ ledger</span>
        </h3>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-14">
            <History size={40} className="text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 font-mono">No recent transactions</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recent.map(tx => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </div>

      {/* ── In-dashboard Send / Receive overlay ── */}
      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(8,9,10,.82)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModal(null)}
        >
          <div className="relative w-full max-w-lg my-8 animate-scale-in" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setModal(null)}
              aria-label="Close"
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full glass flex items-center justify-center text-gray-300 hover:text-neon-green hover:border-neon-green/40 transition-all"
            >
              <X size={18} />
            </button>
            {modal === 'send' ? <SendForm /> : <ReceiveForm />}
          </div>
        </div>
      )}
    </div>
  )
}
