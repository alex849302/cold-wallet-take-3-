import React, { useMemo, useState } from 'react'
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Clock, ListOrdered, Inbox, Search
} from 'lucide-react'
import { useTransactions } from '../../context/TransactionsContext'

const shortAddr = (a) => {
  const s = a == null ? '' : String(a)
  if (!s) return '—'
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s
}

/* Type → icon + color */
const TYPE_CFG = {
  Send:    { icon: ArrowUpRight,   color: 'text-neon-red'   },
  Receive: { icon: ArrowDownLeft,  color: 'text-neon-green' },
  Swap:    { icon: ArrowLeftRight, color: 'text-neon-teal'  },
  Buy:     { icon: TrendingUp,     color: 'text-neon-green' },
  Sell:    { icon: TrendingDown,   color: 'text-neon-red'   },
}

/* Status → colored badge */
function StatusBadge({ status }) {
  const map = {
    Completed: { icon: CheckCircle, cls: 'text-neon-green bg-neon-green/10 border-neon-green/25' },
    Rejected:  { icon: XCircle,     cls: 'text-neon-red bg-neon-red/10 border-neon-red/25' },
    Pending:   { icon: Clock,       cls: 'text-neon-amber bg-neon-amber/10 border-neon-amber/25' },
  }
  const cfg = map[status] || map.Pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.cls} ${status === 'Pending' ? 'animate-pulse' : ''}`}>
      <cfg.icon size={11} /> {status}
    </span>
  )
}

const fmtTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AllTransactions() {
  const { transactions } = useTransactions()
  const [search, setSearch] = useState('')

  // Global audit log — every transaction, newest first, filtered by sender
  // name / email as the admin types.
  const all = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...transactions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (!q) return sorted
    return sorted.filter(tx =>
      (tx.userName || '').toLowerCase().includes(q) ||
      (tx.userEmail || '').toLowerCase().includes(q)
    )
  }, [transactions, search])

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <ListOrdered size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">All Transactions</h2>
            <p className="text-xs text-gray-500">Global audit log · every transaction in the system</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="wallet-input h-9 !pl-9 pr-3 text-sm w-full sm:w-60"
              autoComplete="off"
            />
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neon-green/15 text-neon-green border border-neon-green/25">
            {all.length} total
          </span>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Inbox size={26} className="text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">
            {search.trim() ? 'No matching transactions' : 'No transactions yet'}
          </p>
          <p className="text-xs text-gray-500">
            {search.trim() ? `Nothing matches “${search}”.` : 'Activity across all accounts will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['User / Sender', 'Type', 'Asset', 'Amount', 'USD Value', 'Recipient', 'Timestamp', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map(tx => {
                  const cfg = TYPE_CFG[tx.type] || TYPE_CFG.Send
                  return (
                    <tr key={tx.id} className="border-b border-white/3 hover:bg-white/2 transition-all">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-white">{tx.userName || '—'}</p>
                        <p className="text-xs text-gray-500">{tx.userEmail}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-200">
                          <cfg.icon size={13} className={cfg.color} /> {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold font-num text-white">{tx.asset}</td>
                      <td className="px-4 py-3.5 text-sm font-num text-gray-200">{tx.amount}</td>
                      <td className="px-4 py-3.5 text-sm font-num text-gray-400">
                        ${Number(tx.usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-gray-500" title={tx.to}>{shortAddr(tx.to)}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{fmtTime(tx.createdAt)}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={tx.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="md:hidden divide-y divide-white/5">
            {all.map(tx => {
              const cfg = TYPE_CFG[tx.type] || TYPE_CFG.Send
              return (
                <div key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                        <cfg.icon size={13} className={cfg.color} /> {tx.type} · {tx.asset}
                      </span>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{tx.userName || '—'}{tx.userEmail ? ` · ${tx.userEmail}` : ''}</p>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-num text-gray-200">{tx.amount} {tx.asset}</span>
                    <span className="font-num text-gray-400">
                      ${Number(tx.usd ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-mono truncate mr-2" title={tx.to}>To: {shortAddr(tx.to)}</span>
                    <span className="shrink-0">{fmtTime(tx.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
