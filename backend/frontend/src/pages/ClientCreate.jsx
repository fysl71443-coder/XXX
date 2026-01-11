import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners } from '../services/api'
import { FaHome, FaSave } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

export default function ClientCreate() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang] = useState(localStorage.getItem('lang')||'ar')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', address: '', customer_payment: 'نقدي', discount_pct: ''
  })

  async function save() {
    setSaving(true)
    try {
      const nm = String(form.name||'').trim()
      if (!nm) { alert(lang==='ar'?'يرجى إدخال الاسم':'Please enter name'); setSaving(false); return }
      const paymentTerm = form.customer_payment==='نقدي' ? 'Immediate' : '30d'
      const customerType = form.customer_payment==='نقدي' ? 'cash_registered' : 'credit'
      const phoneRaw = String(form.phone||'').trim()
      const phoneDigits = phoneRaw.replace(/\D/g, '')
      const addr = String(form.address||'').trim()
      const disc = parseFloat(form.discount_pct||0)
      if (customerType==='credit') {
        if (!phoneDigits || phoneDigits.length < 8 || /^0+$/.test(phoneDigits)) { alert(lang==='ar'?'رقم هاتف غير صالح لعميل آجل':'Invalid phone for credit customer'); setSaving(false); return }
        if (!addr || String(addr).toUpperCase()==='NULL') { alert(lang==='ar'?'العنوان مطلوب لعميل آجل':'Address required for credit customer'); setSaving(false); return }
      }
      if (!isFinite(disc) || disc < 0 || disc > 100) { alert(lang==='ar'?'نسبة الخصم يجب أن تكون بين 0 و 100':'Discount % must be between 0 and 100'); setSaving(false); return }
      const payload = {
        name: nm,
        type: 'customer',
        phone: phoneRaw,
        addr_description: (form.address||'').trim(),
        payment_term: paymentTerm,
        discount_rate: Number(form.discount_pct||0),
        contact_info: { discount_pct: Number(form.discount_pct||0) },
        customer_type: customerType
      }
      const created = await partners.create(payload)
      navigate('/clients', { replace: true, state: { created } })
    } catch (e) {
      const code = e?.code || 'request_failed'
      if (code==='validation_failed') {
        alert(lang==='ar'?'تحقق من البيانات':'Validate the form')
      } else if (code==='duplicate') {
        alert(lang==='ar'?'بيانات مكررة: الاسم أو الهاتف موجود':'Duplicate data: name or phone exists')
      } else if (code==='Unauthorized' || e?.status===401) {
        alert(lang==='ar'?'غير مصرح: يرجى تسجيل الدخول':'Unauthorized: please login')
      } else {
        alert(lang==='ar'?'فشل في الحفظ':'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'? 'إنشاء عميل جديد' : 'Create New Customer'}</h1>
            <p className="text-gray-600 text-sm">{lang==='ar'? 'نموذج رسمي وكامل لإضافة عميل' : 'Official, complete customer creation form'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/clients')}> 
              <FaHome /> {lang==='ar'? 'العملاء' : 'Customers'}
            </button>
            {(()=>{ const allowed = can('clients:write'); return (
            <button disabled={saving || !allowed} className={`px-3 py-2 ${allowed?'bg-primary-600':'bg-gray-400 cursor-not-allowed'} text-white rounded-md flex items-center gap-2`} onClick={save}>
              <FaSave /> {saving ? (lang==='ar'? 'جار الحفظ...' : 'Saving...') : (lang==='ar'? 'حفظ' : 'Save')}
            </button>) })()}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        <div className="border rounded p-4 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'بيانات العميل (مطعم)' : 'Customer (Restaurant)'}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم':'Name'} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'الهاتف':'Phone'} value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            <textarea className="border rounded p-2 md:col-span-2" rows={2} placeholder={lang==='ar'?'العنوان':'Address'} value={form.address} onChange={e=>setForm({...form, address: e.target.value})} />
            <select className="border rounded p-2" value={form.customer_payment} onChange={e=>setForm({...form, customer_payment: e.target.value})}>
              <option value="نقدي">{lang==='ar'?'نقدي':'Cash'}</option>
              <option value="آجل">{lang==='ar'?'آجل':'Credit'}</option>
            </select>
            <input type="number" className="border rounded p-2" placeholder={lang==='ar'?'الخصم الممنوح (%)':'Granted Discount (%)'} value={form.discount_pct} onChange={e=>setForm({...form, discount_pct: e.target.value})} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded" onClick={()=>navigate('/clients')}>{lang==='ar'?'رجوع':'Back'}</button>
            {(()=>{ const allowed = can('clients:write'); return (
            <button disabled={saving || !allowed} className={`px-3 py-2 ${allowed?'bg-primary-600':'bg-gray-400 cursor-not-allowed'} text-white rounded flex items-center gap-2`} onClick={save}>
              <FaSave /> {saving ? (lang==='ar'? 'جار الحفظ...' : 'Saving...') : (lang==='ar'? 'حفظ' : 'Save')}
            </button>) })()}
          </div>
        </div>
      </main>
    </div>
  )
}
