import React, { useState } from 'react'
import {
  Cpu, LayoutDashboard, Clock, MessagesSquare, LogOut,
  Menu, X, Users, Activity, ArrowUpRight, Settings
} from 'lucide-react'
import { useUsers } from '../../context/UsersContext'
import { useSupport } from '../../context/SupportContext'
import { useTransactions } from '../../context/TransactionsContext'
import { useApp } from '../../context/AppContext'
import { useAdminNotifications } from '../../context/AdminNotificationContext'
import NotificationBell from '../Notifications/NotificationBell'
import NotificationToasts from '../Notifications/NotificationToasts'
import NodeMonitor from '../common/NodeMonitor'
import TransactionManagement from './TransactionManagement'
import AllTransactions from './AllTransactions'
import UserManagement from './UserManagement'
import SupportDesk from './SupportDesk'
import OnchainBalanceChecker from './OnchainBalanceChecker'
import ChainDiagnostics from './ChainDiagnostics'
import AdminSettings from './AdminSettings'

const NAV = [
  { id: 'users',        label: 'User Management', icon: Users },
  { id: 'transactions', label: 'Transactions',   icon: Clock },
  { id: 'chain',        label: 'Chain Tools',     icon: Activity },
  { id: 'support',      label: 'Support Desk',    icon: MessagesSquare },
  { id: 'settings',     label: 'Settings',        icon: Settings },
]

const SECTION_TITLES = {
  transactions: 'Transaction Management',
  users:        'User Management',
  chain:        'On-Chain Tools',
  support:      'Support Desk',
  settings:     'Settings',
}

export default function AdminDashboard() {
  // Everything is now API-backed.
  const { users } = useUsers()
  const { threads, pendingReplyCount } = useSupport()
  const { transactions, pendingTransactions } = useTransactions()
  const { user, logout } = useApp()
  const adminNotif = useAdminNotifications()
  const { section, setSection } = adminNotif   // admin nav lives in the notification context
  const [drawerOpen, setDrawerOpen] = useState(false)

  const go = (id) => { setSection(id); setDrawerOpen(false) }

  const stats = [
    { label: 'Total Users',       value: users.length,                 icon: Users,    color: 'text-neon-teal',  bg: 'bg-neon-teal/10' },
    { label: 'Pending Approvals', value: pendingTransactions.length,   icon: Clock,    color: 'text-neon-amber', bg: 'bg-neon-amber/10' },
    { label: 'Transactions',      value: transactions.length,          icon: Activity, color: 'text-neon-green', bg: 'bg-neon-green/10' },
    { label: 'Open Chats',        value: threads.length,               icon: MessagesSquare, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
  ]

  return (
    <div className="flex h-screen bg-dark-400 overflow-hidden">
      {/* Real-time admin pop-up toasts (top-right) */}
      <NotificationToasts controller={adminNotif} />

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Sidebar / drawer ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-72 lg:w-64 shrink-0 h-screen
          transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: '#12161A', borderRight: '1px solid rgba(255,255,255,.05)' }}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-green shrink-0"
               style={{ background: 'linear-gradient(135deg, #00E67633, #00E67655)', border: '1px solid rgba(0,230,118,.35)' }}>
            <Cpu size={18} className="text-neon-green" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white leading-none">CoreCold</p>
            <p className="text-xs text-neon-amber font-mono mt-0.5">Admin Console</p>
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Admin chip */}
        <div className="mx-3 mb-4 px-3 py-2.5 rounded-xl glass-light flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-400 shrink-0"
               style={{ background: 'linear-gradient(135deg, #FFB300, #FF8F00)' }}>
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = section === id
            return (
              <button key={id} onClick={() => go(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'nav-active text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
                <Icon size={16} className={active ? 'text-neon-green' : 'text-gray-500'} />
                {label}
                {id === 'transactions' && pendingTransactions.length > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-md bg-neon-amber/20 text-neon-amber font-semibold">
                    {pendingTransactions.length}
                  </span>
                )}
                {id === 'support' && pendingReplyCount > 0 && (
                  <span className="ml-auto relative flex items-center" title={`${pendingReplyCount} ticket${pendingReplyCount === 1 ? '' : 's'} awaiting reply`}>
                    <span className="absolute inline-flex w-full h-full rounded-full bg-neon-red opacity-60 animate-ping" />
                    <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-neon-red text-white text-[10px] font-bold leading-none">
                      {pendingReplyCount > 9 ? '9+' : pendingReplyCount}
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 pb-4 space-y-1">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-neon-red/8 hover:text-neon-red transition-all">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3"
          style={{ background: 'rgba(18,22,26,.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <button onClick={() => setDrawerOpen(o => !o)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 shrink-0">
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <Cpu size={15} className="text-neon-green" />
            <span className="text-sm font-bold text-white">Admin</span>
          </div>
          <h2 className="hidden lg:block text-sm font-semibold text-white">
            {SECTION_TITLES[section]}
          </h2>
          <div className="flex-1" />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-xs text-neon-amber">
            <Cpu size={11} /> Admin Mode
          </span>
          {/* Notification bell + dropdown (admin alerts) */}
          <NotificationBell controller={adminNotif} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="page-enter max-w-6xl mx-auto space-y-6">
            {/* Asymmetric overview — Hero System Banner + Live Node Monitor.
                Only on the Transactions overview; other sections start clean. */}
            {section === 'transactions' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                <div className="lg:col-span-2 cyber-card glow-emerald-strong rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 tech-dots opacity-30 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="readout-label">System Status</span>
                      <span className="flex items-center gap-1 readout-label text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> OPERATIONAL
                      </span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black font-mono text-white leading-none tracking-tight">
                      CoreCold <span className="text-emerald-400">Admin</span>
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-2">Control plane · all services nominal</p>

                    <div className="h-px my-5 bg-gradient-to-r from-neon-green/30 via-white/8 to-transparent" />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {stats.map(s => (
                        <div key={s.label} className="flex items-center gap-2.5">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                            <s.icon size={16} className={s.color} />
                          </span>
                          <div className="min-w-0">
                            <p className="readout-label truncate">{s.label}</p>
                            <p className="text-lg font-bold font-mono text-white leading-none mt-0.5">{s.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1"><NodeMonitor /></div>
              </div>
            )}

            {/* Active section */}
            {section === 'transactions' && (
              <>
                <TransactionManagement />
                <AllTransactions />
              </>
            )}
            {section === 'users'        && <UserManagement />}
            {section === 'chain'        && <><ChainDiagnostics /><OnchainBalanceChecker /></>}
            {section === 'support'      && <SupportDesk />}
            {section === 'settings'     && <AdminSettings />}
          </div>
        </main>
      </div>
    </div>
  )
}
