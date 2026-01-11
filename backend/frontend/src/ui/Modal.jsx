import React from 'react'
import { t } from '../utils/i18n'

export default function Modal({ open = false, title = '', children, actions = null, onClose }){
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-gray-200 shadow-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">{title}</div>
          <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={onClose}>{t('labels.close')}</button>
        </div>
        <div className="space-y-3">{children}</div>
        {actions && (<div className="mt-4 flex justify-end gap-2">{actions}</div>)}
      </div>
    </div>
  )
}