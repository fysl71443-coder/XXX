import { useEffect, useMemo, useState } from 'react'
import { invoices } from '../services/api'

export default function ClientsAging(){
  const lang = localStorage.getItem('lang')||'ar'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [bucket, setBucket] = useState('')
  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await invoices.list({ type:'sale' }); setRows(res?.items||res||[]) } catch { setRows([]) } finally { setLoading(false) } })() },[])
  function days(d){ const x = Math.ceil((Date.now()-new Date(d).getTime())/(1000*60*60*24)); return x<0?0:x }
  const filtered = useMemo(()=> rows.filter(r=> String(r.status)!=='paid' && String(r.status)!=='draft').filter(r=>{ const dd=days(r.date); if(bucket==='0-30') return dd<=30; if(bucket==='31-60') return dd>30&&dd<=60; if(bucket==='61-90') return dd>60&&dd<=90; if(bucket==='90+') return dd>90; return true }),[rows,bucket])
  const counts = useMemo(()=>{ const b={ '0-30':0,'31-60':0,'61-90':0,'90+':0 }; rows.forEach(r=>{ if(r.status==='paid') return; const dd=days(r.date); if(dd<=30) b['0-30']++; else if(dd<=60) b['31-60']++; else if(dd<=90) b['61-90']++; else b['90+']++; }); return b },[rows])
  return (
    <div className="space-y-4" dir="rtl">
      <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'أعمار الديون':'Aging Debts'}</h2>
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
            {loading ? (<tr><td className="p-2 text-sm text-gray-600" colSpan={4}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : filtered.map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2">{inv.date}</td>
                <td className="p-2">{days(inv.date)}</td>
                <td className="p-2">{Number(inv.total||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}