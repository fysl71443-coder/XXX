import { useEffect, useMemo, useState } from 'react'
import { customers } from '../services/api'

export default function ClientsAging(){
  const lang = localStorage.getItem('lang')||'ar'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [bucket, setBucket] = useState('')
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
  return (
    <div className="space-y-4" dir="rtl">
      <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'أعمار الديون':'Aging Debts'}</h2>
      <div className="text-xs text-gray-500 mb-2">
        {lang==='ar'?'قاعدة: البيانات من القيود المنشورة فقط (POSTED)':'Rule: Data from Posted Journal Entries Only (POSTED)'}
      </div>
      <div className="flex items-center gap-2">
        {['0-30','31-60','61-90','90+'].map(k=> (
          <button key={k} className={`px-2 py-1 rounded text-xs ${bucket===k?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setBucket(k)}>{k}: {counts[k]}</button>
        ))}
        <button className="px-2 py-1 rounded text-xs bg-white border" onClick={()=>setBucket('')}>{lang==='ar'?'مسح':'Clear'}</button>
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">رقم الفاتورة</th>
              <th className="p-2">التاريخ</th>
              <th className="p-2">الأيام</th>
              <th className="p-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr><td className="p-2 text-sm text-gray-600" colSpan={4}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : (Array.isArray(filtered) ? filtered : []).map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2">{inv.date}</td>
                <td className="p-2">{calculateDays(inv.date)}</td>
                <td className="p-2">{Number(inv.total||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}