import React from 'react'
import { t } from '../utils/i18n'

export default function StatusBadge({ status, type = 'status' }){
  const s = String(status||'').toLowerCase()
  const lang = typeof window !== 'undefined' ? (localStorage.getItem('lang')||'ar') : 'ar'
  if (type === 'period') {
    const cls = s === 'open' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'
    const label = s === 'open' ? t('labels.open', lang) : t('labels.closed', lang)
    return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>
  }
  const mapCls = {
    posted: 'bg-blue-600 text-white border-blue-600',
    draft: 'bg-sky-50 text-sky-700 border-sky-200',
    reversed: 'bg-gray-100 text-gray-700 border-gray-300',
    due: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    partial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    unpaid: 'bg-rose-50 text-rose-700 border-rose-200'
  }
  const labelsKey = {
    posted: 'labels.posted',
    draft: 'labels.draft',
    reversed: 'labels.reversed',
    due: 'labels.due',
    cancelled: 'labels.cancelled',
    partial: 'labels.partial',
    paid: 'labels.paid',
    unpaid: 'labels.unpaid'
  }
  const cls = mapCls[s] || 'bg-gray-50 text-gray-700 border-gray-200'
  const label = t(labelsKey[s] || s, lang)
  return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>
}