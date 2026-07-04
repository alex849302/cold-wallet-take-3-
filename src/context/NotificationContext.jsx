import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react'
import {
  CheckCircle, XCircle, MessageSquare, LifeBuoy, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import { useApp } from './AppContext'
import { useSupport } from './SupportContext'
import { useTransactions } from './TransactionsContext'
import { loadTickets } from '../lib/ticketStore'

/* ──────────────────────────────────────────────────────────────────────────
   NotificationContext — a PERSISTENT notification history + real-time toasts.

   Design (rewritten for reliability + permanence):
   • Notifications are DERIVED from authoritative backend state (the user's
     transactions + their DB support thread), each keyed by a STABLE event key
     (e.g. `approved:<txid>`, `received:<txid>`, `chat:<msgid>`). A key is turned
     into a notification exactly once per session (`generatedRef`), so polling
     never duplicates — and because the source is the backend, the history
     rebuilds itself after a reload. Nothing is ever removed on view/click.
   • `isRead` is persisted per-user in localStorage, so read/unread survives
     reloads. Opening the dropdown or clicking an item flips isRead → true; the
     item STAYS in the list (just dimmed / no dot).
   • A toast pops only for genuinely NEW events (timestamp ≥ login) that are
     unread — historical events populate the dropdown silently.

   Notification shape:
     { id, key, type, message, timestamp, isRead, metadata:{ transactionId?, chatId? } }
   type ∈ 'transaction_sent' | 'transaction_received' | 'transaction_approved'
        | 'transaction_failed' | 'chat_reply' | 'general'
   ────────────────────────────────────────────────────────────────────────── */

const NotificationContext = createContext(null)

export const NOTIF_META = {
  transaction_sent:     { icon: ArrowUpRight,  accent: 'blue',  title: 'Transfer sent' },
  transaction_received: { icon: ArrowDownLeft, accent: 'green', title: 'Funds received' },
  transaction_approved: { icon: CheckCircle,   accent: 'green', title: 'Transaction approved' },
  transaction_failed:   { icon: XCircle,       accent: 'red',   title: 'Transaction failed' },
  chat_reply:           { icon: MessageSquare, accent: 'blue',  title: 'New support reply' },
  general:              { icon: LifeBuoy,       accent: 'blue',  title: 'Support message' },
  // Admin-side alert types
  admin_pending:        { icon: ArrowUpRight,  accent: 'amber', title: 'New transfer request' },
  admin_support:        { icon: MessageSquare, accent: 'red',   title: 'New support message' },
  admin_deposit:        { icon: ArrowDownLeft, accent: 'green', title: 'Deposit detected' },
}

export const ACCENT = {
  green: { text: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/30', dot: 'bg-neon-green' },
  red:   { text: 'text-neon-red',   bg: 'bg-neon-red/10',   border: 'border-neon-red/30',   dot: 'bg-neon-red'   },
  blue:  { text: 'text-neon-blue',  bg: 'bg-neon-blue/10',  border: 'border-neon-blue/30',  dot: 'bg-neon-blue'  },
  amber: { text: 'text-neon-amber', bg: 'bg-neon-amber/10', border: 'border-neon-amber/30', dot: 'bg-neon-amber' },
}

const MAX_NOTIFS = 50   // bound the history (newest kept)
const MAX_TOASTS = 5    // cap simultaneous pop-ups

let _nid = 0
const nextId = () => `n_${Date.now().toString(36)}_${++_nid}`

const fmtAmt = (n) => {
  const v = Number(n) || 0
  return v < 0.01 ? v.toFixed(8) : v.toFixed(4)
}
const shortRef = (s) => (s ? `${String(s).slice(0, 8)}…` : '')

const readStorageKey    = (uid) => `vaultx_notif_read_${uid || 'anon'}`
const clearedStorageKey = (uid) => `vaultx_notif_cleared_${uid || 'anon'}`
const shownStorageKey   = (uid) => `vaultx_notif_shown_${uid || 'anon'}`
const loadKeySet = (storageKey) => {
  try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')) }
  catch { return new Set() }
}

/* Build the full set of candidate notification events from current backend state.
   Each event has a deterministic `key` so it's generated at most once. */
function buildEvents(transactions, messages, uid) {
  const events = []

  for (const tx of transactions) {
    if (tx.type === 'Send') {
      if (tx.status === 'Completed') {
        events.push({ key: `approved:${tx.id}`, type: 'transaction_approved', timestamp: tx.createdAt,
          message: `Admin approved your transfer of ${fmtAmt(tx.amount)} ${tx.asset}.`,
          metadata: { transactionId: tx.id } })
      } else if (tx.status === 'Rejected') {
        events.push({ key: `failed:${tx.id}`, type: 'transaction_failed', timestamp: tx.createdAt,
          message: `Your transfer of ${fmtAmt(tx.amount)} ${tx.asset} was rejected.`,
          metadata: { transactionId: tx.id } })
      } else {
        events.push({ key: `sent:${tx.id}`, type: 'transaction_sent', timestamp: tx.createdAt,
          message: `You sent ${fmtAmt(tx.amount)} ${tx.asset} — pending admin approval.`,
          metadata: { transactionId: tx.id } })
      }
    } else if (tx.type === 'Receive') {
      events.push({ key: `received:${tx.id}`, type: 'transaction_received', timestamp: tx.createdAt,
        message: `You received ${fmtAmt(tx.amount)} ${tx.asset}.`,
        metadata: { transactionId: tx.id } })
    }
  }

  if (messages.length) {
    const tickets = loadTickets(uid)
    for (const m of messages) {
      if (m.sender !== 'admin' || !m.id) continue
      const ticket = tickets.find(t => t.created <= m.ts) || tickets[0] || null
      let message = 'New message from CoreCold Support.'
      if (ticket?.txRef) message = `New message from Support regarding transaction ${shortRef(ticket.txRef)}.`
      else if (ticket)   message = `New message from Support regarding ticket ${ticket.id}.`
      events.push({ key: `chat:${m.id}`, type: ticket ? 'chat_reply' : 'general', timestamp: m.ts,
        message, metadata: { chatId: ticket?.id || null, transactionId: ticket?.txRef || null } })
    }
  }

  return events
}

export function NotificationProvider({ children }) {
  const app = useApp()
  const { user, navigateToTransaction, openSupport, refreshData } = app
  const uid = user?.uid
  const enabled = !!user && user.role !== 'admin'

  const { transactions } = useTransactions()
  const { messages } = useSupport()

  const [notifications, setNotifications] = useState([])
  const [activeToasts, setActiveToasts]   = useState([])

  const generatedRef = useRef(new Set())     // event keys already materialised this session
  const readSetRef   = useRef(new Set())     // event keys marked read (mirrors localStorage)
  const clearedSetRef = useRef(new Set())    // event keys manually cleared (mirrors localStorage)
  const shownSetRef  = useRef(new Set())     // event keys whose Toast has already popped (mirrors localStorage)

  const unreadCount = useMemo(
    () => notifications.reduce((n, x) => n + (x.isRead ? 0 : 1), 0),
    [notifications]
  )

  const persistRead = useCallback(() => {
    try { localStorage.setItem(readStorageKey(uid), JSON.stringify([...readSetRef.current])) }
    catch { /* quota / disabled */ }
  }, [uid])

  const persistCleared = useCallback(() => {
    try { localStorage.setItem(clearedStorageKey(uid), JSON.stringify([...clearedSetRef.current])) }
    catch { /* quota / disabled */ }
  }, [uid])

  const persistShown = useCallback(() => {
    try { localStorage.setItem(shownStorageKey(uid), JSON.stringify([...shownSetRef.current])) }
    catch { /* quota / disabled */ }
  }, [uid])

  /* ── Mark read — NEVER removes the notification, only flips isRead ───────── */
  const markRead = useCallback((id) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id)
      if (target && !readSetRef.current.has(target.key)) {
        readSetRef.current.add(target.key)
        persistRead()
      }
      return prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    })
  }, [persistRead])

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      let changed = false
      for (const n of prev) {
        if (!readSetRef.current.has(n.key)) { readSetRef.current.add(n.key); changed = true }
      }
      if (changed) persistRead()
      return prev.some(n => !n.isRead) ? prev.map(n => ({ ...n, isRead: true })) : prev
    })
  }, [persistRead])

  // Dismiss a TOAST pop-up only — the dropdown history entry is untouched.
  const removeToast = useCallback((id) => setActiveToasts(prev => prev.filter(t => t.id !== id)), [])

  /* ── Manual "Clear All" — user-initiated wipe of the whole history ────────
     Because notifications are derived from backend state, we must remember which
     event keys were cleared (persisted in localStorage) so they don't simply
     reappear on the next poll/reload. New events arriving later are unaffected. */
  const clearAll = useCallback(() => {
    setNotifications(prev => {
      for (const n of prev) clearedSetRef.current.add(n.key)
      persistCleared()
      return []
    })
    setActiveToasts([])
  }, [persistCleared])

  /* ── Deep-link router ───────────────────────────────────────────────────── */
  const handleClick = useCallback((notif) => {
    if (!notif) return
    markRead(notif.id)         // marks read (persisted) — does NOT delete
    removeToast(notif.id)      // close the pop-up if it's showing
    const m = notif.metadata || {}
    switch (notif.type) {
      case 'transaction_sent':
      case 'transaction_received':
      case 'transaction_approved':
      case 'transaction_failed':
        navigateToTransaction(m.transactionId || null)
        break
      case 'chat_reply':
        openSupport({ tab: 'tickets', ticketId: m.chatId || null, transactionId: m.transactionId || null })
        break
      case 'general':
      default:
        openSupport({ tab: 'chat' })
        break
    }
  }, [markRead, removeToast, navigateToTransaction, openSupport])

  /* ── Reset per signed-in user (login / logout) ──────────────────────────── */
  useEffect(() => {
    generatedRef.current = new Set()
    readSetRef.current = loadKeySet(readStorageKey(uid))
    clearedSetRef.current = loadKeySet(clearedStorageKey(uid))
    shownSetRef.current = loadKeySet(shownStorageKey(uid))
    setNotifications([])
    setActiveToasts([])
  }, [uid])

  /* ── Global polling so events are caught on ANY page, across all sessions ── */
  useEffect(() => {
    if (!enabled || !refreshData) return
    const id = setInterval(() => { refreshData() }, 3000)
    return () => clearInterval(id)
  }, [enabled, refreshData])

  /* ── Derive notifications from backend state ─────────────────────────────
     Runs on login/mount and whenever transactions or the support thread change.
     Every qualifying event becomes a permanent notification exactly once (keyed
     dedup) — this is what reliably fires "approved"/"received".

     OFFLINE / LOGIN TOAST SYNC: each notification carries `hasShownToast`
     (persisted per-user in localStorage). On every derive pass — which includes
     the first pass right after login — we pop a sliding Toast for every UNREAD
     notification whose Toast hasn't been shown yet (`hasShownToast === false`).
     This catches the user up on anything that arrived while they were logged
     out / before a refresh. We then immediately flip those to hasShownToast=true
     and persist, so they never pop again on subsequent refreshes. */
  useEffect(() => {
    if (!enabled) return
    const events = buildEvents(transactions, messages, uid)
    // Skip keys already materialised this session, or manually cleared by the user.
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

    // Catch-up: unread + Toast not yet shown → pop it now, then mark shown.
    const toShow = built.filter(n => !n.isRead && !n.hasShownToast)
    if (toShow.length) {
      for (const n of toShow) { shownSetRef.current.add(n.key); n.hasShownToast = true }
      persistShown()
    }

    setNotifications(prev =>
      [...built, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_NOTIFS)
    )

    if (toShow.length) {
      const ordered = [...toShow].sort((a, b) => b.timestamp - a.timestamp)
      setActiveToasts(prev => [...ordered, ...prev].slice(0, MAX_TOASTS))
    }
  }, [transactions, messages, enabled, uid, persistShown])

  const value = useMemo(() => ({
    notifications, activeToasts, unreadCount,
    markRead, markAllRead, removeToast, handleClick, clearAll,
  }), [notifications, activeToasts, unreadCount, markRead, markAllRead, removeToast, handleClick, clearAll])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be inside <NotificationProvider>')
  return ctx
}
