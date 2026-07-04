import React, { useState } from 'react'
import { Cpu, Mail, AlertCircle, ArrowRight, ArrowLeft, CheckCircle, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function ForgotPasswordPage() {
  const { navigate, showToast } = useApp()
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(email.trim())
      setSent(true)
      showToast('Reset link sent to your email!', 'success')
    } catch (err) {
      setError(err.message || 'Could not send the reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-400 flex items-center justify-center relative overflow-hidden">
      {/* Ambient blobs */}
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

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-neon-green/10 border-2 border-neon-green/40 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={30} className="text-neon-green" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your inbox</h2>
              <p className="text-sm text-zinc-400 mb-6">
                If an account exists for <span className="text-white font-medium">{email}</span>, a password-reset
                link is on its way. The link expires in 1 hour.
              </p>
              <button onClick={() => navigate('login')}
                className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                <ArrowLeft size={16} /> Back to Sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Forgot password?</h2>
              <p className="text-zinc-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
                  <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type="email"
                      className="wallet-input !pl-11"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 h-12 mt-2 disabled:opacity-60"
                >
                  {loading
                    ? <><Cpu size={16} className="animate-spin" /> Sending…</>
                    : <>Send Reset Link <ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <div className="divider my-6" />

              <p className="text-center text-sm text-gray-500">
                Remembered it?{' '}
                <button onClick={() => navigate('login')} className="text-neon-green hover:underline font-medium">
                  Back to Sign in
                </button>
              </p>
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
