import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef, useMemo
} from 'react'
import { ASSETS as BASE_ASSETS } from '../data/mockData'
import { useMarket } from './MarketContext'
import { useAuth }   from './AuthContext'
import { useTransactions } from './TransactionsContext'

const DEFAULT_BALANCES = { btc: 0, eth: 0, sol: 0, tron: 0, usdt_trc20: 0, usdt_erc20: 0 }

const AppContext = createContext(null)
let _toastId = 0

export function AppProvider({ children }) {
  const { getPrice, getChange, prices } = useMarket()
  const { user: authUser, logout: authLogout, refreshUser } = useAuth()
  const txns = useTransactions()
  const uid = authUser?.uid
  // Strict role split: admins are SYSTEM accounts — no wallet, addresses,
  // balances or assets. Everything wallet-related below is gated on this.
  const isAdmin = authUser?.role === 'admin'

  // Balances + addresses now travel with the authenticated user (from the API).
  const balances = authUser?.balances ?? DEFAULT_BALANCES
  const addresses = authUser?.addresses ?? {}

  /* ── Navigation ─────────────────────────────────────── */
  const [currentPage, setCurrentPage] = useState('dashboard')

  /* ── Deep-link targets (driven by the notification system) ──
     focusedTxId opens a transaction's detail view in History;
     supportIntent tells the Support hub which tab / ticket to open. */
  const [focusedTxId, setFocusedTxId] = useState(null)
  const [supportIntent, setSupportIntent] = useState(null)

  /* ── Toasts ─────────────────────────────────────────── */
  const [toasts, setToasts] = useState([])
  const timerRefs = useRef({})

  /* ── Live assets: DB balances + addresses × live prices ──
     Admins get an EMPTY asset list (no wallet), which makes every wallet
     component — Receive, Send and the Settings asset list — render nothing. */
  const assets = useMemo(() =>
    isAdmin ? [] : BASE_ASSETS.map(a => ({
      ...a,
      balance:   balances[a.id] ?? 0,
      address:   addresses[a.id] || a.address,
      price:     getPrice(a.symbol)  || a.price,
      change24h: getChange(a.symbol) ?? a.change24h,
    })),
    [isAdmin, balances, addresses, prices, getPrice, getChange]
  )

  const portfolioValue = useMemo(
    () => assets.reduce((s, a) => s + a.price * a.balance, 0),
    [assets]
  )

  // Transactions belonging to the signed-in user (newest first). For a normal
  // user the API already returns only their own; we sort defensively.
  const transactions = useMemo(
    () => txns.transactions.slice().sort((a, b) => b.createdAt - a.createdAt),
    [txns.transactions]
  )

  /* ── Normalized user object (Sidebar-compatible) ─────── */
  const user = useMemo(() => authUser
    ? {
        name:  authUser.displayName || authUser.email?.split('@')[0] || 'Wallet User',
        email: authUser.email,
        uid:   authUser.uid,
        role:  authUser.role,
        // Withdrawal (Send) block state, sourced from /auth/me hydration.
        withdrawalsBlocked: authUser.isBlocked ?? false,
        withdrawalBlockMessage: authUser.withdrawalBlockMessage || null,
      }
    : null,
    [authUser]
  )

  /* ── Toast helpers ───────────────────────────────────── */
  const showToast = useCallback((message, type = 'info') => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    timerRefs.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timerRefs.current[id]
    }, 4000)
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    clearTimeout(timerRefs.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => () => Object.values(timerRefs.current).forEach(clearTimeout), [])

  /* ── Navigate ────────────────────────────────────────── */
  const navigate = useCallback((page) => setCurrentPage(page), [])

  /* ── Deep-link navigation (used by notification click handlers) ── */
  const navigateToTransaction = useCallback((txId) => {
    setFocusedTxId(txId || null)
    setCurrentPage('history')
  }, [])
  const clearFocusedTx = useCallback(() => setFocusedTxId(null), [])

  const openSupport = useCallback((intent = null) => {
    setSupportIntent(intent)
    setCurrentPage('support')
  }, [])
  const clearSupportIntent = useCallback(() => setSupportIntent(null), [])

  /* ── Background refresh ──────────────────────────────────
     Re-pull the live API data (balances via /auth/me + the user's
     transactions) without reloading the page. Components call this on a
     1s interval. Deps are the stable refresh callbacks, so this function's
     identity is stable and won't thrash any setInterval that depends on it. */
  const refreshData = useCallback(async () => {
    await Promise.all([refreshUser(), txns.refresh()])
  }, [refreshUser, txns.refresh])

  /* ── Logout ──────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try {
      await authLogout()
      setCurrentPage('dashboard')
      showToast('Signed out securely.', 'info')
    } catch (err) {
      showToast('Sign-out error: ' + err.message, 'error')
    }
  }, [authLogout, showToast])

  /* ── Wallet actions (all go through the backend API) ─── */
  // SEND → creates a PENDING transaction. No balance is deducted here;
  // an admin must approve it first (which performs the deduction).
  const sendCrypto = useCallback(async ({ assetId, to, amount }) => {
    if (!uid) return
    const asset = assets.find(a => a.id === assetId)
    if (!asset) return
    const amt = parseFloat(amount)
    try {
      await txns.createTransaction({
        type: 'Send', assetId, asset: asset.symbol,
        amount: amt, usd: amt * asset.price,
        to, from: asset.address, status: 'Pending',
      })
      showToast(`${amt} ${asset.symbol} submitted — awaiting admin approval`, 'info')
    } catch (err) {
      throw err   // let the form surface err.message inline (and avoid a false "success")
    }
  }, [uid, assets, txns, showToast])

  // SWAP settles immediately (not part of the approval pipeline).
  // After settling we refresh the user so balances reflect the new state.
  const swapCrypto = useCallback(async ({ fromId, toId, fromAmount, toAmount }) => {
    if (!uid) return
    const fa = assets.find(a => a.id === fromId)
    const ta = assets.find(a => a.id === toId)
    if (!fa || !ta) return
    const fAmt = parseFloat(fromAmount), tAmt = parseFloat(toAmount)
    try {
      await txns.createTransaction({
        type: 'Swap', assetId: fromId, asset: `${fa.symbol}→${ta.symbol}`,
        amount: fAmt, usd: fAmt * fa.price,
        to: 'Internal', from: 'Internal',
        status: 'Completed', balanceDeltas: { [fromId]: -fAmt, [toId]: +tAmt },
      })
      await refreshUser()
      showToast(`Swapped ${fAmt} ${fa.symbol} → ${tAmt.toFixed(6)} ${ta.symbol}`, 'success')
    } catch (err) {
      throw err
    }
  }, [uid, assets, txns, refreshUser, showToast])

  return (
    <AppContext.Provider value={{
      user,
      currentPage, navigate,
      focusedTxId, navigateToTransaction, clearFocusedTx,
      supportIntent, openSupport, clearSupportIntent,
      assets, portfolioValue, transactions,
      toasts, showToast, dismissToast,
      deviceConnected: true,
      logout, refreshData,
      sendCrypto, swapCrypto,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside <AppProvider>')
  return ctx
}
