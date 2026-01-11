import { useEffect, useMemo, useState } from 'react'
import { invoices, payments as apiPayments } from '../services/api'

export default function ClientsInvoicesPaid(){
  const lang = localStorage.getItem('lang')||'ar'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ from: '', to: '' })
  const [payRows, setPayRows] = useState([])
  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await invoices.list({ type:'sale', status:'paid', ...filters }); setRows(res?.items||res||[]) } catch { setRows([]) } finally { setLoading(false) } })() },[filters])
  useEffect(()=>{ (async()=>{ try { const params = {}; if (filters.from) params.from = filters.from; if (filters.to) params.to = filters.to; params.pageSize = 1000; const res = await apiPayments.list({ ...params, party_type: 'customer' }); setPayRows(res?.items||res||[]) } catch { setPayRows([]) } })() },[filters])
  const lastPayByInvoice = useMemo(()=>{ const m=new Map(); (payRows||[]).forEach(p=>{ const id=Number(p.invoice_id||0); const d=new Date(p.date); const prev=m.get(id); if(!prev || d>prev) m.set(id, d) }); return m },[payRows])
  const paged = useMemo(()=> rows.filter(inv => String(inv?.partner?.customer_type||'').toLowerCase()==='credit'), [rows])
  return (
    <div className="space-y-4" dir="rtl">
      <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'الفواتير المدفوعة فقط':'Paid Invoices Only'}</h2>
      <div className="bg-white rounded border shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="date" className="border rounded px-2 py-2" value={filters.from} onChange={e=>setFilters(f=>({...f, from: e.target.value}))} />
        <input type="date" className="border rounded px-2 py-2" value={filters.to} onChange={e=>setFilters(f=>({...f, to: e.target.value}))} />
        <div className="flex gap-2"><button className="px-3 py-2 bg-gray-100 rounded">Excel</button><button className="px-3 py-2 bg-gray-100 rounded">PDF</button></div>
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">رقم الفاتورة</th>
              <th className="p-2">العميل</th>
              <th className="p-2">تاريخ الفاتورة</th>
              <th className="p-2">تاريخ آخر دفعة</th>
              <th className="p-2">الإجمالي</th>
              <th className="p-2">الضريبة</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr><td className="p-2 text-sm text-gray-600" colSpan={4}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : paged.map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2">{inv.partner?.name || (inv.partner_id? `#${inv.partner_id}` : (lang==='ar'?'عميل نقدي':'Cash Customer'))}</td>
                <td className="p-2">{inv.date}</td>
                <td className="p-2">{(()=>{ const d=lastPayByInvoice.get(Number(inv.id)); return d? new Date(d).toISOString().slice(0,10) : '-' })()}</td>
                <td className="p-2">{Number(inv.total||0).toLocaleString()}</td>
                <td className="p-2">{Number(inv.tax||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}