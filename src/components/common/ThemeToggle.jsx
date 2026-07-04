import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

/**
 * Standalone theme toggle. Used by the floating control on screens that have
 * no app header (auth pages, loading, access-denied). The header has its own
 * inline toggle.
 */
export default function ThemeToggle({ className = '', floating = false }) {
  const { isDark, toggleTheme } = useTheme()

  const base =
    'w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 ' +
    'hover:text-neon-green hover:bg-white/5 transition-all'
  const floatingCls = floating
    ? 'fixed top-4 right-4 z-50 glass !rounded-xl'
    : ''

  return (
    <button
      onClick={toggleTheme}
      className={`${base} ${floatingCls} ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
