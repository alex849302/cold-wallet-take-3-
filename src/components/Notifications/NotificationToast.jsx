import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { NOTIF_META, ACCENT } from '../../context/NotificationContext'

const AUTO_MS  = 4500   // visible time before it fades out
const LEAVE_MS = 280    // fade-out duration (keep in sync with CSS .leaving)

const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/* A single real-time pop-up. The whole card is clickable (deep-links via
   onClick); the X dismisses instantly. Auto-dismisses after ~4.5s. */
export default function NotificationToast({ notif, onClick, onClose }) {
  const meta = NOTIF_META[notif.type] || NOTIF_META.general
  const accent = ACCENT[meta.accent] || ACCENT.blue
  const Icon = meta.icon
  const [leaving, setLeaving] = useState(false)
  const timers = useRef([])

  const close = () => {
    setLeaving(true)
    timers.current.push(setTimeout(() => onClose(notif.id), LEAVE_MS))
  }

  // Auto-dismiss timeline.
  useEffect(() => {
    timers.current.push(setTimeout(() => setLeaving(true), AUTO_MS))
    timers.current.push(setTimeout(() => onClose(notif.id), AUTO_MS + LEAVE_MS))
    return () => timers.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(notif)}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(notif) }}
      className={`notif-toast ${leaving ? 'leaving' : ''} cursor-pointer glass rounded-xl px-3.5 py-3 flex items-start gap-3 border ${accent.border} ${accent.bg} shadow-card w-80 hover:brightness-110 transition`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent.bg} border ${accent.border}`}>
        <Icon size={16} className={accent.text} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold ${accent.text}`}>{meta.title}</p>
        <p className="text-sm text-gray-100 leading-snug break-words">{notif.message}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{timeNow()} · tap to view</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); close() }}
        className="text-gray-500 hover:text-white transition-colors shrink-0 -mr-1"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}
