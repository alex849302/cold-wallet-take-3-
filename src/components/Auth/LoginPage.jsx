import React, { useState } from 'react'
import { Lock, Eye, EyeOff, Cpu, AlertCircle, ArrowRight, ShieldCheck, Layers, KeyRound } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { navigateTo } from '../../lib/router'

/* Map auth error codes to readable messages */
function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}

/* ── Left branding / system-stats panel ─────────────────── */
function BrandPanel() {
  const features = [
    { icon: Layers,      title: 'Multi-Chain Vault', desc: 'BTC · ETH · SOL · TRON in one wallet' },
    { icon: KeyRound,    title: 'Non-Custodial',     desc: 'Only you ever hold the keys' },
    { icon: ShieldCheck, title: 'On-Device Signing', desc: 'Every transfer verified offline' },
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
          Institutional-grade cold storage. Keys never leave the vault — every signature is verified on-device.
        </p>
      </div>

      <div className="relative space-y-3 mt-10">
        {features.map(f => (
          <div key={f.title} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-black/20 backdrop-blur-sm">
            <span className="w-9 h-9 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
              <f.icon size={16} className="text-neon-green" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-none">{f.title}</p>
              <p className="text-xs text-zinc-400 mt-1">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { navigate } = useApp()
  const { login } = useAuth()
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [show,    setShow]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
    } catch (err) {
      setError(err.message || friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen tech-grid flex items-center justify-center relative overflow-hidden p-4">
      {/* Ambient corner glows bleeding in */}
      <div className="absolute top-[-15%] left-[-10%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.16) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-18%] right-[-10%] w-[30rem] h-[30rem] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.10) 0%, transparent 70%)' }} />

      {/* Split-screen card */}
      <div className="relative w-full max-w-4xl grid lg:grid-cols-2 rounded-3xl overflow-hidden cyber-card glow-emerald-strong animate-scale-in">
        <BrandPanel />

        {/* Right: minimalist login fields */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center glow-emerald"
                 style={{ background: 'linear-gradient(135deg, #00E67622, #00E67644)', border: '1px solid rgba(0,230,118,.3)' }}>
              <Cpu size={22} className="text-neon-green" />
            </div>
            <h1 className="text-2xl font-black text-white">Core<span className="text-gradient-green">Cold</span></h1>
          </div>

          <p className="readout-label mb-1">Secure Access</p>
          <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-zinc-400 text-sm mb-7">Authenticate to unlock your vault.</p>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="readout-label">Email</label>
              <input
                type="email"
                className="input-line mt-1"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="readout-label">Password</label>
                <button type="button" onClick={() => navigate('forgot')}
                  className="text-xs text-neon-green hover:underline font-medium">Forgot?</button>
              </div>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input-line mt-1 pr-10"
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 h-12 glow-emerald disabled:opacity-60"
            >
              {loading
                ? <><Cpu size={16} className="animate-spin" /> Authenticating…</>
                : <>Unlock Wallet <ArrowRight size={16} /></>
              }
            </button>
          </form>

          <div className="divider my-6" />

          <p className="text-center text-sm text-gray-500">
            New here?{' '}
            <button onClick={() => navigate('register')} className="text-neon-green hover:underline font-medium">
              Create a wallet
            </button>
          </p>

          <div className="flex items-center justify-between mt-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><Lock size={12} /> 256-bit AES · Secure Enclave</span>
            <button onClick={() => navigateTo('/admin')}
              className="hover:text-neon-green transition-colors inline-flex items-center gap-1">
              <Cpu size={11} /> Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
