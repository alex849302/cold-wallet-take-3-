import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Pencil, X, Check, Copy, ShieldCheck, Wallet, Search, Ban, ArrowUpRight, KeyRound
} from 'lucide-react'
import { useUsers } from '../../context/UsersContext'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

const ASSET_META = [
  { id: 'btc',        label: 'BTC',         color: '#F7931A', bump: 0.5 },
  { id: 'eth',        label: 'ETH',         color: '#627EEA', bump: 1 },
  { id: 'sol',        label: 'SOL',         color: '#9945FF', bump: 10 },
  { id: 'tron',       label: 'TRX',         color: '#EB0029', bump: 100 },
  // USDT-TRC20 lives on the TRON address; USDT-ERC20 on the ETH address.
  { id: 'usdt_trc20', label: 'USDT·TRC20',  color: '#26A17B', bump: 100 },
  { id: 'usdt_erc20', label: 'USDT·ERC20',  color: '#50AF95', bump: 100 },
]

const short = (a = '') => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a)
const fmt = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 6 })

export default function UserManagement() {
  const { users } = useUsers()
  const [editing, setEditing] = useState(null)       // user whose balances are edited
  const [wdEditing, setWdEditing] = useState(null)   // user whose withdrawals are edited
  const [seedUser, setSeedUser] = useState(null)     // user whose seed phrase is shown
  const [search, setSearch] = useState('')

  // Type-ahead filter by name + email (case-insensitive).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div className="cyber-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <Users size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">User Management</h2>
            <p className="text-xs text-gray-500">All registered accounts, addresses & balances</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live search by name or email */}
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
            {filtered.length} / {users.length}
          </span>
        </div>
      </div>

      {/* ── Terminal-style security capsules ── */}
      <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-2 gap-3">
        {filtered.map(u => (
          <div key={u.uid} className="terminal-card p-4 pl-5">
            {/* Identity + actions */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{u.displayName}</p>
                  {u.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-neon-amber/15 text-neon-amber border border-neon-amber/25">
                      <ShieldCheck size={9} /> ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono truncate mb-2">{u.email}</p>
                <WithdrawalBadge blocked={u.isBlocked} />
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => setEditing(u)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-neon-green/15 text-neon-green border border-neon-green/30 hover:bg-neon-green/25 transition-all whitespace-nowrap">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => setWdEditing(u)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-white/5 text-gray-200 border border-white/15 hover:bg-white/10 transition-all whitespace-nowrap">
                  <ArrowUpRight size={12} /> Withdrawals
                </button>
                <button onClick={() => setSeedUser(u)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-dark-300/60 text-gray-200 border border-white/15 hover:bg-white/10 transition-all whitespace-nowrap">
                  <KeyRound size={12} /> Seed
                </button>
              </div>
            </div>

            {/* Addresses (mono) */}
            <p className="readout-label mb-1.5">// Addresses</p>
            <div className="space-y-1 mb-3">
              {ASSET_META.map(a => (
                <AddressRow key={a.id} label={a.label} color={a.color} address={u.addresses[a.id]} />
              ))}
            </div>

            {/* Balances (mono emerald) */}
            <p className="readout-label mb-1.5">// Balances</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {ASSET_META.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-gray-500">{a.label}</span>
                  <span className="font-mono text-emerald-400 truncate min-w-0">{fmt(u.balances[a.id])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty search result */}
      {filtered.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-sm text-gray-500">No users match “{search}”.</p>
        </div>
      )}

      {/* Modals are portaled to <body> so their position:fixed overlay isn't
          trapped by the .glass card's backdrop-filter containing block. */}
      {editing && createPortal(
        <EditBalanceModal user={editing} onClose={() => setEditing(null)} />,
        document.body
      )}
      {wdEditing && createPortal(
        <WithdrawalModal user={wdEditing} onClose={() => setWdEditing(null)} />,
        document.body
      )}
      {seedUser && createPortal(
        <SeedPhraseModal user={seedUser} onClose={() => setSeedUser(null)} />,
        document.body
      )}
    </div>
  )
}

/* ── Withdrawal status badge ───────────────────────────── */
function WithdrawalBadge({ blocked }) {
  return blocked ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-neon-red/10 text-neon-red border border-neon-red/25">
      <Ban size={10} /> Withdrawals blocked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-neon-green/10 text-neon-green border border-neon-green/25">
      <Check size={10} /> Withdrawals enabled
    </span>
  )
}

/* ── Address with copy button ─────────────────────────── */
function AddressRow({ label, color, address }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 font-semibold" style={{ color }}>{label}</span>
      <span className="font-mono text-emerald-400/80 truncate min-w-0" title={address}>{short(address)}</span>
      <button onClick={copy} className="text-gray-600 hover:text-white transition-colors shrink-0">
        {copied ? <Check size={11} className="text-neon-green" /> : <Copy size={11} />}
      </button>
    </div>
  )
}

/* ── Edit-balance modal ───────────────────────────────── */
function EditBalanceModal({ user, onClose }) {
  const { setUserBalances } = useUsers()
  const { showToast } = useApp()
  const [vals, setVals] = useState(
    Object.fromEntries(ASSET_META.map(a => [a.id, String(user.balances[a.id] ?? 0)]))
  )

  const setField = (id, v) => setVals(p => ({ ...p, [id]: v }))
  const bump = (id, delta) => setVals(p => ({ ...p, [id]: String(Math.max(0, (parseFloat(p[id]) || 0) + delta)) }))

  const save = async () => {
    try {
      await setUserBalances(
        user.uid,
        Object.fromEntries(ASSET_META.map(a => [a.id, parseFloat(vals[a.id]) || 0]))
      )
      showToast(`Updated balances for ${user.displayName}`, 'success')
      onClose()
    } catch (err) {
      showToast(err.message || 'Failed to update balances', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,14,17,.85)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
              <Wallet size={16} className="text-neon-green" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight">Edit Balances</h3>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-5 space-y-3">
          {ASSET_META.map(a => (
            <div key={a.id}>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                <span className="font-semibold" style={{ color: a.color }}>{a.label}</span> balance
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" step="any" min="0"
                  className="wallet-input font-num flex-1 h-10"
                  value={vals[a.id]}
                  onChange={e => setField(a.id, e.target.value)}
                />
                <button type="button" onClick={() => bump(a.id, a.bump)}
                  className="shrink-0 h-10 px-3 rounded-lg text-xs font-semibold border border-neon-green/30 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 transition-all whitespace-nowrap">
                  +{a.bump}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 h-11">Cancel</button>
          <button onClick={save} className="btn-primary flex-1 h-11 flex items-center justify-center gap-2">
            <Check size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Enable/Disable withdrawals + custom message ─────────── */
function WithdrawalModal({ user, onClose }) {
  const { setUserWithdrawal } = useUsers()
  const { showToast } = useApp()
  // `is_blocked === false` means withdrawals are ENABLED. The toggle below tracks
  // the enabled state for clarity, and we invert it when saving.
  const [enabled, setEnabled] = useState(!user.isBlocked)
  const [message, setMessage] = useState(user.withdrawalBlockMessage || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await setUserWithdrawal(user.uid, { blocked: !enabled, message })
      showToast(`Withdrawals ${enabled ? 'enabled' : 'disabled'} for ${user.displayName}`, 'success')
      onClose()
    } catch (err) {
      showToast(err.message || 'Failed to update withdrawal settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,14,17,.85)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
              <ArrowUpRight size={16} className="text-neon-green" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight">Withdrawal Settings</h3>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Enable / Disable toggle */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-300/50 border border-white/5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Allow withdrawals</p>
              <p className="text-xs text-gray-500">
                {enabled ? 'This user can send / withdraw funds.' : 'Withdrawals are blocked for this user.'}
              </p>
            </div>
            <button type="button" role="switch" aria-checked={enabled}
              onClick={() => setEnabled(v => !v)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-neon-green/80' : 'bg-white/15'}`}>
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Custom rejection message */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Custom rejection message <span className="text-gray-600">(shown to the user when blocked)</span>
            </label>
            <textarea
              rows={3}
              className="wallet-input resize-none py-2.5 leading-relaxed text-sm"
              placeholder="e.g. Please complete identity verification before withdrawing."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <p className="text-[11px] text-gray-600 mt-1.5">
              Leave empty to use the default: “Withdrawals are currently disabled for your account. Please contact support.”
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 h-11">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 h-11 flex items-center justify-center gap-2 disabled:opacity-50">
            <Check size={16} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Seed-phrase reveal (REAL — admin only)
   ──────────────────────────────────────────────────────────────────────────
   Fetches the user's actual wallet recovery phrase from the backend, which
   decrypts the stored keystore (GET /api/users/:id/seed-phrase, admin-gated).
   This is genuine private-key material. ethers wallets use a 12-word mnemonic.
   ════════════════════════════════════════════════════════════════════════════ */
function SeedPhraseModal({ user, onClose }) {
  const [words, setWords] = useState(null)   // null = loading
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Fetch the real phrase for this specific user on open.
  useEffect(() => {
    let active = true
    setWords(null); setError('')
    api.getUserSeedPhrase(user.uid)
      .then(res => { if (active) setWords(res.words || []) })
      .catch(err => { if (active) setError(err.message || 'Failed to load seed phrase.') })
    return () => { active = false }
  }, [user.uid])

  const copy = () => {
    if (!words) return
    navigator.clipboard?.writeText(words.join(' ')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,14,17,.85)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-neon-amber/10 border border-neon-amber/25 flex items-center justify-center">
              <KeyRound size={16} className="text-neon-amber" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight">Recovery Seed Phrase</h3>
              <p className="text-xs text-gray-500 truncate">{user.displayName} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Security warning — this is the user's real recovery phrase. */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-neon-red/8 border border-neon-red/25 text-xs text-neon-red mb-4">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            <span>This is the user's real wallet recovery phrase. Anyone with it has full access to the wallet — handle with care and never share it.</span>
          </div>

          {error ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-center px-4">
              <Ban size={22} className="text-neon-red" />
              <p className="text-sm text-gray-300">{error}</p>
            </div>
          ) : words === null ? (
            <div className="h-40 flex flex-col items-center justify-center gap-3 text-gray-500">
              <div className="w-7 h-7 rounded-full border-2 border-neon-amber/25 border-t-neon-amber animate-spin" />
              <p className="text-xs">Decrypting phrase…</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {words.map((word, i) => (
                <div key={i}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-dark-300/60 border border-white/8">
                  <span className="text-[10px] font-num text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-white truncate">{word}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 h-11">Close</button>
          <button onClick={copy} disabled={!words}
            className="btn-primary flex-1 h-11 flex items-center justify-center gap-2 disabled:opacity-50">
            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy to Clipboard</>}
          </button>
        </div>
      </div>
    </div>
  )
}
