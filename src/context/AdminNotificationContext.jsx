import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react'
import { useApp } from './AppContext'
import { useSupport } from './SupportContext'
import { useTransactions } from './TransactionsContext'
import { api } from '../lib/api'

const DEPOSIT_UNIT = { btc: 'BTC', eth: 'ETH', sol: 'SOL', tron: 'TRX', usdt_trc20: 'USDT', usdt_erc20: 'USDT' }
const fmtDep = (n) => { const v = Number(n) || 0; return v < 0.0001 ? v.toFixed(8) : String(v) }

/* ──────────────────────────────────────────────────────────────────────────
   AdminNotificationContext — the admin console's notification center + toasts.

   Same persistent-history architecture as the user-side NotificationContext
   (events derived from backend state, keyed dedup, read/shown/cleared sets
   persisted in localStorage, toast only for new unread events), but with
   admin-specific event types and admin navigation built in so a click can
   deep-link to the right console section.

   Admin alert types:
     • admin_pending  — a user submitted a Send that needs approval
     • admin_support  — a user sent a support message

   This context ALSO owns the admin's active `section` + a support-thread intent,
   so notification clicks (and the rest of the console) navigate through one
   source of truth.
   ────────────────────────────────────────────────────────────────────────── */

const AdminNotificationContext = createContext(null)

const MAX_NOTIFS = 50
const MAX_TOASTS = 5

let _aid = 0
const nextId = () => `a_${Date.now().toString(36)}_${++_aid}`

const fmtAmt = (n) => {
  const v = Number(n) || 0
  return v < 0.01 ? v.toFixed(8) : v.toFixed(4)
}
const shortTicket = (uid) => '#' + String(uid || '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()

const readKey    = (uid) => `vaultx_adminnotif_read_${uid || 'anon'}`
const shownKey   = (uid) => `vaultx_adminnotif_shown_${uid || 'anon'}`
const clearedKey = (uid) => `vaultx_adminnotif_cleared_${uid || 'anon'}`
const loadSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')) } catch { return new Set() } }

/* Build the candidate admin events from current backend state. */
function buildEvents(pendingTxns, threads, depositAlerts) {
  const events = []

  // On-chain deposits detected on users' real addresses (admin-only).
  for (const d of depositAlerts) {
    events.push({
      key: `deposit:${d.id}`,
      type: 'admin_deposit',
      timestamp: d.detectedAt,
      message: `Deposit detected — ${d.userName || d.userEmail || 'a user'} received ${fmtDep(d.amount)} ${DEPOSIT_UNIT[d.asset] || d.asset} on-chain.`,
      metadata: { asset: d.asset, address: d.address },
    })
  }

  for (const tx of pendingTxns) {
    events.push({
      key: `pending:${tx.id}`,
      type: 'admin_pending',
      timestamp: tx.createdAt,
      message: `New Send request from ${tx.userName || 'a user'} for ${fmtAmt(tx.amount)} ${tx.asset} requires approval.`,
      metadata: { transactionId: tx.id, uid: tx.uid },
    })
  }

  for (const t of threads) {
    for (const m of (t.messages || [])) {
      if (m.sender !== 'user' || !m.id) continue
      events.push({
        key: `umsg:${m.id}`,
        type: 'admin_support',
        timestamp: m.ts,
        message: `New support message from ${t.name || 'a user'} in Ticket ${shortTicket(t.uid)}.`,
        metadata: { uid: t.uid, msgId: m.id },
      })
    }
  }

  return events
}

export function AdminNotificationProvider({ children }) {
  const { user, refreshData } = useApp()
  const uid = user?.uid
  const enabled = user?.role === 'admin'

  const { pendingTransactions } = useTransactions()
  const { threads } = useSupport()

  const [notifications, setNotifications] = useState([])
  const [activeToasts, setActiveToasts]   = useState([])
  const [depositAlerts, setDepositAlerts] = useState([])  // admin-only on-chain deposit feed

  // Admin navigation (single source of truth for the console).
  const [section, setSection] = useState('transactions')
  const [pendingHighlight, setPendingHighlight] = useState(false)
  const [supportIntentUid, setSupportIntentUid] = useState(null)

  const generatedRef = useRef(new Set())
  const readSetRef    = useRef(new Set())
  const shownSetRef   = useRef(new Set())
  const clearedSetRef = useRef(new Set())
  const highlightTimer = useRef(null)

  const unreadCount = useMemo(
    () => notifications.reduce((n, x) => n + (x.isRead ? 0 : 1), 0),
    [notifications]
  )

  const persist = useCallback((k, set) => {
    try { localStorage.setItem(k, JSON.stringify([...set])) } catch { /* ignore */ }
  }, [])

  const markRead = useCallback((id) => {
    setNotifications(prev => {
      const t = prev.find(n => n.id === id)
      if (t && !readSetRef.current.has(t.key)) { readSetRef.current.add(t.key); persist(readKey(uid), readSetRef.current) }
      return prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    })
  }, [persist, uid])

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      let changed = false
      for (const n of prev) if (!readSetRef.current.has(n.key)) { readSetRef.current.add(n.key); changed = true }
      if (changed) persist(readKey(uid), readSetRef.current)
      return prev.some(n => !n.isRead) ? prev.map(n => ({ ...n, isRead: true })) : prev
    })
  }, [persist, uid])

  const removeToast = useCallback((id) => setActiveToasts(prev => prev.filter(t => t.id !== id)), [])

  // Manual "Delete All" — wipes the history and remembers cleared keys so they
  // don't reappear on the next poll/reload. New events still arrive.
  const clearAll = useCallback(() => {
    setNotifications(prev => {
      for (const n of prev) clearedSetRef.current.add(n.key)
      persist(clearedKey(uid), clearedSetRef.current)
      return []
    })
    setActiveToasts([])
  }, [persist, uid])

  const highlightPending = useCallback(() => {
    setPendingHighlight(true)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setPendingHighlight(false), 3500)
  }, [])

  const clearSupportIntent = useCallback(() => setSupportIntentUid(null), [])

  /* Deep-link router */
  const handleClick = useCallback((notif) => {
    if (!notif) return
    markRead(notif.id)
    removeToast(notif.id)
    const m = notif.metadata || {}
    if (notif.type === 'admin_support') {
      setSection('support')
      setSupportIntentUid(m.uid || null)
    } else if (notif.type === 'admin_deposit') {
      setSection('chain') // Chain Tools shows the on-chain vs DB comparison
    } else {
      // admin_pending (and any other) → Transactions view, flash the pending table
      setSection('transactions')
      highlightPending()
    }
  }, [markRead, removeToast, highlightPending])

  /* Reset per signed-in admin */
  useEffect(() => {
    generatedRef.current = new Set()
    readSetRef.current = loadSet(readKey(uid))
    shownSetRef.current = loadSet(shownKey(uid))
    clearedSetRef.current = loadSet(clearedKey(uid))
    setNotifications([])
    setActiveToasts([])
  }, [uid])

  /* 3-second polling so pending txns / support threads — and therefore the
     sidebar badges AND this bell — stay synchronized in real time. (Support
     threads are also polled by SupportContext every 2s.) */
  useEffect(() => {
    if (!enabled) return
    const pullDeposits = () => api.adminDepositAlerts().then(setDepositAlerts).catch(() => {})
    pullDeposits()
    const id = setInterval(() => { refreshData?.(); pullDeposits() }, 3000)
    return () => clearInterval(id)
  }, [enabled, refreshData])

  /* Derive notifications from backend state */
  useEffect(() => {
    if (!enabled) return
    const events = buildEvents(pendingTransactions, threads, depositAlerts)
    const fresh = events.filter(e => !generatedRef.current.has(e.key) && !clearedSetRef.current.has(e.key))
    if (fresh.length === 0) return

    const built = fresh.map(e => {
      generatedRef.current.add(e.key)
      return {
        id: nextId(),
        key: e.key,
        type: e.type,
        message: e.message,
        timestamp: e.timestamp,
        isRead: readSetRef.current.has(e.key),
        hasShownToast: shownSetRef.current.has(e.key),
        metadata: e.metadata,
      }
    })

    // Catch-up + live toasts: unread events whose toast hasn't fired yet.
    const toShow = built.filter(n => !n.isRead && !n.hasShownToast)
    if (toShow.length) {
      for (const n of toShow) { shownSetRef.current.add(n.key); n.hasShownToast = true }
      persist(shownKey(uid), shownSetRef.current)
    }

    setNotifications(prev =>
      [...built, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_NOTIFS)
    )
    if (toShow.length) {
      const ordered = [...toShow].sort((a, b) => b.timestamp - a.timestamp)
      setActiveToasts(prev => [...ordered, ...prev].slice(0, MAX_TOASTS))
    }
  }, [pendingTransactions, threads, depositAlerts, enabled, uid, persist])

  const value = useMemo(() => ({
    // notification center (same shape the bell/toasts expect)
    notifications, activeToasts, unreadCount,
    markRead, markAllRead, removeToast, handleClick, clearAll,
    // admin navigation
    section, setSection, pendingHighlight,
    supportIntentUid, clearSupportIntent,
  }), [notifications, activeToasts, unreadCount, markRead, markAllRead, removeToast,
       handleClick, clearAll, section, pendingHighlight, supportIntentUid, clearSupportIntent])

  return <AdminNotificationContext.Provider value={value}>{children}</AdminNotificationContext.Provider>
}

export function useAdminNotifications() {
  const ctx = useContext(AdminNotificationContext)
  if (!ctx) throw new Error('useAdminNotifications must be inside <AdminNotificationProvider>')
  return ctx
}
