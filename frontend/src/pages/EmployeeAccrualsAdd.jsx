import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { employees as apiEmployees, payroll as apiPayroll, settings as apiSettings } from '../services/api'

export default function EmployeeAccrualsAdd(){
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [company, setCompany] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState([])
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [type, setType] = useState('salary')
  const [amount, setAmount] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch {} try { const emps = await apiEmployees.list(); setEmployees(Array.isArray(emps)?emps:[]) } catch {} })() },[])
  useEffect(()=>{ try { const q = new URLSearchParams(location.search); const ids = q.get('employee_ids')||''; if (ids) { const arr = ids.split(',').map(s=>Number(s)).filter(Boolean); setSelected(arr) } } catch {} },[location.search])

  function monthsRange(a,b){
    if (!a) return []
    const start = a
    const end = b || a
    const [ay, am] = start.split('-').map(n=>Number(n))
    const [by, bm] = end.split('-').map(n=>Number(n))
    if (!ay || !am || !by || !bm) return []
    const out = []
    let y = ay, m = am
    while (y < by || (y===by && m<=bm)) { out.push(`${y}-${String(m).padStart(2,'0')}`); m++; if (m>12){ m=1; y++ } }
    return out
  }
  const previewPeriods = useMemo(()=> monthsRange(fromMonth, toMonth), [fromMonth, toMonth])
  const allSelected = useMemo(()=> selected.length && selected.length===employees.length, [selected, employees])
  function toggleAll(){ if (allSelected) setSelected([]); else setSelected(employees.map(e=>e.id)) }
  function toggleOne(id){ setSelected(prev=> prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]) }
  async function submit(){
    setError(''); setOkMsg('')
    try {
      if (!selected.length) { setError(lang==='ar'?'يرجى اختيار موظف واحد على الأقل':'Please select at least one employee'); return }
      if (!fromMonth) { setError(lang==='ar'?'يرجى تحديد شهر البداية':'Please set From month'); return }
      const amt = parseFloat(amount||0)
      if (!(amt > 0)) { setError(lang==='ar'?'يرجى إدخال مبلغ صحيح أكبر من صفر':'Enter a valid amount > 0'); return }
      const payload = { employee_ids: selected, from: fromMonth, to: toMonth || fromMonth, type, amount: amt, cost_center: costCenter || undefined, description: description || undefined }
      const res = await apiPayroll.accrualsBulkCreate(payload)
      if (res && res.ok) {
        setOkMsg((lang==='ar'?'تم إنشاء ':'Created ')+String(res.count||0))
        try { localStorage.setItem('accruals_version', String(Date.now())) } catch {}
      } else {
        const err = (res && res.error) ? String(res.error) : 'failed'
        const map = {
          invalid_employees: lang==='ar'?'يرجى اختيار موظف واحد على الأقل':'Please select at least one employee',
          invalid_amount: lang==='ar'?'المبلغ غير صحيح':'Invalid amount',
          invalid_period: lang==='ar'?'الفترة غير صحيحة، استخدم تنسيق YYYY-MM':'Invalid period; use YYYY-MM',
          failed: lang==='ar'?'فشل الإنشاء':'Failed',
          request_failed: lang==='ar'?'فشل الطلب':'Request failed'
        }
        setError(map[err] || (lang==='ar'?'فشل الطلب':'Request failed'))
      }
    } catch (e) {
      const err = String(e?.code || e?.message || 'failed')
      const map = {
        invalid_employees: lang==='ar'?'يرجى اختيار موظف واحد على الأقل':'Please select at least one employee',
        invalid_amount: lang==='ar'?'المبلغ غير صحيح':'Invalid amount',
        invalid_period: lang==='ar'?'الفترة غير صحيحة، استخدم تنسيق YYYY-MM':'Invalid period; use YYYY-MM',
        accounts_not_configured: lang==='ar'?'حسابات الرواتب غير مُعدّة للموظف':'Payroll accounts not configured for employee',
        not_found: lang==='ar'?'الموظف غير موجود':'Employee not found',
        request_failed: lang==='ar'?'فشل الطلب':'Request failed',
        failed: lang==='ar'?'فشل الإنشاء':'Failed'
      }
      setError(map[err] || (lang==='ar'?'فشل الطلب':'Request failed'))
    }
  }
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-primary-700">{lang==='ar'?'إضافة مستحقات سابقة':'Add Prior Dues'}</div>
            <div className="text-sm text-gray-600">{company?.trade_name || company?.name_ar || company?.name_en || ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/payroll/dues')}>{lang==='ar'?'عرض المستحقات':'View dues'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {error && (<div className="px-3 py-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>)}
        {okMsg && (<div className="px-3 py-2 rounded bg-green-100 text-green-700 text-sm">{okMsg}</div>)}
        <section className="bg-white rounded shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang==='ar'?'من شهر (YYYY-MM)':'From month (YYYY-MM)'}</label>
              <input type="month" className="border rounded px-3 py-2 w-full" value={fromMonth} onChange={e=>setFromMonth(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang==='ar'?'إلى شهر (YYYY-MM)':'To month (YYYY-MM)'}</label>
              <input type="month" className="border rounded px-3 py-2 w-full" value={toMonth} onChange={e=>setToMonth(e.target.value)} />
            </div>
            <select className="border rounded px-3 py-2" value={type} onChange={e=>setType(e.target.value)}>
              <option value="salary">{lang==='ar'?'راتب':'Salary'}</option>
              <option value="incentive">{lang==='ar'?'حافز':'Incentive'}</option>
              <option value="difference">{lang==='ar'?'فرق راتب':'Difference'}</option>
              <option value="adjustment">{lang==='ar'?'تعديل':'Adjustment'}</option>
            </select>
            <input type="number" className="border rounded px-3 py-2" placeholder={lang==='ar'?'المبلغ':'Amount'} value={amount} onChange={e=>setAmount(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder={lang==='ar'?'مركز التكلفة (اختياري)':'Cost center (optional)'} value={costCenter} onChange={e=>setCostCenter(e.target.value)} />
            <input className="border rounded px-3 py-2 md:col-span-5" placeholder={lang==='ar'?'وصف':'Description'} value={description} onChange={e=>setDescription(e.target.value)} />
            <div className="md:col-span-5 text-xs text-gray-600">
              {lang==='ar'
                ? 'ملاحظة: النطاق شامل من وإلى. اترك "إلى شهر" فارغًا لإنشاء شهر واحد. القيم بصيغة YYYY-MM مثل 2025-09.'
                : 'Note: Range is inclusive From and To. Leave "To month" empty to create one month. Values use YYYY-MM e.g. 2025-09.'}
            </div>
            {fromMonth && (
              <div className="md:col-span-5 text-sm text-gray-800">
                {(lang==='ar'?'سيتم الإنشاء عن الأشهر':'Will create for months')+`: ${previewPeriods.join(', ') || (lang==='ar'?'—':'—')} `}
                <span className="ml-2 text-gray-600">{(lang==='ar'?'عدد':'Count')+`: ${previewPeriods.length}`}</span>
              </div>
            )}
            <div className="md:col-span-5 flex items-center justify-end">
              <button className="px-4 py-2 bg-primary-600 text-white rounded" onClick={submit}>{lang==='ar'?'إنشاء':'Create'}</button>
            </div>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th className="p-2">{lang==='ar'?'الموظف':'Employee'}</th>
                <th className="p-2">{lang==='ar'?'القسم':'Department'}</th>
                <th className="p-2">{lang==='ar'?'الرقم':'Number'}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id} className="border-b">
                  <td className="p-2"><input type="checkbox" checked={selected.includes(e.id)} onChange={()=>toggleOne(e.id)} /></td>
                  <td className="p-2">{e.full_name}</td>
                  <td className="p-2">{e.department||''}</td>
                  <td className="p-2">{e.employee_number||''}</td>
                </tr>
              ))}
              {employees.length===0 && (<tr><td className="p-3 text-gray-500" colSpan={4}>{lang==='ar'?'لا توجد بيانات':'No data'}</td></tr>)}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
