import React from 'react'
import { useNotifications } from '../../context/NotificationContext'
import NotificationToast from './NotificationToast'

/* Top-right stack of real-time pop-ups. Renders nothing when idle, so it's
   safe to mount globally. Each toast manages its own auto-dismiss. */
export default function NotificationToasts({ controller }) {
  const fallback = useNotifications()
  const { activeToasts, handleClick, removeToast } = controller || fallback
  if (activeToasts.length === 0) return null

  return (
    <div className="notif-toast-container">
      {activeToasts.map(notif => (
        <NotificationToast
          key={notif.id}
          notif={notif}
          onClick={handleClick}
          onClose={removeToast}
        />
      ))}
    </div>
  )
}
