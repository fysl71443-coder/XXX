import React from 'react'

export default function Toast({ type = 'info', message = '', onClose }){
  if (!message) return null
  const variants = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }
  const cls = `fixed bottom-4 right-4 px-4 py-2 border rounded shadow ${variants[type]||variants.info}`
  return (
    <div className={cls}>
      <div className="flex items-center gap-2">
        <div className="text-sm">{message}</div>
        {onClose && (<button className="text-xs opacity-70 hover:opacity-100" onClick={onClose}>×</button>)}
      </div>
    </div>
  )
}