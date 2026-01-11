import React, { useCallback, useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { journal as apiJournal } from '../services/api'
import { generateReportPDF } from '../printing/pdf/autoReports'
import { settings as apiSettings } from '../services/api'
 

export default function GeneralLedger() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [error, setError] = useState(null)
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  

  useEffect(()=>{
    Promise.all([
      apiSettings.get('settings_branding').catch(()=>null),
      apiSettings.get('settings_footer').catch(()=>null),
    ]).then(([b,f])=>{ setBranding(b); setFooterCfg(f) })
  },[])

  

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (from && to) {
        const f = new Date(from).getTime()
        const t = new Date(to).getTime()
        if (f > t) {
          setError('invalid_period')
          setRows([])
          setReportRows([])
          return
        }
      }
      const status = 'posted'
      const params = { from, to, pageSize: 500 }
      if (status) params.status = status
      const data = await apiJournal.list(params)
      const items = Array.isArray(data.items) ? data.items : data
      const flattened = []
      items.forEach(e => {
        (e.postings || []).forEach(p => {
          const raw = p.account ? (p.account.account_code || p.account.id) : p.account_id
          const code = String(raw).padStart(4,'0')
          const label = p.account ? labelName(p.account) : `Account ${p.account_id}`
          flattened.push({
            date: e.date,
            entry_number: e.entry_number,
            description: e.description,
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
        const accountCode = r.account_label.split(' - ')[0].trim()
        const ref = r.description || String(r.entry_number||'')
        bal = bal + parseFloat(r.debit||0) - parseFloat(r.credit||0)
        return { date: r.date, jrnl, accountCode, ref, debit: parseFloat(r.debit||0), credit: parseFloat(r.credit||0), balance: bal }
      })
      setRows(finalRows)
      setReportRows(rr)
      setError(null)
    } catch (e) {
      setError('request_failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to])

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

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50" disabled={loading}>{loading?'Loading...':'Refresh'}</button>
        <button onClick={exportExcel} className="px-3 py-2 bg-gray-800 text-white rounded disabled:opacity-50" disabled={exportingExcel}>{exportingExcel ? 'Exporting...' : 'Export Excel'}</button>
        <button onClick={exportPDF} className="px-3 py-2 bg-gray-800 text-white rounded disabled:opacity-50" disabled={exportingPDF}>{exportingPDF ? 'Generating...' : 'Export PDF'}</button>
      </div>
      
      {error ? (
        <div className="text-red-600 text-sm">{error==='invalid_period' ? 'Invalid period' : 'Failed to load general ledger.'}</div>
      ) : null}
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-2">Date</th>
            <th className="p-2">JRNL</th>
            <th className="p-2">Account</th>
            <th className="p-2">Ref</th>
            <th className="p-2">Debit</th>
            <th className="p-2">Credit</th>
            <th className="p-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((r, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              <td className="p-2">{fmtDate(r.date)}</td>
              <td className="p-2">{r.jrnl}</td>
              <td className="p-2">{r.accountCode}</td>
              <td className="p-2">{r.ref}</td>
              <td className="p-2">{fmt(r.debit)} SAR</td>
              <td className="p-2">{fmt(r.credit)} SAR</td>
              <td className="p-2">{fmt(r.balance)} SAR</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function labelName(acc){
  const en = acc?.name_en || ''
  return sanitizeName(en)
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

 

 
