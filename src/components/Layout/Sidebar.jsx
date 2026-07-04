import React from 'react'
import {
  LayoutDashboard, Clock, Cpu, ChevronRight,
  Zap, LogOut, Settings, X, LifeBuoy
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupport } from '../../context/SupportContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',           icon: LayoutDashboard },
  { id: 'history',   label: 'Transaction History', icon: Clock           },
  { id: 'support',   label: 'Support',             icon: LifeBuoy        },
]

export default function Sidebar({ open, onClose }) {
  const { currentPage, navigate, user, logout } = useApp()
  // Real-time unread admin replies, read straight from the DB-backed support
  // thread (SupportContext polls every 2s), so the badge is global on every page.
  const { unreadCount: supportUnread } = useSupport()

  function goTo(id) {
    navigate(id)
    onClose()
  }

  return (
    <aside
      className={`
        app-sidebar
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col w-72 lg:w-64 shrink-0 h-screen overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo row + mobile close button */}
      <div className="flex items-center gap-3 px-5 py-5 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-green shrink-0"
             style={{ background: 'linear-gradient(135deg, #00E67633, #00E67655)', border: '1px solid rgba(0,230,118,.35)' }}>
          <Cpu size={18} className="text-neon-green" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white leading-none">CoreCold</p>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">Cold Wallet</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* User chip */}
      <div className="mx-3 mb-4 px-3 py-2.5 rounded-xl glass-light flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-400 shrink-0"
             style={{ background: 'linear-gradient(135deg, #00E676, #00BFA5)' }}>
          {user?.name?.charAt(0) || 'A'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{user?.name || 'Wallet User'}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
        </div>
        <Zap size={14} className="text-neon-green ml-auto shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id
          const unread = id === 'support' ? supportUnread : 0
          return (
            <button
              key={id}
              onClick={() => goTo(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'nav-active text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={16} className={active ? 'text-neon-green' : 'text-gray-500 group-hover:text-gray-300'} />
              {label}
              {unread > 0 ? (
                <span className="ml-auto relative flex items-center">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-neon-red opacity-60 animate-ping" />
                  <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-neon-red text-white text-[10px] font-bold leading-none">
                    {unread > 9 ? '9+' : `+${unread}`}
                  </span>
                </span>
              ) : (
                active && <ChevronRight size={14} className="ml-auto text-neon-green/60" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 space-y-1 mt-2">
        <button
          onClick={() => goTo('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
            currentPage === 'settings'
              ? 'nav-active text-white'
              : 'text-gray-500 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Settings size={16} className={currentPage === 'settings' ? 'text-neon-green' : ''} /> Settings
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-neon-red/8 hover:text-neon-red transition-all"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  )
}
