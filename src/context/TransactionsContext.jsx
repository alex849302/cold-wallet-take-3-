import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

/* ──────────────────────────────────────────────────────────
   TransactionsContext — transactions sourced from the backend API.
   The server returns role-appropriate data: admins get every
   transaction, users get their own. Mutations hit the API and then
   refetch so every view stays consistent.
   ────────────────────────────────────────────────────────── */
const TransactionsContext = createContext(null)

export function TransactionsProvider({ children }) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) { setTransactions([]); return }
    setLoading(true)
    try {
      setTransactions(await api.listTransactions())
    } catch {
      /* leave the previous list in place on a transient error */
    } finally {
      setLoading(false)
    }
  }, [user])

  // Refetch whenever the signed-in user changes (login / logout / role).
  useEffect(() => { refresh() }, [refresh])

  const pendingTransactions = useMemo(
    () => transactions.filter(t => t.status === 'Pending').sort((a, b) => b.createdAt - a.createdAt),
    [transactions]
  )

  const transactionsForUser = useCallback(
    (uid) => transactions.filter(t => t.uid === uid),
    [transactions]
  )

  const createTransaction = useCallback(async (payload) => {
    const tx = await api.createTransaction(payload)
    await refresh()
    return tx
  }, [refresh])

  const approveTransaction = useCallback(async (id) => {
    const r = await api.approveTransaction(id)
    await refresh()
    return r
  }, [refresh])

  const cancelTransaction = useCallback(async (id) => {
    const r = await api.cancelTransaction(id)
    await refresh()
    return r
  }, [refresh])

  const value = useMemo(() => ({
    transactions, pendingTransactions, loading, refresh,
    transactionsForUser, createTransaction, approveTransaction, cancelTransaction,
  }), [transactions, pendingTransactions, loading, refresh,
       transactionsForUser, createTransaction, approveTransaction, cancelTransaction])

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error('useTransactions must be inside <TransactionsProvider>')
  return ctx
}
