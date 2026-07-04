import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, getToken } from '../lib/api'

/* ──────────────────────────────────────────────────────────
   AuthContext — session management against the backend API.
   Credentials are verified by the server (bcrypt); a JWT is stored
   in localStorage and replayed on reload via /auth/me. The user
   object carries identity + role + balances + addresses.
   ────────────────────────────────────────────────────────── */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still initializing, null = signed out, object = signed in
  const [user,    setUser]    = useState(undefined)
  const [loading, setLoading] = useState(true)

  // Restore the session from a persisted token on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getToken()) {
        if (!cancelled) { setUser(null); setLoading(false) }
        return
      }
      try {
        const { user } = await api.me()
        if (!cancelled) setUser(user)
      } catch {
        setToken(null)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login(email, password)
    setToken(token)
    setUser(user)
    return user
  }, [])

  // Create the account but DON'T log in yet — the signup flow must first show
  // the real wallet mnemonic + verify it. Returns the token, user and mnemonic
  // so RegisterPage can display the phrase, then call activateSession() to enter.
  const register = useCallback(async ({ name, email, password }) => {
    const { token, user, mnemonic } = await api.register(name, email, password)
    return { token, user, mnemonic }
  }, [])

  // Finalize the session after the user has saved + verified their phrase.
  const activateSession = useCallback((token, user) => {
    setToken(token)
    setUser(user)
  }, [])

  const logout = useCallback(async () => {
    setToken(null)
    setUser(null)
  }, [])

  // Re-pull the current user (e.g. after a balance-changing transaction).
  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.me()
      setUser(user)
      return user
    } catch {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, activateSession, logout, refreshUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}
