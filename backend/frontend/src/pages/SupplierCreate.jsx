import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners } from '../services/api'
import { FaHome, FaSave } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

export default function SupplierCreate() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang] = useState(localStorage.getItem('lang')||'ar')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'مورد', email: '', phone: '',
    supplier_type: '', trade_name: '', legal_name: '', short_name: '', classification: '',
    cr_number: '', cr_city: '', cr_issue_date: '', tax_id: '', vat_registered: false, vat_registration_date: '',
    addr_country: '', addr_city: '', addr_district: '', addr_street: '', addr_building: '', addr_postal: '', addr_additional: '', addr_description: '',
    mobile: '', website: '',
    contact_person_name: '', contact_person_mobile: '', contact_person_email: '', contact_person_role: '',
    gl_account: '1020', pricing_method: 'inclusive', default_payment_method: '', payment_term: '', credit_limit: '', invoice_send_method: 'Email',
    shipping_address: '', billing_address: '',
    internal_notes: '', billing_instructions: '', collection_instructions: '',
    country: '', city: '', tags: [],
    national_id: ''
  })

  async function save() {
    if (!can('suppliers:write')) return
    setSaving(true)
    try {
      const nm = String((form.trade_name || form.legal_name || form.short_name || form.name)||'').trim()
      if (!nm) { alert(lang==='ar'?'يرجى إدخال الاسم':'Please enter name'); setSaving(false); return }
      const payload = {
        name: nm,
        type: 'supplier',
        email: form.email || null,
        phone: form.phone || null,
        cr_number: form.cr_number || null,
        tax_id: form.tax_id || null,
        addr_description: form.addr_description || null,
        billing_address: form.billing_address || null,
        payment_term: form.payment_term || null
      }
      const created = await partners.create(payload)
      navigate('/suppliers', { replace: true, state: { created } })
    } catch (e) {
      const code = e?.code || e?.response?.data?.error || 'request_failed'
      if (code==='validation_failed') {
        alert(lang==='ar'?'تحقق من البيانات':'Validate the form')
      } else if (code==='duplicate') {
        alert(lang==='ar'?'بيانات مكررة: الاسم أو الهاتف موجود':'Duplicate data: name or phone exists')
      } else if (code==='Unauthorized' || e?.status===401) {
        alert(lang==='ar'?'غير مصرح: يرجى تسجيل الدخول':'Unauthorized: please login')
      } else {
        alert(lang==='ar'?'فشل حفظ المورد':'Failed to save supplier')
      }
      } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'? 'إنشاء مورد جديد' : 'Create New Supplier'}</h1>
            <p className="text-gray-600 text-sm">{lang==='ar'? 'نموذج رسمي وكامل لإضافة مورد' : 'Official, complete supplier creation form'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/suppliers')}> 
              <FaHome /> {lang==='ar'? 'الموردون' : 'Suppliers'}
            </button>
            {(()=>{ const allowed = can('suppliers:write'); return (
            <button disabled={saving || !allowed} className={`px-3 py-2 ${allowed?'bg-primary-600':'bg-gray-400 cursor-not-allowed'} text-white rounded-md flex items-center gap-2`} onClick={save}>
              <FaSave /> {saving ? (lang==='ar'? 'جار الحفظ...' : 'Saving...') : (lang==='ar'? 'حفظ' : 'Save')}
            </button>) })()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'المعلومات الأساسية' : 'Basic Information'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select className="border rounded p-2" value={form.supplier_type} onChange={e=>setForm({...form, supplier_type: e.target.value})}>
              <option value="">{lang==='ar'? 'نوع المورد' : 'Supplier Type'}</option>
              <option value="Individual">{lang==='ar'? 'فرد' : 'Individual'}</option>
              <option value="Company">{lang==='ar'? 'شركة' : 'Company'}</option>
            </select>
            {form.supplier_type==='Individual' ? (
              <>
                <input className="border rounded p-2 md:col-span-2" placeholder={lang==='ar'?'الاسم':'Name'} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
              </>
            ) : (
              <>
                <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم التجاري':'Trade Name'} value={form.trade_name} onChange={e=>setForm({...form, trade_name: e.target.value})} />
                <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم القانوني':'Legal Name'} value={form.legal_name} onChange={e=>setForm({...form, legal_name: e.target.value})} />
                <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم المختصر':'Short Name'} value={form.short_name} onChange={e=>setForm({...form, short_name: e.target.value})} />
                <input className="border rounded p-2" placeholder={lang==='ar'?'التصنيف':'Classification'} value={form.classification} onChange={e=>setForm({...form, classification: e.target.value})} />
              </>
            )}
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'الهوية القانونية' : 'Legal Identity'}</div>
          {form.supplier_type==='Individual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الهوية الوطنية':'National ID'} value={form.national_id} onChange={e=>setForm({...form, national_id: e.target.value})} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم السجل التجاري':'CR Number'} value={form.cr_number} onChange={e=>setForm({...form, cr_number: e.target.value})} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'مدينة السجل':'CR City'} value={form.cr_city} onChange={e=>setForm({...form, cr_city: e.target.value})} />
              <input type="date" className="border rounded p-2" value={form.cr_issue_date} onChange={e=>setForm({...form, cr_issue_date: e.target.value})} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'الرقم الضريبي':'Tax ID'} value={form.tax_id} onChange={e=>setForm({...form, tax_id: e.target.value})} />
              <select className="border rounded p-2" value={form.vat_registered ? 'yes' : 'no'} onChange={e=>setForm({...form, vat_registered: e.target.value==='yes'})}>
                <option value="no">{lang==='ar'? 'غير مسجل' : 'Not Registered'}</option>
                <option value="yes">{lang==='ar'? 'مسجل' : 'Registered'}</option>
              </select>
              <input type="date" className="border rounded p-2" value={form.vat_registration_date} onChange={e=>setForm({...form, vat_registration_date: e.target.value})} />
            </div>
          )}
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'العنوان القانوني' : 'Legal Address'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded p-2" placeholder={lang==='ar'?'الدولة':'Country'} value={form.addr_country} onChange={e=>setForm({...form, addr_country: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'المدينة':'City'} value={form.addr_city} onChange={e=>setForm({...form, addr_city: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'الحي':'District'} value={form.addr_district} onChange={e=>setForm({...form, addr_district: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'اسم الشارع':'Street Name'} value={form.addr_street} onChange={e=>setForm({...form, addr_street: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'رقم المبنى':'Building No.'} value={form.addr_building} onChange={e=>setForm({...form, addr_building: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'الرمز البريدي':'Postal Code'} value={form.addr_postal} onChange={e=>setForm({...form, addr_postal: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'الرمز الإضافي':'Additional Code'} value={form.addr_additional} onChange={e=>setForm({...form, addr_additional: e.target.value})} />
            <input className="border rounded p-2 md:col-span-3" placeholder={lang==='ar'?'وصف العنوان':'Address Description'} value={form.addr_description} onChange={e=>setForm({...form, addr_description: e.target.value})} />
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'معلومات التواصل' : 'Contact Information'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded p-2" placeholder={lang==='ar'?'الهاتف':'Phone'} value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'الجوال':'Mobile'} value={form.mobile} onChange={e=>setForm({...form, mobile: e.target.value})} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'البريد الإلكتروني':'Email'} value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
            <input className="border rounded p-2 md:col-span-3" placeholder={lang==='ar'?'الموقع الإلكتروني':'Website'} value={form.website} onChange={e=>setForm({...form, website: e.target.value})} />
          </div>
        </div>

        {form.supplier_type!=='Individual' && (
          <div className="border rounded p-3 bg-white">
            <div className="font-semibold mb-2">{lang==='ar'? 'الشخص المسؤول' : 'Responsible Person'}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم':'Name'} value={form.contact_person_name} onChange={e=>setForm({...form, contact_person_name: e.target.value})} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الجوال':'Mobile'} value={form.contact_person_mobile} onChange={e=>setForm({...form, contact_person_mobile: e.target.value})} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'البريد':'Email'} value={form.contact_person_email} onChange={e=>setForm({...form, contact_person_email: e.target.value})} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'الوظيفة':'Role'} value={form.contact_person_role} onChange={e=>setForm({...form, contact_person_role: e.target.value})} />
            </div>
          </div>
        )}

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'الفوترة والمحاسبة' : 'Billing & Accounting'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded p-2" placeholder={lang==='ar'?'حساب الأستاذ المرتبط':'GL Account'} value={form.gl_account} onChange={e=>setForm({...form, gl_account: e.target.value})} />
            <select className="border rounded p-2" value={form.pricing_method} onChange={e=>setForm({...form, pricing_method: e.target.value})}>
              <option value="inclusive">{lang==='ar'? 'سعر شامل الضريبة' : 'Inclusive VAT'}</option>
              <option value="exclusive">{lang==='ar'? 'سعر غير شامل الضريبة' : 'Exclusive VAT'}</option>
            </select>
            <select className="border rounded p-2" value={form.default_payment_method} onChange={e=>setForm({...form, default_payment_method: e.target.value})}>
              <option value="">{lang==='ar'? 'طريقة الدفع الافتراضي' : 'Default Payment Method'}</option>
              <option value="Cash">{lang==='ar'? 'نقد' : 'Cash'}</option>
              <option value="Bank">{lang==='ar'? 'تحويل بنكي' : 'Bank Transfer'}</option>
              <option value="Card">{lang==='ar'? 'بطاقة' : 'Card'}</option>
            </select>
            <select className="border rounded p-2" value={form.payment_term} onChange={e=>setForm({...form, payment_term: e.target.value})}>
              <option value="">{lang==='ar'? 'مدة السداد' : 'Payment Term'}</option>
              <option value="Immediate">{lang==='ar'? 'فوري' : 'Immediate'}</option>
              <option value="15d">15 {lang==='ar'? 'يوم' : 'days'}</option>
              <option value="30d">30 {lang==='ar'? 'يوم' : 'days'}</option>
              <option value="60d">60 {lang==='ar'? 'يوم' : 'days'}</option>
            </select>
            <input type="number" className="border rounded p-2" placeholder={lang==='ar'?'حد الائتمان':'Credit Limit'} value={form.credit_limit} onChange={e=>setForm({...form, credit_limit: e.target.value})} />
            <select className="border rounded p-2" value={form.invoice_send_method} onChange={e=>setForm({...form, invoice_send_method: e.target.value})}>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'عناوين إضافية' : 'Extra Addresses'}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea className="border rounded p-2" placeholder={lang==='ar'?'عنوان الشحن':'Shipping Address'} rows={2} value={form.shipping_address} onChange={e=>setForm({...form, shipping_address: e.target.value})} />
            <textarea className="border rounded p-2" placeholder={lang==='ar'?'عنوان الفواتير':'Billing Address'} rows={2} value={form.billing_address} onChange={e=>setForm({...form, billing_address: e.target.value})} />
          </div>
          <div className="mt-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>{
              const main = `${form.addr_country} ${form.addr_city} ${form.addr_district} ${form.addr_street} ${form.addr_building} ${form.addr_postal}`.trim()
              setForm({...form, shipping_address: main, billing_address: main})
            }}>{lang==='ar'? 'نسخ من العنوان الرئيسي' : 'Copy from main address'}</button>
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">{lang==='ar'? 'ملاحظات داخلية' : 'Internal Notes'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <textarea className="border rounded p-2 md:col-span-3" rows={3} placeholder={lang==='ar'?'نص كبير لملاحظات الفريق':'Team notes'} value={form.internal_notes} onChange={e=>setForm({...form, internal_notes: e.target.value})} />
            <textarea className="border rounded p-2 md:col-span-3" rows={2} placeholder={lang==='ar'?'تعليمات خاصة للفوترة':'Billing instructions'} value={form.billing_instructions} onChange={e=>setForm({...form, billing_instructions: e.target.value})} />
            <textarea className="border rounded p-2 md:col-span-3" rows={2} placeholder={lang==='ar'?'تعليمات التحصيل':'Collection instructions'} value={form.collection_instructions} onChange={e=>setForm({...form, collection_instructions: e.target.value})} />
          </div>
        </div>
      </main>
    </div>
  )
}
