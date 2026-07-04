import React, { useState } from 'react'
import {
  Cpu, Eye, EyeOff, Copy, Check,
  AlertCircle, ArrowRight, Lock, ShieldCheck, KeyRound, Layers
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'

/* ── Step indicator ─────────────────────────────────── */
const STEPS = ['Account', 'Recovery Phrase', 'Complete']

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current   ? 'bg-neon-green text-dark-400' :
              i === current ? 'bg-neon-green text-dark-400 ring-2 ring-neon-green/30' :
                              'bg-dark-50 text-gray-600'
            }`}>
              {i < current ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === current ? 'text-white' : 'text-gray-600'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px max-w-12 transition-all duration-500 ${i < current ? 'bg-neon-green' : 'bg-dark-50'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

/* ── Left branding / system-stats panel ─────────────────── */
function BrandPanel() {
  const stats = [
    { icon: KeyRound,    label: 'Key Standard', value: 'BIP-39 · HD' },
    { icon: ShieldCheck, label: 'Custody',      value: 'Non-custodial' },
    { icon: Layers,      label: 'Chains',       value: 'BTC·ETH·SOL·TRX' },
  ]
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden"
         style={{ background: 'linear-gradient(160deg, rgba(0,230,118,.10), rgba(8,9,10,.2))' }}>
      <div className="absolute inset-0 tech-dots opacity-40 pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 glow-emerald-strong"
             style={{ background: 'linear-gradient(135deg, #00E67622, #00E67644)', border: '1px solid rgba(0,230,118,.3)' }}>
          <Cpu size={28} className="text-neon-green" />
        </div>
        <h1 className="text-4xl font-black text-white leading-tight">Core<span className="text-gradient-green">Cold</span></h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-xs leading-relaxed">
          Generate a real, self-custodied hardware-grade wallet in seconds. Your seed phrase never touches our servers.
        </p>
      </div>
      <div className="relative space-y-3 mt-10">
        {stats.map(s => (
          <div key={s.label} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 bg-black/20 backdrop-blur-sm">
            <span className="flex items-center gap-2 readout-label">
              <s.icon size={13} className="text-neon-green" /> {s.label}
            </span>
            <span className="font-mono text-xs text-emerald-400">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Map auth error codes to readable messages */
function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/invalid-email':        return 'Please enter a valid email address.'
    case 'auth/weak-password':        return 'Password must be at least 6 characters.'
    default: return 'Account creation failed. Please try again.'
  }
}

/* ── Main component ──────────────────────────────────── */
export default function RegisterPage() {
  const { navigate } = useApp()
  const { register, activateSession } = useAuth()

  const [step,       setStep]       = useState(0)
  const [phrase,     setPhrase]     = useState([])
  const [copied,     setCopied]     = useState(false)
  const [pending,    setPending]    = useState(null) // { token, user } until entered
  const [showPass,   setShowPass]   = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form,       setForm]       = useState({ name: '', email: '', password: '', confirm: '' })
  const [formError,  setFormError]  = useState('')

  /* ── Step 0: form submit — create the real wallet, get its mnemonic ── */
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (form.password.length < 8) return setFormError('Password must be at least 8 characters.')
    if (form.password !== form.confirm) return setFormError('Passwords do not match.')
    setStep(1)
    try {
      const { token, user, mnemonic } = await register({
        name: form.name, email: form.email, password: form.password,
      })
      const words = String(mnemonic || '').trim().split(/\s+/).filter(Boolean)
      setPhrase(words)
      setPending({ token, user })
      setStep(2)
    } catch (err) {
      setFormError(err.message || friendlyError(err.code))
      setStep(0)
    }
  }

  /* ── Copy phrase ── */
  const handleCopy = () => {
    navigator.clipboard.writeText(phrase.join(' ')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  /* ── Final action: enter the wallet (account already created at step 0) ── */
  const handleEnterWallet = () => {
    setSubmitting(true)
    setStep(3)
    setTimeout(() => {
      if (pending) activateSession(pending.token, pending.user)
    }, 900)
  }

  const stepBarIndex = step === 0 ? 0 : (step === 1 || step === 2) ? 1 : 2

  return (
    <div className="min-h-screen tech-grid flex items-center justify-center relative overflow-hidden p-4">
      {/* Ambient corner glows */}
      <div className="absolute top-[-15%] right-[-10%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.16) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-18%] left-[-10%] w-[30rem] h-[30rem] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.10) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-4xl grid lg:grid-cols-2 rounded-3xl overflow-hidden cyber-card glow-emerald-strong animate-scale-in">
        <BrandPanel />

        {/* Right: the flow */}
        <div className="p-8 sm:p-10 overflow-y-auto max-h-[94vh]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center glow-emerald"
                 style={{ background: 'linear-gradient(135deg, #00E67622, #00E67644)', border: '1px solid rgba(0,230,118,.3)' }}>
              <Cpu size={22} className="text-neon-green" />
            </div>
            <h1 className="text-2xl font-black text-white">Core<span className="text-gradient-green">Cold</span></h1>
          </div>

          <StepBar current={stepBarIndex} />

          {/* ── Step 0: Registration form ── */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
              <p className="text-sm text-gray-500 mb-6">Your account is secured with encrypted local storage.</p>

              {formError && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div>
                  <label className="readout-label">Full Name</label>
                  <input type="text" className="input-line mt-1" placeholder="Alex Carter"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="readout-label">Email</label>
                  <input type="email" className="input-line mt-1" placeholder="you@example.com"
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                </div>
                <div>
                  <label className="readout-label">Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input-line mt-1 pr-10" placeholder="Min. 8 characters"
                      value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="readout-label">Confirm Password</label>
                  <div className="relative">
                    <input type={showConf ? 'text' : 'password'} className="input-line mt-1 pr-10" placeholder="Re-enter password"
                      value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
                    <button type="button" onClick={() => setShowConf(s => !s)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full h-12 flex items-center justify-center gap-2 mt-2 glow-emerald">
                  Continue <ArrowRight size={16} />
                </button>
              </form>

              <div className="divider my-5" />
              <p className="text-center text-sm text-gray-500">
                Already have a wallet?{' '}
                <button onClick={() => navigate('login')} className="text-neon-green hover:underline font-medium">Sign in</button>
              </p>
            </div>
          )}

          {/* ── Step 1: Generating animation ── */}
          {step === 1 && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                   style={{ background: 'rgba(0,230,118,.08)', border: '2px solid rgba(0,230,118,.25)' }}>
                <Cpu size={36} className="text-neon-green animate-spin-slow" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">Generating Recovery Phrase</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                Using cryptographically secure entropy to generate your unique 12-word BIP-39 seed phrase…
              </p>
              <div className="flex flex-col gap-2 max-w-64 mx-auto">
                {['Collecting entropy sources', 'Applying BIP-39 derivation', 'Finalizing secure phrase'].map((label, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-4 h-4 rounded-full animate-pulse"
                         style={{ background: 'rgba(0,230,118,.4)', animationDelay: `${i * 0.5}s` }} />
                    <span className="text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Show phrase → enter wallet directly (no verification) ── */}
          {step === 2 && (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Your Recovery Phrase</h2>
                  <p className="text-xs text-gray-500 max-w-sm">
                    Write these 12 words on paper and store them offline.{' '}
                    <strong className="text-neon-red">Never share them.</strong>
                  </p>
                </div>
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    copied ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}>
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy All</>}
                </button>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-amber/8 border border-neon-amber/20 mb-5 text-xs text-neon-amber">
                <AlertCircle size={14} className="shrink-0" />
                Store this phrase somewhere safe before continuing. It cannot be recovered later.
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {phrase.map((word, i) => (
                  <div key={i} className="phrase-word">
                    <span className="num">{i + 1}.</span>
                    <span className="word">{word}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleEnterWallet} disabled={submitting}
                className="btn-primary w-full h-12 flex items-center justify-center gap-2 glow-emerald disabled:opacity-60">
                I've saved it — Enter Wallet <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 3: Success / entering ── */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 glow-emerald-strong"
                   style={{ background: 'rgba(0,230,118,.12)', border: '2px solid rgba(0,230,118,.4)' }}>
                <ShieldCheck size={36} className="text-neon-green" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Wallet Created!</h2>
              <p className="text-gray-400 text-sm">Signing you in and opening your dashboard…</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-600">
            <Lock size={12} />
            BIP-39 · Non-custodial
          </div>
        </div>
      </div>
    </div>
  )
}
