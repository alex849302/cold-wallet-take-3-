import React from 'react'
import { CheckCircle, AlertCircle, Info, X, Zap } from 'lucide-react'

const CONFIG = {
  success: { icon: CheckCircle, color: 'text-neon-green',  border: 'border-neon-green/30', bg: 'bg-neon-green/10' },
  error:   { icon: AlertCircle, color: 'text-neon-red',    border: 'border-neon-red/30',   bg: 'bg-neon-red/10'   },
  info:    { icon: Info,        color: 'text-neon-blue',   border: 'border-neon-blue/30',  bg: 'bg-neon-blue/10'  },
  warning: { icon: Zap,         color: 'text-neon-amber',  border: 'border-neon-amber/30', bg: 'bg-neon-amber/10' },
}

export default function Toast({ toast, onDismiss }) {
  const { icon: Icon, color, border, bg } = CONFIG[toast.type] || CONFIG.info
  return (
    <div className={`toast glass rounded-xl px-4 py-3 flex items-center gap-3 border ${border} ${bg} shadow-card min-w-72`}>
      <Icon size={18} className={color} />
      <p className="text-sm text-white flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-500 hover:text-white transition-colors ml-2"
      >
        <X size={14} />
      </button>
    </div>
  )
}
