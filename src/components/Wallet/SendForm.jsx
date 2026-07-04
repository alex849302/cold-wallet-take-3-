import React, { useState, useMemo } from 'react'
import {
  Send, ChevronDown, AlertCircle, CheckCircle,
  Cpu, Loader, HardDrive, X, ArrowRight, Zap, Info, Clock, QrCode, Camera
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { NETWORK_FEES } from '../../data/mockData'

const STEPS = { form: 0, review: 1, device: 2, success: 3 }

// Mirrors the server fallback so the UI shows a sensible English message even
// before an admin authors a custom one.
const DEFAULT_WITHDRAWAL_BLOCK_MESSAGE =
  'Withdrawals are currently disabled for your account. Please contact support.'

/* ── Device Confirm Modal ──────────────────────────── */
function DeviceModal({ tx, onSuccess, onCancel }) {
  const [phase, setPhase] = useState('waiting') // waiting | confirmed

  React.useEffect(() => {
    const t = setTimeout(() => setPhase('confirmed'), 3200)
    return () => clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (phase === 'confirmed') {
      const t = setTimeout(onSuccess, 800)
      return () => clearTimeout(t)
    }
  }, [phase, onSuccess])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,14,17,.92)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-2xl p-8 w-full max-w-sm text-center animate-scale-in">

        {/* Hardware device illustration */}
        <div className="relative inline-block mb-6">
          {/* Pulse rings */}
          {phase === 'waiting' && (
            <>
              <div className="absolute inset-[-12px] rounded-2xl border-2 border-neon-green/20 animate-ping" />
              <div className="absolute inset-[-6px] rounded-2xl border border-neon-green/30" />
            </>
          )}
          {/* Device body */}
          <div className="device-body w-32 h-20 flex flex-col items-center justify-center gap-2 relative">
            {/* Screen */}
            <div className="device-screen w-24 h-10 flex items-center justify-center">
              {phase === 'waiting' ? (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                <CheckCircle size={18} className="text-neon-green" />
              )}
            </div>
            {/* Buttons */}
            <div className="flex gap-3">
              <div className="device-btn w-4 h-4" />
              <div className="device-btn w-4 h-4" />
            </div>
          </div>
        </div>

        {phase === 'waiting' ? (
          <>
            <h3 className="text-lg font-bold text-white mb-2">Confirm on Device</h3>
            <p className="text-sm text-gray-400 mb-5">
              Review and approve the transaction on your <span className="text-white font-semibold">CoreCold</span> device.
            </p>
            {/* TX summary */}
            <div className="glass-dark rounded-xl p-3 mb-5 text-left space-y-2">
              <Row label="Send"    value={`${tx.amount} ${tx.asset}`} />
              <Row label="To"      value={`${tx.to.slice(0, 12)}…${tx.to.slice(-6)}`} mono />
              <Row label="Fee"     value={`~$${tx.feeUSD}`} />
              <Row label="Network" value={tx.network} />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
              <Loader size={13} className="animate-spin text-neon-green" />
              Waiting for device confirmation…
            </div>
            <button onClick={onCancel}
              className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1 mx-auto">
              <X size={12} /> Cancel
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-neon-green/10 border-2 border-neon-green/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-neon-green" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Transaction Confirmed!</h3>
            <p className="text-sm text-gray-400">Broadcasting to network…</p>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs text-white ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

/* ── QR Scanner Modal (placeholder camera view) ───────
   Mobile-only entry point. Real camera/QR decoding is not wired up yet —
   this renders a viewfinder placeholder so the flow is testable. */
function ScannerModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,14,17,.92)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-2xl p-6 w-full max-w-sm text-center animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <QrCode size={16} className="text-neon-green" /> Scan QR Code
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Camera viewfinder placeholder */}
        <div className="relative aspect-square rounded-xl overflow-hidden bg-dark-300/60 border border-white/8 flex items-center justify-center">
          {/* Corner brackets */}
          <div className="absolute inset-6 rounded-lg">
            <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-neon-green/70 rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-neon-green/70 rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-neon-green/70 rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-neon-green/70 rounded-br-lg" />
          </div>
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Camera size={28} className="text-gray-600" />
            <p className="text-xs">Camera preview</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Point your camera at a wallet QR code to autofill the recipient address.
        </p>
      </div>
    </div>
  )
}

/* ── Main Send Form ────────────────────────────────── */
export default function SendForm() {
  const { assets, sendCrypto, user } = useApp()
  const [step, setStep]        = useState('form')
  const [form, setForm]        = useState({ assetId: 'btc', to: '', amount: '', feeLevel: 'Medium' })
  const [error, setError]      = useState('')
  const [showScanner, setShowScanner] = useState(false)

  // Withdrawal block: when blocked, the user cannot start a Send. We show the
  // admin's exact custom message (or an English fallback) and disable the form.
  const withdrawalsBlocked = !!user?.withdrawalsBlocked
  const blockMessage = user?.withdrawalBlockMessage || DEFAULT_WITHDRAWAL_BLOCK_MESSAGE

  const asset   = assets.find(a => a.id === form.assetId)
  const fees    = NETWORK_FEES[form.assetId] || NETWORK_FEES.btc
  const selFee  = fees[form.feeLevel]
  const amtNum  = parseFloat(form.amount) || 0
  const usdVal  = amtNum * (asset?.price || 0)
  const maxAmt  = asset?.balance || 0

  const isValidAddr = form.to.length >= 26

  const validate = () => {
    if (!form.to.trim())          return 'Recipient address is required.'
    if (!isValidAddr)             return 'Address appears invalid (too short).'
    if (!form.amount || amtNum <= 0) return 'Enter a valid amount.'
    if (amtNum > maxAmt)          return `Insufficient balance. Max: ${maxAmt.toFixed(6)} ${asset?.symbol}`
    return ''
  }

  const handleReview = (e) => {
    e.preventDefault()
    if (withdrawalsBlocked) { setError(blockMessage); return }
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setStep('review')
  }

  const handleConfirm = () => setStep('device')

  const handleSuccess = async () => {
    try {
      await sendCrypto({ assetId: form.assetId, to: form.to, amount: form.amount, fee: selFee.fee })
      setStep('success')
    } catch (err) {
      // Surface the backend's real reason and return to the form (no false success).
      setError(err.message || 'Transaction failed. Please try again.')
      setStep('form')
    }
  }

  const handleReset = () => {
    setForm({ assetId: 'btc', to: '', amount: '', feeLevel: 'Medium' })
    setError('')
    setStep('form')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <Send size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Send Crypto</h2>
            <p className="text-xs text-gray-500">Transfer to any address</p>
          </div>
        </div>

        {/* ── Form ── */}
        {step === 'form' && (
          <form onSubmit={handleReview} className="p-6 space-y-5">
            {/* Withdrawal block notice — shows the admin's exact custom message. */}
            {withdrawalsBlocked && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-neon-red/10 border border-neon-red/30 text-sm">
                <AlertCircle size={16} className="text-neon-red shrink-0 mt-0.5" />
                <div>
                  <p className="text-neon-red font-semibold mb-0.5">Withdrawals disabled</p>
                  <p className="text-gray-300 leading-relaxed">{blockMessage}</p>
                </div>
              </div>
            )}

            {error && !withdrawalsBlocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            {/* Asset selector */}
            <div>
              <label className="label-xs">Asset</label>
              <div className="relative mt-1.5">
                <select
                  className="wallet-input appearance-none pr-10 cursor-pointer"
                  value={form.assetId}
                  onChange={e => setForm(p => ({ ...p, assetId: e.target.value, amount: '' }))}
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#1E2329' }}>
                      {a.name} ({a.symbol}) — Balance: {a.balance.toFixed(4)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-600 mt-1 font-mono">
                Available: {maxAmt.toFixed(6)} {asset?.symbol} ≈ ${(maxAmt * (asset?.price||0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>

            {/* Recipient */}
            <div>
              <label className="label-xs">Recipient Address</label>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className={`wallet-input font-mono text-xs pr-10 ${form.to && !isValidAddr ? 'border-neon-red/50' : ''}`}
                    placeholder={asset?.id === 'btc' ? '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' : '0x71C7656EC7ab88b098de…'}
                    value={form.to}
                    onChange={e => setForm(p => ({ ...p, to: e.target.value }))}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {form.to && (
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${isValidAddr ? 'text-neon-green' : 'text-neon-red'}`}>
                      {isValidAddr ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    </div>
                  )}
                </div>
                {/* TEMP: forced always-visible for desktop mobile-preview.
                    Restore `md:hidden` (drop the leading `flex`) to make this
                    mobile-only again. */}
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  aria-label="Scan QR code"
                  title="Scan QR code"
                  className="flex shrink-0 w-11 h-11 items-center justify-center rounded-xl border border-white/10 bg-dark-300/60 text-gray-300 hover:text-neon-green hover:border-neon-green/40 active:scale-95 transition-all"
                >
                  <QrCode size={18} />
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-xs">Amount</label>
                <button type="button" className="text-xs text-neon-green hover:underline"
                  onClick={() => setForm(p => ({ ...p, amount: (maxAmt - selFee.fee).toFixed(6) }))}>
                  Max
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  className="wallet-input pr-20 font-num"
                  placeholder="0.00000000"
                  step="any" min="0"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">{asset?.symbol}</span>
              </div>
              {amtNum > 0 && (
                <p className="text-xs text-gray-500 mt-1 font-num">
                  ≈ ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </p>
              )}
            </div>

            {/* Network fee */}
            <div>
              <label className="label-xs mb-1.5 block">Network Fee</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Low', 'Medium', 'High']).map(lvl => {
                  const f = fees[lvl]
                  return (
                    <button type="button" key={lvl} onClick={() => setForm(p => ({ ...p, feeLevel: lvl }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.feeLevel === lvl
                          ? 'border-neon-green/40 bg-neon-green/10'
                          : 'border-white/8 bg-dark-300/40 hover:border-white/15'
                      }`}>
                      <p className={`text-xs font-semibold mb-0.5 ${form.feeLevel === lvl ? 'text-neon-green' : 'text-white'}`}>{lvl}</p>
                      <p className="text-xs text-gray-500 font-num">${f.usd}</p>
                      <p className="text-xs text-gray-600">{f.time}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <button type="submit" disabled={withdrawalsBlocked}
              className="btn-primary w-full h-12 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {withdrawalsBlocked ? 'Withdrawals Disabled' : <>Review Transaction <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-400">Review your transaction before confirming on device.</p>
            <div className="space-y-2 glass-dark rounded-xl p-4">
              <ReviewRow label="Asset"      value={`${asset?.name} (${asset?.symbol})`} />
              <ReviewRow label="Amount"     value={`${form.amount} ${asset?.symbol}`} highlight />
              <ReviewRow label="USD Value"  value={`$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              <ReviewRow label="Recipient"  value={form.to} mono />
              <ReviewRow label="Network"    value={asset?.network} />
              <ReviewRow label="Fee"        value={`${selFee.fee} ${asset?.symbol} (~$${selFee.usd}) · ${selFee.time}`} />
              <div className="divider" />
              <ReviewRow label="Total"
                value={`${(amtNum + selFee.fee).toFixed(6)} ${asset?.symbol}`}
                highlight />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-neon-amber/8 border border-neon-amber/20 text-xs text-neon-amber">
              <Info size={14} className="shrink-0 mt-0.5" />
              Transactions on blockchain are irreversible. Double-check the recipient address.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('form')} className="btn-ghost flex-1 h-11 flex items-center justify-center gap-2">
                ← Back
              </button>
              <button onClick={handleConfirm} className="btn-green flex-1 h-11 flex items-center justify-center gap-2">
                <Cpu size={15} /> Confirm on Device
              </button>
            </div>
          </div>
        )}

        {/* ── Success (submitted → pending approval) ── */}
        {step === 'success' && (
          <div className="p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-neon-amber/10 border-2 border-neon-amber/40 flex items-center justify-center mx-auto mb-4">
              <Clock size={34} className="text-neon-amber" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Transaction Submitted!</h3>
            <p className="text-sm text-gray-400 mb-2">
              Your transfer is <span className="text-neon-amber font-semibold">pending approval</span>. Funds remain in your
              balance until it’s approved.
            </p>
            <p className="text-xs text-gray-600 font-mono mb-6">
              {form.amount} {asset?.symbol} → {form.to.slice(0, 14)}…{form.to.slice(-6)}
            </p>
            <button onClick={handleReset} className="btn-primary px-8 h-11">
              New Transaction
            </button>
          </div>
        )}
      </div>

      {/* QR scanner overlay (mobile) */}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} />}

      {/* Device modal overlay */}
      {step === 'device' && (
        <DeviceModal
          tx={{ amount: form.amount, asset: asset?.symbol, to: form.to, feeUSD: selFee.usd, network: asset?.network }}
          onSuccess={handleSuccess}
          onCancel={() => setStep('review')}
        />
      )}
    </div>
  )
}

/* Label helper */
function ReviewRow({ label, value, highlight, mono }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-500 shrink-0 w-24">{label}</span>
      <span className={`text-xs text-right break-all ${highlight ? 'text-white font-bold' : mono ? 'text-gray-300 font-mono' : 'text-gray-300'}`}>
        {value}
      </span>
    </div>
  )
}
