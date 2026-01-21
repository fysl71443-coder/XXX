import React, { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { journal as apiJournal, settings as apiSettings } from '../services/api'
import { printAccountStatementPDF } from '../printing/pdf/reportPdf'
import { FaFileExcel, FaFilePdf, FaSync } from 'react-icons/fa'

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
    setError(null)
    try {
      const rows = await apiJournal.byAccount(account.id, { from, to, pageSize: 1000 })
      // Handle both array and object with items property
      const entriesArray = Array.isArray(rows) ? rows : (Array.isArray(rows?.items) ? rows.items : [])
      // Sort by date ascending for running balance calculation
      entriesArray.sort((a, b) => {
        const dateA = new Date(a.journal?.date || a.date || '').getTime()
        const dateB = new Date(b.journal?.date || b.date || '').getTime()
        return dateA - dateB
      })
      setEntries(entriesArray)
    } catch (e) {
      console.error('[AccountStatement] Error loading entries:', e)
      if (e?.status === 403) {
        setError(lang === 'ar' ? 'ليس لديك صلاحية لعرض كشف الحساب' : 'You do not have permission to view account statement')
      } else {
        setError(lang === 'ar' ? 'تعذّر تحميل كشف الحساب' : 'Failed to load account statement')
      }
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [account, from, to, lang])

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

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebit = withRunning.reduce((sum, e) => sum + parseFloat(e.debit || 0), 0)
    const totalCredit = withRunning.reduce((sum, e) => sum + parseFloat(e.credit || 0), 0)
    const finalBalance = withRunning.length > 0 ? withRunning[withRunning.length - 1].running : 0
    return { debit: totalDebit, credit: totalCredit, balance: finalBalance }
  }, [withRunning])

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm text-gray-600">{lang==='ar'?'من':'From'}</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="text-sm text-gray-600">{lang==='ar'?'إلى':'To'}</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50 flex items-center gap-2 hover:bg-primary-700 transition" disabled={loading}>
          <FaSync className={loading ? 'animate-spin' : ''} />
          {loading?(lang==='ar'?'جارٍ التحميل...':'Loading...'):(lang==='ar'?'تحديث':'Refresh')}
        </button>
        <button onClick={exportExcel} className="px-3 py-2 bg-green-700 text-white rounded flex items-center gap-2 disabled:opacity-50 hover:bg-green-800 transition" disabled={exportingExcel || !withRunning.length}>
          <FaFileExcel /> {exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : (lang==='ar'?'Excel':'Excel')}
        </button>
        <button onClick={exportPDF} className="px-3 py-2 bg-red-700 text-white rounded flex items-center gap-2 disabled:opacity-50 hover:bg-red-800 transition" disabled={exportingPDF || !withRunning.length}>
          <FaFilePdf /> {exportingPDF ? (lang==='ar'?'جارٍ التوليد...':'Generating...') : (lang==='ar'?'PDF':'PDF')}
        </button>
      </div>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      ) : null}
      
      {!error && withRunning.length === 0 && !loading ? (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-700 text-sm">
          {lang==='ar'?'لا توجد حركات في هذا الحساب للفترة المحددة':'No transactions found for this account in the selected period'}
        </div>
      ) : null}

      {withRunning.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 p-3 rounded border">
              <div className="text-xs text-blue-600">{lang==='ar'?'الرصيد الافتتاحي':'Opening Balance'}</div>
              <div className="text-lg font-bold text-blue-700">{fmt(account?.opening_balance || 0, lang)}</div>
            </div>
            <div className="bg-green-50 p-3 rounded border">
              <div className="text-xs text-green-600">{lang==='ar'?'إجمالي المدين':'Total Debit'}</div>
              <div className="text-lg font-bold text-green-700">{fmt(totals.debit, lang)}</div>
            </div>
            <div className="bg-red-50 p-3 rounded border">
              <div className="text-xs text-red-600">{lang==='ar'?'إجمالي الدائن':'Total Credit'}</div>
              <div className="text-lg font-bold text-red-700">{fmt(totals.credit, lang)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              <div className="text-xs text-gray-600">{lang==='ar'?'الرصيد النهائي':'Closing Balance'}</div>
              <div className={`text-lg font-bold ${totals.balance < 0 ? 'text-red-700' : 'text-gray-700'}`}>{fmt(totals.balance, lang)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 text-gray-700">{lang==='ar'?'التاريخ':'Date'}</th>
                  <th className="p-2 text-gray-700">{lang==='ar'?'رقم القيد':'Entry #'}</th>
                  <th className="p-2 text-gray-700">{lang==='ar'?'الوصف':'Description'}</th>
                  <th className="p-2 text-gray-700">{lang==='ar'?'مدين':'Debit'}</th>
                  <th className="p-2 text-gray-700">{lang==='ar'?'دائن':'Credit'}</th>
                  <th className="p-2 text-gray-700">{lang==='ar'?'الرصيد':'Balance'}</th>
                </tr>
              </thead>
              <tbody>
                {withRunning.map((e, idx) => (
                  <tr key={idx} className={`border-b hover:bg-gray-50 transition ${parseFloat(e.running||0) < 0 ? 'bg-red-50' : ''}`}>
                    <td className="p-2 text-sm">{fmtDate(e.journal?.date || e.date, lang)}</td>
                    <td className="p-2 text-sm font-mono">#{e.journal?.entry_number || e.entry_number || '—'}</td>
                    <td className="p-2 text-sm max-w-[300px] truncate" title={e.journal?.description || e.description || ''}>{e.journal?.description || e.description || '—'}</td>
                    <td className="p-2 text-sm text-blue-700">{parseFloat(e.debit || 0) > 0 ? fmt(parseFloat(e.debit || 0), lang) : '—'}</td>
                    <td className="p-2 text-sm text-red-700">{parseFloat(e.credit || 0) > 0 ? fmt(parseFloat(e.credit || 0), lang) : '—'}</td>
                    <td className={`p-2 text-sm font-medium ${parseFloat(e.running||0) < 0 ? 'text-red-600' : ''}`}>{fmt(parseFloat(e.running || 0), lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="p-2" colSpan={3}>{lang==='ar'?'المجموع':'Total'}</td>
                  <td className="p-2 text-blue-700">{fmt(totals.debit, lang)}</td>
                  <td className="p-2 text-red-700">{fmt(totals.credit, lang)}</td>
                  <td className={`p-2 ${totals.balance < 0 ? 'text-red-600' : ''}`}>{fmt(totals.balance, lang)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {lang==='ar'?`عدد الحركات: ${withRunning.length}`:`Transactions: ${withRunning.length}`}
          </div>
        </>
      ) : null}
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
