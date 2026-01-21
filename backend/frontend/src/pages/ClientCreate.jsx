import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners } from '../services/api'
import { FaHome, FaSave, FaUser, FaPhone, FaMapMarkerAlt, FaPercent, FaCreditCard } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

export default function ClientCreate() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', address: '', customer_payment: 'نقدي', discount_pct: '', email: '', tax_id: ''
  })

  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <div className="font-bold text-lg mb-4 text-primary-700">{lang==='ar'? 'بيانات العميل الجديد' : 'New Customer Information'}</div>
          
          {/* البيانات الأساسية */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">{lang==='ar'?'البيانات الأساسية':'Basic Information'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaUser className="inline ml-1" /> {lang==='ar'?'اسم العميل':'Customer Name'} <span className="text-red-500">*</span>
                </label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                  placeholder={lang==='ar'?'أدخل اسم العميل':'Enter customer name'} 
                  value={form.name} 
                  onChange={e=>setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaPhone className="inline ml-1" /> {lang==='ar'?'رقم الهاتف':'Phone Number'}
                </label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                  placeholder={lang==='ar'?'05XXXXXXXX':'05XXXXXXXX'} 
                  value={form.phone} 
                  onChange={e=>setForm({...form, phone: e.target.value})} />
              </div>
            </div>
          </div>

          {/* العنوان */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FaMapMarkerAlt className="inline ml-1" /> {lang==='ar'?'العنوان':'Address'}
            </label>
            <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
              rows={2} 
              placeholder={lang==='ar'?'أدخل عنوان العميل (مطلوب لعملاء الآجل)':'Enter customer address (required for credit customers)'} 
              value={form.address} 
              onChange={e=>setForm({...form, address: e.target.value})} />
          </div>

          {/* نوع الدفع والخصم */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">{lang==='ar'?'معلومات الدفع':'Payment Information'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaCreditCard className="inline ml-1" /> {lang==='ar'?'نوع الدفع':'Payment Type'}
                </label>
                <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                  value={form.customer_payment} 
                  onChange={e=>setForm({...form, customer_payment: e.target.value})}>
                  <option value="نقدي">{lang==='ar'?'نقدي (دفع فوري)':'Cash (Immediate Payment)'}</option>
                  <option value="آجل">{lang==='ar'?'آجل (بيع بالدين)':'Credit (Deferred Payment)'}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {form.customer_payment==='آجل' 
                    ? (lang==='ar'?'العميل الآجل يتطلب رقم هاتف وعنوان صحيح':'Credit customer requires valid phone and address')
                    : (lang==='ar'?'العميل النقدي يدفع فورًا':'Cash customer pays immediately')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaPercent className="inline ml-1" /> {lang==='ar'?'نسبة الخصم الممنوح':'Granted Discount (%)'}
                </label>
                <input type="number" min="0" max="100" step="0.5"
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                  placeholder={lang==='ar'?'0':'0'} 
                  value={form.discount_pct} 
                  onChange={e=>setForm({...form, discount_pct: e.target.value})} />
                <p className="text-xs text-gray-500 mt-1">{lang==='ar'?'سيتم تطبيقه تلقائيًا على الفواتير':'Will be automatically applied to invoices'}</p>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" onClick={()=>navigate('/clients')}>
              {lang==='ar'?'رجوع':'Back'}
            </button>
            {(()=>{ const allowed = can('clients:write'); return (
            <button disabled={saving || !allowed} 
              className={`px-4 py-2.5 ${allowed?'bg-primary-600 hover:bg-primary-700':'bg-gray-400 cursor-not-allowed'} text-white rounded-lg flex items-center gap-2 transition-colors`} 
              onClick={save}>
              <FaSave /> {saving ? (lang==='ar'? 'جار الحفظ...' : 'Saving...') : (lang==='ar'? 'حفظ العميل' : 'Save Customer')}
            </button>) })()}
          </div>
        </div>
      </main>
    </div>
  )
}
