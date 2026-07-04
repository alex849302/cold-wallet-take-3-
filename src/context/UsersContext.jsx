import React, {
  createContext, useContext, useState, useEffect, useCallback
} from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

/* ──────────────────────────────────────────────────────────
   UsersContext — admin user-management list (every account with
   balances + addresses) sourced from the backend API. Only fetches
   for admins; the balance editor writes through to the API.
   ────────────────────────────────────────────────────────── */
const UsersContext = createContext(null)

export function UsersProvider({ children }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [users, setUsers] = useState([])

  const refresh = useCallback(async () => {
    if (!isAdmin) { setUsers([]); return }
    try {
      setUsers(await api.listUsers())
    } catch {
      /* keep last good state */
    }
  }, [isAdmin])

  useEffect(() => { refresh() }, [refresh])

  const setUserBalances = useCallback(async (uid, balances) => {
    await api.setUserBalances(uid, balances)
    await refresh()
  }, [refresh])

  const setUserWithdrawal = useCallback(async (uid, { blocked, message }) => {
    await api.setUserWithdrawal(uid, { blocked, message })
    await refresh()
  }, [refresh])

  return (
    <UsersContext.Provider value={{ users, setUserBalances, setUserWithdrawal, refresh }}>
      {children}
    </UsersContext.Provider>
  )
}

export function useUsers() {
  const ctx = useContext(UsersContext)
  if (!ctx) throw new Error('useUsers must be inside <UsersProvider>')
  return ctx
}
