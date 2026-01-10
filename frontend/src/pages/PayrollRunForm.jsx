import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { employees as apiEmployees, payroll as apiPayroll, settings as apiSettings } from '../services/api'
import { sanitizeDecimal } from '../utils/number'

export default function PayrollRunForm(){
  const navigate = useNavigate()
  const { id: editIdParam } = useParams()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [departments, setDepartments] = useState([])
  function normalizeDigits(str){
    const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}
    return String(str||'').split('').map(ch => map[ch] ?? ch).join('')
  }
  function showVal(v){ const n = Number(v||0); return n===0 ? '' : normalizeDigits(String(v||'')) }
  const [period, setPeriod] = useState(new Date().toISOString().slice(0,7))
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [saving, setSaving] = useState(false)
  const [run, setRun] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [postDate, setPostDate] = useState('')
  const ds = String(run?.derived_status||'draft')
  const statusLabel = useMemo(()=>{ return lang==='ar' ? (ds==='paid'?'مدفوعة':(ds==='posted'?'منشورة':'مسودة')) : (ds==='paid'?'Paid':(ds==='posted'?'Posted':'Draft')) },[ds,lang])
  const statusClass = useMemo(()=>{ return ds==='paid' ? 'bg-green-100 text-green-700' : (ds==='posted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700') },[ds])

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{
    (async()=>{
      try {
        const deps = await apiSettings.get('settings_departments')
        setDepartments(Array.isArray(deps)?deps:[])

        const emps = await apiEmployees.list({ active: 'true' })
        setEmployees(Array.isArray(emps)?emps:[])
        if (editIdParam) {
          const id = Number(editIdParam)
          const runs = await apiPayroll.runs()
          const r = (Array.isArray(runs)?runs:[]).find(x => Number(x.id)===id)
          if (r) { setRun(r); setPeriod(r.period) }
          const its = await apiPayroll.items(id)
          const mapped = (Array.isArray(its)?its:[]).map(it => ({
            employee_id: it.employee_id,
            full_name: it.employee?.full_name || emps.find(e=>e.id===it.employee_id)?.full_name || '',
            department: it.employee?.department || emps.find(e=>e.id===it.employee_id)?.department || '',
            hours_worked: parseFloat(it.hours_worked||0),
            basic_salary: parseFloat(it.basic_salary||0),
            housing_allowance: parseFloat(it.housing_allowance||0),
            transport_allowance: parseFloat(it.transport_allowance||0),
            other_allowances: parseFloat(it.other_allowances||0),
            manual_deduction: parseFloat(it.manual_deduction||0),
            incentive_amount: parseFloat(it.incentive_amount||0),
            gosi_enrolled: !!(emps.find(e=>e.id===it.employee_id)?.gosi_enrolled),
            gosi_employee_rate: parseFloat(emps.find(e=>e.id===it.employee_id)?.gosi_employee_rate||0),
            pay_type: emps.find(e=>e.id===it.employee_id)?.pay_type || 'monthly'
          }))
          setRows(mapped)
        } else {
          setRows((Array.isArray(emps)?emps:[]).filter(e => String(e.status||'')==='active').map(e => ({
            employee_id: e.id,
            full_name: e.full_name,
            department: e.department||'',
            hours_worked: 0,
            basic_salary: parseFloat(e.basic_salary||0),
            housing_allowance: parseFloat(e.housing_allowance||0),
            transport_allowance: parseFloat(e.transport_allowance||0),
            other_allowances: parseFloat(e.other_allowances||0),
            manual_deduction: 0,
            incentive_amount: 0,
            gosi_enrolled: !!e.gosi_enrolled,
            gosi_employee_rate: parseFloat(e.gosi_employee_rate||0),
            pay_type: String(e.pay_type||'monthly')
          })))
        }
      } catch {}
    })()
  },[editIdParam])

  const totals = useMemo(()=>{
    const gross = rows.reduce((s,r)=> s + parseFloat(r.basic_salary||0) + parseFloat(r.housing_allowance||0) + parseFloat(r.transport_allowance||0) + parseFloat(r.other_allowances||0), 0)
    const gosi = rows.reduce((s,r)=> s + (r.gosi_enrolled ? ((parseFloat(r.basic_salary||0)+parseFloat(r.housing_allowance||0)+parseFloat(r.transport_allowance||0)+parseFloat(r.other_allowances||0)) * parseFloat(r.gosi_employee_rate||0)) : 0), 0)
    const net = gross - gosi
    const inc = rows.reduce((s,r)=> s + parseFloat(r.incentive_amount||0), 0)
    const ded = rows.reduce((s,r)=> s + parseFloat(r.manual_deduction||0), 0)
    return { gross: gross.toFixed(2), gosi: gosi.toFixed(2), net: net.toFixed(2), inc: inc.toFixed(2), ded: ded.toFixed(2) }
  },[rows])

  function updateRow(id, patch){ 
    setRows(prev => prev.map(r => {
      if (r.employee_id !== id) return r
      const next = { ...r, ...patch }
      
      // Auto-calculate basic salary for hourly employees if hours changed
      if (String(next.pay_type)==='hourly' && 'hours_worked' in patch) {
        const depName = String(next.department||'').trim().toLowerCase()
        const dep = departments.find(d => String(d.name||'').trim().toLowerCase() === depName)
        const rate = dep ? parseFloat(dep.hourly_rate||0) : 0
        const hrs = parseFloat(next.hours_worked||0)
        next.basic_salary = hrs * rate
      }
      
      return next
    })) 
  }

  function toggleEmployee(id){
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id])
  }
  function toggleAll(){
    const allIds = rows.map(r => r.employee_id)
    if (selectedEmployees.length===allIds.length && allIds.length>0) setSelectedEmployees([])
    else setSelectedEmployees(allIds)
  }

  function getErrMsg(code){
    if (code==='forbidden') return lang==='ar'?'ليس لديك صلاحية':'Permission denied'
    if (code==='not_found') return lang==='ar'?'المسير غير موجود':'Run not found'
    if (code==='cannot_delete_posted') return lang==='ar'?'لا يمكن حذف مسير مُرحل':'Cannot delete posted run'
    if (code==='not_approved') return lang==='ar'?'يجب اعتماد المسير أولاً':'Run must be approved first'
    return lang==='ar'?'حدث خطأ غير متوقع':'Unexpected error'
  }

  async function save(){
    setError('')
    setSuccess('')
    try {
      setSaving(true)
      if (!selectedEmployees.length) { setError(lang==='ar'?'يرجى اختيار موظفين':'Please select employees'); return }
      const payloadItems = rows.filter(r => selectedEmployees.includes(r.employee_id)).map(r => ({ employee_id: r.employee_id, hours_worked: parseFloat(r.hours_worked||0), basic_salary: parseFloat(r.basic_salary||0), housing_allowance: parseFloat(r.housing_allowance||0), transport_allowance: parseFloat(r.transport_allowance||0), other_allowances: parseFloat(r.other_allowances||0), manual_deduction: parseFloat(r.manual_deduction||0), incentive_amount: parseFloat(r.incentive_amount||0) }))
      if (editIdParam) {
        const id = Number(editIdParam)
        await apiPayroll.updateItems(id, payloadItems, { replace: true })
        setRun({ id, period })
      } else {
        const hours = Object.fromEntries(rows.filter(r => selectedEmployees.includes(r.employee_id)).map(r => [r.employee_id, parseFloat(r.hours_worked||0)]))
        const created = await apiPayroll.run({ period, hours, employee_ids: selectedEmployees })
        const runId = created.run?.id || created.id
        setRun(created.run || { id: runId, period })
        await apiPayroll.updateItems(runId, payloadItems, { replace: true })
      }
      setSuccess(lang==='ar'?'تم حفظ المسير بنجاح':'Run saved successfully')
      setTimeout(() => navigate('/payroll/statements'), 1500)
    } catch (e) { setError(getErrMsg(e.response?.data?.error || e.code || 'failed')) } finally { setSaving(false) }
  }

  async function approve(){ if (!run?.id) return; try { await apiPayroll.approve(run.id) ; navigate('/payroll/statements') } catch (e) { setError(getErrMsg(e.response?.data?.error || e.code || 'failed')) } }
  async function post(){ if (!run?.id || !postDate) { setError(lang==='ar'?'يرجى تحديد تاريخ القيد':'Please select a transaction date'); return } try { await apiPayroll.post(run.id, { date: postDate }) ; navigate('/payroll/payments') } catch (e) { setError(getErrMsg(e.response?.data?.error || e.code || 'failed')) } }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold text-primary-700">{(ds==='posted'||ds==='paid') ? (lang==='ar'?'عرض مسير رواتب':'View Payroll Run') : (editIdParam ? (lang==='ar'?'تعديل مسير رواتب':'Edit Payroll Run') : (lang==='ar'?'إنشاء مسير رواتب':'Create Payroll Run'))}</div>
              {run && (<span className={`px-2 py-1 rounded text-xs ${statusClass}`}>{statusLabel}</span>)}
            </div>
            <div className="text-sm text-gray-600">{(!run || run?.allowed_actions?.edit) ? (editIdParam ? (lang==='ar'?'عدّل البيانات واحفظ ثم اعتمد/رحّل':'Edit data, save then approve/post') : (lang==='ar'?'اختر الشهر واملأ البيانات المتغيرة ثم احفظ وراحِل':'Select month, fill variable data, then save and post')) : (lang==='ar'?'هذه الصفحة قراءة فقط (المسير مُرحّل)':'This page is read-only (run posted)')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {error && (<div className="mb-3 text-sm text-red-600">{error}</div>)}
        {success && (<div className="mb-3 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">{success}</div>)}
        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center gap-2">
            <input type="month" lang="en" dir="ltr" className="border rounded px-3 py-2" value={period} onChange={e=>setPeriod(e.target.value)} disabled={!!editIdParam || (!!run && !run?.allowed_actions?.edit)} />
            {run?.has_posted_journal ? null : (
              <>
                <button className="px-3 py-2 bg-primary-600 text-white rounded" disabled={saving || (!!run && !run?.allowed_actions?.edit)} onClick={save}>{saving ? (lang==='ar'?'جار الحفظ...':'Saving...') : (lang==='ar'?'حفظ المسير':'Save Run')}</button>
                <button className="px-3 py-2 bg-indigo-600 text-white rounded" disabled={!run || !run?.allowed_actions?.post} onClick={approve}>{lang==='ar'?'اعتماد':'Approve'}</button>
                <input type="date" lang="en" dir="ltr" className="border rounded px-3 py-2" value={postDate} onChange={e=>setPostDate(e.target.value)} placeholder={lang==='ar'?'تاريخ القيد':'Entry date'} disabled={!run || !run?.allowed_actions?.post} />
                <button className="px-3 py-2 bg-green-600 text-white rounded" disabled={!run || !postDate || !run?.allowed_actions?.post} onClick={post}>{lang==='ar'?'ترحيل':'Post'}</button>
              </>
            )}
            <div className="text-sm text-gray-700">{run ? ((lang==='ar'?'المسير':'Run')+`: ${run.period}`) : ''}</div>
          </div>
        </section>
        <section className="bg-white rounded shadow p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={toggleAll}>{(selectedEmployees.length===rows.length && rows.length>0) ? (lang==='ar'?'إلغاء الكل':'Unselect All') : (lang==='ar'?'تحديد الكل':'Select All')}</button>
            <div className="text-sm text-gray-700">{(lang==='ar'?'عدد المختارين':'Selected')+`: ${selectedEmployees.length}`}</div>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'اختر':'Select'}</th>
                <th className="p-2">{lang==='ar'?'الموظف':'Employee'}</th>
                <th className="p-2">{lang==='ar'?'القسم':'Department'}</th>
                <th className="p-2">{lang==='ar'?'الساعات':'Hours'}</th>
                <th className="p-2">{lang==='ar'?'الأساسي':'Basic'}</th>
                <th className="p-2">{lang==='ar'?'السكن':'Housing'}</th>
                <th className="p-2">{lang==='ar'?'النقل':'Transport'}</th>
                <th className="p-2">{lang==='ar'?'أخرى':'Other'}</th>
                <th className="p-2">{lang==='ar'?'الحوافز':'Incentives'}</th>
                <th className="p-2">{lang==='ar'?'الاستقطاعات':'Deductions'}</th>
                <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.employee_id} className="border-b">
                  <td className="p-2"><input type="checkbox" checked={selectedEmployees.includes(r.employee_id)} onChange={()=>toggleEmployee(r.employee_id)} /></td>
                  <td className="p-2">{r.full_name}</td>
                  <td className="p-2">{r.department}</td>
                  <td className="p-2">{String(r.pay_type||'monthly')==='hourly' ? (
                    <input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.hours_worked)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { hours_worked: v }) }} disabled={!!run && !run?.allowed_actions?.edit} />
                  ) : (
                    <span>—</span>
                  )}</td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.basic_salary)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { basic_salary: v }) }} disabled={(!!run && !run?.allowed_actions?.edit) || String(r.pay_type)==='hourly'} /></td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.housing_allowance)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { housing_allowance: v }) }} disabled={!!run && !run?.allowed_actions?.edit} /></td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.transport_allowance)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { transport_allowance: v }) }} disabled={!!run && !run?.allowed_actions?.edit} /></td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.other_allowances)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { other_allowances: v }) }} disabled={!!run && !run?.allowed_actions?.edit} /></td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.incentive_amount)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { incentive_amount: v }) }} disabled={!!run && !run?.allowed_actions?.edit} /></td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="text" inputMode="decimal" lang="en" dir="ltr" value={showVal(r.manual_deduction)} onChange={e=>{ const v=sanitizeDecimal(e.target.value); updateRow(r.employee_id, { manual_deduction: v }) }} disabled={!!run && !run?.allowed_actions?.edit} /></td>
                  <td className="p-2">{(parseFloat(r.basic_salary||0)+parseFloat(r.housing_allowance||0)+parseFloat(r.transport_allowance||0)+parseFloat(r.other_allowances||0)+parseFloat(r.incentive_amount||0)-parseFloat(r.manual_deduction||0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="bg-white rounded shadow p-4">
          <div className="text-sm text-gray-700">{(lang==='ar'?'الإجمالي':'Totals')+`: ${totals.gross} • GOSI: ${totals.gosi} • ${lang==='ar'?'الصافي':'Net'}: ${totals.net} • ${lang==='ar'?'الحوافز':'Inc'}: ${totals.inc} • ${lang==='ar'?'الاستقطاعات':'Ded'}: ${totals.ded}`}</div>
        </section>
      </main>
    </div>
  )
}
