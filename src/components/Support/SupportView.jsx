import React, { useEffect, useRef, useState } from 'react'
import {
  Headphones, BookOpen, Ticket, ChevronDown, Send, Mail, MessageSquare,
  Key, ArrowLeftRight, CreditCard, LifeBuoy, ArrowLeft, ShieldCheck
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupport } from '../../context/SupportContext'
import { useTickets, createTicket, appendMessage, markRead } from '../../lib/ticketStore'

/* ──────────────────────────────────────────────────────────────────────────
   Support Hub — standalone tabbed support page (separate from Settings).
   Tabs: live specialist chat, help center, and the user's support tickets
   (now with a full per-ticket chat thread that syncs with the admin via the
   shared ticket store).
   ────────────────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'chat',    label: 'Talk to a Specialist', icon: Headphones },
  { id: 'tickets', label: 'Chats',                icon: Ticket },
  { id: 'faq',     label: 'Help Center & FAQ',    icon: BookOpen },
]

const TOPICS = ['Transaction Issue', 'Verification', 'Wallet Setup', 'Other']
const TX_TOPIC = 'Transaction Issue'

const TYPE_LABEL = { Send: 'Sent', Receive: 'Received', Swap: 'Swapped', Buy: 'Bought', Sell: 'Sold' }
const shortHash = (h) => (h ? `${h.slice(0, 6)}...${h.slice(-4)}` : '')

const txOptionLabel = (t) => {
  const label = TYPE_LABEL[t.type] || t.type
  const asset = (t.asset || '').replace('→', ' → ')
  const amt = t.amount != null ? `${t.amount} ` : ''
  return `${label} ${amt}${asset} · ${shortHash(t.hash)} · ${t.date}`
}

const FAQ_CARDS = [
  {
    key: 'wallet', icon: Key, title: 'Wallet & Security',
    desc: 'How to back up and safeguard your recovery phrase.',
    articles: [
      { q: 'How do I back up my recovery phrase?', a: 'Go to Settings → Security → Reveal Recovery Phrase. Write the 24 words down on paper in the exact order shown and store them somewhere safe and offline. Never photograph them or save them to the cloud.' },
      { q: 'What is a recovery phrase?', a: 'A recovery phrase (seed phrase) is a list of 24 words that acts as the master key to your wallet. Anyone who has it can access your funds, so keep it private and never share it with anyone — including support.' },
      { q: 'How do I keep my wallet secure?', a: 'Use a strong, unique password, never share your recovery phrase, always double-check the destination address before sending, and be cautious of phishing links or anyone asking for your seed phrase.' },
    ],
  },
  {
    key: 'transactions', icon: ArrowLeftRight, title: 'Transactions & Fees',
    desc: 'Understanding network fees and transaction times.',
    articles: [
      { q: 'Why is my transaction pending?', a: 'Outgoing (Send) transactions require administrator approval before they are processed. Once approved, the transfer settles and your balance updates — you will receive a notification the moment it completes.' },
      { q: 'How are network fees calculated?', a: 'Fees depend on the asset and current network congestion at the time of the transfer. The estimated fee is always shown before you confirm a transaction.' },
      { q: 'How long do transfers take?', a: 'Internal transfers settle immediately after approval. On-chain transfers depend on network confirmations and usually complete within a few minutes.' },
    ],
  },
  {
    key: 'cards', icon: CreditCard, title: 'Cards & Deposits',
    desc: 'Tracking card delivery and funding methods.',
    articles: [
      { q: 'How do I request a ZX Visa Card?', a: 'Open the Cards tab, enter your card name and billing address, then tap Request. Your application is submitted for review and you can track its status right on that screen.' },
      { q: 'How do I track card delivery?', a: 'Once your request is approved, the Cards tab shows the current status and you will receive a notification with delivery details as they become available.' },
      { q: 'What funding methods are supported?', a: 'You can fund your account with on-chain deposits to your wallet addresses (see the Receive tab), or buy crypto through our partner via the Buy quick action on the dashboard.' },
    ],
  },
]

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function SupportView() {
  const { user, supportIntent, clearSupportIntent } = useApp()
  const uid = user?.uid
  const { tickets } = useTickets(uid)
  const { unreadCount } = useSupport() // DB-backed unread admin replies

  const [tab, setTab] = useState('faq')          // Help Center & FAQ active by default
  const [openId, setOpenId] = useState(null)     // ticket id whose chat is open
  const [connecting, setConnecting] = useState(false) // "Connecting with a specialist…" modal

  // Tab switch: leaving Tickets closes any open chat; entering "Talk to a
  // Specialist" pops the connecting modal.
  const switchTab = (next) => {
    if (next !== 'tickets') setOpenId(null)
    if (next === 'chat') setConnecting(true)
    setTab(next)
  }

  // Deep-link from a notification: open a specific tab and (optionally) a ticket.
  useEffect(() => {
    if (!supportIntent) return
    const wantTicket = supportIntent.ticketId && tickets.some(t => t.id === supportIntent.ticketId)
    if (wantTicket) {
      setTab('tickets')
      setOpenId(supportIntent.ticketId)
    } else {
      setTab(supportIntent.tab || 'tickets')
      setOpenId(null)
    }
    clearSupportIntent()
  }, [supportIntent, tickets, clearSupportIntent])

  const handleCreate = (subject, txRef, message) => createTicket(uid, { subject, txRef, message })

  return (
    <div className="max-w-5xl space-y-5">
      {/* Tabs are now the top element (title/subtitle removed to maximize space) */}
      <TabBar tab={tab} setTab={switchTab} unread={{ tickets: unreadCount > 0 }} />

      {connecting && <ConnectingModal onClose={() => setConnecting(false)} />}

      <div key={`${tab}-${openId || 'list'}`} className="page-enter">
        {tab === 'chat' && <ChatTab onCreate={handleCreate} />}
        {tab === 'faq'  && <FaqTab />}
        {tab === 'tickets' && (
          openId
            ? <TicketChat uid={uid} ticket={tickets.find(t => t.id === openId)} onBack={() => setOpenId(null)} />
            : <TicketsTab tickets={tickets} onOpen={setOpenId} />
        )}
      </div>
    </div>
  )
}

/* ── Tab navigation bar ───────────────────────────────────────────────────── */
function TabBar({ tab, setTab, unread = {} }) {
  return (
    <div className="glass rounded-2xl p-1.5 flex flex-col sm:flex-row gap-1.5">
      {TABS.map(t => {
        const active = tab === t.id
        const Icon = t.icon
        const showDot = !!unread[t.id]
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative w-full sm:flex-1 sm:min-w-fit whitespace-nowrap flex items-center justify-start sm:justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              active
                ? 'bg-neon-green/15 text-white border-neon-green/30 shadow'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}>
            <Icon size={16} className={active ? 'text-neon-green' : ''} />
            {t.label}
            {/* Unread admin-reply indicator dot on the tab header */}
            {showDot && (
              <span className="absolute top-1.5 right-2 flex w-2.5 h-2.5" title="New reply">
                <span className="absolute inline-flex w-full h-full rounded-full bg-neon-red opacity-60 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-neon-red border border-dark-400" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 1 — Talk to a Specialist
   ════════════════════════════════════════════════════════════════════════════ */
function ChatTab({ onCreate }) {
  const { showToast, transactions } = useApp()
  const { sendMessage } = useSupport()
  const [topic, setTopic]     = useState(TOPICS[0])
  const [message, setMessage] = useState('')
  const [txId, setTxId]       = useState('')
  const [sending, setSending] = useState(false)

  const showTxPicker = topic === TX_TOPIC
  const selectedTx = transactions.find(t => t.id === txId) || null

  const handleTopic = (value) => {
    setTopic(value)
    if (value !== TX_TOPIC) setTxId('')
  }

  const start = async (e) => {
    e.preventDefault()
    if (!message.trim()) return showToast('Please describe your issue first.', 'error')
    setSending(true)
    try {
      const txRef = selectedTx ? (selectedTx.hash || selectedTx.id) : null
      const body = `[${topic}] ${message.trim()}${txRef ? `\n\nRelated transaction: ${txRef}` : ''}`
      await sendMessage(body)            // existing backend support thread
      onCreate?.(topic, txRef, message.trim()) // persistent ticket w/ chat thread
      showToast('Chat started — our team will reply shortly.', 'success')
      setMessage('')
    } catch (err) {
      showToast(err.message || 'Could not start chat. Please try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Left — live support form */}
      <div className="lg:col-span-3 glass rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <Headphones size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Live Support</h2>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-neon-green" />
              </span>
              <span className="text-neon-green font-medium">Online</span> · Typical reply time: 10 mins
            </p>
          </div>
        </div>

        <form onSubmit={start} className="p-5 sm:p-6 space-y-4">
          {/* Topic */}
          <div>
            <label className="label-xs mb-1.5">Topic</label>
            <div className="relative">
              <select value={topic} onChange={e => handleTopic(e.target.value)}
                className="wallet-input appearance-none h-11 !pr-9 cursor-pointer font-medium">
                {TOPICS.map(t => <option key={t} value={t} style={{ background: '#1E2329' }}>{t}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Conditional transaction picker */}
          <div className={`grid transition-all duration-200 ease-out ${
            showTxPicker ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}>
            <div className="overflow-hidden">
              <label className="label-xs mb-1.5">Select Associated Transaction</label>
              <div className="relative">
                <select value={txId} onChange={e => setTxId(e.target.value)} disabled={!showTxPicker}
                  className="wallet-input appearance-none h-11 !pr-9 cursor-pointer font-medium">
                  <option value="" style={{ background: '#1E2329' }}>
                    {transactions.length ? 'Choose a transaction…' : 'No transactions found'}
                  </option>
                  {transactions.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#1E2329' }}>{txOptionLabel(t)}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              {selectedTx && (
                <p className="text-[11px] text-gray-500 mt-1.5 font-num truncate">
                  Linked: <span className="text-neon-green">{selectedTx.hash || selectedTx.id}</span>
                </p>
              )}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="label-xs mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="Describe your issue and we'll connect you with a specialist…"
              className="wallet-input resize-none py-3 leading-relaxed" />
          </div>

          <button type="submit" disabled={sending}
            className="w-full h-12 rounded-xl font-bold text-dark-400 text-sm transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #00E676, #00C853)', boxShadow: '0 8px 24px rgba(0,230,118,.28)' }}>
            <Send size={16} /> {sending ? 'Starting…' : 'Start Chat'}
          </button>
        </form>
      </div>

      {/* Right — alternative contact */}
      <div className="lg:col-span-2 glass rounded-2xl overflow-hidden flex flex-col">
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <LifeBuoy size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Other ways to reach us</h2>
            <p className="text-xs text-gray-500">Prefer not to chat? Use one of these.</p>
          </div>
        </div>

        <div className="p-5 sm:p-6 flex-1 flex flex-col gap-3">
          <p className="text-sm text-gray-400 leading-relaxed">
            Prefer other methods? Email us or join our official Discord community — we're
            around 24/7 and usually reply within a few hours.
          </p>
          <ContactRow icon={Mail} label="Email us" value="support@vaultx.com" tint="blue" />
          <ContactRow icon={MessageSquare} label="Discord community" value="discord.gg/vaultx" tint="purple" />
          <div className="mt-auto pt-3 text-xs text-gray-600">
            Average first response: <span className="text-gray-400">~10 minutes</span> on live chat.
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactRow({ icon: Icon, label, value, tint }) {
  const tints = {
    blue:   'bg-neon-green/10 border-neon-green/25 text-neon-green',
    purple: 'bg-neon-purple/10 border-neon-purple/25 text-neon-purple',
  }
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 border border-white/5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tints[tint] || tints.blue}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-sm font-medium text-white truncate">{value}</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 2 — Help Center & FAQ
   ════════════════════════════════════════════════════════════════════════════ */
function FaqTab() {
  // currentView: null = category menu, else the selected category key.
  const [activeKey, setActiveKey] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  const active = FAQ_CARDS.find(c => c.key === activeKey) || null

  // ── Detail view: a category's article list (with a Back button) ──
  if (active) {
    const Icon = active.icon
    return (
      <div className="space-y-4 page-enter">
        {/* Back + category header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveKey(null); setOpenArticle(null) }}
            className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all shrink-0 cursor-pointer">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-neon-green" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">{active.title}</h2>
              <p className="text-xs text-gray-500">{active.articles.length} help articles</p>
            </div>
          </div>
        </div>

        {/* Article accordion */}
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          {active.articles.map((art, i) => {
            const open = openArticle === i
            return (
              <div key={i}>
                <button onClick={() => setOpenArticle(open ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer">
                  <span className="flex-1 text-sm font-medium text-white">{art.q}</span>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180 text-neon-green' : 'text-gray-500'}`} />
                </button>
                <div className={`grid transition-all duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{art.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Menu view: clickable category cards ──
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FAQ_CARDS.map(({ key, icon: Icon, title, desc, articles }) => (
        <button key={key} type="button" onClick={() => { setActiveKey(key); setOpenArticle(null) }}
          className="text-left glass rounded-2xl p-5 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:border-neon-green/30 border border-white/6 group cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center shrink-0 group-hover:bg-neon-green/20 transition-colors">
            <Icon size={18} className="text-neon-green" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neon-green opacity-0 group-hover:opacity-100 transition-opacity">
              View {articles.length} articles →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   "Connecting with a specialist…" modal (Talk to a Specialist trigger)
   ════════════════════════════════════════════════════════════════════════════ */
function ConnectingModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}
         style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}>
      <div className="glass rounded-2xl p-7 w-full max-w-sm text-center notif-dropdown" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-2xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center mx-auto mb-4">
          <Headphones size={24} className="text-neon-green" />
        </div>
        <div className="w-7 h-7 rounded-full border-2 border-neon-green/25 border-t-neon-green animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-white">Connecting with a specialist…</h3>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
          Hang tight — we're finding the next available agent. You can describe your issue below while you wait.
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-neon-green">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-neon-green" />
          </span>
          Online · typical wait ~10 min
        </div>
        <button onClick={onClose} className="btn-primary w-full h-11 mt-5">Continue to chat</button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 3 — Support Tickets (table)
   ════════════════════════════════════════════════════════════════════════════ */
const COLS = 'grid grid-cols-[auto_0.9fr_1.3fr_1.1fr_1.1fr_auto] gap-3'

function TicketsTab({ tickets, onOpen }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
          <Ticket size={16} className="text-neon-green" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Support Tickets</h2>
          <p className="text-xs text-gray-500">Select a ticket to open its conversation</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Ticket size={20} className="text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">You have no active support tickets.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table (lg+) — fits the width, no horizontal sliding ── */}
          <div className="hidden lg:block">
            <div className={`${COLS} px-5 sm:px-6 py-3 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5`}>
              <span />
              <span>Ticket ID</span>
              <span>Subject / Topic</span>
              <span>Associated TX</span>
              <span>Created Date</span>
              <span className="text-right">Status</span>
            </div>
            {tickets.map(t => {
              const unread = (t.unread || 0) > 0
              return (
                <button key={t.key || t.id} onClick={() => onOpen(t.id)}
                  className={`${COLS} w-full text-left px-5 sm:px-6 py-3.5 items-center border-b border-white/3 transition-colors hover:bg-white/5 ${
                    unread ? 'bg-neon-green/5' : ''
                  }`}>
                  {/* Unread dot */}
                  <span className="flex w-2.5 justify-center">
                    {unread && (
                      <span className="relative flex w-2 h-2" title="New reply">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
                        <span className="relative inline-flex w-2 h-2 rounded-full bg-neon-green" />
                      </span>
                    )}
                  </span>
                  <span className={`text-sm font-num ${unread ? 'text-white font-semibold' : 'text-gray-300'}`}>{t.id}</span>
                  <span className="text-sm text-white truncate">{t.subject}</span>
                  <span className="text-sm font-num truncate" title={t.txRef || ''}>
                    {t.txRef ? <span className="text-neon-green">{shortHash(t.txRef)}</span> : <span className="text-gray-600">—</span>}
                  </span>
                  <span className="text-sm text-gray-400 font-num">{fmtDate(t.created)}</span>
                  <span className="text-right"><StatusBadge status={t.status} /></span>
                </button>
              )
            })}
          </div>

          {/* ── Mobile / tablet cards — stacked, no horizontal sliding ── */}
          <div className="lg:hidden divide-y divide-white/5">
            {tickets.map(t => {
              const unread = (t.unread || 0) > 0
              return (
                <button key={t.key || t.id} onClick={() => onOpen(t.id)}
                  className={`w-full text-left p-4 transition-colors hover:bg-white/5 ${unread ? 'bg-neon-green/5' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {unread && (
                        <span className="relative flex w-2 h-2 shrink-0" title="New reply">
                          <span className="absolute inline-flex w-full h-full rounded-full bg-neon-green opacity-60 animate-ping" />
                          <span className="relative inline-flex w-2 h-2 rounded-full bg-neon-green" />
                        </span>
                      )}
                      <span className={`text-sm font-num shrink-0 ${unread ? 'text-white font-semibold' : 'text-neon-green'}`}>{t.id}</span>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-sm text-white truncate mb-1">{t.subject}</p>
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span className="font-num truncate" title={t.txRef || ''}>
                      {t.txRef ? <span className="text-neon-green">{shortHash(t.txRef)}</span> : '—'}
                    </span>
                    <span className="font-num shrink-0">{fmtDate(t.created)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const open = status === 'Open'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      open ? 'bg-neon-green/10 text-neon-green border-neon-green/25' : 'bg-white/5 text-gray-400 border-white/10'
    }`}>
      {status}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 3 (detail) — Ticket chat thread
   ════════════════════════════════════════════════════════════════════════════ */
function TicketChat({ uid, ticket, onBack }) {
  const { sendMessage, markRead: markThreadRead } = useSupport()
  const [text, setText] = useState('')
  const scrollRef = useRef(null)

  const messages = ticket?.messages || []

  // Auto-scroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // Opening this ticket chat clears unread the moment it mounts:
  //   • markRead (localStorage) → the per-row dot on this ticket
  //   • markThreadRead (DB)     → the global sidebar badge + the tab dot
  useEffect(() => {
    if (ticket && (ticket.unread || 0) > 0) markRead(uid, ticket.id)
    markThreadRead()
  }, [uid, ticket?.id, ticket?.unread, markThreadRead])

  // Ticket vanished (e.g. cleared elsewhere) — go back to the list.
  if (!ticket) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-sm text-gray-500 mb-4">This ticket is no longer available.</p>
        <button onClick={onBack} className="btn-primary px-5 h-10">Back to Tickets</button>
      </div>
    )
  }

  const send = (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    appendMessage(uid, ticket.id, { sender: 'user', text: body })  // show locally now
    sendMessage(body).catch(() => {})  // also deliver to the admin's Support Desk
    setText('')
  }

  return (
    // Mobile: full-screen slide-in overlay (standard mobile app chat behavior).
    // Desktop (sm+): inline panel exactly as before.
    <div className="glass overflow-hidden flex flex-col fixed inset-0 z-[60] rounded-none animate-[slideUp_.25s_ease-out] sm:static sm:z-auto sm:rounded-2xl sm:animate-none sm:h-[min(70vh,620px)]">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-white/5 flex items-center gap-3 shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all shrink-0">
          <ArrowLeft size={14} /> Back to Tickets
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">
            <span className="font-num text-neon-green">{ticket.id}</span> · {ticket.subject}
          </p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> Open · opened {fmtDate(ticket.created)}
          </p>
        </div>
        <span className="ml-auto shrink-0"><StatusBadge status={ticket.status} /></span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-600 mt-6">No messages yet — say hello to start the conversation.</p>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="px-3 sm:px-4 py-3 border-t border-white/5 flex items-center gap-2 shrink-0">
        <input type="text" value={text} onChange={e => setText(e.target.value)} autoComplete="off"
          className="wallet-input flex-1 h-11" placeholder="Type your message…" />
        <button type="submit" disabled={!text.trim()}
          className="btn-primary h-11 w-11 sm:w-auto sm:px-5 flex items-center justify-center gap-2 disabled:opacity-40">
          <Send size={16} /> <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ message }) {
  const mine = message.sender === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
        mine
          ? 'bg-neon-green/15 border border-neon-green/25 rounded-br-sm'
          : 'glass-dark rounded-bl-sm'
      }`}>
        {!mine && (
          <p className="text-xs font-semibold text-neon-green mb-0.5 flex items-center gap-1">
            <ShieldCheck size={11} /> Support Agent
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
