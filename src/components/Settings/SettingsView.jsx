import React, { useState } from 'react'
import {
  ShieldCheck, Lock, Unlock, Eye, EyeOff, Copy, Check, AlertTriangle,
  KeyRound, User, Mail, ArrowRight, SlidersHorizontal, Clock, Timer,
  Usb, ChevronDown, CircleDollarSign, Wallet
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

// The recovery phrase is the user's REAL BIP-39 mnemonic, generated at signup
// and stored only as an encrypted keystore server-side. It's fetched on demand
// (after a password re-check) via api.revealSeedPhrase — never hardcoded here.

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'profile',  label: 'Profile',           icon: User },
  { id: 'security', label: 'Security & Privacy', icon: ShieldCheck },
  { id: 'general',  label: 'General',            icon: SlidersHorizontal },
]

export default function SettingsView() {
  const { user } = useApp()
  const [tab, setTab] = useState('profile')

  return (
    <div className="max-w-5xl space-y-5">
      <TabBar tab={tab} setTab={setTab} />

      {/* key={tab} re-triggers the fadeIn page-enter animation on every switch */}
      <div key={tab} className="page-enter">
        {tab === 'profile'  && <AccountCard user={user} />}
        {tab === 'security' && <SecurityPanel />}
        {tab === 'general'  && <GeneralPanel />}
      </div>
    </div>
  )
}

/* ── Tab navigation bar ───────────────────────────────────────────────────── */
function TabBar({ tab, setTab }) {
  return (
    <div className="glass rounded-2xl p-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
      {TABS.map(t => {
        const active = tab === t.id
        const Icon = t.icon
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
              active
                ? 'bg-neon-green/15 text-white border-neon-green/30 shadow'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}>
            <Icon size={16} className={active ? 'text-neon-green' : ''} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 1 — Profile: account details + change password
   ════════════════════════════════════════════════════════════════════════════ */
function AccountCard({ user }) {
  const { showToast } = useApp()
  const [cur, setCur] = useState('')
  const [nw, setNw]   = useState('')
  const [cf, setCf]   = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!cur || !nw || !cf) return showToast('Fill in all password fields.', 'error')
    if (nw.length < 8)      return showToast('New password must be at least 8 characters.', 'error')
    if (nw !== cf)          return showToast('New passwords do not match.', 'error')
    setSaving(true)
    try {
      await api.changePassword(cur, nw)
      showToast('Password updated successfully.', 'success')
      setCur(''); setNw(''); setCf('')
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <CardHeader icon={ShieldCheck} accent="green" title="Account" subtitle="Profile & security" />

      <div className="p-5 sm:p-6 grid lg:grid-cols-2 gap-6">
        {/* Read-only account details */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Profile</h3>
          <ReadOnly icon={User} label="Username" value={user?.name || 'Wallet User'} />
          <ReadOnly icon={Mail} label="Email" value={user?.email || '—'} />
        </div>

        {/* Change password */}
        <form onSubmit={submit} className="space-y-3 lg:border-l lg:border-white/5 lg:pl-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Change Password</h3>
          <Field label="Current Password" value={cur} onChange={setCur} />
          <Field label="New Password" value={nw} onChange={setNw} />
          <Field label="Confirm New Password" value={cf} onChange={setCf} />
          <button type="submit" disabled={saving}
            className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-50">
            <KeyRound size={15} /> {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 2 — Security & Privacy: recovery phrase + auto-lock
   ════════════════════════════════════════════════════════════════════════════ */
function SecurityPanel() {
  const [autoLock, setAutoLock] = useState('10 mins')
  return (
    <div className="space-y-5">
      <RecoveryPhraseCard />

      <WalletAddressesCard />

      <div className="glass rounded-2xl overflow-hidden">
        <CardHeader icon={Timer} accent="green" title="Auto-Lock"
          subtitle="Automatically lock the wallet after a period of inactivity." />
        <div className="p-5 sm:p-6">
          <SettingRow icon={Clock} title="Auto-Lock Timer"
            desc="Require your password again after this idle time.">
            <div className="w-36">
              <Select value={autoLock} onChange={setAutoLock}
                options={['5 mins', '10 mins', '30 mins', 'Never']} />
            </div>
          </SettingRow>
        </div>
      </div>
    </div>
  )
}

/* Recovery phrase, gated behind a password reveal (unchanged reveal logic). */
function RecoveryPhraseCard() {
  const { showToast } = useApp()
  const [unlocked, setUnlocked]   = useState(false)
  const [phrase, setPhrase]       = useState([])   // real BIP-39 words, fetched on unlock
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')
  const [copied, setCopied]       = useState(false)

  const unlock = async (e) => {
    e.preventDefault()
    setError('')
    if (!password) return setError('Enter your password to reveal the phrase.')
    setBusy(true)
    try {
      // Server re-verifies the password and decrypts the keystore to the real
      // mnemonic — nothing is revealed until this round-trip succeeds.
      const { words } = await api.revealSeedPhrase(password)
      setPhrase(words)
      setUnlocked(true)
      setPassword('')
    } catch (err) {
      setError(err.message || 'Incorrect password.')
    } finally {
      setBusy(false)
    }
  }

  const copyAll = () => {
    if (!phrase.length) return
    navigator.clipboard?.writeText(phrase.join(' ')).then(() => {
      setCopied(true)
      showToast('Recovery phrase copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 1800)
    })
  }

  // Before unlock we render a fixed-size masked grid; after unlock, the real words.
  const cells = unlocked ? phrase : Array.from({ length: 12 })

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-amber/10 border border-neon-amber/25 flex items-center justify-center">
            <KeyRound size={16} className="text-neon-amber" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Your Recovery Phrase</h2>
            <p className="text-xs text-gray-500">
              Write these 12 words on paper and store them offline.{' '}
              <span className="text-neon-red font-medium">Never share them.</span>{' '}
              Anyone with this phrase has full access to your wallet.
            </p>
          </div>
        </div>
        {unlocked && (
          <button onClick={copyAll}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold bg-neon-green/15 text-neon-green border border-neon-green/30 hover:bg-neon-green/25 transition-all">
            {copied ? <Check size={13} /> : <Copy size={13} />} Copy All
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {/* Warning box */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neon-amber/8 border border-neon-amber/30 text-sm text-neon-amber mb-5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Store this phrase somewhere safe before continuing. It cannot be recovered later.</span>
        </div>

        {/* Phrase grid + security barrier */}
        <div className="relative">
          {/* 12-word grid (blurred until unlocked) */}
          <div className={`grid grid-cols-3 gap-2 sm:gap-2.5 transition-all duration-300 ${
            unlocked ? '' : 'blur-md select-none pointer-events-none'
          }`}>
            {cells.map((word, i) => (
              <div key={i}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-300/70 border border-white/5">
                <span className="text-xs text-gray-500 font-num w-5 shrink-0 text-right">{i + 1}.</span>
                <span className="text-sm font-medium text-white truncate">
                  {unlocked ? word : '••••••'}
                </span>
              </div>
            ))}
          </div>

          {/* Lock overlay */}
          {!unlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <form onSubmit={unlock}
                className="w-full max-w-xs glass-dark rounded-2xl p-5 text-center border border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-neon-green/10 border border-neon-green/30 flex items-center justify-center mx-auto mb-3">
                  <Lock size={22} className="text-neon-green" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Phrase locked</h3>
                <p className="text-xs text-gray-500 mb-4">Enter your account password to reveal your 12-word recovery phrase.</p>

                <div className="relative mb-2">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Account password"
                    className="wallet-input h-11 pr-10 text-sm"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {error && <p className="text-xs text-neon-red mb-2">{error}</p>}

                <button type="submit" disabled={busy}
                  className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-50">
                  <Unlock size={15} /> {busy ? 'Verifying…' : 'Reveal Phrase'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        {unlocked && (
          <button
            onClick={() => { setUnlocked(false); showToast('Recovery phrase hidden', 'info') }}
            className="btn-primary w-full h-12 mt-5 flex items-center justify-center gap-2">
            I've written it down <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

/* Your wallets — the SAME real, HD-derived receiving addresses the Receive tab
   shows. Sourced from `assets` (addresses[a.id] from the backend wallet), so this
   list and the Receive screen can never drift apart. One row per supported asset
   (BTC, ETH, SOL, TRON, USDT-TRC20, USDT-ERC20). */
function WalletAddressesCard() {
  const { assets, showToast } = useApp()
  const [copiedId, setCopiedId] = useState(null)

  const rows = (assets || []).filter(a => a.address)
  if (rows.length === 0) return null

  const copy = (a) => {
    navigator.clipboard?.writeText(a.address).then(() => {
      setCopiedId(a.id)
      showToast(`${a.name} address copied`, 'success')
      setTimeout(() => setCopiedId(null), 1600)
    })
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <CardHeader icon={Wallet} accent="green" title="Your Wallets"
        subtitle="Real on-chain receiving addresses — the same ones shown in the Receive tab." />

      <div className="p-5 sm:p-6 space-y-2.5">
        {rows.map(a => (
          <div key={a.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 border border-white/5">
            {/* Asset badge */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[9px] font-bold tracking-tight"
              style={{ background: `${a.color}1A`, border: `1px solid ${a.color}40`, color: a.color }}>
              {a.symbol}
            </div>

            {/* Name + address */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white leading-none">{a.name}</p>
                <span className="text-[10px] text-gray-500">{a.network}</span>
              </div>
              <p className="font-num text-xs text-gray-400 truncate mt-1">{a.address}</p>
            </div>

            {/* Copy */}
            <button onClick={() => copy(a)} aria-label={`Copy ${a.name} address`}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-white/8 text-gray-400 hover:text-neon-green hover:bg-white/5 transition-all">
              {copiedId === a.id ? <Check size={15} className="text-neon-green" /> : <Copy size={15} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 3 — General: interface preferences
   ════════════════════════════════════════════════════════════════════════════ */
function GeneralPanel() {
  const [currency, setCurrency]   = useState('USD')
  const [hideEmpty, setHideEmpty] = useState(false)

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <CardHeader icon={SlidersHorizontal} accent="green" title="General"
        subtitle="Interface preferences" />

      <div className="p-5 sm:p-6 space-y-3">
        <SettingRow icon={CircleDollarSign} title="Primary Currency"
          desc="Display balances in your preferred currency.">
          <div className="w-32">
            <Select value={currency} onChange={setCurrency}
              options={['USD', 'EUR', 'BTC', 'ETH']} />
          </div>
        </SettingRow>

        <SettingRow icon={EyeOff} title="Hide Empty Accounts"
          desc="Hide assets that have a 0 balance.">
          <Toggle checked={hideEmpty} onChange={setHideEmpty} />
        </SettingRow>

        <SettingRow icon={Usb} title="Hardware Connection"
          desc="Status of your connected CoreCold device.">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-neon-green" />
            </span>
            <span className="text-sm font-medium text-neon-green whitespace-nowrap">
              CoreCold USB Connected
            </span>
          </div>
        </SettingRow>
      </div>
    </div>
  )
}

/* ── Shared building blocks ───────────────────────────────────────────────── */
const ACCENTS = {
  blue:  { bg: 'bg-neon-green/10',  border: 'border-neon-green/25',  text: 'text-neon-green' },
  green: { bg: 'bg-neon-green/10', border: 'border-neon-green/25', text: 'text-neon-green' },
  amber: { bg: 'bg-neon-amber/10', border: 'border-neon-amber/25', text: 'text-neon-amber' },
}

function CardHeader({ icon: Icon, accent = 'blue', title, subtitle }) {
  const a = ACCENTS[accent] || ACCENTS.blue
  return (
    <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${a.bg} border ${a.border} flex items-center justify-center`}>
        <Icon size={16} className={a.text} />
      </div>
      <div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function SettingRow({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-300/50 border border-white/5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-gray-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          {desc && <p className="text-xs text-gray-500">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-neon-green' : 'bg-dark-300 border border-white/10'
      }`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : ''
      }`} />
    </button>
  )
}

function Select({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="wallet-input h-10 pr-9 text-sm appearance-none cursor-pointer">
        {options.map(o => (
          <option key={o} value={o} className="bg-dark-300 text-white">{o}</option>
        ))}
      </select>
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
    </div>
  )
}

function ReadOnly({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 border border-white/5">
      <Icon size={16} className="text-gray-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-sm font-medium text-white truncate">{value}</p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input type="password" value={value} onChange={e => onChange(e.target.value)}
        className="wallet-input h-11 mt-1.5 text-sm" placeholder="••••••••" />
    </div>
  )
}
