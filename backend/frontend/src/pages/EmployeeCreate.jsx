import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { employees as apiEmployees, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'

function useLang(){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  return lang
}

function validateId(n){ return /^\d{10}$/.test(String(n||'').trim()) }
function validateIBAN(s){ const x = String(s||'').replace(/\s+/g,'').toUpperCase(); return x? (x.startsWith('SA') && x.length===24): true }

export default function EmployeeCreate(){
  const navigate = useNavigate()
  const { can: authCan } = useAuth()
  const lang = useLang()
  function normalizeDigits(str){
    const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}
    return String(str||'').split('').map(ch => map[ch] ?? ch).join('')
  }
  function sanitizeDecimal(str){
    const s = normalizeDigits(str).replace(/[^0-9.]/g,'')
    const parts = s.split('.')
    const head = parts[0] || ''
    const tail = parts[1] ? parts[1].slice(0,4) : ''
    return tail ? `${head}.${tail}` : head
  }
  const [form, setForm] = useState({ full_name:'', national_id:'', nationality:'SA', birth_date:'', gender:'', hire_date:'', contract_type:'full_time', contract_duration_months:'', probation_days:90, status:'active', pay_type:'monthly', hourly_rate:'', basic_salary:'', housing_allowance:'', transport_allowance:'', other_allowances:'', payment_method:'bank', iban:'', gosi_subscription_no:'', gosi_enrolled:false, gosi_employee_rate:0.09, gosi_employer_rate:0.11, gosi_enroll_date:'', gosi_status:'', mudad_contract_id:'', mudad_status:'', mudad_last_sync:'', department:'', payroll_expense_account_code:'5210', gosi_liability_account_code:'2120', payroll_payable_account_code:'2130' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState([])
  useEffect(()=>{ (async()=>{ try { const d = await apiSettings.get('settings_departments'); setDepartments(Array.isArray(d)?d:[]) } catch { setDepartments([]) } })() },[])

  async function save(){
    setError('')
    if (!authCan('employees:write')) { setError(lang==='ar'?'ليس لديك صلاحية':'Permission denied'); return }
    if (!validateId(form.national_id)) { setError(lang==='ar'?'رقم هوية غير صحيح':'Invalid national ID'); return }
    if (!validateIBAN(form.iban)) { setError('Invalid IBAN'); return }
    try {
      setSaving(true)
      await apiEmployees.create(form)
      navigate('/employees')
    } catch (e) {
      setError(e.code||'failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'إضافة موظف':'Add Employee'}</h1>
            <p className="text-gray-600 text-sm">{lang==='ar'?'أدخل بيانات الموظف واحفظ للرجوع':'Fill employee data, save and return'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
            {(()=>{ const allowed = authCan('employees:write'); return (
            <button className={`px-3 py-2 ${allowed?'bg-primary-600':'bg-gray-400 cursor-not-allowed'} text-white rounded-md`} disabled={saving || !allowed} onClick={save}>{saving?(lang==='ar'?'جار الحفظ...':'Saving...'):(lang==='ar'?'حفظ':'Save')}</button>) })()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <div className="bg-white rounded shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 font-semibold">{lang==='ar'?'البيانات الشخصية':'Personal'}</div>
            <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم الكامل':'Full name'} value={form.full_name} onChange={e=>setForm({ ...form, full_name: e.target.value })} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الهوية الوطنية / الإقامة':'National ID / Iqama'} value={form.national_id} onChange={e=>setForm({ ...form, national_id: e.target.value })} />
            <input className="border rounded p-2" list="nationalities" placeholder={lang==='ar'?"اختر الجنسية أو اكتب الرمز":"Select nationality or type code"} value={form.nationality} onChange={e=>setForm({ ...form, nationality: e.target.value })} />
            <datalist id="nationalities">
              <option value="SA">السعودية</option>
              <option value="EG">مصر</option>
              <option value="JO">الأردن</option>
              <option value="AE">الإمارات</option>
              <option value="QA">قطر</option>
              <option value="KW">الكويت</option>
              <option value="BH">البحرين</option>
              <option value="OM">عُمان</option>
              <option value="YE">اليمن</option>
              <option value="LB">لبنان</option>
              <option value="PS">فلسطين</option>
              <option value="SY">سوريا</option>
              <option value="IQ">العراق</option>
              <option value="MA">المغرب</option>
              <option value="DZ">الجزائر</option>
              <option value="TN">تونس</option>
              <option value="LY">ليبيا</option>
              <option value="SD">السودان</option>
              <option value="TR">تركيا</option>
              <option value="IN">الهند</option>
              <option value="PK">باكستان</option>
              <option value="BD">بنغلاديش</option>
              <option value="PH">الفلبين</option>
              <option value="ET">إثيوبيا</option>
              <option value="US">الولايات المتحدة</option>
              <option value="GB">المملكة المتحدة</option>
              <option value="FR">فرنسا</option>
              <option value="DE">ألمانيا</option>
              <option value="CN">الصين</option>
              <option value="ID">إندونيسيا</option>
            </datalist>
            <input type="date" className="border rounded p-2" placeholder={lang==='ar'?'تاريخ الميلاد':'Birth Date'} value={form.birth_date} onChange={e=>setForm({ ...form, birth_date: e.target.value })} />
            <select className="border rounded p-2" value={form.gender} onChange={e=>setForm({ ...form, gender: e.target.value })}><option value="">{lang==='ar'?'الجنس':'Gender'}</option><option value="male">{lang==='ar'?'ذكر':'Male'}</option><option value="female">{lang==='ar'?'أنثى':'Female'}</option></select>

            <div className="md:col-span-2 font-semibold">{lang==='ar'?'بيانات التوظيف':'Employment'}</div>
            <input type="date" className="border rounded p-2" placeholder={lang==='ar'?'تاريخ التعيين':'Hire Date'} value={form.hire_date} onChange={e=>setForm({ ...form, hire_date: e.target.value })} />
            <select className="border rounded p-2" value={form.contract_type} onChange={e=>setForm({ ...form, contract_type: e.target.value })}><option value="full_time">{lang==='ar'?'دوام كامل':'Full-time'}</option><option value="part_time">{lang==='ar'?'جزئي':'Part-time'}</option><option value="temporary">{lang==='ar'?'مؤقت':'Temporary'}</option></select>
            <input className="border rounded p-2" placeholder={lang==='ar'?'مدة العقد (أشهر)':'Contract months'} value={form.contract_duration_months} onChange={e=>setForm({ ...form, contract_duration_months: e.target.value })} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'فترة التجربة (يوم)':'Probation (days)'} value={form.probation_days} onChange={e=>setForm({ ...form, probation_days: e.target.value })} />
            <select className="border rounded p-2" value={form.status} onChange={e=>setForm({ ...form, status: e.target.value })}><option value="active">{lang==='ar'?'نشط':'Active'}</option><option value="disabled">{lang==='ar'?'موقوف':'Disabled'}</option><option value="terminated">{lang==='ar'?'منتهي':'Terminated'}</option></select>

            <div className="md:col-span-2 font-semibold">Payroll</div>
            <select className="border rounded p-2" value={form.pay_type} onChange={e=>setForm({ ...form, pay_type: e.target.value })}><option value="monthly">{lang==='ar'?'شهري':'Monthly'}</option><option value="hourly">{lang==='ar'?'بالساعة':'Hourly'}</option></select>
            <select className="border rounded p-2" value={form.department} onChange={e=>setForm({ ...form, department: e.target.value })}>
              <option value="">{lang==='ar'?'القسم':'Department'}</option>
              {departments.filter(d=>!d.disabled).map(d => (<option key={d.name} value={d.name}>{d.name}</option>))}
            </select>
            {String(form.pay_type||'monthly')==='hourly' ? (
              <input className="border rounded p-2" type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" placeholder={lang==='ar'?'سعر الساعة':'Hourly rate'} value={String(form.hourly_rate||'')} onChange={e=>{ const v = sanitizeDecimal(e.target.value); setForm({ ...form, hourly_rate: v }) }} />
            ) : (
              <>
                <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'الراتب الأساسي':'Basic salary'} value={String(form.basic_salary||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, basic_salary: v }) }} />
                <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'بدل سكن':'Housing'} value={String(form.housing_allowance||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, housing_allowance: v }) }} />
                <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'بدل نقل':'Transport'} value={String(form.transport_allowance||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, transport_allowance: v }) }} />
                <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'بدلات أخرى':'Other allowances'} value={String(form.other_allowances||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, other_allowances: v }) }} />
              </>
            )}
            <input className="border rounded p-2" placeholder={lang==='ar'?'IBAN':'IBAN'} value={form.iban} onChange={e=>setForm({ ...form, iban: e.target.value })} />

            <div className="md:col-span-2 font-semibold">GOSI</div>
            <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الاشتراك بالتأمينات':'GOSI subscription'} value={form.gosi_subscription_no} onChange={e=>setForm({ ...form, gosi_subscription_no: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.gosi_enrolled} onChange={e=>setForm({ ...form, gosi_enrolled: e.target.checked })} /> {lang==='ar'?'مشمول بالتأمينات':'GOSI enrolled'}</label>
            <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'نسبة الموظف':'Employee %'} value={String(form.gosi_employee_rate||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, gosi_employee_rate: v }) }} />
            <input className="border rounded p-2" inputMode="decimal" lang="en" dir="ltr" placeholder={lang==='ar'?'نسبة صاحب العمل':'Employer %'} value={String(form.gosi_employer_rate||'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setForm({ ...form, gosi_employer_rate: v }) }} />

            <div className="md:col-span-2 font-semibold">Mudad</div>
            <input className="border rounded p-2" placeholder={lang==='ar'?'رقم عقد مُدد':'Mudad contract'} value={form.mudad_contract_id} onChange={e=>setForm({ ...form, mudad_contract_id: e.target.value })} />
            <input className="border rounded p-2" placeholder={lang==='ar'?'حالة التوثيق':'Mudad status'} value={form.mudad_status} onChange={e=>setForm({ ...form, mudad_status: e.target.value })} />

            <div className="md:col-span-2 font-semibold">{lang==='ar'?'ربط محاسبي':'Accounting Link'}</div>
            <input className="border rounded p-2 bg-gray-100" disabled placeholder={lang==='ar'?'حساب مصروف الرواتب (كود)':'Payroll expense code'} value={form.payroll_expense_account_code} />
            <input className="border rounded p-2 bg-gray-100" disabled placeholder={lang==='ar'?'حساب التزامات التأمينات (كود)':'GOSI liability code'} value={form.gosi_liability_account_code} />
            <input className="border rounded p-2 bg-gray-100" disabled placeholder={lang==='ar'?'حساب الرواتب المستحقة (كود)':'Payroll payable code'} value={form.payroll_payable_account_code} />
          </div>
        </div>
      </main>
    </div>
  )
}
