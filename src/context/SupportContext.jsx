import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

/* ──────────────────────────────────────────────────────────
   SupportContext — support chat sourced from the backend API.
   • Regular user → their own thread (`messages`).
   • Admin        → every thread (`threads`).
   Light polling (every 4s) keeps the user chat and the admin desk
   in sync, replacing the old cross-tab localStorage `storage` event.
   ────────────────────────────────────────────────────────── */
const SupportContext = createContext(null)

export function SupportProvider({ children }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [messages, setMessages] = useState([]) // current user's own thread
  const [threads,  setThreads]  = useState([]) // admin view

  const refresh = useCallback(async () => {
    if (!user) { setMessages([]); setThreads([]); return }
    try {
      if (isAdmin) setThreads(await api.getThreads())
      else setMessages(await api.getMessages())
    } catch {
      /* keep last good state on transient errors */
    }
  }, [user, isAdmin])

  // Initial load + polling while signed in. 2s cadence so admin replies reach
  // the user's ticket chat / sidebar badge quickly (via the admin-reply bridge).
  useEffect(() => {
    refresh()
    if (!user) return
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [refresh, user])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return
    await api.sendMessage(text)
    await refresh()
  }, [refresh])

  const adminReply = useCallback(async (userId, text) => {
    if (!text.trim()) return
    await api.adminReply(userId, text)
    await refresh()
  }, [refresh])

  // Unread = admin replies in this user's DB thread that aren't marked read yet.
  // Drives the global sidebar badge + the Support page dots.
  const unreadCount = useMemo(
    () => messages.reduce((n, m) => n + (m.sender === 'admin' && !m.read ? 1 : 0), 0),
    [messages]
  )

  // Admin-side: a thread "needs a reply" when its newest message came from the
  // user (the admin hasn't responded yet). Drives the admin sidebar badge + the
  // "Pending Reply" row highlight. Refreshes on the same 2s poll above, so the
  // admin's view updates live as users send messages.
  const pendingReplyCount = useMemo(
    () => threads.reduce((n, t) => n + (t.lastSender === 'user' ? 1 : 0), 0),
    [threads]
  )

  // Clear unread server-side (the user opened their ticket chat). Optimistically
  // flip local messages to read so the badge/dots vanish the instant they click,
  // then confirm against the backend.
  const markRead = useCallback(async () => {
    if (unreadCount === 0) return
    setMessages(prev => prev.map(m => (m.sender === 'admin' && !m.read ? { ...m, read: true } : m)))
    try {
      await api.markMessagesRead()
    } catch {
      /* a later poll will reconcile if this transient call failed */
    }
    await refresh()
  }, [unreadCount, refresh])

  return (
    <SupportContext.Provider value={{ messages, threads, unreadCount, pendingReplyCount, sendMessage, adminReply, markRead, refresh }}>
      {children}
    </SupportContext.Provider>
  )
}

export function useSupport() {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupport must be inside <SupportProvider>')
  return ctx
}
