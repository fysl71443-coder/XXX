import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners } from '../services/api'
import { FaHome, FaSave, FaBuilding, FaUser, FaIdCard, FaMapMarkerAlt, FaPhone, FaEnvelope, FaGlobe, FaMoneyBillWave, FaFileAlt } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'

export default function SupplierCreate() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
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

  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function save() {
    // REMOVED: Admin check - can() function already has admin bypass
    // if (!can('suppliers:write')) return
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

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* المعلومات الأساسية */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaBuilding /> {lang==='ar'? 'المعلومات الأساسية' : 'Basic Information'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang==='ar'? 'نوع المورد' : 'Supplier Type'} <span className="text-red-500">*</span>
              </label>
              <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.supplier_type} onChange={e=>setForm({...form, supplier_type: e.target.value})}>
                <option value="">{lang==='ar'? 'اختر النوع' : 'Select Type'}</option>
                <option value="Individual">{lang==='ar'? 'فرد' : 'Individual'}</option>
                <option value="Company">{lang==='ar'? 'شركة' : 'Company'}</option>
              </select>
            </div>
            {form.supplier_type==='Individual' ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaUser className="inline ml-1" /> {lang==='ar'?'اسم المورد':'Supplier Name'} <span className="text-red-500">*</span>
                </label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'أدخل اسم المورد':'Enter supplier name'} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الاسم التجاري':'Trade Name'} <span className="text-red-500">*</span></label>
                  <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'الاسم التجاري':'Trade Name'} value={form.trade_name} onChange={e=>setForm({...form, trade_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الاسم القانوني':'Legal Name'}</label>
                  <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'الاسم القانوني':'Legal Name'} value={form.legal_name} onChange={e=>setForm({...form, legal_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الاسم المختصر':'Short Name'}</label>
                  <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'الاسم المختصر':'Short Name'} value={form.short_name} onChange={e=>setForm({...form, short_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'التصنيف':'Classification'}</label>
                  <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: مواد غذائية':'e.g. Food supplies'} value={form.classification} onChange={e=>setForm({...form, classification: e.target.value})} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* الهوية القانونية */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaIdCard /> {lang==='ar'? 'الهوية القانونية' : 'Legal Identity'}
          </div>
          {form.supplier_type==='Individual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم الهوية الوطنية':'National ID'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'أدخل رقم الهوية':'Enter National ID'} value={form.national_id} onChange={e=>setForm({...form, national_id: e.target.value})} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم السجل التجاري':'CR Number'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: 1010XXXXXX':'e.g. 1010XXXXXX'} value={form.cr_number} onChange={e=>setForm({...form, cr_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'مدينة السجل':'CR City'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: الرياض':'e.g. Riyadh'} value={form.cr_city} onChange={e=>setForm({...form, cr_city: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'تاريخ إصدار السجل':'CR Issue Date'}</label>
                <input type="date" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.cr_issue_date} onChange={e=>setForm({...form, cr_issue_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الرقم الضريبي (VAT)':'Tax ID (VAT)'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'30XXXXXXXXX00003':'30XXXXXXXXX00003'} value={form.tax_id} onChange={e=>setForm({...form, tax_id: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'حالة التسجيل في الضريبة':'VAT Registration'}</label>
                <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.vat_registered ? 'yes' : 'no'} onChange={e=>setForm({...form, vat_registered: e.target.value==='yes'})}>
                  <option value="no">{lang==='ar'? 'غير مسجل' : 'Not Registered'}</option>
                  <option value="yes">{lang==='ar'? 'مسجل في ضريبة القيمة المضافة' : 'VAT Registered'}</option>
                </select>
              </div>
              {form.vat_registered && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'تاريخ التسجيل الضريبي':'VAT Registration Date'}</label>
                  <input type="date" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.vat_registration_date} onChange={e=>setForm({...form, vat_registration_date: e.target.value})} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* العنوان القانوني */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaMapMarkerAlt /> {lang==='ar'? 'العنوان القانوني' : 'Legal Address'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الدولة':'Country'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'المملكة العربية السعودية':'Saudi Arabia'} value={form.addr_country} onChange={e=>setForm({...form, addr_country: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'المدينة':'City'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: الرياض':'e.g. Riyadh'} value={form.addr_city} onChange={e=>setForm({...form, addr_city: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الحي':'District'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: العليا':'e.g. Al Olaya'} value={form.addr_district} onChange={e=>setForm({...form, addr_district: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'اسم الشارع':'Street Name'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'اسم الشارع':'Street Name'} value={form.addr_street} onChange={e=>setForm({...form, addr_street: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم المبنى':'Building No.'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: 1234':'e.g. 1234'} value={form.addr_building} onChange={e=>setForm({...form, addr_building: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الرمز البريدي':'Postal Code'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: 12345':'e.g. 12345'} value={form.addr_postal} onChange={e=>setForm({...form, addr_postal: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الرمز الإضافي':'Additional Code'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: 6789':'e.g. 6789'} value={form.addr_additional} onChange={e=>setForm({...form, addr_additional: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'وصف العنوان التفصيلي':'Detailed Address Description'}</label>
              <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" rows={2} placeholder={lang==='ar'?'أدخل وصف تفصيلي للعنوان':'Enter detailed address description'} value={form.addr_description} onChange={e=>setForm({...form, addr_description: e.target.value})} />
            </div>
          </div>
        </div>

        {/* معلومات التواصل */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaPhone /> {lang==='ar'? 'معلومات التواصل' : 'Contact Information'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FaPhone className="inline ml-1 text-gray-500" /> {lang==='ar'?'الهاتف':'Phone'}
              </label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'011XXXXXXX':'011XXXXXXX'} value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الجوال':'Mobile'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'05XXXXXXXX':'05XXXXXXXX'} value={form.mobile} onChange={e=>setForm({...form, mobile: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FaEnvelope className="inline ml-1 text-gray-500" /> {lang==='ar'?'البريد الإلكتروني':'Email'}
              </label>
              <input type="email" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder="email@example.com" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FaGlobe className="inline ml-1 text-gray-500" /> {lang==='ar'?'الموقع الإلكتروني':'Website'}
              </label>
              <input type="url" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder="https://www.example.com" value={form.website} onChange={e=>setForm({...form, website: e.target.value})} />
            </div>
          </div>
        </div>

        {/* الشخص المسؤول */}
        {form.supplier_type!=='Individual' && (
          <div className="border rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
              <FaUser /> {lang==='ar'? 'الشخص المسؤول / جهة الاتصال' : 'Contact Person'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'اسم المسؤول':'Contact Name'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'الاسم الكامل':'Full Name'} value={form.contact_person_name} onChange={e=>setForm({...form, contact_person_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الوظيفة':'Role/Position'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: مدير المبيعات':'e.g. Sales Manager'} value={form.contact_person_role} onChange={e=>setForm({...form, contact_person_role: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم الجوال':'Mobile'}</label>
                <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'05XXXXXXXX':'05XXXXXXXX'} value={form.contact_person_mobile} onChange={e=>setForm({...form, contact_person_mobile: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'البريد الإلكتروني':'Email'}</label>
                <input type="email" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder="contact@example.com" value={form.contact_person_email} onChange={e=>setForm({...form, contact_person_email: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {/* الفوترة والمحاسبة */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaMoneyBillWave /> {lang==='ar'? 'الفوترة والمحاسبة' : 'Billing & Accounting'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'حساب الأستاذ المرتبط':'GL Account'}</label>
              <input className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'مثال: 1020':'e.g. 1020'} value={form.gl_account} onChange={e=>setForm({...form, gl_account: e.target.value})} />
              <p className="text-xs text-gray-500 mt-1">{lang==='ar'?'حساب الموردين الافتراضي':'Default supplier account'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'طريقة التسعير':'Pricing Method'}</label>
              <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.pricing_method} onChange={e=>setForm({...form, pricing_method: e.target.value})}>
                <option value="inclusive">{lang==='ar'? 'شامل الضريبة' : 'Inclusive VAT'}</option>
                <option value="exclusive">{lang==='ar'? 'غير شامل الضريبة' : 'Exclusive VAT'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'طريقة الدفع الافتراضية':'Default Payment Method'}</label>
              <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.default_payment_method} onChange={e=>setForm({...form, default_payment_method: e.target.value})}>
                <option value="">{lang==='ar'? 'اختر الطريقة' : 'Select Method'}</option>
                <option value="Cash">{lang==='ar'? 'نقد' : 'Cash'}</option>
                <option value="Bank">{lang==='ar'? 'تحويل بنكي' : 'Bank Transfer'}</option>
                <option value="Card">{lang==='ar'? 'بطاقة' : 'Card'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'مدة السداد':'Payment Term'}</label>
              <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.payment_term} onChange={e=>setForm({...form, payment_term: e.target.value})}>
                <option value="">{lang==='ar'? 'اختر المدة' : 'Select Term'}</option>
                <option value="Immediate">{lang==='ar'? 'فوري (عند الاستلام)' : 'Immediate (on receipt)'}</option>
                <option value="15d">15 {lang==='ar'? 'يوم' : 'days'}</option>
                <option value="30d">30 {lang==='ar'? 'يوم' : 'days'}</option>
                <option value="60d">60 {lang==='ar'? 'يوم' : 'days'}</option>
                <option value="90d">90 {lang==='ar'? 'يوم' : 'days'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'حد الائتمان (ر.س)':'Credit Limit (SAR)'}</label>
              <input type="number" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'0 = بدون حد':'0 = No limit'} value={form.credit_limit} onChange={e=>setForm({...form, credit_limit: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'طريقة إرسال الفواتير':'Invoice Send Method'}</label>
              <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={form.invoice_send_method} onChange={e=>setForm({...form, invoice_send_method: e.target.value})}>
                <option value="Email">{lang==='ar'?'بريد إلكتروني':'Email'}</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="PDF">{lang==='ar'?'طباعة PDF':'PDF Print'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* عناوين إضافية */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaMapMarkerAlt /> {lang==='ar'? 'عناوين إضافية' : 'Additional Addresses'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'عنوان الشحن':'Shipping Address'}</label>
              <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'عنوان استلام البضائع':'Goods delivery address'} rows={3} value={form.shipping_address} onChange={e=>setForm({...form, shipping_address: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'عنوان الفواتير':'Billing Address'}</label>
              <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" placeholder={lang==='ar'?'عنوان إرسال الفواتير':'Invoice sending address'} rows={3} value={form.billing_address} onChange={e=>setForm({...form, billing_address: e.target.value})} />
            </div>
          </div>
          <div className="mt-3">
            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" onClick={()=>{
              const main = `${form.addr_country} ${form.addr_city} ${form.addr_district} ${form.addr_street} ${form.addr_building} ${form.addr_postal}`.trim()
              setForm({...form, shipping_address: main, billing_address: main})
            }}>{lang==='ar'? 'نسخ من العنوان الرئيسي' : 'Copy from main address'}</button>
          </div>
        </div>

        {/* ملاحظات داخلية */}
        <div className="border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4 text-primary-700">
            <FaFileAlt /> {lang==='ar'? 'ملاحظات وتعليمات' : 'Notes & Instructions'}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'ملاحظات داخلية للفريق':'Internal Team Notes'}</label>
              <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" rows={3} placeholder={lang==='ar'?'ملاحظات للاستخدام الداخلي فقط':'For internal use only'} value={form.internal_notes} onChange={e=>setForm({...form, internal_notes: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'تعليمات الفوترة':'Billing Instructions'}</label>
                <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" rows={2} placeholder={lang==='ar'?'تعليمات خاصة بالفوترة':'Special billing instructions'} value={form.billing_instructions} onChange={e=>setForm({...form, billing_instructions: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'تعليمات السداد':'Payment Instructions'}</label>
                <textarea className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" rows={2} placeholder={lang==='ar'?'تعليمات خاصة بالسداد':'Special payment instructions'} value={form.collection_instructions} onChange={e=>setForm({...form, collection_instructions: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex justify-end gap-3 pt-2">
          <button className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" onClick={()=>navigate('/suppliers')}>
            {lang==='ar'?'إلغاء':'Cancel'}
          </button>
          {(()=>{ const allowed = can('suppliers:write'); return (
          <button disabled={saving || !allowed} 
            className={`px-4 py-2.5 ${allowed?'bg-primary-600 hover:bg-primary-700':'bg-gray-400 cursor-not-allowed'} text-white rounded-lg flex items-center gap-2 transition-colors`} 
            onClick={save}>
            <FaSave /> {saving ? (lang==='ar'? 'جار الحفظ...' : 'Saving...') : (lang==='ar'? 'حفظ المورد' : 'Save Supplier')}
          </button>) })()}
        </div>
      </main>
    </div>
  )
}
