import { useEffect, useMemo, useState } from 'react'
import { ar } from '../services/api'
import { useNavigate } from 'react-router-dom'

export default function ClientsDue(){
  const lang = localStorage.getItem('lang')||'ar'
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await ar.summary(); const items=(res?.items||res||[]); setRows(items) } catch { setRows([]) } finally { setLoading(false) } })() },[])
  const paged = useMemo(()=>{
    const byName = new Map()
    for (const r of rows) {
      const key = String(r.name||'').trim().toLowerCase()
      const prev = byName.get(key)
      const bal = Number(r.balance||0)
      if (!prev) byName.set(key, { name: r.name, balance: bal, partner_id: r.partner_id, last_payment_at: r.last_payment_at || null })
      else byName.set(key, { ...prev, balance: Number(prev.balance||0) + bal })
    }
    return Array.from(byName.values())
  }, [rows])
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'المستحقات':'Due Amounts'}</h2>
        <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={()=>navigate('/clients/followups')}>{lang==='ar'?'الانتقال إلى متابعة السداد':'Go to Follow-up'}</button>
      </div>
      <div className="bg-white rounded border shadow p-4 text-sm text-gray-600">
        {lang==='ar'?'القيم مشتقة من القيود اليومية المنشورة والمدفوعات فقط':'Values derived from posted journal entries and payments only'}
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">{lang==='ar'?"العميل":"Customer"}</th>
              <th className="p-2">{lang==='ar'?"الرصيد":"Balance"}</th>
              <th className="p-2">{lang==='ar'?"الحالة":"Status"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr><td className="p-2 text-sm text-gray-600" colSpan={3}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : (Array.isArray(paged) ? paged : []).map(r => {
              const bal = Number(r.balance||0)
              const status = bal>0 ? (lang==='ar'?"مدين":"Debit") : bal<0 ? (lang==='ar'?"دائن":"Credit") : (lang==='ar'?"صفر":"Zero")
              return (
                <tr key={r.partner_id} className="border-b odd:bg-white even:bg-gray-50">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2">{Math.abs(bal).toLocaleString('en-US')}</td>
                  <td className="p-2">{status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}