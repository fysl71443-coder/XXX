import { useEffect, useMemo, useState } from 'react'
import { invoices, payments } from '../services/api'

export default function ClientsStatsBar({ from, to, refreshKey }){
  const [invRows, setInvRows] = useState([])
  const [payRows, setPayRows] = useState([])
  useEffect(()=>{ (async()=>{ try { const res = await invoices.list({ type: 'sale', from, to }); const items = res?.items||res||[]; const filtered = items.filter(r => String(r.status)!=='draft'); setInvRows(filtered) } catch { setInvRows([]) } })() },[from,to,refreshKey])
  useEffect(()=>{ (async()=>{ try { const res = await payments.list({ from, to }); setPayRows(res?.items||res||[]) } catch { setPayRows([]) } })() },[from,to,refreshKey])
  const paidByInvoice = useMemo(()=>{ const by=new Map(); payRows.forEach(p => { const k=p.invoice_id||0; const prev=by.get(k)||0; by.set(k, prev+Number(p.amount||0)) }); return by },[payRows])
  const totals = useMemo(()=>{ const count=invRows.length; const totalAmount = invRows.reduce((s,r)=> s + Number(r.total||0), 0); const totalPaid = invRows.reduce((s,r)=> s + Number(paidByInvoice.get(r.id)||0), 0); const dueSum = invRows.filter(r => String(r.status)!=='paid').reduce((s,r)=> s + Math.max(0, Number(r.total||0) - Number(paidByInvoice.get(r.id)||0)), 0); const overdueCount = invRows.filter(r => { const d=new Date(r.date); const term=30; const dueDate = new Date(d.getTime()); dueDate.setDate(dueDate.getDate()+term); return String(r.status)!=='paid' && new Date()>dueDate }).length; const paymentRate = totalAmount>0 ? Math.round((totalPaid/totalAmount)*100) : 0; const dso = (()=>{ const open = invRows.filter(r => String(r.status)!=='paid'); if (!open.length) return 0; const days = open.reduce((s,r)=> s + Math.ceil((Date.now() - new Date(r.date).getTime())/(1000*60*60*24)), 0); return Math.round(days/open.length) })(); return { count, dueSum, overdueCount, paymentRate, dso } },[invRows, paidByInvoice])
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div className="bg-white rounded-xl shadow p-4"><div className="font-semibold">الفواتير</div><div className="text-2xl font-bold mt-2">{totals.count}</div></div>
      <div className="bg-white rounded-xl shadow p-4"><div className="font-semibold">إجمالي المستحق</div><div className="text-2xl font-bold mt-2">{Number(totals.dueSum).toLocaleString('en-US')} SAR</div></div>
      <div className="bg-white rounded-xl shadow p-4"><div className="font-semibold">متأخرة</div><div className="text-2xl font-bold mt-2">{totals.overdueCount}</div></div>
      <div className="bg-white rounded-xl shadow p-4"><div className="font-semibold">معدل السداد</div><div className="text-2xl font-bold mt-2">{totals.paymentRate}%</div></div>
      <div className="bg-white rounded-xl shadow p-4"><div className="font-semibold">متوسط فترة التحصيل</div><div className="text-2xl font-bold mt-2">{totals.dso} يوم</div></div>
    </div>
  )
}