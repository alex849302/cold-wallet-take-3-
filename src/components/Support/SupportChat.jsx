import React, { useEffect, useRef } from 'react'
import { useState } from 'react'
import { LifeBuoy, Send, ShieldCheck, Headphones } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupport } from '../../context/SupportContext'

/* ── User-side live support chat ──────────────────────── */
export default function SupportChat() {
  const { user } = useApp()
  const { messages, sendMessage, refresh } = useSupport()
  const [text, setText] = useState('')
  const scrollRef = useRef(null)

  // Poll the API for new support messages every 1s; clear on unmount.
  // (SupportContext also refreshes on its own; this gives the chat a faster cadence.)
  useEffect(() => {
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  }, [refresh])

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim() || !user) return
    const body = text
    setText('')
    await sendMessage(body)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: 'min(70vh, 620px)' }}>
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/5 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <Headphones size={16} className="text-neon-green" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Support</h2>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> CoreCold team · typically replies in minutes
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-4">
                <LifeBuoy size={26} className="text-neon-green" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">How can we help?</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Send us a message about your wallet, a transaction, or your account — our team will reply right here.
              </p>
            </div>
          )}

          {messages.map(m => <Bubble key={m.id} message={m} />)}
        </div>

        {/* Composer */}
        <form onSubmit={handleSend} className="px-3 sm:px-4 py-3 border-t border-white/5 flex items-center gap-2 shrink-0">
          <input
            type="text"
            className="wallet-input flex-1 h-11"
            placeholder="Type your message…"
            value={text}
            onChange={e => setText(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" disabled={!text.trim()}
            className="btn-primary h-11 w-11 sm:w-auto sm:px-5 flex items-center justify-center gap-2 disabled:opacity-40">
            <Send size={16} /> <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-600 mt-3 flex items-center justify-center gap-1.5">
        <ShieldCheck size={12} className="text-neon-green" /> End-to-end encrypted · CoreCold Support Desk
      </p>
    </div>
  )
}

/* ── Single chat bubble ───────────────────────────────── */
function Bubble({ message }) {
  const mine = message.sender === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
        mine
          ? 'bg-neon-green/15 border border-neon-green/25 rounded-br-sm'
          : 'glass-dark rounded-bl-sm'
      }`}>
        {!mine && <p className="text-xs font-semibold text-neon-green mb-0.5">CoreCold Support</p>}
        <p className="text-sm text-gray-100 break-words whitespace-pre-wrap">{message.text}</p>
        <p className={`text-[10px] mt-1 ${mine ? 'text-neon-green/70 text-right' : 'text-gray-600'}`}>
          {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
