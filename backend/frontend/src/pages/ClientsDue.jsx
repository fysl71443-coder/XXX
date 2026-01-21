import { useEffect, useMemo, useState } from 'react'
import { ar } from '../services/api'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { FaFileExcel, FaArrowLeft, FaArrowRight, FaMoneyBillWave } from 'react-icons/fa'

export default function ClientsDue(){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // all, debit, credit

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

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
    let list = Array.from(byName.values())
    if (filter === 'debit') list = list.filter(r => Number(r.balance||0) > 0)
    else if (filter === 'credit') list = list.filter(r => Number(r.balance||0) < 0)
    return list
  }, [rows, filter])

  const totals = useMemo(() => {
    const safe = Array.isArray(paged) ? paged : []
    const totalDebit = safe.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0)
    const totalCredit = safe.filter(r => r.balance < 0).reduce((s, r) => s + Math.abs(r.balance), 0)
    return { count: safe.length, totalDebit, totalCredit, net: totalDebit - totalCredit }
  }, [paged])

  function exportExcel() {
    const header = [lang==='ar'?'العميل':'Customer', lang==='ar'?'الرصيد':'Balance', lang==='ar'?'الحالة':'Status', lang==='ar'?'آخر دفعة':'Last Payment']
    const data = (Array.isArray(paged)?paged:[]).map(r => {
      const bal = Number(r.balance||0)
      const status = bal>0 ? (lang==='ar'?"مدين":"Debit") : bal<0 ? (lang==='ar'?"دائن":"Credit") : (lang==='ar'?"صفر":"Zero")
      return [r.name||'', bal, status, r.last_payment_at||'-']
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'المستحقات':'Due')
    XLSX.writeFile(wb, 'customers-due.xlsx')
  }

  return (
    <div className="space-y-4" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'المستحقات':'Due Amounts'}</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 hover:bg-gray-200" onClick={exportExcel}><FaFileExcel /> Excel</button>
          <button className="px-3 py-2 bg-primary-600 text-white rounded flex items-center gap-2 hover:bg-primary-700" onClick={()=>navigate('/clients/followups')}>
            <FaMoneyBillWave /> {lang==='ar'?'تسجيل تحصيل':'Record Collection'}
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-gray-600">
        {lang==='ar'?'القيم مشتقة من القيود اليومية المنشورة (POSTED) فقط':'Values derived from posted journal entries only (POSTED)'}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${filter==='all'?'ring-2 ring-primary-500':''}`} onClick={()=>setFilter('all')}>
          <div className="text-sm text-gray-600">{lang==='ar'?'عدد العملاء':'Customers Count'}</div>
          <div className="text-xl font-bold text-gray-800">{totals.count}</div>
        </div>
        <div className={`bg-red-50 rounded-xl border border-red-100 p-4 cursor-pointer transition-all ${filter==='debit'?'ring-2 ring-red-500':''}`} onClick={()=>setFilter('debit')}>
          <div className="text-sm text-red-600">{lang==='ar'?'إجمالي المدين':'Total Debit'}</div>
          <div className="text-xl font-bold text-red-700">{totals.totalDebit.toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</div>
        </div>
        <div className={`bg-green-50 rounded-xl border border-green-100 p-4 cursor-pointer transition-all ${filter==='credit'?'ring-2 ring-green-500':''}`} onClick={()=>setFilter('credit')}>
          <div className="text-sm text-green-600">{lang==='ar'?'إجمالي الدائن':'Total Credit'}</div>
          <div className="text-xl font-bold text-green-700">{totals.totalCredit.toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="text-sm text-blue-600">{lang==='ar'?'صافي المستحق':'Net Balance'}</div>
          <div className="text-xl font-bold text-blue-700">{totals.net.toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3">{lang==='ar'?"العميل":"Customer"}</th>
              <th className="p-3">{lang==='ar'?"الرصيد":"Balance"}</th>
              <th className="p-3">{lang==='ar'?"الحالة":"Status"}</th>
              <th className="p-3">{lang==='ar'?"آخر دفعة":"Last Payment"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr><td className="p-3 text-sm text-gray-600" colSpan={4}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>) : (Array.isArray(paged) ? paged : []).length === 0 ? (
              <tr><td className="p-3 text-sm text-gray-500 text-center" colSpan={4}>{lang==='ar'?'لا توجد مستحقات':'No due amounts'}</td></tr>
            ) : (Array.isArray(paged) ? paged : []).map(r => {
              const bal = Number(r.balance||0)
              const status = bal>0 ? (lang==='ar'?"مدين":"Debit") : bal<0 ? (lang==='ar'?"دائن":"Credit") : (lang==='ar'?"صفر":"Zero")
              const statusClass = bal>0 ? 'bg-red-100 text-red-700' : bal<0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              return (
                <tr key={r.partner_id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 font-medium" dir="ltr">{Math.abs(bal).toLocaleString('en-US')} {lang==='ar'?'ريال':'SAR'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusClass}`}>{status}</span>
                  </td>
                  <td className="p-3 text-gray-600">{r.last_payment_at ? new Date(r.last_payment_at).toLocaleDateString(lang==='ar'?'ar-SA':'en-US') : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}