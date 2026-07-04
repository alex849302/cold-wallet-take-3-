import React, { useState, useMemo, useEffect } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, DollarSign,
  Search, Filter, ExternalLink, Clock, CheckCircle, XCircle,
  ChevronUp, ChevronDown, TrendingUp, TrendingDown, X, Copy
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const TYPE_CONFIG = {
  Receive: { icon: ArrowDownLeft, color: 'text-neon-green',  bg: 'bg-neon-green/12',  label: 'Received' },
  Send:    { icon: ArrowUpRight,  color: 'text-neon-red',    bg: 'bg-neon-red/12',    label: 'Sent'     },
  Swap:    { icon: ArrowLeftRight,color: 'text-neon-teal',   bg: 'bg-neon-teal/12',   label: 'Swapped'  },
  Buy:     { icon: TrendingUp,    color: 'text-neon-green',  bg: 'bg-neon-green/12',  label: 'Bought'   },
  Sell:    { icon: TrendingDown,  color: 'text-neon-red',    bg: 'bg-neon-red/12',    label: 'Sold'     },
}

const ALL_TYPES  = ['All', 'Receive', 'Send', 'Swap', 'Buy', 'Sell']
const ALL_ASSETS = ['All', 'BTC', 'ETH', 'SOL', 'USDT']

function StatusBadge({ status }) {
  if (status === 'Completed') return (
    <span className="flex items-center gap-1 text-xs font-medium text-neon-green">
      <CheckCircle size={11} /> Completed
    </span>
  )
  if (status === 'Rejected') return (
    <span className="flex items-center gap-1 text-xs font-medium text-neon-red">
      <XCircle size={11} /> Rejected
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-neon-amber animate-pulse">
      <Clock size={11} /> Pending
    </span>
  )
}

export default function TransactionHistory() {
  const { transactions, focusedTxId, clearFocusedTx } = useApp()
  const [detailTx, setDetailTx] = useState(null)
  const [search, setSearch]   = useState('')

  // Deep-link target from a notification → open that transaction's detail view.
  useEffect(() => {
    if (!focusedTxId) return
    const tx = transactions.find(t => t.id === focusedTxId)
    if (tx) setDetailTx(tx)
    clearFocusedTx()
  }, [focusedTxId, transactions, clearFocusedTx])
  const [typeFilter, setType] = useState('All')
  const [assetFilter, setAsset] = useState('All')
  const [sort, setSort]       = useState({ key: 'date', dir: 'desc' })
  const [page, setPage]       = useState(1)
  const PER_PAGE = 8

  const filtered = useMemo(() => {
    let list = [...transactions]
    if (typeFilter !== 'All') list = list.filter(t => t.type === typeFilter)
    if (assetFilter !== 'All') list = list.filter(t => t.asset.includes(assetFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.hash.toLowerCase().includes(q) ||
        t.asset.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.date.includes(q)
      )
    }
    list.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key]
      if (sort.key === 'usd' || sort.key === 'amount') { av = +av; bv = +bv }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ?  1 : -1
      return 0
    })
    return list
  }, [transactions, typeFilter, assetFilter, search, sort])

  const pages = Math.ceil(filtered.length / PER_PAGE)
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
    setPage(1)
  }

  const SortIcon = ({ col }) => {
    if (sort.key !== col) return <ChevronDown size={12} className="text-gray-600" />
    return sort.dir === 'asc' ? <ChevronUp size={12} className="text-neon-green" /> : <ChevronDown size={12} className="text-neon-green" />
  }

  return (
    <>
    <div className="cyber-card rounded-2xl overflow-hidden max-w-6xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Transaction History</h2>
            <p className="text-xs text-gray-500 mt-0.5">{filtered.length} transactions</p>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="wallet-input !pl-9 w-56 h-9 text-sm"
              placeholder="Search hash, asset…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 mr-2">
            <Filter size={12} className="text-gray-500" />
            <span className="text-xs text-gray-500">Type:</span>
          </div>
          {ALL_TYPES.map(t => (
            <button key={t} onClick={() => { setType(t); setPage(1) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                typeFilter === t
                  ? 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                  : 'border border-white/8 text-gray-500 hover:text-white hover:border-white/15'
              }`}>
              {t}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-3 mr-2">
            <span className="text-xs text-gray-500">Asset:</span>
          </div>
          {ALL_ASSETS.map(a => (
            <button key={a} onClick={() => { setAsset(a); setPage(1) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                assetFilter === a
                  ? 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                  : 'border border-white/8 text-gray-500 hover:text-white hover:border-white/15'
              }`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="px-5 sm:px-6 pt-4 flex items-center gap-2">
        <span className="readout-label mr-1">Sort</span>
        {[['date', 'Date'], ['amount', 'Amount'], ['usd', 'USD']].map(([k, l]) => (
          <button key={k} onClick={() => toggleSort(k)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border inline-flex items-center gap-1 ${
              sort.key === k ? 'bg-neon-green/15 text-neon-green border-neon-green/30' : 'border-white/8 text-gray-500 hover:text-white'
            }`}>
            {l} {sort.key === k && (sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
          </button>
        ))}
      </div>

      {/* Terminal-style transaction capsules */}
      <div className="p-4 sm:p-6 space-y-2.5">
        {slice.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500 font-mono">No transactions match your filters.</div>
        ) : slice.map((tx) => {
          const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.Send
          return (
            <button key={tx.id} onClick={() => setDetailTx(tx)}
              className="terminal-card w-full text-left pl-5 pr-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Type */}
              <div className="flex items-center gap-2.5 min-w-[130px]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <cfg.icon size={14} className={cfg.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{tx.type}</p>
                  <p className="readout-label mt-1">{tx.asset}</p>
                </div>
              </div>
              {/* Amount + USD (mono) */}
              <div className="flex-1 min-w-[120px]">
                <p className="font-mono text-sm text-emerald-400">
                  {tx.amount.toFixed(tx.amount < 0.01 ? 8 : 4)} {tx.asset}
                </p>
                <p className="font-mono text-xs text-gray-500">
                  ${tx.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              {/* Status */}
              <div className="min-w-[104px]"><StatusBadge status={tx.status} /></div>
              {/* Date */}
              <div className="min-w-[88px] font-mono text-xs text-gray-500">{tx.date}</div>
              {/* TxID */}
              <div className="font-mono text-xs text-gray-600 flex items-center gap-1.5"
                title={tx.hash}
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.hash) }}>
                {tx.hash.slice(0, 10)}… <ExternalLink size={11} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/20 transition-all">
              ← Prev
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                  p === page
                    ? 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                    : 'border border-white/8 text-gray-500 hover:text-white'
                }`}>
                {p}
              </button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/20 transition-all">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>

    {detailTx && <TxDetailModal tx={detailTx} onClose={() => setDetailTx(null)} />}
    </>
  )
}

/* ── Transaction detail / status screen (modal) ─────────────────────────────
   Deep-link target for "approved" and "failed" notifications. Explains the
   current status — especially WHY a transaction failed. */
function TxDetailModal({ tx, onClose }) {
  const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.Send

  const STATUS_INFO = {
    Completed: {
      accent: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/30', icon: CheckCircle,
      title: 'Approved & settled',
      body: 'This transaction was approved by an administrator and has been settled. Your balance reflects the change.',
    },
    Rejected: {
      accent: 'text-neon-red', bg: 'bg-neon-red/10', border: 'border-neon-red/30', icon: XCircle,
      title: 'Transaction failed',
      body: 'This transaction was rejected during administrator review, so it was not processed. No funds were deducted from your balance. You can try again or contact support if you believe this was a mistake.',
    },
    Pending: {
      accent: 'text-neon-amber', bg: 'bg-neon-amber/10', border: 'border-neon-amber/30', icon: Clock,
      title: 'Awaiting approval',
      body: 'This transaction is pending administrator approval. No funds have been deducted yet — you’ll be notified once it’s processed.',
    },
  }
  const info = STATUS_INFO[tx.status] || STATUS_INFO.Pending
  const InfoIcon = info.icon

  const Row = ({ label, children }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-200 font-num text-right break-all">{children}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         onClick={onClose} style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}>
      <div className="glass rounded-2xl w-full max-w-md overflow-hidden notif-dropdown" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
            <cfg.icon size={17} className={cfg.color} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white">{tx.type} · {tx.asset}</h3>
            <p className="text-xs text-gray-500">Transaction details</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Status explanation */}
        <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 flex items-start gap-3 ${info.bg} ${info.border}`}>
          <InfoIcon size={18} className={`${info.accent} shrink-0 mt-0.5`} />
          <div>
            <p className={`text-sm font-bold ${info.accent}`}>{info.title}</p>
            <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{info.body}</p>
          </div>
        </div>

        {/* Facts */}
        <div className="px-5 py-3">
          <Row label="Amount">{tx.amount.toFixed(tx.amount < 0.01 ? 8 : 4)} {tx.asset}</Row>
          <Row label="USD Value">${tx.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Row>
          <Row label="Status"><StatusBadge status={tx.status} /></Row>
          <Row label="Date">{tx.date}</Row>
          {tx.to && <Row label="To">{tx.to}</Row>}
          {tx.from && <Row label="From">{tx.from}</Row>}
          <Row label="Transaction ID">
            <button
              className="inline-flex items-center gap-1.5 text-neon-green hover:underline font-mono text-xs"
              onClick={() => navigator.clipboard.writeText(tx.hash)}
              title="Copy full hash">
              {tx.hash.slice(0, 14)}… <Copy size={11} />
            </button>
          </Row>
        </div>

        <div className="px-5 pb-5 pt-1">
          <button onClick={onClose} className="btn-primary w-full h-11">Close</button>
        </div>
      </div>
    </div>
  )
}
