import { useEffect, useMemo, useState } from 'react'
import { invoices } from '../services/api'

export default function ClientsUnknown(){
  const lang = localStorage.getItem('lang')||'ar'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ from: '', to: '' })

  useEffect(()=>{ (async()=>{ setLoading(true); try {
    const res = await invoices.list({ type:'sale', ...filters })
    const items = (res?.items || res || []).filter(r => !r.partner_id)
    setRows(items)
  } catch { setRows([]) } finally { setLoading(false) } })() },[filters])

  const paged = useMemo(()=> rows, [rows])

  function exportExcel(){
    if (!rows.length) return
    import('xlsx').then(XLSX => {
      const header = ['Invoice','Date','Total']
      const data = rows.map(r => [r.invoice_number||r.id, r.date||'', Number(r.total||0)])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'مجهول':'Unknown')
      const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' })
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'unknown_customer_invoices.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    }).catch(()=>{})
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'فواتير عملاء مجهولين':'Unknown Customer Invoices'}</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!rows.length} onClick={exportExcel}>Excel</button>
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled>{lang==='ar'?'PDF قريبًا':'PDF soon'}</button>
        </div>
      </div>
      <div className="bg-white rounded border shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="date" className="border rounded px-2 py-2" value={filters.from} onChange={e=>setFilters(f=>({...f, from: e.target.value}))} />
        <input type="date" className="border rounded px-2 py-2" value={filters.to} onChange={e=>setFilters(f=>({...f, to: e.target.value}))} />
        <div className="text-sm text-gray-600">{lang==='ar'?'فواتير نقدية فقط ولا تدخل في الذمم':'Cash sales only; excluded from receivables'}</div>
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">رقم الفاتورة</th>
              <th className="p-2">التاريخ</th>
              <th className="p-2">الإجمالي</th>
              <th className="p-2">النوع</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2 text-sm text-gray-600" colSpan={4}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
            ) : paged.map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2">{inv.date}</td>
                <td className="p-2">{Number(inv.total||0).toLocaleString()}</td>
                <td className="p-2"><span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">{lang==='ar'?'نقدي':'Cash'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}