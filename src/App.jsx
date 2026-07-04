import React from 'react'
import { Cpu, ShieldAlert, ArrowLeft } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useApp }  from './context/AppContext'
import { useRoutePath, navigateTo } from './lib/router'
import LoginPage     from './components/Auth/LoginPage'
import RegisterPage  from './components/Auth/RegisterPage'
import ForgotPasswordPage from './components/Auth/ForgotPasswordPage'
import ResetPasswordPage from './components/Auth/ResetPasswordPage'
import UserDashboard from './components/User/UserDashboard'
import AdminDashboard from './components/Admin/AdminDashboard'
import { AdminNotificationProvider } from './context/AdminNotificationContext'
import Toast         from './components/common/Toast'
import ThemeToggle    from './components/common/ThemeToggle'
import NotificationToasts from './components/Notifications/NotificationToasts'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-400 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center glow-green"
          style={{ background: 'linear-gradient(135deg, #00E67622, #00E67644)', border: '1px solid rgba(0,230,118,.3)' }}>
          <Cpu size={28} className="text-neon-green" />
        </div>
        <div className="w-7 h-7 rounded-full border-2 border-neon-green/25 border-t-neon-green animate-spin" />
        <p className="text-xs text-gray-600 font-mono tracking-widest uppercase">Initializing CoreCold…</p>
      </div>
    </div>
  )
}

/* Shown when a non-admin tries to open /admin. */
function AccessDenied() {
  return (
    <div className="min-h-screen bg-dark-400 flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-neon-red/10 border border-neon-red/30 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert size={30} className="text-neon-red" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Admin access required</h1>
        <p className="text-sm text-gray-400 mb-6">
          This account doesn’t have permission to view the admin console.
        </p>
        <button onClick={() => navigateTo('/')} className="btn-primary w-full h-11 flex items-center justify-center gap-2">
          <ArrowLeft size={16} /> Back to Wallet
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading, isAdmin } = useAuth()
  const { currentPage, toasts, dismissToast } = useApp()
  const path = useRoutePath()
  const isAdminRoute = path.startsWith('/admin')
  const isResetRoute = path.startsWith('/reset-password')

  let content
  // Dashboards carry their own header (with a theme toggle); the other screens
  // get a floating toggle so light/dark works everywhere.
  let showFloatingToggle = true
  if (loading) {
    content = <LoadingScreen />
  } else if (isResetRoute) {
    // Public password-reset landing page (reached from the emailed link).
    content = <ResetPasswordPage />
  } else if (isAdminRoute) {
    // Dedicated /admin route — guarded.
    if (!user)        content = currentPage === 'register' ? <RegisterPage /> : currentPage === 'forgot' ? <ForgotPasswordPage /> : <LoginPage />
    else if (!isAdmin) content = <AccessDenied />
    else             { content = <AdminNotificationProvider><AdminDashboard /></AdminNotificationProvider>; showFloatingToggle = false }
  } else if (!user) {
    content = currentPage === 'register' ? <RegisterPage /> : currentPage === 'forgot' ? <ForgotPasswordPage /> : <LoginPage />
  } else if (isAdmin) {
    // Admins land on the console even at the root path.
    content = <AdminNotificationProvider><AdminDashboard /></AdminNotificationProvider>
    showFloatingToggle = false
  } else {
    content = <UserDashboard />
    showFloatingToggle = false
  }

  return (
    <>
      {content}
      {showFloatingToggle && <ThemeToggle floating />}
      {/* Real-time notification pop-ups (top-right) */}
      <NotificationToasts />
      {/* Action toasts (bottom-right) */}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </>
  )
}
