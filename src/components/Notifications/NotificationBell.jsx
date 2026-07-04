import React, { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react'
import { useNotifications, NOTIF_META, ACCENT } from '../../context/NotificationContext'

const timeAgo = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function NotificationBell({ controller }) {
  // Defaults to the user notification center; the admin console passes its own
  // controller (useAdminNotifications) so the exact same UI is reused.
  const fallback = useNotifications()
  const { notifications, unreadCount, markAllRead, handleClick, clearAll } = controller || fallback
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Opening the dropdown clears the unread badge. (markAllRead runs in the event
  // handler — never inside the setOpen updater — to avoid setState-during-render.)
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) markAllRead()
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onRowClick = (notif) => { handleClick(notif); setOpen(false) }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      {/* Bell button */}
      <button
        onClick={toggle}
        aria-label="Notifications"
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
          open ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex">
            <span className="absolute inline-flex w-full h-full rounded-full bg-neon-blue opacity-60 animate-ping" />
            <span className="relative inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-neon-blue text-white text-[9px] font-bold leading-none border border-dark-400">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] rounded-2xl overflow-hidden z-50 flex flex-col notif-dropdown"
          style={{ background: '#12161A', border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 20px 50px rgba(0,0,0,.55)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-neon-blue" />
              <span className="text-sm font-bold text-white">Notifications</span>
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition-colors"
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-neon-red transition-colors"
                >
                  <Trash2 size={12} /> Clear all
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <BellOff size={20} className="text-gray-600" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No new notifications</p>
                <p className="text-xs text-gray-600 mt-1">You're all caught up.</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = NOTIF_META[n.type] || NOTIF_META.general
                const accent = ACCENT[meta.accent] || ACCENT.blue
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => onRowClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-white/3 transition-colors hover:bg-white/5 ${
                      n.isRead ? 'opacity-60' : 'bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent.bg} border ${accent.border}`}>
                      <Icon size={15} className={accent.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${accent.text}`}>{meta.title}</p>
                        {!n.isRead && <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} shrink-0`} />}
                      </div>
                      <p className="text-sm text-gray-200 leading-snug break-words">{n.message}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(n.timestamp)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
