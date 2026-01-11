import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { FaPrint } from 'react-icons/fa'
import { payroll as apiPayroll, settings as apiSettings, employees as apiEmployees } from '../services/api'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'
 
 

export default function PayrollDues(){
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [company, setCompany] = useState(null)
  const [employees, setEmployees] = useState([])
  const [outstanding, setOutstanding] = useState([])
  const [filterEmp, setFilterEmp] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [runs, setRuns] = useState([])
  const [runId, setRunId] = useState('')
  const [outMonth, setOutMonth] = useState('')
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch {} try { const emps = await apiEmployees.list(); setEmployees(Array.isArray(emps)?emps:[]) } catch {} try { const rs = await apiPayroll.runs(); const posted = rs.filter(r=>String(r.derived_status||'draft')==='posted'); setRuns(posted) } catch {} })() },[])
  useEffect(()=>{ try { const q = new URLSearchParams(location.search); const empId = q.get('employee_id')||''; if (empId) setFilterEmp(empId) } catch {} },[location.search])
  useEffect(()=>{ (async()=>{ try { const params = {}; if (filterEmp) params.employee_id = filterEmp; const outs = await apiPayroll.outstanding(params); let arr = Array.isArray(outs)?outs:[]; if (runId) { const r = runs.find(x=>String(x.id)===String(runId)); const per = r?.period||''; arr = arr.filter(o => String(o.period||'')===String(per)) } setOutstanding(arr) } catch { setOutstanding([]) } })() },[filterEmp, runId, runs])

  const empById = useMemo(()=>{ const m = new Map(); employees.forEach(e=>m.set(e.id, e)); return m },[employees])
  const filteredOutstanding = useMemo(()=>{
    function cmpYm(a,b){ try { const [ay,am]=String(a||'').split('-').map(Number); const [by,bm]=String(b||'').split('-').map(Number); if (!isFinite(ay)||!isFinite(am)||!isFinite(by)||!isFinite(bm)) return 0; const av=ay*100+am; const bv=by*100+bm; return av - bv } catch { return 0 } }
    return outstanding.filter(o => {
      if (filterEmp && String(o.employee_id||'') !== String(filterEmp)) return false
      const per = String(o.period||'')
      if (outMonth && /^\d{4}-\d{2}$/.test(outMonth)) { if (cmpYm(per,outMonth) > 0) return false }
      const e = empById.get(o.employee_id)
      if (filterDept && String(e?.department||'') !== String(filterDept)) return false
      return true
    })
  },[outstanding, filterEmp, filterDept, outMonth, empById])
  function fmt(n){ try { return parseFloat(n||0).toFixed(2) } catch { return '0.00' } }
  const outTotal = useMemo(()=> fmt(filteredOutstanding.reduce((s,o)=> s + parseFloat(o.net_salary||0) + parseFloat(o.previous_due_amount||0), 0)), [filteredOutstanding])

  async function refresh(){
    try { const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch {}
    try { const emps = await apiEmployees.list(); setEmployees(Array.isArray(emps)?emps:[]) } catch {}
    try { const params = {}; if (filterEmp) params.employee_id = filterEmp; const outs = await apiPayroll.outstanding(params); let arr = Array.isArray(outs)?outs:[]; if (runId) { const r = runs.find(x=>String(x.id)===String(runId)); const per = r?.period||''; arr = arr.filter(o => String(o.period||'')===String(per)) } setOutstanding(arr) } catch { setOutstanding([]) }
  }

  

  function exportOutstandingExcel(){
    const header = [lang==='ar'?'الموظف':'Employee', lang==='ar'?'القسم':'Department', lang==='ar'?'الشهر':'Month', lang==='ar'?'المبلغ':'Amount']
    const data = filteredOutstanding.map(o => {
      const e = empById.get(o.employee_id)
      return {
        employee: (e?.full_name||''),
        department: (e?.department||''),
        month: o.period||'',
        amount: parseFloat(o.net_salary||0)+parseFloat(o.previous_due_amount||0)
      }
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data, { header: ['employee','department','month','amount'], skipHeader: true })
    XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A1' })
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding Dues')
    XLSX.writeFile(wb, 'outstanding_dues.xlsx')
  }

  async function printOutstandingPDF(){
    const qs = new URLSearchParams()
    if (filterEmp) qs.set('employee_id', filterEmp)
    if (outMonth) qs.set('month', outMonth)
    const url = `/print/payroll-dues.html${qs.toString()?`?${qs.toString()}`:''}`
    window.open(url, '_blank')
    return
    const doc = await createPDF({ orientation: 'l', unit: 'pt', format: 'a4', lang })
    let companyName = ''
    let logo = ''
    try {
        if (company) {
            companyName = lang==='ar' ? (company.name_ar || company.name_en || '') : (company.name_en || company.name_ar || '')
        }
        const branding = await apiSettings.get('settings_branding')
        if (branding?.logo) logo = branding.logo
    } catch {}

    const pageW = 842
    const margin = 40
    let y = margin

    // Logo removed per request
    
    doc.setFontSize(18)
    const title = lang==='ar'?'تقرير المستحقات غير المدفوعة':'Outstanding Dues Report'
    doc.safeText(title, margin, y+25)

    if (companyName) {
        doc.setFontSize(12)
        doc.safeText(companyName, pageW-margin, y+15, { align: 'right' })
        if (company?.vat_number) doc.safeText(`${lang==='ar'?'الرقم الضريبي':'VAT'}: ${company.vat_number}`, pageW-margin, y+30, { align: 'right' })
    }

    y = 100

    const columns = [
      { t: lang==='ar'?'الموظف':'Employee', w: 200, val: o => { const e = empById.get(o.employee_id); return e?.full_name||'' } },
      { t: lang==='ar'?'القسم':'Department', w: 150, val: o => { const e = empById.get(o.employee_id); return e?.department||'' } },
      { t: lang==='ar'?'الشهر':'Month', w: 100, val: o => o.period||'' },
      { t: lang==='ar'?'المبلغ':'Amount', w: 100, val: o => fmt(parseFloat(o.net_salary||0)+parseFloat(o.previous_due_amount||0)) },
    ]

    doc.setFillColor(245, 247, 250)
    doc.rect(margin, y, pageW-(margin*2), 25, 'F')
    doc.setTextColor(0)
    doc.setFontSize(10)

    if (lang==='ar') {
        let x = pageW - margin
        columns.forEach(c => {
            x -= c.w
            doc.safeText(c.t, x + c.w/2, y+16, { align: 'center' })
        })
    } else {
        let x = margin
        columns.forEach(c => {
            doc.safeText(c.t, x+5, y+16)
            x += c.w
        })
    }

    y += 30

    filteredOutstanding.forEach(o => {
        if (y > 550) { doc.addPage(); y = margin + 20 }
        
        if (lang==='ar') {
            let x = pageW - margin
            columns.forEach(c => {
                x -= c.w
                doc.safeText(String(c.val(o)), x + c.w/2, y, { align: 'center' })
            })
        } else {
            let x = margin
            columns.forEach(c => {
                doc.safeText(String(c.val(o)), x+5, y)
                x += c.w
            })
        }
        y += 20
    })

    y += 10
    doc.setFontSize(12)
    try {
      const fam = doc.fontName || 'helvetica'
      doc.setFont(fam, 'bold')
      try { doc.getTextWidth('A') } catch { doc.setFont(fam, 'normal') }
    } catch {}
    const totalLabel = lang==='ar'?'الإجمالي:':'Total:'
    if (lang==='ar') {
        doc.safeText(`${totalLabel} ${outTotal}`, margin, y) 
    } else {
         doc.safeText(`${totalLabel} ${outTotal}`, pageW-margin, y, { align: 'right' })
    }

    print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
  }

  

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-primary-700">{lang==='ar'?'المستحقات غير المدفوعة':'Outstanding Dues'}</div>
            <div className="text-sm text-gray-600">{company?.trade_name || company?.name_ar || company?.name_en || ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={refresh}>{lang==='ar'?'تحديث':'Refresh'}</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        
        <section className="bg-white rounded shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
            <select className="border rounded px-3 py-2" value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}>
              <option value="">{lang==='ar'?'جميع الموظفين':'All employees'}</option>
              {employees.map(e => (<option key={e.id} value={e.id}>{e.full_name}</option>))}
            </select>
            <input type="month" className="border rounded px-3 py-2" placeholder={lang==='ar'?'حتى شهر':'Up to month'} value={outMonth} onChange={e=>setOutMonth(e.target.value)} />
            <div className="text-sm text-gray-700 flex items-center justify-end">{(lang==='ar'?'إجمالي غير المدفوع':'Total outstanding')+`: ${outTotal}`}</div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{lang==='ar'?'المستحقات غير المدفوعة من المسيرات':'Outstanding from posted runs'}</div>
            <div className="flex items-center gap-2">
              <select className="border rounded px-3 py-2" value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
                <option value="">{lang==='ar'?'جميع الأقسام':'All departments'}</option>
                {[...new Set(employees.map(e=>e.department||'').filter(Boolean))].map(d => (<option key={d} value={d}>{d}</option>))}
              </select>
              <select className="border rounded px-3 py-2" value={runId} onChange={e=>setRunId(e.target.value)}>
                <option value="">{lang==='ar'?'كل المسيرات':'All runs'}</option>
                {runs.map(r => (<option key={r.id} value={r.id}>{r.period}</option>))}
              </select>
              <button className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors flex items-center gap-2" onClick={exportOutstandingExcel}>Excel</button>
              <button className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2" onClick={printOutstandingPDF}><FaPrint/> طباعة</button>
            </div>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'الموظف':'Employee'}</th>
                <th className="p-2">{lang==='ar'?'القسم':'Department'}</th>
                <th className="p-2">{lang==='ar'?'الشهر':'Month'}</th>
                <th className="p-2">{lang==='ar'?'المبلغ':'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutstanding.map(o => {
                const e = empById.get(o.employee_id)
                return (
                  <tr key={`${o.employee_id}-${o.period}`} className="border-b">
                    <td className="p-2">{e?.full_name||''}</td>
                    <td className="p-2">{e?.department||''}</td>
                    <td className="p-2">{o.period||''}</td>
                    <td className="p-2">{fmt(parseFloat(o.net_salary||0) + parseFloat(o.previous_due_amount||0))}</td>
                  </tr>
                )
              })}
              {filteredOutstanding.length===0 && (<tr><td className="p-3 text-gray-500" colSpan={4}>{lang==='ar'?'لا توجد بيانات':'No data'}</td></tr>)}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
