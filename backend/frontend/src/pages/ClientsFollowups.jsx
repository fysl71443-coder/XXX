import { useEffect, useState } from 'react'
import { partners as apiPartners, payments } from '../services/api'

export default function ClientsFollowups(){
  const lang = localStorage.getItem('lang')||'ar'
  const [partners, setPartners] = useState([])
  const [form, setForm] = useState({ partner_id: '', invoice_id: '', amount: '', method: 'cash', date: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [sessionPayments, setSessionPayments] = useState([])

  useEffect(()=>{ (async()=>{ try { const list = await apiPartners.list({ type: 'customer' }); setPartners(Array.isArray(list)?list:[]) } catch { setPartners([]) } })() },[])

  async function save(){
    if (!form.partner_id || !form.amount || !form.date) return
    setSaving(true)
    try {
      const payload = { partner_id: form.partner_id, amount: Number(form.amount||0), type: String(form.method||'cash'), date: form.date }
      if (form.invoice_id) payload.invoice_id = form.invoice_id
      if (form.note) payload.note = form.note
      const res = await payments.create(payload)
      setSessionPayments(prev => [{ ...payload, id: res?.id || Date.now() }, ...prev])
      setForm({ partner_id: form.partner_id, invoice_id: '', amount: '', method: form.method, date: form.date, note: '' })
      alert(lang==='ar'?'تم تسجيل التحصيل بنجاح':'Payment recorded successfully')
    } catch {
      alert(lang==='ar'?'فشل حفظ التحصيل':'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  function exportExcel(){
    if (!sessionPayments.length) return
    try {
      const header = ['partner_id','invoice_id','amount','type','date','note']
      const rows = sessionPayments.map(p => [p.partner_id||'', p.invoice_id||'', Number(p.amount||0), String(p.type||''), p.date||'', p.note||''])
      // Lazy import XLSX to avoid bundling when unused
      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'تحصيلات':'Collections')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'collections.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch {}
  }

  return (
    <div className="space-y-4" dir="rtl">
      <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'متابعة السداد':'Payment Follow-up'}</h2>
      <div className="bg-white rounded border shadow p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <select className="border rounded px-2 py-2" value={form.partner_id} onChange={e=>setForm(f=>({ ...f, partner_id: e.target.value }))}>
          <option value="">{lang==='ar'?'اختر العميل':'Select Customer'}</option>
          {partners.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <input className="border rounded px-2 py-2" placeholder={lang==='ar'?'رقم الفاتورة (اختياري)':'Invoice Number (optional)'} value={form.invoice_id} onChange={e=>setForm(f=>({ ...f, invoice_id: e.target.value }))} />
        <input type="number" min="0" className="border rounded px-2 py-2" placeholder={lang==='ar'?'المبلغ':'Amount'} value={form.amount} onChange={e=>setForm(f=>({ ...f, amount: e.target.value }))} />
        <input type="date" className="border rounded px-2 py-2" value={form.date} onChange={e=>setForm(f=>({ ...f, date: e.target.value }))} />
        <select className="border rounded px-2 py-2" value={form.method} onChange={e=>setForm(f=>({ ...f, method: e.target.value }))}>
          <option value="cash">{lang==='ar'?'نقدًا':'Cash'}</option>
          <option value="bank">{lang==='ar'?'بنكي':'Bank'}</option>
          <option value="other">{lang==='ar'?'أخرى':'Other'}</option>
        </select>
        <input className="border rounded px-2 py-2" placeholder={lang==='ar'?'ملاحظة (اختياري)':'Note (optional)'} value={form.note} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} />
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50" disabled={saving || !form.partner_id || !form.amount || !form.date} onClick={save}>{lang==='ar'?'تسجيل تحصيل':'Record Collection'}</button>
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!sessionPayments.length} onClick={exportExcel}>Excel</button>
        </div>
      </div>
      <div className="bg-white rounded border shadow p-4">
        <div className="text-sm text-gray-600">{lang==='ar'?'هذه الشاشة مخصصة للعمليات فقط ولا تعرض جداول الفواتير':'This screen is operations-only and does not show invoice tables'}</div>
      </div>
    </div>
  )
}