import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function ActionButton({ action, children, onClick, className = '', disabledWhenClosed = false, periodStatus = null }){
  const { can } = useAuth()
  const allowed = can(action)
  const isClosed = disabledWhenClosed && String(periodStatus||'').toLowerCase() === 'closed'
  const disabled = !allowed || isClosed
  const cls = `${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  return (
    <button className={cls} disabled={disabled} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  )
}