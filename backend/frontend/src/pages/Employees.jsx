import { useEffect, useMemo, useState, useCallback } from 'react'
import { employees as apiEmployees, payroll as apiPayroll, settings as apiSettings } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'
import * as XLSX from 'xlsx'
import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react'
import { FaIdCard, FaFileExcel } from 'react-icons/fa'
import PageHeader from '../components/PageHeader'
import AdvancedFilters from '../components/AdvancedFilters'
 

function useLang(){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  return lang
}

function validateId(n){ return /^\d{10}$/.test(String(n||'').trim()) }
function validateIBAN(s){ const x = String(s||'').replace(/\s+/g,'').toUpperCase(); return x? (x.startsWith('SA') && x.length===24): true }

export default function Employees(){
  const navigate = useNavigate()
  const lang = useLang()
  const [list, setList] = useState([])
  const [filters, setFilters] = useState({ saudization: '', active: '', gosi: '', include_disabled: '' })
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState(null)
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name:'', national_id:'', nationality:'SA', birth_date:'', gender:'', hire_date:'', contract_type:'full_time', contract_duration_months:'', probation_days:90, status:'active', pay_type:'monthly', basic_salary:'', hourly_rate:'', housing_allowance:'', transport_allowance:'', other_allowances:'', payment_method:'bank', iban:'', gosi_subscription_no:'', gosi_enrolled:false, gosi_employee_rate:0.09, gosi_employer_rate:0.11, gosi_enroll_date:'', gosi_status:'', mudad_contract_id:'', mudad_status:'', mudad_last_sync:'', department:'', payroll_expense_account_code:'5210', gosi_liability_account_code:'2120', payroll_payable_account_code:'2130', advance_account_code:'1220', deduction_account_code:'4210', cash_account_code:'1110', bank_account_code:'1120' })
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [runs, setRuns] = useState([])
  const [prevDues, setPrevDues] = useState([])
  const { can } = useAuth()
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
  const [natQuery, setNatQuery] = useState('')
  const [natOpen, setNatOpen] = useState(false)
  const natFiltered = useMemo(()=>{
    const q = String(natQuery||'').trim().toLowerCase()
    if (!q) return natList
    return natList.filter(n => n.code.toLowerCase().startsWith(q) || (lang==='ar' ? n.labelAr.toLowerCase().startsWith(q) : n.labelEn.toLowerCase().startsWith(q)))
  }, [natQuery, natList, lang])

  const load = useCallback(async () => {
    try { const rows = await apiEmployees.list(); setList(Array.isArray(rows)?rows:[]) } catch { setList([]) }
    try { const rs = await apiPayroll.runs(); setRuns(rs) } catch {}
    try { const dues = await apiPayroll.previousDues(); setPrevDues(Array.isArray(dues)?dues:[]) } catch { setPrevDues([]) }
  }, [filters])
  useEffect(()=>{ load() }, [load])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const c = await apiSettings.get('settings_branding/settings_company')
        const b = await apiSettings.get('settings_branding')
        const f = await apiSettings.get('settings_branding/settings_footer')
        setCompany(c); setBranding(b); setFooterCfg(f)
      } catch(e) { console.error(e) }
    }
    fetchSettings()
  }, [])
  useEffect(()=>{
    function onStorage(e){ if (e.key==='prev_dues_version') load() }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[load])

  useEffect(()=>{ if (toast) { const t = setTimeout(()=>setToast(''), 3000); return ()=>clearTimeout(t) } }, [toast])

  const filtered = useMemo(()=> {
    const q = String(search||'').trim().toLowerCase()
    return list.filter(e => {
      if (String(e.status||'') === 'disabled' && String(filters.include_disabled||'') !== '1') return false
      if (String(filters.saudization||'')==='saudi' && String(e.nationality||'').toUpperCase()!=='SA') return false
      if (String(filters.saudization||'')==='non_saudi' && String(e.nationality||'').toUpperCase()==='SA') return false
      if (String(filters.active||'')==='true' && String(e.status||'')!=='active') return false
      if (String(filters.active||'')==='false' && String(e.status||'')!=='terminated') return false
      if (String(filters.gosi||'')==='true' && !e.gosi_enrolled) return false
      if (String(filters.gosi||'')==='false' && !!e.gosi_enrolled) return false
      if (q && !(`${e.employee_number||''} ${e.full_name||''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [list, search, filters])
  function fmt(n){ try { return parseFloat(n||0).toFixed(2) } catch { return '0.00' } }
  const prevByEmp = useMemo(()=>{
    const m = new Map();
    (prevDues||[]).forEach(d => {
      const id = Number(d.employee_id||0)
      const amt = parseFloat(d.amount||0)
      if (!id) return
      m.set(id, (m.get(id)||0) + (isFinite(amt)?amt:0))
    })
    return m
  }, [prevDues])

  const stats = useMemo(()=>{
    const total = list.length
    const active = list.filter(e=>String(e.status||'')==='active').length
    const terminated = list.filter(e=>String(e.status||'')==='terminated').length
    const saudi = list.filter(e=>String(e.nationality||'').toUpperCase()==='SA').length
    const grossTotal = list.reduce((sum,e)=> sum + gross(e), 0)
    return { total, active, terminated, saudi, nonSaudi: total - saudi, grossTotal }
  },[list])
  const canEmployeesWrite = can('employees:write')
  const canPayrollWrite = can('payroll:write')

  function gross(e){ const b=Number(e.basic_salary||0), h=Number(e.housing_allowance||0), t=Number(e.transport_allowance||0), o=Number(e.other_allowances||0); return (b+h+t+o) }

  function exportExcel(rows){
    const data = (rows||list).map(e => ({
      [lang==='ar'?'رقم الموظف':'Emp No.']: e.employee_number,
      [lang==='ar'?'الاسم':'Name']: e.full_name,
      [lang==='ar'?'الجنسية':'Nationality']: e.nationality,
      [lang==='ar'?'العقد':'Contract']: e.contract_type,
      [lang==='ar'?'الحالة':'Status']: e.status,
      [lang==='ar'?'الإجمالي':'Gross']: gross(e).toFixed(2),
      'GOSI': e.gosi_enrolled? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Employees")
    XLSX.writeFile(wb, "employees.xlsx")
  }

  async function exportPDF(){
    const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang })
      let companyName = ''
      let companyVAT = ''
      if (company) {
        companyName = lang==='ar' ? (company.name_ar || company.name_en) : (company.name_en || company.name_ar)
        companyVAT = company.vat_number ? `${lang==='ar'?'الرقم الضريبي':'VAT'}: ${company.vat_number}` : ''
      }
      
      // Logo removed per request
      
      doc.setFontSize(14)
      doc.safeText(lang==='ar'?'قائمة الموظفين':'Employees List', 40, 80)
      
      if (companyName) {
        doc.setFontSize(10)
        doc.safeText(companyName, 550, 40, { align: 'right' })
        if (companyVAT) doc.safeText(companyVAT, 550, 55, { align: 'right' })
      }
      
      let y = 100
      doc.setFontSize(10)
      
      filtered.slice(0,200).forEach((e,i)=>{
        const line = `${i+1}. ${e.employee_number||''} • ${(e.full_name||'')} • ${(e.nationality||'')} • ${(e.contract_type||'')} • ${gross(e).toFixed(2)}`
        doc.safeText(line, 40, y)
        y += 16
        if (y>780){ doc.addPage(); y=60 }
      })
      if (footerCfg && footerCfg.text) { doc.safeText(String(footerCfg.text), 40, 820) }
      print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
        <PageHeader
          icon={Users}
          title={lang==='ar'?"شاشة الموظفين":"Employees"}
          subtitle={lang==='ar'?"إدارة الموظفين والرواتب (متوافق مع GOSI ومُدد)":"Manage employees & payroll (GOSI & Mudad ready)"}
          onHomeClick={()=>navigate('/')}
          homeLabel={lang==='ar'?"الرئيسية":"Home"}
          actions={[
          ( <button key="cards" aria-label={lang==='ar'?"بطاقات الموظفين":"Employee Cards"} className="px-3 py-2 rounded-full border border-white/20 bg-gradient-to-tr from-primary-600 to-primary-400 text-white shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition flex items-center justify-center animate-pulse" onClick={()=>navigate('/employees/cards')}>
              <FaIdCard className="w-5 h-5" />
            </button> ),
          ( <button key="excel" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 flex items-center gap-2" onClick={()=>exportExcel(filtered)}><FaFileExcel/> Excel</button>),
          ( <button key="pdf" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={exportPDF}>PDF</button>),
          ( <button key="pay" className={`px-3 py-2 rounded-lg border border-white/20 ${canPayrollWrite?'bg-white/10 hover:bg-white/20 text-white':'bg-white/10 text-white/70 cursor-not-allowed'}`} onClick={()=>{ if (canPayrollWrite) navigate('/payroll/payments') }}>{lang==='ar'?"سداد الرواتب":"Payroll Payments"}</button>),
          ( <button key="stmt" className={`px-3 py-2 rounded-lg border border-white/20 ${canPayrollWrite?'bg-white/10 hover:bg-white/20 text-white':'bg-white/10 text-white/70 cursor-not-allowed'}`} onClick={()=>{ if (canPayrollWrite) navigate('/payroll/statements') }}>{lang==='ar'?"كشوف الرواتب":"Payroll Statements"}</button>),
          ( <button key="new" className={`px-3 py-2 rounded-lg border border-white/20 ${canEmployeesWrite?'bg-white/10 hover:bg-white/20 text-white':'bg-white/10 text-white/70 cursor-not-allowed'}`} onClick={()=>{ if (canEmployeesWrite) navigate('/employees/new') }}>{lang==='ar'?"إضافة موظف":"Add Employee"}</button>),
          ]}
        />

      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-500">{lang==='ar'?"إجمالي الموظفين":"Total Employees"}</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
            <Users className="w-8 h-8 text-primary-600" />
          </div>
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-500">{lang==='ar'?"نشطون":"Active"}</div>
              <div className="text-xl font-bold">{stats.active}</div>
            </div>
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-500">{lang==='ar'?"منتهون":"Terminated"}</div>
              <div className="text-xl font-bold">{stats.terminated}</div>
            </div>
            <UserX className="w-8 h-8 text-rose-600" />
          </div>
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-500">{lang==='ar'?"سعوديون":"Saudi"}</div>
              <div className="text-xl font-bold">{stats.saudi}</div>
            </div>
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-500">{lang==='ar'?"إجمالي الراتب":"Gross Total"}</div>
              <div className="text-xl font-bold">{stats.grossTotal.toFixed(2)}</div>
            </div>
          </div>
        </section>
        <section className="bg-white rounded shadow p-4">
          <AdvancedFilters
            value={{ ...filters, search }}
            onChange={(next)=>{ setFilters({ saudization: next.saudization||'', active: next.active||'', gosi: next.gosi||'', include_disabled: next.include_disabled||'' }); setSearch(next.search||'') }}
            lang={lang}
            fields={[
              { key:'search', type:'text', labelAr:'بحث', labelEn:'Search', placeholderAr:'اسم أو رقم موظف', placeholderEn:'Name or Employee No.' },
              { key:'saudization', type:'select', labelAr:'السعودة', labelEn:'Saudization', options:[{value:'saudi',label:lang==='ar'?'سعودي':'Saudi'},{value:'non_saudi',label:lang==='ar'?'غير سعودي':'Non-Saudi'}] },
              { key:'active', type:'select', labelAr:'الحالة', labelEn:'Status', options:[{value:'true',label:lang==='ar'?'نشط':'Active'},{value:'false',label:lang==='ar'?'منتهي':'Terminated'}] },
              { key:'gosi', type:'select', labelAr:'GOSI', labelEn:'GOSI', options:[{value:'true',label:lang==='ar'?'مشمول':'Enrolled'},{value:'false',label:lang==='ar'?'غير مشمول':'Not enrolled'}] },
              { key:'include_disabled', type:'select', labelAr:'إظهار الموقوفين', labelEn:'Show Disabled', options:[{value:'1',label:lang==='ar'?'إظهار':'Show'}] },
            ]}
          />
        </section>

        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">{lang==='ar'? 'تم نقل عرض الموظفين إلى صفحة البطاقات. استخدم الزر بالأعلى للوصول.':'Employee list has moved to the Cards page. Use the button above.'}</div>
            <button className="px-3 py-2 rounded-full border border-white/20 bg-gradient-to-tr from-primary-600 to-primary-400 text-white shadow hover:shadow-md" onClick={()=>navigate('/employees/cards')}>
              {lang==='ar'?'فتح البطاقات':'Open Cards'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{lang==='ar'?'مسير الرواتب':'Payroll'}</div>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={()=>{ if (canPayrollWrite) navigate('/payroll/run/create') }}>{lang==='ar'?'إنشاء مسير':'Create Run'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={()=>{ if (canPayrollWrite) navigate('/payroll/payments') }}>{lang==='ar'?'سداد الرواتب':'Payroll Payments'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={()=>{ if (canPayrollWrite) navigate('/payroll/statements') }}>{lang==='ar'?'كشوف الرواتب':'Payroll Statements'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canEmployeesWrite} onClick={()=>{ if (canEmployeesWrite) navigate('/employees/settings') }}>{lang==='ar'?'إعدادات الموظفين':'Employee Settings'}</button>
          </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2">{lang==='ar'?'الفترة':'Period'}</th>
                  <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                  <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.period}</td>
                    <td className="p-2">
                      <span className={r.status==='posted' ? 'px-2 py-1 rounded text-xs bg-green-100 text-green-700' : (r.status==='approved' ? 'px-2 py-1 rounded text-xs bg-blue-100 text-blue-700' : 'px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700')}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50" disabled={r.status!=='draft' || !canPayrollWrite} onClick={async()=>{ 
                          try {
                            if (r.status!=='draft' || !canPayrollWrite) return; 
                            if (!window.confirm(lang==='ar'?'تأكيد اعتماد المسير؟':'Confirm approve run?')) return; 
                            await apiPayroll.approve(r.id); 
                            load(); 
                            setToast(lang==='ar'?'تم اعتماد المسير':'Run approved') 
                          } catch (e) {
                            setToast(lang==='ar'?'فشل الاعتماد':'Approve failed')
                          }
                        }}>{lang==='ar'?'اعتماد':'Approve'}</button>
                        <button className="px-2 py-1 bg-primary-600 text-white rounded disabled:opacity-50" disabled={r.status!=='approved' || !canPayrollWrite} onClick={async()=>{ 
                          try {
                            if (r.status!=='approved' || !canPayrollWrite) { setToast(lang==='ar'?'المسير غير معتمد أو صلاحيات غير كافية':'Run not approved or insufficient permissions'); return } 
                            if (!window.confirm(lang==='ar'?'تأكيد الترحيل المحاسبي؟ (سيتم استخدام تاريخ اليوم)':'Confirm posting? (Today\'s date will be used)')) return; 
                            const date = new Date().toISOString().slice(0,10);
                            const res = await apiPayroll.post(r.id, { date }); 
                            load(); 
                            setToast(res?.already_posted ? (lang==='ar'?'المسير مُرحل مسبقًا':'Run already posted') : (lang==='ar'?'تم الترحيل المحاسبي':'Posted')) 
                          } catch (e) {
                            setToast(lang==='ar'?'فشل الترحيل: '+(e.message||'error') : 'Post failed: '+(e.message||'error'))
                          }
                        }}>{r.status==='posted'?(lang==='ar'?'مُرحل':'Posted'):(lang==='ar'?'ترحيل محاسبي':'Post')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-3xl">
            <div className="text-lg font-bold mb-2">{lang==='ar'?'إضافة موظف':'Add Employee'}</div>
            {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 font-semibold">{lang==='ar'?'البيانات الشخصية':'Personal'}</div>
              <input className="border rounded p-2" placeholder={lang==='ar'?'الاسم الكامل':'Full name'} value={form.full_name} onChange={e=>setForm({ ...form, full_name: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الهوية الوطنية / الإقامة':'National ID / Iqama'} value={form.national_id} onChange={e=>setForm({ ...form, national_id: e.target.value })} />
              <div className="relative">
                <input className="border rounded p-2 w-full" placeholder={lang==='ar'?'الجنسية (اكتب أول أحرف)':'Nationality (type first letters)'} value={form.nationality} onFocus={()=>setNatOpen(true)} onChange={e=>{ setNatQuery(e.target.value); setForm({ ...form, nationality: e.target.value.toUpperCase() }) }} onBlur={()=>setTimeout(()=>setNatOpen(false),150)} />
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
              <input className="border rounded p-2" placeholder={lang==='ar'?'الراتب الأساسي':'Basic salary'} value={form.basic_salary} onChange={e=>setForm({ ...form, basic_salary: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'أجرة الساعة':'Hourly rate'} value={form.hourly_rate} onChange={e=>setForm({ ...form, hourly_rate: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'بدل سكن':'Housing'} value={form.housing_allowance} onChange={e=>setForm({ ...form, housing_allowance: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'بدل نقل':'Transport'} value={form.transport_allowance} onChange={e=>setForm({ ...form, transport_allowance: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'بدلات أخرى':'Other allowances'} value={form.other_allowances} onChange={e=>setForm({ ...form, other_allowances: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'IBAN':'IBAN'} value={form.iban} onChange={e=>setForm({ ...form, iban: e.target.value })} />

              <div className="md:col-span-2 font-semibold">GOSI</div>
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم الاشتراك بالتأمينات':'GOSI subscription'} value={form.gosi_subscription_no} onChange={e=>setForm({ ...form, gosi_subscription_no: e.target.value })} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.gosi_enrolled} onChange={e=>setForm({ ...form, gosi_enrolled: e.target.checked })} /> {lang==='ar'?'مشمول بالتأمينات':'GOSI enrolled'}</label>
              <input className="border rounded p-2" placeholder={lang==='ar'?'نسبة الموظف':'Employee %'} value={form.gosi_employee_rate} onChange={e=>setForm({ ...form, gosi_employee_rate: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'نسبة صاحب العمل':'Employer %'} value={form.gosi_employer_rate} onChange={e=>setForm({ ...form, gosi_employer_rate: e.target.value })} />

              <div className="md:col-span-2 font-semibold">Mudad</div>
              <input className="border rounded p-2" placeholder={lang==='ar'?'رقم عقد مُدد':'Mudad contract'} value={form.mudad_contract_id} onChange={e=>setForm({ ...form, mudad_contract_id: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'حالة التوثيق':'Mudad status'} value={form.mudad_status} onChange={e=>setForm({ ...form, mudad_status: e.target.value })} />

              <div className="md:col-span-2 font-semibold">{lang==='ar'?'ربط محاسبي':'Accounting Link'}</div>
              <div className="md:col-span-2 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">5210</span>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">2120</span>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">2130</span>
              </div>
              <input className="border rounded p-2" placeholder={lang==='ar'?'حساب السلف (كود)':'Advances account code'} value={form.advance_account_code} onChange={e=>setForm({ ...form, advance_account_code: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'حساب الاستقطاعات/إيرادات أخرى (كود)':'Deductions account code'} value={form.deduction_account_code} onChange={e=>setForm({ ...form, deduction_account_code: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'حساب النقدية (كود)':'Cash account code'} value={form.cash_account_code} onChange={e=>setForm({ ...form, cash_account_code: e.target.value })} />
              <input className="border rounded p-2" placeholder={lang==='ar'?'حساب البنك (كود)':'Bank account code'} value={form.bank_account_code} onChange={e=>setForm({ ...form, bank_account_code: e.target.value })} />

              <div className="md:col-span-2 font-semibold">{lang==='ar'?'الصلاحيات':'Access'}</div>
              <input className="border rounded p-2" placeholder={lang==='ar'?'ربط بحساب مستخدم (ID)':'Link user ID'} value={form.user_id||''} onChange={e=>setForm({ ...form, user_id: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setShowForm(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={async()=>{
                setError('')
                if (!validateId(form.national_id)) { setError(lang==='ar'?'رقم هوية غير صحيح':'Invalid national ID'); return }
                if (!validateIBAN(form.iban)) { setError('Invalid IBAN'); return }
                try {
                  await apiEmployees.create(form)
                  try { localStorage.setItem('employees_version', String(Date.now())) } catch {}
                  setShowForm(false); load(); setToast(lang==='ar'?'تم الحفظ':'Saved')
                } catch (e) { setError(e.code||'failed') }
              }}>{lang==='ar'?'حفظ':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      

      {toast && (
        <div className="fixed bottom-4 right-4 bg-white border shadow px-4 py-2 rounded" onAnimationEnd={()=>setToast('')}>{toast}</div>
      )}
    </div>
  )
}
