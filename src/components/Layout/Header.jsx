import React from 'react'
import { Menu, X, Cpu, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import NotificationBell from '../Notifications/NotificationBell'

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  history:   'Transaction History',
  support:   'Support',
  settings:  'Settings',
}

export default function Header({ onMenuClick, sidebarOpen }) {
  const { currentPage, user } = useApp()
  const { isDark, toggleTheme } = useTheme()

  const name  = user?.name || 'Wallet User'
  const email = user?.email || ''
  const initial = name.charAt(0).toUpperCase()

  return (
    <header
      className="app-header sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3"
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all shrink-0"
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* CoreCold brand — mobile only (sidebar is hidden) */}
      <div className="flex items-center gap-2 lg:hidden shrink-0">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #00E67633, #00E67655)', border: '1px solid rgba(0,230,118,.35)' }}>
          <Cpu size={13} className="text-neon-green" />
        </div>
        <span className="text-sm font-bold text-white">CoreCold</span>
      </div>

      {/* Page title */}
      <h2 className="text-lg font-bold text-white">
        {PAGE_TITLES[currentPage] || 'Dashboard'}
      </h2>

      <div className="flex-1" />

      {/* Right cluster: notifications, theme toggle, user profile badge */}
      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-neon-green hover:bg-white/5 transition-all"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* User profile badge */}
        <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl glass">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-400 shrink-0"
               style={{ background: 'linear-gradient(135deg, #00E676, #00BFA5)' }}>
            {initial}
          </div>
          <div className="hidden sm:block min-w-0 leading-tight">
            <p className="text-sm font-semibold text-white truncate max-w-[140px]">{name}</p>
            <p className="text-xs text-gray-500 truncate max-w-[140px]">{email}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
