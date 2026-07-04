import React from 'react'
import {
  Check, X, Clock, ArrowUpRight, Inbox, ShieldCheck
} from 'lucide-react'
import { useTransactions } from '../../context/TransactionsContext'
import { useApp } from '../../context/AppContext'
import { useAdminNotifications } from '../../context/AdminNotificationContext'

const shortAddr = (a) => {
  const s = a == null ? '' : String(a)
  if (!s) return '—'
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s
}

export default function TransactionManagement() {
  const { pendingTransactions, approveTransaction, cancelTransaction } = useTransactions()
  const { showToast } = useApp()
  const { pendingHighlight } = useAdminNotifications()  // flashes when a notification deep-links here

  const handleApprove = async (tx) => {
    try {
      await approveTransaction(tx.id)
      showToast(`Approved ${tx.amount} ${tx.asset} for ${tx.userName} — balance deducted`, 'success')
    } catch (err) {
      showToast(err.message || 'Approve failed', 'error')
    }
  }
  const handleCancel = async (tx) => {
    try {
      await cancelTransaction(tx.id)
      showToast(`Rejected ${tx.userName}'s ${tx.amount} ${tx.asset} transfer`, 'error')
    } catch (err) {
      showToast(err.message || 'Cancel failed', 'error')
    }
  }

  return (
    <div className={`glass rounded-2xl overflow-hidden transition-all duration-500 ${
      pendingHighlight ? 'ring-2 ring-neon-amber/70 shadow-[0_0_28px_rgba(255,193,7,0.25)]' : 'ring-0'
    }`}>
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-amber/10 border border-neon-amber/25 flex items-center justify-center">
            <Clock size={16} className="text-neon-amber" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Pending Approvals</h2>
            <p className="text-xs text-gray-500">Review and action pending transfers</p>
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neon-amber/15 text-neon-amber border border-neon-amber/25">
          {pendingTransactions.length} pending
        </span>
      </div>

      {/* Empty state */}
      {pendingTransactions.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-4">
            <ShieldCheck size={26} className="text-neon-green" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">All clear</p>
          <p className="text-xs text-gray-500">There are no pending transactions to review.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['User', 'Type', 'Asset', 'Amount', 'USD', 'Recipient', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.map(tx => (
                  <tr key={tx.id} className="border-b border-white/3 hover:bg-white/2 transition-all">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-white">{tx.userName}</p>
                      <p className="text-xs text-gray-500">{tx.userEmail}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-200">
                        <ArrowUpRight size={13} className="text-neon-red" /> {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold font-num text-white">{tx.asset}</td>
                    <td className="px-4 py-3.5 text-sm font-num text-gray-200">{tx.amount}</td>
                    <td className="px-4 py-3.5 text-sm font-num text-gray-400">
                      ${tx.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono text-gray-500" title={tx.to}>{shortAddr(tx.to)}</td>
                    <td className="px-4 py-3.5">
                      <ActionButtons onApprove={() => handleApprove(tx)} onCancel={() => handleCancel(tx)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="md:hidden divide-y divide-white/5">
            {pendingTransactions.map(tx => (
              <div key={tx.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{tx.userName}</p>
                    <p className="text-xs text-gray-500 truncate">{tx.userEmail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold font-num text-white">
                    {tx.amount} {tx.asset}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span className="inline-flex items-center gap-1"><ArrowUpRight size={12} className="text-neon-red" /> {tx.type}</span>
                  <span className="font-num">${tx.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
                <p className="text-xs font-mono text-gray-600 mb-3 truncate" title={tx.to}>To: {shortAddr(tx.to)}</p>
                <ActionButtons full onApprove={() => handleApprove(tx)} onCancel={() => handleCancel(tx)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ActionButtons({ onApprove, onCancel, full }) {
  return (
    <div className={`flex items-center gap-2 ${full ? 'w-full' : ''}`}>
      <button onClick={onApprove}
        className={`${full ? 'flex-1' : ''} flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold
          bg-neon-green/15 text-neon-green border border-neon-green/30 hover:bg-neon-green/25 transition-all`}>
        <Check size={14} /> Approve
      </button>
      <button onClick={onCancel}
        className={`${full ? 'flex-1' : ''} flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold
          bg-neon-red/12 text-neon-red border border-neon-red/30 hover:bg-neon-red/22 transition-all`}>
        <X size={14} /> Cancel
      </button>
    </div>
  )
}
