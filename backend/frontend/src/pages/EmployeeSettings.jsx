import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { employees as apiEmployees, settings as apiSettings } from '../services/api'

export default function EmployeeSettings(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [list, setList] = useState([])
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState([])
  const [newDeptName, setNewDeptName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(()=>new Set())
  const [assignDept, setAssignDept] = useState('')
  const [toast, setToast] = useState('')
  const [period, setPeriod] = useState(()=>{ const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}` })
  const [hours, setHours] = useState({})
  const [savingHours, setSavingHours] = useState(false)
  function normalizeDigits(str){
    const map = {
      '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
      '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
    }
    return String(str||'').split('').map(ch => map[ch] ?? ch).join('')
  }
  function sanitizeDecimal(str){
    const s = normalizeDigits(str).replace(/[^0-9.]/g,'')
    const parts = s.split('.')
    const head = parts[0] || ''
    const tail = parts[1] ? parts[1].slice(0,4) : ''
    return tail ? `${head}.${tail}` : head
  }
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ function onStorage(e){ if (e.key==='employees_version') { (async()=>{ try { const rows = await apiEmployees.list(); setList(rows) } catch {} })() } } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const rows = await apiEmployees.list(); setList(rows) } catch { setList([]) } try { const d = await apiSettings.get('settings_departments'); setDepartments(Array.isArray(d)?d:[]) } catch { setDepartments([]) } })() },[])
  useEffect(()=>{ (async()=>{ try { const key = `settings_payroll_hours_${period}`; const v = await apiSettings.get(key); if (v) setHours(v); else setHours({}) } catch { setHours({}) } })() },[period])

  const listShown = useMemo(()=>{
    const q = String(search||'').trim().toLowerCase()
    if (!q) return list
    return list.filter(e => (`${e.employee_number||''} ${e.full_name||''} ${e.department||''}`).toLowerCase().includes(q))
  },[list, search])
  const byDept = useMemo(()=>{
    const map = new Map()
    listShown.forEach(e => { const d = e.department || ''; if (!map.has(d)) map.set(d, []); map.get(d).push(e) })
    return Array.from(map.entries())
  },[listShown])

  async function saveAll(){
    try {
      setSaving(true)
      const jobs = list.map(e => apiEmployees.update(e.id, { department: e.department }))
      await Promise.all(jobs)
      try { await apiSettings.save('settings_departments', departments) } catch {}
      navigate('/employees')
    } catch {} finally { setSaving(false) }
  }

  function toggleSelect(id){ const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next) }
  function clearSel(){ setSelectedIds(new Set()) }
  async function assignSelected(){
    try {
      if (!assignDept) return
      const ids = Array.from(selectedIds)
      if (!ids.length) return
      const jobs = ids.map(id => apiEmployees.update(id, { department: assignDept }))
      await Promise.all(jobs)
      const rows = await apiEmployees.list(); setList(rows)
      setToast(lang==='ar'?'تم التعيين على القسم المحدد':'Assigned to selected department')
      clearSel()
    } catch {}
  }

  function removeDept(name){
    const next = departments.filter(d => d.name !== name)
    setDepartments(next)
    setList(list.map(e => e.department===name ? { ...e, department: '' } : e))
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'إعدادات الموظفين':'Employee Settings'}</h1>
            <p className="text-gray-600 text-sm">{lang==='ar'?'توزيع الموظفين على الأقسام وتحديث بياناتهم':'Assign employees to departments and update settings'}</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="px-3 py-2 bg-primary-600 text-white rounded" disabled={saving} onClick={saveAll}>{saving?(lang==='ar'?'جار الحفظ...':'Saving...'):(lang==='ar'?'حفظ الكل':'Save All')}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{lang==='ar'?"ساعات الرواتب":"Payroll Hours"}</div>
            <div className="flex items-center gap-2">
              <input className="border rounded px-3 py-2 w-40" value={period} onChange={e=>setPeriod(e.target.value)} placeholder={lang==='ar'?"الفترة (YYYY-MM)":"Period (YYYY-MM)"} />
              <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={async()=>{ try { setSavingHours(true); await apiSettings.save(`settings_payroll_hours_${period}`, hours) } finally { setSavingHours(false) } }}>{savingHours?(lang==='ar'?"جار الحفظ...":"Saving..."):(lang==='ar'?"حفظ الساعات":"Save hours")}</button>
            </div>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?"رقم الموظف":"Emp No."}</th>
                <th className="p-2">{lang==='ar'?"الاسم":"Name"}</th>
                <th className="p-2">{lang==='ar'?"القسم":"Department"}</th>
                <th className="p-2">{lang==='ar'?"نوع الدفع":"Pay Type"}</th>
                <th className="p-2">{lang==='ar'?"الساعات":"Hours"}</th>
              </tr>
            </thead>
            <tbody>
              {list.filter(e => String(e.pay_type||'monthly')==='hourly').map(e => (
                <tr key={e.id} className="border-b">
                  <td className="p-2">{e.employee_number}</td>
                  <td className="p-2">{e.full_name}</td>
                  <td className="p-2">{e.department||''}</td>
                  <td className="p-2">{lang==='ar'? (String(e.pay_type)==='hourly'?"بالساعة":"شهري") : (String(e.pay_type)==='hourly'?"Hourly":"Monthly")}</td>
                  <td className="p-2"><input inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-32" value={String(hours[e.id]??'')} onChange={ev=>{ const v=sanitizeDecimal(ev.target.value); setHours(prev=>({ ...prev, [e.id]: v })) }} placeholder={lang==='ar'?"0":"0"} /></td>
                </tr>
              ))}
              {list.filter(e => String(e.pay_type||'monthly')==='hourly').length===0 && (
                <tr><td className="p-3 text-gray-500" colSpan={5}>{lang==='ar'?"لا يوجد موظفون بنظام الساعة":"No hourly employees"}</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <input className="border rounded px-3 py-2 w-64" placeholder={lang==='ar'?"بحث الموظفين":"Search employees"} value={search} onChange={e=>setSearch(e.target.value)} />
            <div className="flex items-center gap-2">
              <select className="border rounded px-3 py-2" value={assignDept} onChange={e=>setAssignDept(e.target.value)}>
                <option value="">{lang==='ar'?'اختر قسمًا':'Select department'}</option>
                {departments.filter(d=>!d.disabled).map(d => (<option key={d.name} value={d.name}>{d.name}</option>))}
              </select>
              <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={assignSelected}>{lang==='ar'?'تعيين المحدد للقسم':'Assign selected to department'}</button>
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={clearSel}>{lang==='ar'?'إلغاء التحديد':'Clear selection'}</button>
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-2">{lang==='ar'?'المحدد':'Selected'}: {selectedIds.size}</div>
        </section>
        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{lang==='ar'?"الأقسام":"Departments"}</div>
            <div className="flex gap-2">
              <input className="border rounded px-2 py-1" placeholder={lang==='ar'?"اسم القسم":"Department name"} value={newDeptName} onChange={e=>setNewDeptName(e.target.value)} />
              <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>{ const name = newDeptName.trim(); if (!name) return; if (departments.some(d=>d.name.toLowerCase()===name.toLowerCase())) return; setDepartments([...departments, { name, disabled: false, hourly_rate: 0 }]); setNewDeptName('') }}>{lang==='ar'?"إضافة قسم":"Add department"}</button>
              <button className="px-2 py-1 bg-primary-600 text-white rounded" onClick={async()=>{ try { await apiSettings.save('settings_departments', departments) } catch {} }}>{lang==='ar'?"حفظ الأقسام":"Save departments"}</button>
            </div>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?"القسم":"Department"}</th>
                <th className="p-2">{lang==='ar'?"سعر الساعة":"Hourly Rate"}</th>
                <th className="p-2">{lang==='ar'?"الحالة":"Status"}</th>
                <th className="p-2">{lang==='ar'?"إجراء":"Action"}</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => (
                <tr key={`${d.name}-${i}`} className="border-b">
                  <td className="p-2"><input className="border rounded p-2 w-full" value={d.name} onChange={e=>{ const v=e.target.value; setDepartments(departments.map((x,idx)=>idx===i?{...x,name:v}:x)) }} /></td>
                  <td className="p-2"><input inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-full" value={String(d.hourly_rate??'')} onChange={e=>{ const v=sanitizeDecimal(e.target.value); setDepartments(departments.map((x,idx)=>idx===i?{...x,hourly_rate:v}:x)) }} /></td>
                  <td className="p-2">
                    <select className="border rounded p-2" value={d.disabled?'disabled':'active'} onChange={e=>{ const v=e.target.value==='disabled'; setDepartments(departments.map((x,idx)=>idx===i?{...x,disabled:v}:x)) }}>
                      <option value="active">{lang==='ar'?"مفعل":"Active"}</option>
                      <option value="disabled">{lang==='ar'?"معطل":"Disabled"}</option>
                    </select>
                  </td>
                  <td className="p-2"><button className="px-2 py-1 bg-rose-100 text-rose-800 rounded" onClick={()=>removeDept(d.name)}>{lang==='ar'?"حذف":"Delete"}</button></td>
                </tr>
              ))}
              {departments.length===0 && (<tr><td className="p-3 text-gray-500" colSpan={4}>{lang==='ar'?"لا توجد أقسام":"No departments"}</td></tr>)}
            </tbody>
          </table>
        </section>
        {byDept.map(([dept, rows]) => (
          <section key={dept} className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">{dept|| (lang==='ar'?'غير محدد':'Unassigned')}</div>
            </div>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2">{lang==='ar'?'تحديد':'Select'}</th>
                  <th className="p-2">{lang==='ar'?'رقم الموظف':'Emp No.'}</th>
                  <th className="p-2">{lang==='ar'?'الاسم':'Name'}</th>
                  <th className="p-2">{lang==='ar'?'القسم':'Department'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => (
                  <tr key={e.id} className="border-b">
                    <td className="p-2"><input type="checkbox" checked={selectedIds.has(e.id)} onChange={()=>toggleSelect(e.id)} /></td>
                    <td className="p-2">{e.employee_number}</td>
                    <td className="p-2">{e.full_name}</td>
                    <td className="p-2">
                      <select className="border rounded p-2" value={e.department||''} onChange={ev=>{ const v=ev.target.value; setList(list.map(x=>x.id===e.id?{...x, department:v}:x)) }}>
                        <option value="">{lang==='ar'?'غير محدد':'Unassigned'}</option>
                        {departments.filter(d=>!d.disabled).map(d => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {toast && (<div className="fixed bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded" onAnimationEnd={()=>setToast('')}>{toast}</div>)}
      </main>
    </div>
  )
}
