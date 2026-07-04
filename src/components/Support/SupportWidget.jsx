import React, { useEffect, useRef, useState } from 'react'
import {
  MessageCircle, X, ArrowLeft, Send, ShieldCheck, Ticket, ChevronRight, Headphones
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupport } from '../../context/SupportContext'
import {
  useTickets, appendMessage, markRead as markTicketRead, totalUnread
} from '../../lib/ticketStore'

/* ──────────────────────────────────────────────────────────────────────────
   SupportWidget — global floating live-chat bubble.

   Mounted once in MainLayout so it persists in the bottom-right corner across
   every user-panel page. It is a thin, self-contained shortcut over the SAME
   global support state the Support hub uses:
     • useTickets(uid)            → the user's ticket list + per-ticket threads
     • appendMessage / markRead   → localStorage ticket store (optimistic UI)
     • useSupport().sendMessage   → delivers to the admin's Support Desk
     • useSupport().markRead      → clears the DB-backed sidebar/unread badge
   Because it writes through these exact same channels, anything typed here
   stays perfectly in sync with the full Support page and the admin desk.
   ────────────────────────────────────────────────────────────────────────── */

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function SupportWidget() {
  const { user, openSupport } = useApp()
  const uid = user?.uid
  const { tickets } = useTickets(uid)
  const { sendMessage, markRead: markThreadRead } = useSupport()

  const [open, setOpen]         = useState(false)   // panel open/closed
  const [activeId, setActiveId] = useState(null)    // ticket id whose thread is open

  const unread = totalUnread(tickets)
  const activeTicket = activeId ? tickets.find(t => t.id === activeId) : null

  // Close the thread view whenever the panel is fully closed.
  const togglePanel = () => {
    setOpen(o => {
      if (o) setActiveId(null)
      return !o
    })
  }

  // Opening a thread clears its unread (both the local dot and the DB badge),
  // exactly like the Support hub's TicketChat does.
  const openThread = (id) => {
    setActiveId(id)
    markTicketRead(uid, id)
    markThreadRead()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 print:hidden">
      {/* ── Slide-up overlay panel (above the bubble) ── */}
      {open && (
        <div
          className="glass rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-[slideUp_.25s_ease-out]
                     w-[calc(100vw-3rem)] sm:w-[380px] h-[min(70vh,560px)] origin-bottom-right"
          style={{ boxShadow: '0 24px 64px -12px rgba(0,0,0,.7)' }}
        >
          {activeTicket
            ? <ThreadView
                ticket={activeTicket}
                onBack={() => setActiveId(null)}
                onSend={(body) => {
                  appendMessage(uid, activeTicket.id, { sender: 'user', text: body }) // optimistic
                  sendMessage(body).catch(() => {})                                   // → admin desk
                }}
              />
            : <ListView
                tickets={tickets}
                onClose={togglePanel}
                onOpen={openThread}
                onNew={() => { setOpen(false); openSupport({ tab: 'chat' }) }}
              />}
        </div>
      )}

      {/* ── Floating chat bubble ── */}
      <button
        type="button"
        onClick={togglePanel}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        className="relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer
                   transition-transform duration-200 hover:scale-110 active:scale-95 glow-green"
        style={{
          background: 'linear-gradient(135deg, #00E676, #00C853)',
          border: '1px solid rgba(0,230,118,.5)',
          boxShadow: '0 10px 30px -6px rgba(0,230,118,.55)',
        }}
      >
        {open
          ? <X size={22} className="text-dark-400" />
          : <MessageCircle size={22} className="text-dark-400" />}

        {/* "Online" glowing green dot */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 flex w-3.5 h-3.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-70 animate-ping" />
            <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-white border-2 border-dark-400" />
          </span>
        )}

        {/* Unread admin-reply count badge */}
        {!open && unread > 0 && (
          <span className="absolute -bottom-1 -left-1 min-w-[20px] h-5 px-1 rounded-full bg-neon-red
                           text-white text-[10px] font-bold flex items-center justify-center border-2 border-dark-400">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}

/* ── List of the user's support chats ──────────────────────────────────────── */
function ListView({ tickets, onClose, onOpen, onNew }) {
  return (
    <>
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
          <Headphones size={15} className="text-neon-green" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white leading-none">Support Chats</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-1">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-neon-green" />
            </span>
            <span className="text-neon-green font-medium">Online</span> · replies in ~10 min
          </p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable ticket list */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Ticket size={20} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 font-medium">No support chats yet</p>
            <p className="text-xs text-gray-600 mt-1">Start a conversation and our team will reply shortly.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tickets.map(t => {
              const last    = t.messages?.[t.messages.length - 1]
              const preview = last
                ? `${last.sender === 'admin' ? 'Support: ' : ''}${last.text}`
                : 'No messages yet'
              const isUnread = (t.unread || 0) > 0
              return (
                <button key={t.key || t.id} onClick={() => onOpen(t.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/5 ${
                    isUnread ? 'bg-neon-green/5' : ''
                  }`}>
                  {/* Avatar / unread dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
                      <MessageCircle size={16} className="text-neon-green" />
                    </div>
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-red border-2 border-dark-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-num text-[11px] text-neon-green shrink-0">{t.id}</span>
                      <span className={`text-sm truncate ${isUnread ? 'text-white font-semibold' : 'text-gray-200 font-medium'}`}>
                        {t.subject}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{preview}</p>
                    <div className="mt-1.5">
                      <RowStatus ticket={t} last={last} unread={isUnread} />
                    </div>
                  </div>

                  <ChevronRight size={15} className="text-gray-600 shrink-0 mt-2.5" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer — jump to full hub / start a new chat */}
      <div className="px-3 py-2.5 border-t border-white/5 shrink-0">
        <button onClick={onNew}
          className="btn-primary w-full h-10 flex items-center justify-center gap-2 text-sm">
          <Headphones size={15} /> Start a new chat
        </button>
      </div>
    </>
  )
}

/* Status pill: unread reply → red, awaiting admin → amber, otherwise open → green. */
function RowStatus({ ticket, last, unread }) {
  if (unread) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neon-red/15 text-neon-red border border-neon-red/30">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-red" /> New reply
      </span>
    )
  }
  if (last?.sender === 'user') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neon-amber/10 text-neon-amber border border-neon-amber/25">
        Pending Admin Reply
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neon-green/10 text-neon-green border border-neon-green/25">
      {ticket.status || 'Open'}
    </span>
  )
}

/* ── Active conversation thread (reply inline) ─────────────────────────────── */
function ThreadView({ ticket, onBack, onSend }) {
  const [text, setText] = useState('')
  const scrollRef = useRef(null)
  const messages = ticket.messages || []

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const submit = (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    onSend(body)
    setText('')
  }

  return (
    <>
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/5 flex items-center gap-2.5 shrink-0">
        <button onClick={onBack} aria-label="Back"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate leading-none">
            <span className="font-num text-neon-green">{ticket.id}</span> · {ticket.subject}
          </p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            {ticket.status || 'Open'} · opened {fmtDate(ticket.created)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-4 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-600 mt-6">No messages yet — say hello to start the conversation.</p>
        )}
        {messages.map((m, i) => <Bubble key={i} message={m} />)}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="px-3 py-3 border-t border-white/5 flex items-center gap-2 shrink-0">
        <input type="text" value={text} onChange={e => setText(e.target.value)} autoComplete="off"
          className="wallet-input flex-1 h-10 text-sm" placeholder="Type your message…" />
        <button type="submit" disabled={!text.trim()}
          className="btn-primary h-10 w-10 flex items-center justify-center disabled:opacity-40 shrink-0">
          <Send size={15} />
        </button>
      </form>
    </>
  )
}

function Bubble({ message }) {
  const mine = message.sender === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
        mine ? 'bg-neon-green/15 border border-neon-green/25 rounded-br-sm' : 'glass-dark rounded-bl-sm'
      }`}>
        {!mine && (
          <p className="text-[11px] font-semibold text-neon-green mb-0.5 flex items-center gap-1">
            <ShieldCheck size={10} /> Support Agent
          </p>
        )}
        <p className="text-sm text-gray-100 break-words whitespace-pre-wrap">{message.text}</p>
        <p className={`text-[10px] mt-1 ${mine ? 'text-neon-green/70 text-right' : 'text-gray-600'}`}>
          {fmtTime(message.ts)}
        </p>
      </div>
    </div>
  )
}
