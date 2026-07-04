import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'corecold-theme'

/** Read the persisted theme, defaulting to dark. */
function readInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  return 'dark'
}

/** Apply the theme to <html>: `.dark` drives Tailwind + our CSS overrides. */
function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme)

  // Keep <html> + localStorage in sync whenever the theme changes.
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
    []
  )

  const value = { theme, isDark: theme === 'dark', toggleTheme, setTheme }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
