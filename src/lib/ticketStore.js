/* ──────────────────────────────────────────────────────────────────────────
   Shared support-ticket store (frontend, localStorage-backed).

   There's no tickets backend, so tickets persist to localStorage, namespaced
   per user. This module is the single source of truth for both the user's
   Support Hub and (a same-origin) admin tab. Writes broadcast two events:

     • the native `storage` event  → other tabs (e.g. an admin tab) react live
     • a custom `tickets:changed`   → the same tab reacts live (storage doesn't
                                       fire in the tab that wrote it)

   The `useTickets` hook layers polling on top as a belt-and-suspenders fallback,
   so admin replies appear within a couple of seconds no matter what.

   Ticket shape:
     { key, id:'TK-####', subject, txRef, created, status:'Open',
       messages:[{ sender:'user'|'admin', text, ts }], unread:Number }
   ────────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'vaultx_tickets_'
export const keyFor = (uid) => `${PREFIX}${uid || 'anon'}`

const CHANGE_EVENT = 'tickets:changed'

export function loadTickets(uid) {
  try {
    const arr = JSON.parse(localStorage.getItem(keyFor(uid)) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveTickets(uid, tickets) {
  try { localStorage.setItem(keyFor(uid), JSON.stringify(tickets)) } catch { /* quota / disabled */ }
  // Notify listeners in THIS tab (the `storage` event only fires in *other* tabs).
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { uid } })) } catch { /* SSR */ }
}

const makeTicketId = () => `TK-${Math.floor(1000 + Math.random() * 9000)}`
const uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`)

/** Create a ticket, seeding the message thread with the user's opening message. */
export function createTicket(uid, { subject, txRef = null, message = '' }) {
  const ts = Date.now()
  const ticket = {
    key: uuid(),
    id: makeTicketId(),
    subject,
    txRef,
    created: ts,
    status: 'Open',
    messages: message.trim() ? [{ sender: 'user', text: message.trim(), ts }] : [],
    unread: 0,
  }
  saveTickets(uid, [ticket, ...loadTickets(uid)])
  return ticket
}

/** Append a message. Admin messages bump the ticket's unread counter. */
export function appendMessage(uid, ticketId, { sender, text, ts }) {
  if (!text?.trim()) return
  const next = loadTickets(uid).map(t => {
    if (t.id !== ticketId && t.key !== ticketId) return t
    return {
      ...t,
      messages: [...(t.messages || []), { sender, text: text.trim(), ts: ts || Date.now() }],
      unread: sender === 'admin' ? (t.unread || 0) + 1 : (t.unread || 0),
    }
  })
  saveTickets(uid, next)
}

/** Clear a ticket's unread counter (user has viewed the thread). */
export function markRead(uid, ticketId) {
  let changed = false
  const next = loadTickets(uid).map(t => {
    if ((t.id === ticketId || t.key === ticketId) && (t.unread || 0) !== 0) {
      changed = true
      return { ...t, unread: 0 }
    }
    return t
  })
  if (changed) saveTickets(uid, next) // avoid redundant writes / event loops
}

export const totalUnread = (tickets) => tickets.reduce((s, t) => s + (t.unread || 0), 0)

/* ── Admin-reply bridge ───────────────────────────────────────────────────────
   The real admin replies live in the backend support thread (a different channel
   from these localStorage tickets). This bridge ingests those admin messages
   into the ticket store so the user's ticket chat + badge update live.

   Dedup is tracked by backend message id in a per-user "seen" set so a reply is
   ingested exactly once. Each admin reply attaches to the newest ticket that
   existed when it was sent. Messages older than the user's first ticket are
   marked seen but never backfilled. */
const SEEN_PREFIX = 'vaultx_tickets_seen_'
const seenKey = (uid) => `${SEEN_PREFIX}${uid || 'anon'}`

function loadSeen(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || '[]')) }
  catch { return new Set() }
}
function saveSeen(uid, set) {
  try { localStorage.setItem(seenKey(uid), JSON.stringify([...set])) } catch { /* ignore */ }
}

export function ingestAdminMessages(uid, backendMessages) {
  if (!uid || !Array.isArray(backendMessages) || backendMessages.length === 0) return
  const seen = loadSeen(uid)
  const tickets = loadTickets(uid)
  const hasTickets = tickets.length > 0
  const minTs = hasTickets ? Math.min(...tickets.map(t => t.created)) : Infinity
  let seenChanged = false

  for (const m of backendMessages) {
    if (m.sender !== 'admin' || !m.id || seen.has(m.id)) continue
    // Only surface replies that arrived after the user started using tickets.
    if (hasTickets && m.ts >= minTs) {
      const target = tickets.find(t => t.created <= m.ts) || tickets[0]
      appendMessage(uid, target.id, { sender: 'admin', text: m.text, ts: m.ts })
    }
    seen.add(m.id)
    seenChanged = true
  }
  if (seenChanged) saveSeen(uid, seen)
}

/** Mount once (app-wide) for a logged-in user: ingests admin replies from the
 *  backend support thread into the ticket store whenever they arrive. */
export function useAdminReplyBridge(uid, backendMessages) {
  useEffect(() => {
    ingestAdminMessages(uid, backendMessages)
  }, [uid, backendMessages])
}

/**
 * Live tickets for a user: reads localStorage, then stays in sync via the
 * `storage` event (other tabs), the `tickets:changed` event (same tab), and a
 * polling fallback.
 */
export function useTickets(uid, { poll = 2000 } = {}) {
  const [tickets, setTickets] = useState(() => loadTickets(uid))
  const refresh = useCallback(() => setTickets(loadTickets(uid)), [uid])

  useEffect(() => {
    refresh()
    const onStorage = (e) => { if (!e.key || e.key === keyFor(uid)) refresh() }
    const onChange  = (e) => { if (!e.detail || e.detail.uid === uid) refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    const id = setInterval(refresh, poll)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
      clearInterval(id)
    }
  }, [uid, refresh, poll])

  return { tickets, refresh }
}
