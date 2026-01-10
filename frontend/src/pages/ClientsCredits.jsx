import { useEffect, useMemo, useState } from 'react'
import { invoices } from '../services/api'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'

export default function ClientsCredits(){
  const lang = localStorage.getItem('lang')||'ar'
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ (async()=>{ setLoading(true); try {
    const resAll = await invoices.list({ type:'sale' })
    const resDue = await invoices.list({ type:'sale', due: '1' })
    const rowsAll = resAll?.items || resAll || []
    const rowsDue = resDue?.items || resDue || []
    const byPartner = new Map()
    rowsAll.forEach(r => {
      const ps = String(r.payment_status||r.status||'').toLowerCase()
      if (ps==='partial') {
        const k = r.partner?.name || `#${r.partner_id||'-'}`
        const prev = byPartner.get(k) || { overdue:0, partial:0 }
        prev.partial++
        byPartner.set(k, prev)
      }
    })
    rowsDue.forEach(r => {
      const k = r.partner?.name || `#${r.partner_id||'-'}`
      const prev = byPartner.get(k) || { overdue:0, partial:0 }
      prev.overdue++
      byPartner.set(k, prev)
    })
    const list = Array.from(byPartner.entries()).map(([name, c]) => ({ name, ...c }))
    setAlerts(list)
  } catch { setAlerts([]) } finally { setLoading(false) } })() },[])

  function exportExcel(){
    if (!alerts.length) return
    import('xlsx').then(XLSX => {
      const header = ['Customer','Overdue','Partial']
      const rows = alerts.map(a => [a.name, a.overdue, a.partial])
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'إشعارات':'Notifications')
      const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' })
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'credit_notifications.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    }).catch(()=>{})
  }

  async function exportPDF(){
    if (!alerts.length) return
    try {
      const doc = await createPDF({ orientation:'p', unit:'pt', format:'a4', lang })
      doc.setFontSize(14)
      const title = lang==='ar'?'إشعارات دائنة':'Credit Notifications'
      if (lang==='ar') { doc.safeText(title, 550, 40, { align:'right' }) } else { doc.safeText(title, 40, 40) }
      let y = 70
      doc.setFontSize(11)
      alerts.forEach((a, i) => {
        const line = `${i+1}. ${a.name} — ${lang==='ar'?'متأخرة':'Overdue'}: ${a.overdue}, ${lang==='ar'?'جزئية':'Partial'}: ${a.partial}`
        if (lang==='ar') { doc.safeText(line, 550, y, { align:'right' }) } else { doc.safeText(line, 40, y) }
        y += 18
        if (y > 780) { doc.addPage(); y = 60 }
      })
      print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
    } catch {}
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'إشعارات دائنة':'Credit Notifications'}</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!alerts.length} onClick={exportExcel}>Excel</button>
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!alerts.length} onClick={exportPDF}>PDF</button>
        </div>
      </div>
      <div className="bg-white rounded border shadow p-4">
        {loading ? (
          <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
        ) : alerts.length ? (
          <ul className="list-disc pr-6 space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="text-sm text-gray-800">{a.name} — {lang==='ar'?'متأخرة':'Overdue'}: {a.overdue}, {lang==='ar'?'جزئية':'Partial'}: {a.partial}</li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-600">{lang==='ar'?'لا توجد إشعارات حالية':'No current notifications'}</div>
        )}
      </div>
      <div className="text-xs text-gray-500">{lang==='ar'?'شاشة عرض فقط بدون عمليات مالية':'View-only screen with no financial operations'}</div>
    </div>
  )
}