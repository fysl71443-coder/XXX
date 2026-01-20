import React, { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { journal as apiJournal, settings as apiSettings } from '../services/api'
import { printAccountStatementPDF } from '../printing/pdf/reportPdf'
import { FaFileExcel, FaFilePdf } from 'react-icons/fa'

export default function AccountStatement({ account }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [error, setError] = useState(null)

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    try {
      const rows = await apiJournal.byAccount(account.id, { from, to })
      // Handle both array and object with items property
      const entriesArray = Array.isArray(rows) ? rows : (Array.isArray(rows?.items) ? rows.items : [])
      setEntries(entriesArray)
      setError(null)
    } catch (e) {
      console.error('[AccountStatement] Error loading entries:', e)
      setError('request_failed')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [account, from, to])

  useEffect(() => { load() }, [load])

  const withRunning = useMemo(() => {
    const start = account?.opening_balance != null
      ? parseFloat(account?.opening_balance || 0)
      : (parseFloat(account?.opening_debit || 0) - parseFloat(account?.opening_credit || 0))
    let balance = start
    const entriesArray = Array.isArray(entries) ? entries : (Array.isArray(entries?.items) ? entries.items : [])
    return entriesArray.map(e => {
      const debit = parseFloat(e.debit || 0)
      const credit = parseFloat(e.credit || 0)
      balance += debit - credit
      return { ...e, running: balance }
    })
  }, [entries, account])

  async function exportPDF() {
    try {
      setExportingPDF(true)
      await printAccountStatementPDF({ accountId: account?.id, from, to, lang })
    } finally {
      setExportingPDF(false)
    }
  }

  function exportExcel() {
    try {
      setExportingExcel(true)
      const headers = ['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance']
      const data = withRunning.map(e => ({
        [headers[0]]: e.journal?.date,
        [headers[1]]: e.journal?.entry_number,
        [headers[2]]: e.journal?.description,
        [headers[3]]: Number(e.debit || 0),
        [headers[4]]: Number(e.credit || 0),
        [headers[5]]: Number(e.running || 0)
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)

      const colWidths = [
        { wch: 12 },
        { wch: 10 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
      ]
      ws['!cols'] = colWidths

      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let row = 1; row <= range.e.r; row++) {
        for (let col = 3; col <= 5; col++) {
          const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
          if (cell && cell.v != null) {
            cell.z = '#,##0.00'
            cell.t = 'n'
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Account Statement')
      XLSX.writeFile(wb, `account_${account?.account_code||account?.id}_statement.xlsx`)
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm text-gray-600">{lang==='ar'?'من':'From'}</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="text-sm text-gray-600">{lang==='ar'?'إلى':'To'}</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50" disabled={loading}>{loading?(lang==='ar'?'جارٍ التحميل...':'Loading...'):(lang==='ar'?'تحديث':'Refresh')}</button>
        <button onClick={exportExcel} className="px-3 py-2 bg-gray-800 text-white rounded flex items-center gap-2 disabled:opacity-50" disabled={exportingExcel}>
          <FaFileExcel /> {exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : (lang==='ar'?'تصدير Excel':'Export Excel')}
        </button>
        <button onClick={exportPDF} className="px-3 py-2 bg-red-700 text-white rounded flex items-center gap-2 disabled:opacity-50" disabled={exportingPDF}>
          <FaFilePdf /> {exportingPDF ? (lang==='ar'?'جارٍ التوليد...':'Generating...') : (lang==='ar'?'تصدير PDF':'Export PDF')}
        </button>
      </div>
      {error ? (
        <div className="text-red-600 text-sm">{lang==='ar'?'تعذّر تحميل كشف الحساب.':'Failed to load account statement.'}</div>
      ) : null}

      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
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
            <tr key={idx} className={`border-b hover:bg-gray-50 ${parseFloat(e.running||0) < 0 ? 'bg-red-50' : ''}`}>
              <td className="p-2">{fmtDate(e.journal.date, lang)}</td>
              <td className="p-2">{e.journal.entry_number}</td>
              <td className="p-2">{e.journal.description}</td>
              <td className="p-2"><span className={parseFloat(e.debit||0) < 0 ? 'text-red-600' : ''}>{fmt(parseFloat(e.debit || 0), lang)}</span></td>
              <td className="p-2"><span className={parseFloat(e.credit||0) < 0 ? 'text-red-600' : ''}>{fmt(parseFloat(e.credit || 0), lang)}</span></td>
              <td className="p-2"><span className={parseFloat(e.running||0) < 0 ? 'text-red-600' : ''}>{fmt(parseFloat(e.running || 0), lang)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmt(n, lang){
  try {
    const val = Number(n||0)
    const abs = Math.abs(val)
    const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
    return val < 0 ? `(${s})` : s
  } catch { const v = Number(n||0); const s = Math.abs(v).toFixed(2); return v < 0 ? `(${s})` : s }
}

function fmtDate(d, lang){
  try { return new Date(d).toLocaleDateString('en-GB') } catch { return new Date(d).toLocaleDateString('en-GB') }
}
