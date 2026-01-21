import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { employees as apiEmployees } from '../services/api'
import { Home as HomeIcon, User, Briefcase, Wallet, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { sanitizeDecimal } from '../utils/number'

function useLang(){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  return lang
}

function validateId(n){ return /^\d{10}$/.test(String(n||'').trim()) }
function validateIBAN(s){ const x = String(s||'').replace(/\s+/g,'').toUpperCase(); return x? (x.startsWith('SA') && x.length===24): true }

export default function EmployeeEdit(){
  const navigate = useNavigate()
  const { id } = useParams()
  const { can } = useAuth()
  const lang = useLang()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const natList = useMemo(()=>[
    { code:'SA', labelAr:'سعودي', labelEn:'Saudi' },
    { code:'EG', labelAr:'مصري', labelEn:'Egyptian' },
    { code:'JO', labelAr:'أردني', labelEn:'Jordanian' },
    { code:'LB', labelAr:'لبناني', labelEn:'Lebanese' },
    { code:'SY', labelAr:'سوري', labelEn:'Syrian' },
    { code:'IQ', labelAr:'عراقي', labelEn:'Iraqi' },
    { code:'YE', labelAr:'يمني', labelEn:'Yemeni' },
    { code:'SD', labelAr:'سوداني', labelEn:'Sudanese' },
    { code:'MA', labelAr:'مغربي', labelEn:'Moroccan' },
    { code:'TN', labelAr:'تونسي', labelEn:'Tunisian' },
    { code:'DZ', labelAr:'جزائري', labelEn:'Algerian' },
    { code:'QA', labelAr:'قطري', labelEn:'Qatari' },
    { code:'AE', labelAr:'إماراتي', labelEn:'Emirati' },
    { code:'KW', labelAr:'كويتي', labelEn:'Kuwaiti' },
    { code:'OM', labelAr:'عُماني', labelEn:'Omani' },
    { code:'BH', labelAr:'بحريني', labelEn:'Bahraini' },
    { code:'IN', labelAr:'هندي', labelEn:'Indian' },
    { code:'PK', labelAr:'باكستاني', labelEn:'Pakistani' },
    { code:'BD', labelAr:'بنغلاديشي', labelEn:'Bangladeshi' },
    { code:'PH', labelAr:'فلبيني', labelEn:'Filipino' },
  ],[])
  const [natOpen, setNatOpen] = useState(false)
  const [natQuery, setNatQuery] = useState('')
  const natFiltered = useMemo(()=>{
    const q = String(natQuery||'').trim().toLowerCase()
    if (!q) return natList
    return natList.filter(n => n.code.toLowerCase().startsWith(q) || (lang==='ar' ? n.labelAr.toLowerCase().startsWith(q) : n.labelEn.toLowerCase().startsWith(q)))
  }, [natQuery, natList, lang])

  useEffect(()=>{ (async()=>{ try { const emp = await apiEmployees.get(id); setForm(emp) } catch { setForm(null) } })() },[id])

  async function save(){
    setError('')
    // REMOVED: Admin check - can() function already has admin bypass
    // if (!can('employees:write')) { setError(lang==='ar'?'ليس لديك صلاحية':'Permission denied'); return }
    if (!validateId(form.national_id)) { setError(lang==='ar'?'رقم هوية غير صحيح':'Invalid national ID'); return }
    if (!validateIBAN(form.iban)) { setError('Invalid IBAN'); return }
    try {
      setSaving(true)
      await apiEmployees.update(id, form)
      navigate('/employees')
    } catch (e) { setError(e.code||'failed') }
    finally { setSaving(false) }
  }

  return (!form) ? (
    <div className="min-h-screen bg-gray-50" dir="rtl"><main className="max-w-7xl mx-auto p-6"><div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div></main></div>
  ) : (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'تعديل موظف':'Edit Employee'}</h1>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={()=>navigate('/employees')}><HomeIcon className="w-4 h-4" />{lang==='ar'?'رجوع':'Back'}</button>
            <button className="px-3 py-2 bg-primary-600 text-white rounded-md" disabled={saving} onClick={save}>{saving?(lang==='ar'?'جار الحفظ...':'Saving...'):(lang==='ar'?'حفظ':'Save')}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <div className="bg-white rounded shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary-600" />{lang==='ar'?'البيانات الشخصية':'Personal'}</div>
            <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم الكامل':'Full name'} value={form.full_name||''} onChange={e=>setForm({ ...form, full_name: e.target.value })} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الهوية الوطنية / الإقامة':'National ID / Iqama'} value={form.national_id||''} onChange={e=>setForm({ ...form, national_id: e.target.value })} />
            <div className="relative">
              <input className="border rounded p-2 w-full" placeholder={lang==='ar'?'الجنسية (اكتب أول أحرف)':'Nationality (type first letters)'} value={form.nationality||''} onFocus={()=>setNatOpen(true)} onChange={e=>{ setNatQuery(e.target.value); setForm({ ...form, nationality: String(e.target.value||'').toUpperCase() }) }} onBlur={()=>setTimeout(()=>setNatOpen(false),150)} />
              {natOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-40 overflow-auto border rounded bg-white shadow">
                  {natFiltered.map(n => (
                    <button key={n.code} className="w-full text-right px-3 py-2 hover:bg-gray-100" onMouseDown={()=>{ setForm({ ...form, nationality: n.code }); setNatQuery(n.code); setNatOpen(false) }}>
                      <span className="text-sm">{n.code}</span>
                      <span className="text-xs text-gray-600 mr-2">{lang==='ar'?n.labelAr:n.labelEn}</span>
                    </button>
                  ))}
                  {!natFiltered.length && (<div className="px-3 py-2 text-sm text-gray-500">{lang==='ar'?'لا نتائج':'No results'}</div>)}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تاريخ الميلاد':'Birth Date'}</label>
              <input type="date" className="border rounded p-2 w-full" value={form.birth_date||''} onChange={e=>setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'الجنس':'Gender'}</label>
              <select className="border rounded p-2 w-full" value={form.gender||''} onChange={e=>setForm({ ...form, gender: e.target.value })}><option value="">{lang==='ar'?'اختر':'Select'}</option><option value="male">{lang==='ar'?'ذكر':'Male'}</option><option value="female">{lang==='ar'?'أنثى':'Female'}</option></select>
            </div>
            <div className="md:col-span-2 font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary-600" />{lang==='ar'?'بيانات التوظيف':'Employment'}</div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تاريخ التعيين':'Hire Date'}</label>
              <input type="date" className="border rounded p-2 w-full" value={form.hire_date||''} onChange={e=>setForm({ ...form, hire_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'نوع العقد':'Contract Type'}</label>
              <select className="border rounded p-2 w-full" value={form.contract_type||''} onChange={e=>setForm({ ...form, contract_type: e.target.value })}><option value="full_time">{lang==='ar'?'دوام كامل':'Full-time'}</option><option value="part_time">{lang==='ar'?'جزئي':'Part-time'}</option><option value="temporary">{lang==='ar'?'مؤقت':'Temporary'}</option></select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'مدة العقد (أشهر)':'Contract Duration (months)'}</label>
              <input className="border rounded p-2 w-full" placeholder={lang==='ar'?'12':'12'} value={form.contract_duration_months||''} onChange={e=>setForm({ ...form, contract_duration_months: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'فترة التجربة (يوم)':'Probation (days)'}</label>
              <input className="border rounded p-2 w-full" placeholder="90" value={form.probation_days||''} onChange={e=>setForm({ ...form, probation_days: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'الحالة':'Status'}</label>
              <select className="border rounded p-2 w-full" value={form.status||'active'} onChange={e=>setForm({ ...form, status: e.target.value })}><option value="active">{lang==='ar'?'نشط':'Active'}</option><option value="disabled">{lang==='ar'?'موقوف':'Disabled'}</option><option value="terminated">{lang==='ar'?'منتهي':'Terminated'}</option></select>
            </div>
            <div className="md:col-span-2 font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary-600" />{lang==='ar'?'الرواتب':'Payroll'}</div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'نوع الدفع':'Pay Type'}</label>
              <select className="border rounded p-2 w-full" value={form.pay_type||'monthly'} onChange={e=>setForm({ ...form, pay_type: e.target.value })}><option value="monthly">{lang==='ar'?'شهري':'Monthly'}</option><option value="hourly">{lang==='ar'?'بالساعة':'Hourly'}</option></select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'الراتب الأساسي':'Basic Salary'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.00" value={String(form.basic_salary||'')} onChange={e=>setForm({ ...form, basic_salary: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'سعر الساعة':'Hourly Rate'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.00" value={String(form.hourly_rate||'')} onChange={e=>setForm({ ...form, hourly_rate: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'بدل السكن':'Housing Allowance'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.00" value={String(form.housing_allowance||'')} onChange={e=>setForm({ ...form, housing_allowance: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'بدل النقل':'Transport Allowance'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.00" value={String(form.transport_allowance||'')} onChange={e=>setForm({ ...form, transport_allowance: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'بدلات أخرى':'Other Allowances'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.00" value={String(form.other_allowances||'')} onChange={e=>setForm({ ...form, other_allowances: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'رقم الآيبان':'IBAN'}</label>
              <input className="border rounded p-2 w-full" placeholder="SA..." value={form.iban||''} onChange={e=>setForm({ ...form, iban: e.target.value })} />
            </div>
            <div className="md:col-span-2 font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-600" />{lang==='ar'?'التأمينات الاجتماعية':'GOSI'}</div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'رقم الاشتراك':'Subscription No.'}</label>
              <input className="border rounded p-2 w-full" placeholder={lang==='ar'?'رقم الاشتراك':'Subscription No.'} value={form.gosi_subscription_no||''} onChange={e=>setForm({ ...form, gosi_subscription_no: e.target.value })} />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.gosi_enrolled} onChange={e=>setForm({ ...form, gosi_enrolled: e.target.checked })} /> {lang==='ar'?'مشمول بالتأمينات':'GOSI enrolled'}</label>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'نسبة الموظف':'Employee Rate'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.09" value={String(form.gosi_employee_rate||'')} onChange={e=>setForm({ ...form, gosi_employee_rate: sanitizeDecimal(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'نسبة صاحب العمل':'Employer Rate'}</label>
              <input className="border rounded p-2 w-full" inputMode="decimal" lang="en" dir="ltr" placeholder="0.11" value={String(form.gosi_employer_rate||'')} onChange={e=>setForm({ ...form, gosi_employer_rate: sanitizeDecimal(e.target.value) })} />
            </div>
            <div className="md:col-span-2 font-semibold">{lang==='ar'?'ربط محاسبي':'Accounting Link'}</div>
            <div className="md:col-span-2 flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">{lang==='ar'?'مصروف الرواتب':'Salary Expense'}: 5210</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">{lang==='ar'?'التأمينات':'GOSI Liability'}: 2120</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">{lang==='ar'?'الرواتب المستحقة':'Payroll Payable'}: 2130</span>
            </div>
            <div className="md:col-span-2 font-semibold">{lang==='ar'?'القسم':'Department'}</div>
            <div>
              <input className="border rounded p-2 w-full" placeholder={lang==='ar'?'اسم القسم':'Department name'} value={form.department||''} onChange={e=>setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
