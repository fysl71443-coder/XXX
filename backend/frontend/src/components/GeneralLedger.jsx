import React, { useCallback, useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { journal as apiJournal, settings as apiSettings } from '../services/api'
import { generateReportPDF } from '../printing/pdf/autoReports'
import { FaSync, FaFileExcel, FaFilePdf } from 'react-icons/fa'

export default function GeneralLedger() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')
  
  const [error, setError] = useState(null)
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  

  useEffect(()=>{
    Promise.all([
      apiSettings.get('settings_branding').catch(()=>null),
      apiSettings.get('settings_footer').catch(()=>null),
    ]).then(([b,f])=>{ setBranding(b); setFooterCfg(f) })
  },[])

  

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (from && to) {
        const f = new Date(from).getTime()
        const t = new Date(to).getTime()
        if (f > t) {
          setError(lang === 'ar' ? 'فترة غير صالحة: تاريخ البداية أكبر من تاريخ النهاية' : 'Invalid period: start date is after end date')
          setRows([])
          setReportRows([])
          return
        }
      }
      const status = 'posted'
      const params = { from, to, pageSize: 1000 }
      if (status) params.status = status
      const data = await apiJournal.list(params)
      const items = Array.isArray(data.items) ? data.items : data
      const flattened = []
      items.forEach(e => {
        (e.postings || []).forEach(p => {
          const raw = p.account ? (p.account.account_code || p.account.account_number || p.account.id) : p.account_id
          const code = String(raw).padStart(4,'0')
          const accName = p.account ? (lang === 'ar' ? (p.account.name || p.account.name_en || '') : (p.account.name_en || p.account.name || '')) : `${lang === 'ar' ? 'حساب' : 'Account'} ${p.account_id}`
          const label = sanitizeName(accName)
          flattened.push({
            date: e.date,
            entry_number: e.entry_number,
            description: e.description,
            account_code: code,
            account_label: `${code} - ${label}`,
            debit: parseFloat(p.debit || 0),
            credit: parseFloat(p.credit || 0),
          })
        })
      })
      const finalRows = flattened
      const sorted = [...finalRows].sort((a,b)=>{
        const da = new Date(a.date).getTime()
        const db = new Date(b.date).getTime()
        if (da !== db) return da - db
        return (a.entry_number||0) - (b.entry_number||0)
      })
      let bal = 0
      const rr = sorted.map(r => {
        const jrnl = jrnlFrom(r)
        const accountCode = r.account_code
        const accountLabel = r.account_label
        const ref = r.description || String(r.entry_number||'')
        bal = bal + parseFloat(r.debit||0) - parseFloat(r.credit||0)
        return { date: r.date, jrnl, accountCode, accountLabel, ref, debit: parseFloat(r.debit||0), credit: parseFloat(r.credit||0), balance: bal }
      })
      setRows(finalRows)
      setReportRows(rr)
    } catch (e) {
      console.error('[GeneralLedger] Error:', e)
      if (e?.status === 403) {
        setError(lang === 'ar' ? 'ليس لديك صلاحية لعرض دفتر الأستاذ' : 'You do not have permission to view general ledger')
      } else {
        setError(lang === 'ar' ? 'فشل تحميل دفتر الأستاذ' : 'Failed to load general ledger')
      }
      setRows([])
      setReportRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, lang])

  useEffect(() => { load() }, [load])

  

  function exportExcel() {
    setExportingExcel(true)
    const headers = ['Date','Entry #','Description','Account','Debit','Credit']
    
    const data = rows.map(r => ({
      [headers[0]]: r.date,
      [headers[1]]: r.entry_number,
      [headers[2]]: r.description,
      [headers[3]]: r.account_label,
      [headers[4]]: Number(r.debit || 0),
      [headers[5]]: Number(r.credit || 0)
    }))
    
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    
    // Set column widths for better formatting
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 10 }, // Entry #
      { wch: 40 }, // Description
      { wch: 35 }, // Account
      { wch: 15 }, // Debit
      { wch: 15 }  // Credit
    ]
    ws['!cols'] = colWidths
    
    // Add formatting for numeric columns
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let row = 1; row <= range.e.r; row++) {
      for (let col = 4; col <= 5; col++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
        if (cell && cell.v) {
          cell.z = '#,##0.00'
          cell.t = 'n'
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger')
    XLSX.writeFile(wb, 'general_ledger.xlsx')
    setExportingExcel(false)
  }

  async function exportPDF() {
    setExportingPDF(true)
    try { await generateReportPDF({ reportType: 'ledger', fromDate: from, toDate: to, download: false }) }
    finally { setExportingPDF(false) }
  }

  // Calculate totals
  const totals = reportRows.reduce((acc, r) => ({
    debit: acc.debit + r.debit,
    credit: acc.credit + r.credit
  }), { debit: 0, credit: 0 })

  return (
    <div className="bg-white p-4 rounded shadow space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-gray-600">{lang === 'ar' ? 'من' : 'From'}</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="text-sm text-gray-600">{lang === 'ar' ? 'إلى' : 'To'}</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50 flex items-center gap-2 hover:bg-primary-700 transition" disabled={loading}>
          <FaSync className={loading ? 'animate-spin' : ''} />
          {loading ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Loading...') : (lang === 'ar' ? 'تحديث' : 'Refresh')}
        </button>
        <button onClick={exportExcel} className="px-3 py-2 bg-green-700 text-white rounded flex items-center gap-2 disabled:opacity-50 hover:bg-green-800 transition" disabled={exportingExcel || !reportRows.length}>
          <FaFileExcel /> {lang === 'ar' ? 'Excel' : 'Excel'}
        </button>
        <button onClick={exportPDF} className="px-3 py-2 bg-red-700 text-white rounded flex items-center gap-2 disabled:opacity-50 hover:bg-red-800 transition" disabled={exportingPDF || !reportRows.length}>
          <FaFilePdf /> {lang === 'ar' ? 'PDF' : 'PDF'}
        </button>
      </div>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      ) : null}
      
      {!error && reportRows.length === 0 && !loading ? (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-700 text-sm">
          {lang === 'ar' ? 'لا توجد قيود في الفترة المحددة' : 'No entries found in the selected period'}
        </div>
      ) : null}
      
      {reportRows.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded border">
              <div className="text-xs text-blue-600">{lang === 'ar' ? 'إجمالي المدين' : 'Total Debit'}</div>
              <div className="text-lg font-bold text-blue-700">{fmt(totals.debit)} SAR</div>
            </div>
            <div className="bg-red-50 p-3 rounded border">
              <div className="text-xs text-red-600">{lang === 'ar' ? 'إجمالي الدائن' : 'Total Credit'}</div>
              <div className="text-lg font-bold text-red-700">{fmt(totals.credit)} SAR</div>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              <div className="text-xs text-gray-600">{lang === 'ar' ? 'عدد السطور' : 'Row Count'}</div>
              <div className="text-lg font-bold text-gray-700">{reportRows.length}</div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'النوع' : 'JRNL'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'الحساب' : 'Account'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'المرجع' : 'Ref'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'مدين' : 'Debit'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'دائن' : 'Credit'}</th>
                  <th className="p-2 text-gray-700">{lang === 'ar' ? 'الرصيد' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r, idx) => (
                  <tr key={idx} className={`border-b hover:bg-gray-50 transition ${r.balance < 0 ? 'bg-red-50' : ''}`}>
                    <td className="p-2 text-sm">{fmtDate(r.date)}</td>
                    <td className="p-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.jrnl === 'INV' ? 'bg-green-100 text-green-700' : r.jrnl === 'BNK1' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {r.jrnl}
                      </span>
                    </td>
                    <td className="p-2 text-sm font-mono" title={r.accountLabel}>{r.accountCode}</td>
                    <td className="p-2 text-sm max-w-[200px] truncate" title={r.ref}>{r.ref}</td>
                    <td className="p-2 text-sm text-blue-700">{r.debit > 0 ? `${fmt(r.debit)}` : '—'}</td>
                    <td className="p-2 text-sm text-red-700">{r.credit > 0 ? `${fmt(r.credit)}` : '—'}</td>
                    <td className={`p-2 text-sm font-medium ${r.balance < 0 ? 'text-red-600' : ''}`}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-200 font-bold">
                  <td className="p-3" colSpan={4}>{lang === 'ar' ? 'المجموع' : 'Totals'}</td>
                  <td className="p-3 text-blue-700">{fmt(totals.debit)}</td>
                  <td className="p-3 text-red-700">{fmt(totals.credit)}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

function fmt(n){
  try {
    const val = Number(n||0)
    const abs = Math.abs(val)
    const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
    return val < 0 ? `(${s})` : s
  } catch { const v = Number(n||0); const s = Math.abs(v).toFixed(2); return v < 0 ? `(${s})` : s }
}

function fmtDate(d){
  try { return new Date(d).toLocaleDateString('en-GB') } catch { return new Date(d).toLocaleDateString('en-GB') }
}

function labelName(acc, lang = 'ar'){
  const name = lang === 'ar' ? (acc?.name || acc?.name_en || '') : (acc?.name_en || acc?.name || '')
  return sanitizeName(name)
}

function jrnlFrom(r){
  const desc = String(r.description||'')
  const s = desc.toUpperCase()
  if (s.includes('INV')) return 'INV'
  if (s.includes('PBNK') || s.includes('BANK') || s.includes('PAYMENT')) return 'BNK1'
  return 'JRNL'
}

function sanitizeName(s){
  const raw = String(s||'')
  return raw
    .replace(/[•]/g, ' ')
    .replace(/[–]/g, '-')
    .replace(/[()]/g, ' ')
    .replace(/[\\/]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
}

 

 
