import { useEffect, useMemo, useState } from 'react'
import { customers } from '../services/api'
import * as XLSX from 'xlsx'
import { FaFileExcel, FaFilePdf } from 'react-icons/fa'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'

export default function ClientsAging(){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [bucket, setBucket] = useState('')

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await customers.aging(); setRows(res?.items||res||[]) } catch (e) { console.error('[ClientsAging] Error:', e); setRows([]) } finally { setLoading(false) } })() },[])
  
  const filtered = useMemo(()=> {
    if (!bucket) return rows
    return (Array.isArray(rows) ? rows : []).filter(r=> r.aging_bucket === bucket)
  },[rows, bucket])
  
  const counts = useMemo(()=>{ 
    const b={ '0-30':0,'31-60':0,'61-90':0,'90+':0 }; 
    const safe = Array.isArray(rows) ? rows : []; 
    safe.forEach(r=>{ 
      if (r.aging_bucket) b[r.aging_bucket] = (b[r.aging_bucket] || 0) + 1
    }); 
    return b 
  },[rows])

  const totals = useMemo(() => {
    const safe = Array.isArray(filtered) ? filtered : []
    return {
      count: safe.length,
      total: safe.reduce((s, r) => s + Number(r.total || 0), 0),
      remaining: safe.reduce((s, r) => s + Number(r.remaining || 0), 0)
    }
  }, [filtered])

  const calculateDays = (dateStr) => {
    if (!dateStr) return 0
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    } catch {
      return 0
    }
  }

  function exportExcel() {
    const header = [lang==='ar'?'رقم الفاتورة':'Invoice No.', lang==='ar'?'العميل':'Customer', lang==='ar'?'التاريخ':'Date', lang==='ar'?'الأيام':'Days', lang==='ar'?'الإجمالي':'Total', lang==='ar'?'المتبقي':'Remaining', lang==='ar'?'الفئة':'Bucket']
    const data = (Array.isArray(filtered)?filtered:[]).map(r => [r.invoice_number||'', r.partner_name||'', r.date||'', calculateDays(r.date), Number(r.total||0), Number(r.remaining||0), r.aging_bucket||''])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'أعمار الديون':'Aging')
    XLSX.writeFile(wb, 'aging-report.xlsx')
  }

  async function exportPDF() {
    try {
      const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang })
      doc.setFontSize(14)
      const title = lang==='ar'?'تقرير أعمار الديون':'Aging Report'
      doc.safeText(title, lang==='ar'?550:40, 40, lang==='ar'?{ align:'right' }:{})
      let y = 70
      doc.setFontSize(10)
      ;(Array.isArray(filtered)?filtered:[]).forEach((inv, i) => {
        const line = `${i+1}. ${inv.invoice_number||'-'} | ${inv.partner_name||'-'} | ${calculateDays(inv.date)} ${lang==='ar'?'يوم':'days'} | ${Number(inv.remaining||0).toLocaleString()}`
        doc.safeText(line, lang==='ar'?550:40, y, lang==='ar'?{ align:'right' }:{})
        y += 16
        if (y > 780) { doc.addPage(); y = 60 }
      })
      print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
    } catch(e) { console.error('[ClientsAging] PDF Error:', e) }
  }

  return (
    <div className="space-y-4" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'أعمار الديون':'Aging Debts'}</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 hover:bg-gray-200" onClick={exportExcel}><FaFileExcel /> Excel</button>
          <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 hover:bg-gray-200" onClick={exportPDF}><FaFilePdf /> PDF</button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {lang==='ar'?'قاعدة: البيانات من القيود المنشورة فقط (POSTED)':'Rule: Data from Posted Journal Entries Only (POSTED)'}
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">{lang==='ar'?'عدد الفواتير':'Invoices Count'}</div>
          <div className="text-xl font-bold text-gray-800">{totals.count}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي المبالغ':'Total Amount'}</div>
          <div className="text-xl font-bold text-gray-800">{totals.total.toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <div className="text-sm text-red-600">{lang==='ar'?'المتبقي':'Remaining'}</div>
          <div className="text-xl font-bold text-red-700">{totals.remaining.toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</div>
        </div>
      </div>

      {/* Bucket Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['0-30','31-60','61-90','90+'].map(k=> (
          <button key={k} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${bucket===k?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} onClick={()=>setBucket(bucket===k?'':k)}>
            {k} {lang==='ar'?'يوم':'days'}: <span className="font-bold">{counts[k]}</span>
          </button>
        ))}
        {bucket && <button className="px-3 py-1.5 rounded-lg text-sm bg-white border hover:bg-gray-50" onClick={()=>setBucket('')}>{lang==='ar'?'مسح الفلتر':'Clear Filter'}</button>}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
              <th className="p-3">{lang==='ar'?'العميل':'Customer'}</th>
              <th className="p-3">{lang==='ar'?'التاريخ':'Date'}</th>
              <th className="p-3">{lang==='ar'?'الأيام':'Days'}</th>
              <th className="p-3">{lang==='ar'?'الإجمالي':'Total'}</th>
              <th className="p-3">{lang==='ar'?'المتبقي':'Remaining'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr><td className="p-3 text-sm text-gray-600" colSpan={6}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : (Array.isArray(filtered) ? filtered : []).length === 0 ? (
              <tr><td className="p-3 text-sm text-gray-500 text-center" colSpan={6}>{lang==='ar'?'لا توجد فواتير متأخرة':'No overdue invoices'}</td></tr>
            ) : (Array.isArray(filtered) ? filtered : []).map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                <td className="p-3 font-medium">{inv.invoice_number}</td>
                <td className="p-3">{inv.partner_name||'-'}</td>
                <td className="p-3">{inv.date}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${calculateDays(inv.date) > 90 ? 'bg-red-100 text-red-700' : calculateDays(inv.date) > 60 ? 'bg-orange-100 text-orange-700' : calculateDays(inv.date) > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {calculateDays(inv.date)} {lang==='ar'?'يوم':'days'}
                  </span>
                </td>
                <td className="p-3">{Number(inv.total||0).toLocaleString()}</td>
                <td className="p-3 font-medium text-red-600">{Number(inv.remaining||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}