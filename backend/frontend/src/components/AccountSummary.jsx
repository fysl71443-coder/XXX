import React, { useEffect, useState } from 'react'

export default function AccountSummary({ account }) {
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  const opening = account.opening_balance != null
    ? parseFloat(account.opening_balance || 0)
    : (parseFloat(account.opening_debit || 0) - parseFloat(account.opening_credit || 0))
  const current = parseFloat(account.current_balance ?? account.balance ?? 0)
  return (
    <div className="p-4 bg-gray-50 rounded shadow space-y-2">
      <h2 className="text-xl font-bold">{String(account.account_number || account.account_code || account.id).padStart(4,'0')} • {lang==='ar'?(isBroken(account.name)?(account.name_en||account.name||''):(account.name||'')):(account.name_en||account.name||'')}</h2>
      <p>{lang==='ar'?"نوع":"Type"}: {account.type}</p>
      <p>{lang==='ar'?"الرصيد الافتتاحي":"Opening Balance"}: <span className={opening < 0 ? 'text-red-600' : ''}>{fmt(opening, lang)}</span></p>
      <p>{lang==='ar'?"الرصيد الحالي":"Current Balance"}: <span className={current < 0 ? 'text-red-600' : ''}>{fmt(current, lang)}</span></p>
    </div>
  )
}

function isBroken(s){
  const n = s || ''
  return /^\?+$/.test(n)
}

function fmt(n, lang){
  try {
    const val = Number(n||0)
    const abs = Math.abs(val)
    const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
    return val < 0 ? `(${s})` : s
  } catch { const v = Number(n||0); const s = Math.abs(v).toFixed(2); return v < 0 ? `(${s})` : s }
}
