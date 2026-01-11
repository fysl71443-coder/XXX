import React, { useEffect, useMemo, useState } from 'react'
import { journal as apiJournal } from '../services/api'

export default function LedgerTable({ accountId, opening = 0 }) {
  const [entries, setEntries] = useState([])
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(() => {
    async function load() {
      if (!accountId) return
      const rows = await apiJournal.byAccount(accountId)
      setEntries(rows)
    }
    load()
  }, [accountId])

  const withRunning = useMemo(() => {
    let balance = parseFloat(opening || 0)
    return entries.map(e => {
      const debit = parseFloat(e.debit || 0)
      const credit = parseFloat(e.credit || 0)
      balance += debit - credit
      return { ...e, running: balance }
    })
  }, [entries, opening])

  return (
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 bg-white z-10">
        <tr className="border-b">
          <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
          <th className="p-2">{lang==='ar'?'رقم القيد':'Entry #'}</th>
          <th className="p-2">{lang==='ar'?'الوصف':'Description'}</th>
          <th className="p-2">{lang==='ar'?'مدين':'Debit'}</th>
          <th className="p-2">{lang==='ar'?'دائن':'Credit'}</th>
          <th className="p-2">{lang==='ar'?'الرصيد':'Balance'}</th>
        </tr>
      </thead>
      <tbody>
        {withRunning.map((e, idx) => (
          <tr key={idx} className="border-b hover:bg-gray-50 odd:bg-gray-50">
            <td className="p-2">{new Date(e.journal.date).toLocaleDateString()}</td>
            <td className="p-2">{e.journal.entry_number}</td>
            <td className="p-2">{e.journal.description}</td>
            <td className="p-2 text-right" dir="ltr">{parseFloat(e.debit || 0).toFixed(2)}</td>
            <td className="p-2 text-right" dir="ltr">{parseFloat(e.credit || 0).toFixed(2)}</td>
            <td className="p-2 text-right" dir="ltr">{parseFloat(e.running || 0).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
