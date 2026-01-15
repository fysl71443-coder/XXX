import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { payroll as apiPayroll, settings as apiSettings, employees as apiEmployees, accounts as apiAccounts } from '../services/api'
import { createPDF, ensureImageDataUrl } from '../utils/pdfUtils'
import { print } from '@/printing'

function flatten(nodes){ const out=[]; (nodes||[]).forEach(n=>{ out.push(n); out.push(...flatten(n.children||[])) }); return out }
function labelName(acc, lang){ return lang==='ar'?(acc.name||''):(acc.name_en||acc.name||'') }

export default function PayrollStatements(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [company, setCompany] = useState(null)
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [runs, setRuns] = useState([])
  const [runId, setRunId] = useState('')
  const period = useMemo(()=>{ const r = runs.find(x=>String(x.id)===String(runId)); return r?.period || '' },[runs, runId])
  const [items, setItems] = useState([])
  const [filterEmp, setFilterEmp] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [employees, setEmployees] = useState([])
  
  const [accs, setAccs] = useState([])
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch {} try { const b = await apiSettings.get('settings_branding'); setBranding(b||null) } catch {} try { const f = await apiSettings.get('settings_footer'); setFooterCfg(f||null) } catch {} try { const rs = await apiPayroll.runs(); const posted = rs.filter(r=>String(r.derived_status||'draft')==='posted'); setRuns(posted); if (!runId && posted.length) setRunId(String(posted[0].id)) } catch {} try { const emps = await apiEmployees.list(); setEmployees(Array.isArray(emps)?emps:[]) } catch {} try { const t = await apiAccounts.tree(); setAccs(flatten(t||[])) } catch {} })() },[runId])
  useEffect(()=>{ (async()=>{ try { if (runId) { const its = await apiPayroll.items(runId); setItems(Array.isArray(its)?its:[]) } else { setItems([]) } } catch { setItems([]) } })() },[runId])
  
  function accountDisplay(code){
    const c = String(code||'')
    if (!c || c==='—') return c
    const a = accs.find(x => String(x.account_code)===c)
    if (a) return `${c} • ${labelName(a, lang)}`
    return c
  }
  

  const empById = useMemo(()=>{ const m = new Map(); employees.forEach(e=>m.set(e.id, e)); return m },[employees])
  const rows = useMemo(()=>{
    const withItems = items.map(it => ({ ...it, employee: it.employee || empById.get(it.employee_id) || { full_name: lang==='ar'?'(غير موجود)':'(Missing)', department: '', employee_number: '?' } }))
    return withItems.filter(r => {
      const e = r.employee
      if (filterEmp && String(r.employee_id||'') !== String(filterEmp)) return false
      if (filterDept && String(e.department||'') !== String(filterDept)) return false
      if (filterStatus==='paid' && !r.paid_at) return false
      if (filterStatus==='unpaid' && r.paid_at) return false
      return true
    })
  },[items, empById, filterEmp, filterDept, filterStatus, lang])
  const departments = useMemo(()=>{ const set = new Set(); employees.forEach(e=>{ const d=String(e.department||'').trim(); if (d) set.add(d) }); return Array.from(set) },[employees])
  
  

  function fmt(n){ try { return parseFloat(n||0).toFixed(2) } catch { return '0.00' } }
  

  
  

  function printHTML(){ const url = runId ? `/print/payroll-slip.html?runId=${encodeURIComponent(runId)}` : (period ? `/print/payroll-slip.html?period=${encodeURIComponent(period)}` : '/print/payroll-slip.html'); window.open(url, '_blank') }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b no-print">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-primary-700">{lang==='ar'?'كشوف الرواتب':'Payroll Statements'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors" onClick={async()=>{ try { const rs = await apiPayroll.runs(); const posted = rs.filter(r=>String(r.derived_status||'draft')==='posted'); setRuns(posted); if (!runId && posted.length) setRunId(String(posted[0].id)) } catch {} try { const its = runId ? await apiPayroll.items(runId) : []; setItems(its||[]) } catch {} try { const emps = await apiEmployees.list(); setEmployees(Array.isArray(emps)?emps:[]) } catch {} }}>{lang==='ar'?'تحديث':'Refresh'}</button>
            <button className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors" onClick={printHTML}>{lang==='ar'?'طباعة':'Print'}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <section className="bg-white rounded shadow p-4 no-print">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'اختر مسير مُرحل':'Select posted run'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-64 bg-gray-50" value={runId} onChange={e=>setRunId(e.target.value)}>
                <option value="">{lang==='ar'?'اختر مسير...':'Select run...'}</option>
                {runs.map(r => (<option key={r.id} value={r.id}>{r.period}</option>))}
                </select>
            </div>
            <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تصفية حسب الموظف':'Filter by Employee'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-48" value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}>
                <option value="">{lang==='ar'?'جميع الموظفين':'All employees'}</option>
                {employees.map(e => (<option key={e.id} value={e.id}>{e.full_name}</option>))}
                </select>
            </div>
            <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تصفية حسب القسم':'Filter by Department'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-48" value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
                <option value="">{lang==='ar'?'جميع الأقسام':'All departments'}</option>
                {departments.map(d => (<option key={d} value={d}>{d}</option>))}
                </select>
            </div>
            <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تصفية حسب الحالة':'Filter by Status'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-48" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                <option value="">{lang==='ar'?'جميع الحالات':'All statuses'}</option>
                <option value="paid">{lang==='ar'?'مدفوع':'Paid'}</option>
                <option value="unpaid">{lang==='ar'?'غير مدفوع':'Unpaid'}</option>
                </select>
            </div>
          </div>
          
          <div className="mb-6 border-b pb-4">
            <div className="font-semibold mb-2 text-lg">{lang==='ar'?'إدارة المسيرات':'Manage Runs'}</div>
            <RunsManager />
          </div>

          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 border">{lang==='ar'?"الموظف":"Employee"}</th>
                <th className="p-2 border">{lang==='ar'?"الرقم الوظيفي":"Emp. No"}</th>
                <th className="p-2 border">{lang==='ar'?"القسم":"Department"}</th>
                <th className="p-2 border">{lang==='ar'?"نوع العقد":"Contract"}</th>
                <th className="p-2 border">{lang==='ar'?"الأساسي":"Basic"}</th>
                <th className="p-2 border">{lang==='ar'?"الساعات":"Hours"}</th>
                <th className="p-2 border">{lang==='ar'?"أجر الساعة":"Hourly Rate"}</th>
                <th className="p-2 border">{lang==='ar'?"حوافز مُدرجة":"Incentives"}</th>
                <th className="p-2 border">{lang==='ar'?"بدل سكن":"Housing"}</th>
                <th className="p-2 border">{lang==='ar'?"بدل نقل":"Transport"}</th>
                <th className="p-2 border">{lang==='ar'?"بدل آخر":"Other"}</th>
                <th className="p-2 border">{lang==='ar'?"تأمينات":"GOSI"}</th>
                <th className="p-2 border">{lang==='ar'?"غياب":"Absence"}</th>
                <th className="p-2 border">{lang==='ar'?"الصافي":"Net"}</th>
                <th className="p-2 border">{lang==='ar'?"الحالة":"Status"}</th>
                <th className="p-2 border">{lang==='ar'?"طريقة الدفع":"Method"}</th>
                <th className="p-2 border">{lang==='ar'?"حساب الصرف":"Account"}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(rows) ? rows : []).map(r => {
                const e = r.employee || {}
                const isHourly = String(e.pay_type||'monthly')==='hourly'
                return (
                  <tr key={r.employee_id} className={r.paid_at ? "border-b bg-green-50 hover:bg-green-100 transition-colors" : "border-b bg-white hover:bg-gray-50 transition-colors"}>
                    <td className="p-2 border font-medium">{e.full_name||''}</td>
                    <td className="p-2 border">{e.employee_number||''}</td>
                    <td className="p-2 border">{e.department||''}</td>
                    <td className="p-2 border">{String(e.contract_type||'')||''}</td>
                    <td className="p-2 border">{!isHourly ? fmt(r.basic_salary||0) : '—'}</td>
                    <td className="p-2 border">{isHourly ? fmt(r.hours_worked||0) : '—'}</td>
                    <td className="p-2 border">{isHourly ? fmt(e.hourly_rate||0) : '—'}</td>
                    <td className="p-2 border">{fmt(r.incentive_amount||0)}</td>
                    <td className="p-2 border">{fmt(r.housing_allowance||0)}</td>
                    <td className="p-2 border">{fmt(r.transport_allowance||0)}</td>
                    <td className="p-2 border">{fmt(r.other_allowances||0)}</td>
                    <td className="p-2 border">{fmt(r.gosi_employee||0)}</td>
                    <td className="p-2 border">{fmt(r.manual_deduction||0)}</td>
                    <td className="p-2 border font-bold">{fmt(r.net_salary||0)}</td>
                    <td className="p-2 border"><span className={r.paid_at ? 'px-2 py-1 rounded text-xs bg-green-100 text-green-700 font-semibold' : 'px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700 font-semibold'}>{r.paid_at ? (lang==='ar'?'مدفوع':'Paid') : (lang==='ar'?'غير مدفوع':'Unpaid')}</span></td>
                    <td className="p-2 border">{r.payment_method ? (r.payment_method==='cash' ? (lang==='ar'?'نقدي':'Cash') : (lang==='ar'?'تحويل بنكي':'Bank')) : '—'}</td>
                    <td className="p-2 border">{accountDisplay(r.payment_method==='cash' ? (e.cash_account_code||'—') : (e.bank_account_code||'—'))}</td>
                  </tr>
                )
              })}
              {rows.length===0 && (
                <tr><td className="p-8 text-center text-gray-500 italic" colSpan={17}>{lang==='ar'?'لا توجد بيانات للعرض':'No data to display'}</td></tr>
              )}
            </tbody>
          </table>
          
      </section>

      </main>
      
      {/* PRINT TEMPLATE */}
      <div id="payroll-print-template" className="print-only" style={{ display: 'none' }}>
        <div style={{ fontFamily: branding?.font || 'Arial, sans-serif', direction: 'rtl', width: '100%', maxWidth: '100%', margin: '0 auto', color: '#000', padding: '0', backgroundColor: 'white' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, borderBottom: '2px solid #000', paddingBottom: 15 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 5 }}>{company?.trade_name || company?.name_ar || 'شركة سمو الأوائل ذات المسئولية المحدودة'}</div>
              <div style={{ fontSize: 12 }}>{lang==='ar'?'الرقم الضريبي':'VAT Number'}: <span style={{ fontFamily: 'monospace' }}>{company?.vat_number || '—'}</span></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: 20, textDecoration: 'underline', marginBottom: 5 }}>{lang==='ar'?'كشف الرواتب':'PAYROLL STATEMENT'}</div>
              <div style={{ fontSize: 12 }}>{lang==='ar'?'التاريخ':'Date'}: {new Date().toLocaleDateString('en-CA')}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
               {branding?.logo ? (<img src={branding.logo} alt="logo" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain' }} />) : (<div style={{ height: 60, width: 100 }}></div>)}
            </div>
          </div>

          {/* Notes Section */}
          <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: 8, marginBottom: 15, fontSize: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, textDecoration: 'underline' }}>{lang==='ar'?'ملاحظات':'Notes'}:</div>
            <ul style={{ margin: 0, paddingInlineStart: 15, listStyleType: 'disc' }}>
              <li>{lang==='ar'?'الموظفون الشهريون: يظهر عمود الأساسي ويُخفى الساعات':'Monthly employees: Basic column shown, Hours hidden'}</li>
              <li>{lang==='ar'?'الموظفون بالساعة: يظهر عمود الساعات ويُخفى الأساسي':'Hourly employees: Hours column shown, Basic hidden'}</li>
              <li>{lang==='ar'?'البيانات مستمدة بالكامل من المسير المعتمد ولا يتم إعادة احتسابها':'Data derived from approved run'}</li>
              <li>{lang==='ar'?'جميع المبالغ بالريال السعودي':'All amounts in SAR'}</li>
            </ul>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, textAlign: 'center' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #999' }}>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc', width: '12%' }}>{lang==='ar'?'الموظف':'Employee'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'الرقم الوظيفي':'Emp No'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'القسم':'Dept'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'نوع العقد':'Contract'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'الأساسي':'Basic'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'الساعات':'Hours'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'أجر الساعة':'Rate'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'حوافز مُدرجة':'Incentives'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'بدل سكن':'Housing'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'بدل نقل':'Trans.'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'بدل آخر':'Other'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'تأمينات':'GOSI'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'غياب':'Absence'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc', backgroundColor: '#e5e7eb', fontWeight: 'bold' }}>{lang==='ar'?'الصافي':'Net'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'الحالة':'Status'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'طريقة الدفع':'Method'}</th>
                <th style={{ padding: '4px 2px', border: '1px solid #ccc' }}>{lang==='ar'?'حساب الصرف':'Account'}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(rows) ? rows : []).map((r, idx) => {
                const e = r.employee || {}
                const isHourly = String(e.pay_type||'monthly')==='hourly'
                const isPaid = !!r.paid_at
                return (
                  <tr key={r.employee_id} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '3px', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}>{e.full_name||''}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{e.employee_number||''}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{e.department||''}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{String(e.contract_type||'')||''}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{!isHourly ? fmt(r.basic_salary||0) : '—'}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{isHourly ? fmt(r.hours_worked||0) : '—'}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{isHourly ? fmt(e.hourly_rate||0) : '—'}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.incentive_amount||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.housing_allowance||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.transport_allowance||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.other_allowances||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.gosi_employee||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{fmt(r.manual_deduction||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>{fmt(r.net_salary||0)}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc', fontSize: 8 }}>{isPaid ? (lang==='ar'?'مدفوع':'Paid') : (lang==='ar'?'غير مدفوع':'Unpaid')}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc' }}>{r.payment_method ? (r.payment_method==='cash' ? (lang==='ar'?'نقدي':'Cash') : (lang==='ar'?'بنكي':'Bank')) : '—'}</td>
                    <td style={{ padding: '3px', border: '1px solid #ccc', fontSize: 8 }}>{accountDisplay(r.payment_method==='cash' ? (e.cash_account_code||'—') : (e.bank_account_code||'—'))}</td>
                  </tr>
                )
              })}
              {rows.length===0 && (
                 <tr><td colSpan={17} style={{ padding: 20, textAlign: 'center', color: '#666' }}>{lang==='ar'?'لا توجد بيانات':'No data'}</td></tr>
              )}
            </tbody>
          </table>

          {/* Footer Signatures */}
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', paddingLeft: 40, paddingRight: 40 }}>
             <div style={{ textAlign: 'center', width: 200 }}>
               <div style={{ fontWeight: 'bold', marginBottom: 50, borderBottom: '1px solid #000', paddingBottom: 5 }}>{lang==='ar'?'توقيع المحاسب':'Accountant Signature'}</div>
             </div>
             <div style={{ textAlign: 'center', width: 200 }}>
               <div style={{ fontWeight: 'bold', marginBottom: 50, borderBottom: '1px solid #000', paddingBottom: 5 }}>{lang==='ar'?'توقيع المدير':'Manager Signature'}</div>
             </div>
          </div>
          
          {/* Disclaimer */}
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: '#666', borderTop: '1px solid #eee', paddingTop: 10 }}>
            {lang==='ar'?'هذا الكشف صادر إلكترونيًا ويُستخدم لأغراض الاعتماد الداخلي.':'This statement is issued electronically and used for internal approval purposes.'}
          </div>

        </div>
      </div>
    </div>
  )
}

function RunsManager(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ setLoading(true); try { const rows = await apiPayroll.runs(); setList(Array.isArray(rows)?rows:[]) } catch { setList([]) } finally { setLoading(false) } })() },[])
  async function revertToDraft(id){
    setToast('')
    if (!window.confirm(lang==='ar'?'هل أنت متأكد من إعادة المسير إلى حالة مسودة؟':'Are you sure you want to revert to draft?')) return
    try {
      await apiPayroll.draft(id)
      const rows = await apiPayroll.runs()
      setList(Array.isArray(rows)?rows:[])
      setToast(lang==='ar'?'تم تحويل المسير إلى مسودة':'Run reverted to draft')
    } catch (e) {
      setToast(lang==='ar'?'فشل العملية':'Failed')
    }
  }
  async function removeRun(id){
    setToast('')
    if (!window.confirm(lang==='ar'?'حذف المسير غير المُرحل؟':'Delete unposted run?')) return
    try {
      await apiPayroll.removeRun(id)
      const rows = await apiPayroll.runs()
      setList(Array.isArray(rows)?rows:[])
      setToast(lang==='ar'?'تم حذف المسير':'Run deleted')
    } catch (e) {
      const code = e.response?.data?.error || e.code || ''
      const msg = code==='forbidden'
        ? (lang==='ar'?'غير مصرح: لا يمكنك حذف هذا المسير':'Forbidden: you cannot delete this run')
        : (code==='cannot_delete_posted' ? (lang==='ar'?'لا يمكن حذف مسير مُرحل':'Cannot delete posted run') : (lang==='ar'?'فشل حذف المسير':'Failed to delete run'))
      setToast(msg)
    }
  }
  return (
    <div className="border rounded p-3 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">{lang==='ar'?'الفترة':'Period'}</th>
              <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
              <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2 text-sm text-gray-600" colSpan={3}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
            ) : (
              list.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.period}</td>
                  <td className="p-2">
                    {(() => { const ds = String(r.derived_status||'draft'); const cls = ds==='paid' ? 'bg-green-100 text-green-700' : (ds==='posted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'); const label = lang==='ar' ? (ds==='paid' ? 'مدفوعة' : (ds==='posted' ? 'منشورة' : 'مسودة')) : (ds==='paid' ? 'Paid' : (ds==='posted' ? 'Posted' : 'Draft')); return (<span className={`px-2 py-1 rounded text-xs ${cls}`}>{label}</span>) })()}
                  </td>
                  <td className="p-2">
                    {r?.has_posted_journal ? (
                      <span className="text-xs text-gray-500">{lang==='ar'?'—':'—'}</span>
                    ) : (
                      <div className="flex gap-2">
                        <button className={`px-2 py-1 rounded ${r?.allowed_actions?.edit ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} disabled={!r?.allowed_actions?.edit} onClick={()=>{ if (r?.allowed_actions?.edit) revertToDraft(r.id) }}>{lang==='ar'?'مسودة':'Draft'}</button>
                        <button className={`px-2 py-1 rounded ${r?.allowed_actions?.edit ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} disabled={!r?.allowed_actions?.edit} onClick={()=>{ if (r?.allowed_actions?.edit) navigate(`/payroll/run/${r.id}/edit`) }}>{lang==='ar'?'تعديل':'Edit'}</button>
                        <button className={`px-2 py-1 rounded ${r?.allowed_actions?.delete ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} disabled={!r?.allowed_actions?.delete} onClick={()=>{ if (r?.allowed_actions?.delete) removeRun(r.id) }}>{lang==='ar'?'حذف':'Delete'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {toast && (<div className="mt-2 px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm">{toast}</div>)}
      </div>
    </div>
  )
}
