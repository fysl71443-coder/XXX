import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'
import * as XLSX from 'xlsx'
import { Users } from 'lucide-react'
import { FaIdCard, FaFileExcel } from 'react-icons/fa'
import PageHeader from '../components/PageHeader'
import AdvancedFilters from '../components/AdvancedFilters'
import EmployeesStats from '../components/EmployeesStats'
import EmployeesPayrollRunsTable from '../components/EmployeesPayrollRunsTable'
import { useLang } from '../hooks/useLang'
import { useEmployeesData } from '../hooks/useEmployeesData'

export default function Employees(){
  const navigate = useNavigate()
  const { lang } = useLang()
  const { can } = useAuth()

  const {
    filtered,
    runs,
    company,
    footerCfg,
    filters,
    search,
    error,
    stats,
    setFilters,
    setSearch,
    setError,
    load,
    gross,
  } = useEmployeesData()

  const [toast, setToast] = useState('')

  const canEmployeesWrite = can('employees:write')
  const canPayrollWrite = can('payroll:write')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function exportExcel(rows){
    const data = (rows||filtered).map(e => ({
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
        <EmployeesStats stats={stats} lang={lang} />

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

        <EmployeesPayrollRunsTable
          runs={runs}
          canPayrollWrite={canPayrollWrite}
          canEmployeesWrite={canEmployeesWrite}
          lang={lang}
          onRefresh={load}
        />
      </main>

      {error && (
        <div className="max-w-7xl mx-auto px-6">
          <div className="px-4 py-2 rounded bg-red-100 text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-white border shadow px-4 py-2 rounded">{toast}</div>
      )}
    </div>
  )
}
