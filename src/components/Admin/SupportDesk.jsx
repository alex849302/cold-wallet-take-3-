import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MessagesSquare, Send, ArrowLeft, User, Inbox, Search } from 'lucide-react'
import { useSupport } from '../../context/SupportContext'
import { useAdminNotifications } from '../../context/AdminNotificationContext'

/* ── Admin Support Desk: all user threads + live reply ── */
export default function SupportDesk() {
  const { threads, adminReply } = useSupport()
  const { supportIntentUid, clearSupportIntent } = useAdminNotifications()
  const [activeUid, setActiveUid] = useState(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const scrollRef = useRef(null)

  const active = threads.find(t => t.uid === activeUid) || null

  // Type-ahead filter of the thread list by user name + email.
  const visibleThreads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    )
  }, [threads, search])

  // Auto-select the first thread once threads have loaded from the API.
  useEffect(() => {
    if (!activeUid && threads.length > 0) setActiveUid(threads[0].uid)
  }, [threads, activeUid])

  // A notification deep-linked to a specific user's thread → open it.
  useEffect(() => {
    if (supportIntentUid) {
      setActiveUid(supportIntentUid)
      clearSupportIntent()
    }
  }, [supportIntentUid, clearSupportIntent])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [active?.messages.length, activeUid])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim() || !activeUid) return
    const body = text
    setText('')
    await adminReply(activeUid, body)
  }

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: 'min(72vh, 640px)' }}>
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-white/5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
          <MessagesSquare size={16} className="text-neon-green" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Support Desk</h2>
          <p className="text-xs text-gray-500">{threads.length} conversation{threads.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Thread list ── (hidden on mobile once a thread is open) */}
        <aside className={`${active ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-64 shrink-0 border-r border-white/5 overflow-y-auto`}>
          {/* Search by user name / email */}
          {threads.length > 0 && (
            <div className="sticky top-0 z-10 p-2.5 border-b border-white/5" style={{ background: '#12161A' }}>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="wallet-input h-9 !pl-8 pr-2.5 text-sm w-full"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-500">
              <Inbox size={26} className="mb-2 text-gray-600" />
              <p className="text-xs">No conversations yet.</p>
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-500">
              <Search size={22} className="mb-2 text-gray-600" />
              <p className="text-xs">No matches for “{search}”.</p>
            </div>
          ) : visibleThreads.map(t => {
            // A thread awaits a reply when the user sent the most recent message.
            const pending = t.lastSender === 'user'
            return (
            <button key={t.uid} onClick={() => setActiveUid(t.uid)}
              className={`flex items-start gap-3 px-4 py-3 text-left border-b border-white/3 transition-all ${
                activeUid === t.uid ? 'bg-neon-green/10' : pending ? 'bg-neon-amber/[0.07] hover:bg-neon-amber/10' : 'hover:bg-white/3'
              }`}>
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-400"
                     style={{ background: 'linear-gradient(135deg, #00E676, #00BFA5)' }}>
                  {t.name.charAt(0)}
                </div>
                {/* Flashing indicator dot for an unanswered user message */}
                {pending && (
                  <span className="absolute -top-0.5 -right-0.5 flex w-2.5 h-2.5" title="Awaiting your reply">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-neon-red opacity-70 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-neon-red border border-dark-300" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${pending ? 'font-bold text-white' : 'font-semibold text-white'}`}>{t.name}</p>
                  <span className="text-[10px] text-gray-600 shrink-0">
                    {t.lastTs ? new Date(t.lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs truncate ${pending ? 'text-gray-300' : 'text-gray-500'}`}>
                    {t.lastSender === 'admin' ? 'You: ' : ''}{t.lastText}
                  </p>
                  {pending && (
                    <span className="shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-neon-amber/20 text-neon-amber font-bold border border-neon-amber/30">
                      Pending Reply
                    </span>
                  )}
                </div>
              </div>
            </button>
          )})}
        </aside>

        {/* ── Conversation ── */}
        <section className={`${active ? 'flex' : 'hidden sm:flex'} flex-col flex-1 min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <MessagesSquare size={28} className="mb-2 text-gray-600" />
              <p className="text-sm">Select a conversation to reply</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 shrink-0">
                <button onClick={() => setActiveUid(null)}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
                  <ArrowLeft size={16} />
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-400"
                     style={{ background: 'linear-gradient(135deg, #00E676, #00BFA5)' }}>
                  {active.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{active.name}</p>
                  <p className="text-xs text-gray-500 truncate">{active.email}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {active.messages.map(m => {
                  const fromAdmin = m.sender === 'admin'
                  return (
                    <div key={m.id} className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                        fromAdmin
                          ? 'bg-neon-green/15 border border-neon-green/25 rounded-br-sm'
                          : 'glass-dark rounded-bl-sm'
                      }`}>
                        {!fromAdmin && (
                          <p className="text-xs font-semibold text-gray-400 mb-0.5 flex items-center gap-1">
                            <User size={10} /> {active.name}
                          </p>
                        )}
                        <p className="text-sm text-gray-100 break-words whitespace-pre-wrap">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${fromAdmin ? 'text-neon-green/70 text-right' : 'text-gray-600'}`}>
                          {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Reply composer */}
              <form onSubmit={handleSend} className="px-3 py-3 border-t border-white/5 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  className="wallet-input flex-1 h-11"
                  placeholder={`Reply to ${active.name}…`}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  autoComplete="off"
                />
                <button type="submit" disabled={!text.trim()}
                  className="btn-primary h-11 w-11 sm:w-auto sm:px-5 flex items-center justify-center gap-2 disabled:opacity-40">
                  <Send size={16} /> <span className="hidden sm:inline">Reply</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
