import React, { useState } from 'react'
import { Cpu, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { navigateTo } from '../../lib/router'
import { api } from '../../lib/api'

export default function ResetPasswordPage() {
  const { navigate, showToast } = useApp()
  // The token arrives as ?token=… in the emailed reset link.
  const token = new URLSearchParams(window.location.search).get('token') || ''

  const [form,    setForm]    = useState({ password: '', confirm: '' })
  const [show,    setShow]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const goToLogin = () => { navigate('login'); navigateTo('/') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await api.resetPassword(token, form.password)
      setDone(true)
      showToast('Password updated — you can sign in now.', 'success')
    } catch (err) {
      setError(err.message || 'Could not reset your password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-400 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.10) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-15%] right-[-8%] w-80 h-80 rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(0,230,118,.06) 0%, transparent 70%)' }} />

      <div className="w-full max-w-md px-4 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 glow-green"
               style={{ background: 'linear-gradient(135deg, #00E67622, #00E67644)', border: '1px solid rgba(0,230,118,.3)' }}>
            <Cpu size={32} className="text-neon-green" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Core<span className="text-gradient-green">Cold</span></h1>
          <p className="text-sm text-zinc-400">Secure Cold Wallet · v2.4.1</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-neon-green/10 border-2 border-neon-green/40 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={30} className="text-neon-green" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password updated</h2>
              <p className="text-sm text-zinc-400 mb-6">Your password has been changed. Sign in with your new password.</p>
              <button onClick={goToLogin} className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                Go to Sign in <ArrowRight size={16} />
              </button>
            </div>
          ) : !token ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-neon-red/10 border-2 border-neon-red/30 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-neon-red" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Invalid reset link</h2>
              <p className="text-sm text-zinc-400 mb-6">This link is missing its token. Request a new password-reset email.</p>
              <button onClick={goToLogin} className="btn-primary w-full h-12">Back to Sign in</button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Set a new password</h2>
              <p className="text-zinc-400 text-sm mb-6">Choose a strong password for your CoreCold wallet.</p>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
                  <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      className="wallet-input pr-12"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      required
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShow(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                  <input
                    type={show ? 'text' : 'password'}
                    className="wallet-input"
                    placeholder="Re-enter password"
                    value={form.confirm}
                    onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 h-12 mt-2 disabled:opacity-60">
                  {loading
                    ? <><Cpu size={16} className="animate-spin" /> Updating…</>
                    : <>Update Password <ArrowRight size={16} /></>
                  }
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-600">
          <Lock size={12} />
          256-bit AES · Secure Enclave
        </div>
      </div>
    </div>
  )
}
