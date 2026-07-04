import React, { useState } from 'react'
import { ShieldCheck, KeyRound, Eye, EyeOff, Check, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

/* Admin → Settings: account security (change password).
   Posts to the admin-gated /api/admin/change-password route. */
export default function AdminSettings() {
  const { user, showToast } = useApp()
  const [cur, setCur] = useState('')
  const [nw, setNw]   = useState('')
  const [cf, setCf]   = useState('')
  const [show, setShow] = useState({ cur: false, nw: false, cf: false })
  const [saving, setSaving] = useState(false)

  const toggle = (k) => setShow(s => ({ ...s, [k]: !s[k] }))

  const submit = async (e) => {
    e.preventDefault()
    if (!cur || !nw || !cf) return showToast('Fill in all password fields.', 'error')
    if (nw.length < 8)      return showToast('New password must be at least 8 characters.', 'error')
    if (nw !== cf)          return showToast('New passwords do not match.', 'error')
    if (nw === cur)         return showToast('New password must be different from the current one.', 'error')

    setSaving(true)
    try {
      await api.adminChangePassword(cur, nw)
      showToast('Admin password updated successfully.', 'success')
      setCur(''); setNw(''); setCf('')
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="cyber-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <ShieldCheck size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Account Security</h2>
            <p className="text-xs text-gray-500">Change the password for {user?.email || 'your admin account'}</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-5 sm:p-6 space-y-4">
          <PasswordField label="Current Password" value={cur} onChange={setCur}
            visible={show.cur} onToggle={() => toggle('cur')} autoComplete="current-password" />
          <PasswordField label="New Password" value={nw} onChange={setNw}
            visible={show.nw} onToggle={() => toggle('nw')} autoComplete="new-password"
            hint="At least 8 characters." />
          <PasswordField label="Confirm New Password" value={cf} onChange={setCf}
            visible={show.cf} onToggle={() => toggle('cf')} autoComplete="new-password" />

          <button type="submit" disabled={saving}
            className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <><KeyRound size={15} className="animate-pulse" /> Updating…</> : <><Check size={16} /> Update Password</>}
          </button>

          <p className="flex items-center gap-1.5 text-[11px] text-gray-600 pt-1">
            <Lock size={11} /> Verified against your current password and stored as a bcrypt hash.
          </p>
        </form>
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete, hint }) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="wallet-input h-11 pr-10 text-sm"
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  )
}
