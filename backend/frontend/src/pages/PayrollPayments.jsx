import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { employees as apiEmployees, payroll as apiPayroll, settings as apiSettings } from '../services/api'
import { createPDF, ensureImageDataUrl } from '../utils/pdfUtils'
import { print } from '@/printing'

export default function PayrollPayments(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [runs, setRuns] = useState([])
  const [runId, setRunId] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [method, setMethod] = useState('bank')
  const [payDate, setPayDate] = useState('')
  const [employees, setEmployees] = useState([])
  const [advanceBalances, setAdvanceBalances] = useState(new Map()) // Map<employeeId, balance>
  const [company, setCompany] = useState(null)
  const [branding, setBranding] = useState(null)
  const printRef = useRef(null)
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
  useEffect(()=>{ function onStorage(e){ if (e.key==='employees_version') { (async()=>{ try { const emps = await apiEmployees.list(); setEmployees(emps) } catch {} })() } } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const rs = await apiPayroll.runs(); const posted = rs.filter(r=>String(r.derived_status||'draft')==='posted'); setRuns(posted); if (!runId && posted.length) setRunId(String(posted[0].id)) } catch {} try { const emps = await apiEmployees.list(); setEmployees(emps) } catch {} })() },[runId])
  
  // Load advance balances from journal entries
  useEffect(() => {
    async function loadAdvanceBalances() {
      if (!employees.length) return
      const balances = new Map()
      for (const emp of employees) {
        try {
          const balanceData = await apiEmployees.advanceBalance(emp.id)
          balances.set(emp.id, parseFloat(balanceData?.balance || 0))
        } catch {
          balances.set(emp.id, 0)
        }
      }
      setAdvanceBalances(balances)
    }
    loadAdvanceBalances()
  }, [employees])
  useEffect(()=>{ (async()=>{ if (!runId) { setItems([]); return } try { const its = await apiPayroll.items(runId); setItems(its) } catch { setItems([]) } })() },[runId])
  useEffect(()=>{ (async()=>{ try { const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch {} try { const b = await apiSettings.get('settings_branding'); setBranding(b||null) } catch {} })() },[])

  const empById = useMemo(()=>{ const m = new Map(); employees.forEach(e=>m.set(e.id, e)); return m },[employees])
  const rows = useMemo(()=>{
    if (!runId) return []
    const withItems = items.map(it => ({ ...it, employee: it.employee || empById.get(it.employee_id) }))
    if (withItems.length) return withItems.filter(r => !!r.employee)
    return []
  },[items, empById, runId])
  const byDept = useMemo(()=>{ const map = new Map(); const safe = Array.isArray(rows) ? rows : []; safe.forEach(r=>{ const d = r.employee?.department || ''; if (!map.has(d)) map.set(d, []); map.get(d).push(r) }); return Array.from(map.entries()) },[rows])
  const selectedRows = useMemo(()=> (Array.isArray(rows) ? rows : []).filter(r => selected.has(r.employee_id)), [rows, selected])
  const selTotal = useMemo(()=> selectedRows.reduce((s,r)=> s + parseFloat(r.net_salary||0), 0).toFixed(2), [selectedRows])
  const stats = useMemo(()=>{
    const safe = Array.isArray(rows) ? rows : []
    const totalNet = safe.reduce((s,r)=> s + parseFloat(r.net_salary||0), 0)
    const paid = safe.filter(r=>!!r.paid_at).reduce((s,r)=> s + parseFloat(r.net_salary||0), 0)
    const unpaid = totalNet - paid
    const count = safe.length
    const paidCount = safe.filter(r=>!!r.paid_at).length
    return { totalNet, paid, unpaid, count, paidCount }
  },[rows])
  const [showAdvances, setShowAdvances] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ open: false, type: '', employeeId: null, amount: '', month: new Date().toISOString().slice(0,7), duration: '', method: 'cash' })
  const [modalMonthError, setModalMonthError] = useState('')
  const runPeriod = useMemo(()=>{ const r = runs.find(x => String(x.id)===String(runId)); return r?.period || '' },[runs, runId])
  const currentRun = useMemo(()=>{ return runs.find(x => String(x.id)===String(runId)) || null },[runs, runId])
  const canPay = !!(currentRun?.allowed_actions?.pay)

  function toggleSelect(id){ const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next) }
  function selectAll(){ const next = new Set(items.map(i=>i.employee_id)); setSelected(next) }
  function clearSel(){ setSelected(new Set()) }

  async function paySelected(){
    if (!runId || selected.size===0) return
    if (!payDate) { setError(lang==='ar'?'يرجى تحديد تاريخ السداد':'Please select a payment date'); return }
    try {
      const payload = { date: payDate, method, items: Array.from(selected).map(id => ({ employee_id: id })) }
      await apiPayroll.pay(runId, payload)
      const its = await apiPayroll.items(runId); setItems(its); clearSel()
    } catch (er) { setError(er.code||'failed') }
  }

  async function payOne(id){
    if (!runId) return
    if (!payDate) { setError(lang==='ar'?'يرجى تحديد تاريخ السداد':'Please select a payment date'); return }
    try {
      const e = empById.get(id)
      const adv = parseFloat(e?.advance_balance||0)
      if (adv > 0) { setModal({ open: true, type: 'advance_prompt', employeeId: id, amount: adv }) ; return }
      const payload = { date: payDate, method, items: [{ employee_id: id }] }
      await apiPayroll.pay(runId, payload)
      const its = await apiPayroll.items(runId); setItems(its)
    } catch (er) { setError(er.code||'failed') }
  }

  async function deductOne(id){ setModal({ open: true, type: 'deduction', employeeId: id, amount: '' }) }

  async function createPriorDue(id){ setModal({ open: true, type: 'previous', employeeId: id, amount: '', month: new Date().toISOString().slice(0,7) }); setModalMonthError('') }

  async function grantAdvance(empId){ setModal({ open: true, type: 'advance', employeeId: empId, amount: '', duration: '', method: 'cash' }) }
  async function collectAdvance(empId){ setModal({ open: true, type: 'advance_collect', employeeId: empId, amount: '', method: 'cash' }) }

  async function createIncentive(id){ setModal({ open: true, type: 'incentive', employeeId: id, amount: '' }) }

  

  async function printPayslips(){
    const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang })
    
    let y = 40
    const pageH = 842
    const margin = 40
    const boxH = 220
    
    // Logo removed per request
    const safeRows = Array.isArray(rows) ? rows : []
    safeRows.forEach((r, i) => {
      if (y + boxH > pageH - 40) {
        doc.addPage()
        y = 40
      }
      
      // Draw Box
      doc.setDrawColor(220)
      doc.setFillColor(255, 255, 255)
      doc.rect(margin, y, 515, boxH, 'S')
      
      // Header inside box
      let cy = y + 25
      // Logo removed per request
      
      const companyName = lang==='ar' ? (company?.name_ar || company?.name_en) : (company?.name_en || company?.name_ar)
      doc.setFontSize(12)
      doc.safeText(companyName || '', 530, cy, { align: 'right' })
      cy += 14
      doc.setFontSize(10)
      doc.safeText(`${lang==='ar'?'كشف راتب':'Payslip'} • ${runPeriod||''}`, 530, cy, { align: 'right' })
      
      cy += 20
      doc.setDrawColor(240)
      doc.line(margin + 10, cy, 545, cy) // Separator
      
      // Employee Info
      cy += 20
      const e = r.employee || {}
      doc.setFontSize(11)
      doc.safeText(`${e.full_name||''} (${e.employee_number||''})`, 530, cy, { align: 'right' })
      doc.setFontSize(9)
      doc.safeText(e.department||'', margin + 15, cy)
      
      cy += 20
      
      const basic = parseFloat(r.basic_salary||0)
      const housing = parseFloat(r.housing_allowance||0)
      const trans = parseFloat(r.transport_allowance||0)
      const other = parseFloat(r.other_allowances||0)
      const incentive = parseFloat(r.incentive_amount||0)
      
      const gosi = parseFloat(r.gosi_employee||0)
      const ded = parseFloat(r.manual_deduction||0)
      const net = parseFloat(r.net_salary||0)
      
      let ry = cy
      doc.safeText(`${lang==='ar'?'الأساسي':'Basic'}: ${basic.toFixed(2)}`, 530, ry, { align: 'right' })
      doc.safeText(`${lang==='ar'?'تأمينات':'GOSI'}: ${gosi.toFixed(2)}`, 300, ry, { align: 'right' })
      
      ry += 14
      doc.safeText(`${lang==='ar'?'سكن':'Housing'}: ${housing.toFixed(2)}`, 530, ry, { align: 'right' })
      doc.safeText(`${lang==='ar'?'خصومات':'Ded.'}: ${ded.toFixed(2)}`, 300, ry, { align: 'right' })
      
      ry += 14
      doc.safeText(`${lang==='ar'?'نقل':'Trans.'}: ${trans.toFixed(2)}`, 530, ry, { align: 'right' })
      
      ry += 14
      doc.safeText(`${lang==='ar'?'أخرى':'Other'}: ${other.toFixed(2)}`, 530, ry, { align: 'right' })
      
      if (incentive > 0) {
        ry += 14
        doc.safeText(`${lang==='ar'?'حوافز':'Incentives'}: ${incentive.toFixed(2)}`, 530, ry, { align: 'right' })
      }
      
      ry += 20
      doc.setDrawColor(240)
      doc.line(margin + 10, ry, 545, ry)
      ry += 25
      
      doc.setFontSize(14)
      doc.safeText(`${lang==='ar'?'الصافي':'Net'}: ${net.toFixed(2)} ${lang==='ar'?'ريال':'SAR'}`, 530, ry, { align: 'right' })
      
      
      doc.setFontSize(10)
      const status = r.paid_at ? (lang==='ar'?'مدفوع':'Paid') : (lang==='ar'?'غير مدفوع':'Unpaid')
      doc.setTextColor(r.paid_at ? 0 : 200)
      if (r.paid_at) doc.setTextColor(0, 128, 0)
      else doc.setTextColor(200, 0, 0)
      
      doc.safeText(status, margin + 20, ry)
      doc.setTextColor(0)
      
      y += boxH + 20
    })
    
    print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'سداد الرواتب وطباعة الكشوفات':'Payroll Payments & Payslips'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/employees')}>{lang==='ar'?'رجوع':'Back'}</button>
            <button className="px-3 py-2 bg-yellow-500 text-white rounded" onClick={printPayslips}>PDF</button>
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/payroll/statements')}>{lang==='ar'?'كشوف الرواتب':'Statements'}</button>
          </div>
        </div>
      </header>
      {error && (
        <div className="max-w-7xl mx-auto px-6">
          <div className="mt-3 px-3 py-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>
        </div>
      )}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded shadow p-4 border-r-4 border-primary-500">
            <div className="text-sm text-gray-500">{lang==='ar'?'إجمالي الرواتب':'Total Net'}</div>
            <div className="text-xl font-bold">{stats.totalNet.toFixed(2)}</div>
            <div className="text-xs text-gray-400">{stats.count} {lang==='ar'?'موظف':'employees'}</div>
          </div>
          <div className="bg-white rounded shadow p-4 border-r-4 border-green-500">
            <div className="text-sm text-gray-500">{lang==='ar'?'المدفوع':'Paid'}</div>
            <div className="text-xl font-bold text-green-600">{stats.paid.toFixed(2)}</div>
            <div className="text-xs text-gray-400">{stats.paidCount} {lang==='ar'?'عملية':'transactions'}</div>
          </div>
          <div className="bg-white rounded shadow p-4 border-r-4 border-red-500">
            <div className="text-sm text-gray-500">{lang==='ar'?'المتبقي':'Remaining'}</div>
            <div className="text-xl font-bold text-red-600">{stats.unpaid.toFixed(2)}</div>
            <div className="text-xs text-gray-400">{(stats.count - stats.paidCount)} {lang==='ar'?'معلق':'pending'}</div>
          </div>
          <div className="bg-white rounded shadow p-4 border-r-4 border-blue-500">
            <div className="text-sm text-gray-500">{lang==='ar'?'المحدد للسداد':'Selected to Pay'}</div>
            <div className="text-xl font-bold text-blue-600">{selTotal}</div>
            <div className="text-xs text-gray-400">{selectedRows.length} {lang==='ar'?'محدد':'selected'}</div>
          </div>
        </section>

        <section className="bg-white rounded shadow p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'المسير':'Run'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-48 bg-gray-50" value={runId} onChange={e=>setRunId(e.target.value)}>
                  <option value="">{lang==='ar'?'اختر مسير مُرحل':'Select posted run'}</option>
                  {runs.map(r => (<option key={r.id} value={r.id}>{r.period}</option>))}
                </select>
              </div>
              
              <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'طريقة السداد':'Payment Method'}</label>
                <select className="border rounded px-3 py-2 w-full md:w-32 bg-gray-50" value={method} onChange={e=>setMethod(e.target.value)}>
                  <option value="bank">{lang==='ar'?'تحويل بنكي':'Bank transfer'}</option>
                  <option value="cash">{lang==='ar'?'نقدي':'Cash'}</option>
                </select>
              </div>

              <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'تاريخ السداد':'Payment Date'}</label>
                <input type="date" className="border rounded px-3 py-2 w-full md:w-auto bg-gray-50" value={payDate} onChange={e=>setPayDate(e.target.value)} />
              </div>

              <div className="pt-5">
                <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title={lang==='ar'?'تحديث':'Refresh'} onClick={async()=>{ try { const rs = await apiPayroll.runs(); const posted = rs.filter(r=>String(r.derived_status||'draft')==='posted'); setRuns(posted); if (!runId && posted.length) setRunId(String(posted[0].id)) } catch {} try { const its = runId ? await apiPayroll.items(runId) : []; setItems(its||[])} catch {} try { const emps = await apiEmployees.list(); setEmployees(emps) } catch {} }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0 w-full md:w-auto justify-end">
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm" onClick={selectAll}>{lang==='ar'?'تحديد الكل':'Select All'}</button>
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm" onClick={clearSel}>{lang==='ar'?'إلغاء':'Clear'}</button>
              <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" onClick={paySelected} disabled={!payDate || !selectedRows.length || !canPay}>
                {lang==='ar'?'سداد المحدد':'Pay Selected'}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{lang==='ar'?'السلف':'Advances'}</div>
            <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setShowAdvances(v=>!v)}>{showAdvances ? (lang==='ar'?'إخفاء':'Hide') : (lang==='ar'?'عرض':'Show')}</button>
          </div>
          {showAdvances && (
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'الموظف':'Employee'}</th>
                <th className="p-2">{lang==='ar'?'الرصيد الحالي':'Current balance'}</th>
                <th className="p-2">{lang==='ar'?'إجراء':'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(e => {
                const advanceBalance = advanceBalances.get(e.id) || 0
                return (
                  <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-2">{e.full_name}</td>
                    <td className="p-2">{advanceBalance.toFixed(2)}</td>
                    <td className="p-2"><div className="flex gap-2"><button className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors" onClick={()=>grantAdvance(e.id)}>{lang==='ar'?'منح سلفة':'Grant advance'}</button><button className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm transition-colors" onClick={()=>collectAdvance(e.id)}>{lang==='ar'?'تحصيل سلفة':'Collect advance'}</button></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </section>

        {byDept.map(([dept, rows]) => (
          <section key={dept} className="bg-white rounded shadow p-4">
            <div className="font-semibold mb-2">{dept|| (lang==='ar'?'غير محدد':'Unassigned')}</div>
            <table className="w-full text-right border-collapse">
              <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'تحديد':'Select'}</th>
                <th className="p-2">{lang==='ar'?'الموظف':'Employee'}</th>
                <th className="p-2">{lang==='ar'?'الساعات':'Hours'}</th>
                <th className="p-2">{lang==='ar'?'الصافي':'Net'}</th>
                <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
              </tr>
              </thead>
              <tbody>
                {(Array.isArray(rows) ? rows : []).map(r => (
                  <tr key={r.employee_id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-2"><input type="checkbox" checked={selected.has(r.employee_id)} onChange={()=>toggleSelect(r.employee_id)} /></td>
                  <td className="p-2">{r.employee?.full_name || ''}</td>
                  <td className="p-2">{(()=>{ const h = parseFloat(r.hours_worked||0); return h>0? h.toFixed(2) : '—' })()}</td>
                  <td className="p-2">{parseFloat(r.net_salary||0).toFixed(2)}</td>
                  <td className="p-2">
                    <span className={r.paid_at ? 'px-2 py-1 rounded text-xs bg-green-100 text-green-700' : 'px-2 py-1 rounded text-xs bg-red-100 text-red-700'}>
                      {r.paid_at ? (lang==='ar'?'مدفوع':'Paid') : (lang==='ar'?'غير مدفوع':'Unpaid')}
                    </span>
                  </td>
                  <td className="p-2">
                  <div className="flex gap-2">
                    <button 
                      className={`px-2 py-1 rounded text-white text-sm transition-colors ${r.paid_at || !canPay ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`} 
                      onClick={()=>{ if (!r.paid_at && canPay) payOne(r.employee_id) }}
                      disabled={!!r.paid_at || !canPay}
                    >
                      {lang==='ar'?'سداد راتب':'Pay Salary'}
                    </button>
                  </div>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
      <div ref={printRef} style={{ position:'fixed', left:-9999, top:-9999, width: 800 }} dir="rtl">
        <div className="p-4" style={{ width: 700 }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-lg font-bold">{(company?.trade_name||company?.name_ar||company?.name_en||'') || (lang==='ar'?'الشركة':'Company')}</div>
              <div className="text-xs text-gray-600">{lang==='ar'?'الرقم الضريبي':'VAT'}: {company?.vat_number || '—'}</div>
            </div>
            {branding?.logo && (<img src={branding.logo} alt="logo" style={{ height: 40, objectFit: 'contain' }} />)}
          </div>
          <div className="text-sm text-gray-700 mb-3">{lang==='ar'?'كشوف الرواتب':'Payslips'} {runPeriod?`• ${runPeriod}`:''}</div>
          {(rows||[]).map(r => {
            const e = r.employee || {}
            const gross = (parseFloat(r.basic_salary||0)+parseFloat(r.housing_allowance||0)+parseFloat(r.transport_allowance||0)+parseFloat(r.other_allowances||0))
            const net = parseFloat(r.net_salary||0)
            const hrs = parseFloat(r.hours_worked||0)
            return (
              <div key={r.employee_id} className="border rounded p-3 mb-3" style={{ pageBreakAfter: 'always' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{e.full_name||''}</div>
                  <div className={r.paid_at ? 'px-2 py-1 rounded text-xs bg-green-100 text-green-700' : 'px-2 py-1 rounded text-xs bg-red-100 text-red-700'}>{r.paid_at ? (lang==='ar'?'مدفوع':'Paid') : (lang==='ar'?'غير مدفوع':'Unpaid')}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="border rounded p-2">
                    <div>{lang==='ar'?'رقم الموظف':'Employee No.'}: {e.employee_number||''}</div>
                    <div>{lang==='ar'?'القسم':'Department'}: {e.department||''}</div>
                    <div>{lang==='ar'?'الساعات':'Hours'}: {hrs>0?hrs.toFixed(2):'—'}</div>
                  </div>
                  <div className="border rounded p-2">
                    <div>{lang==='ar'?'الراتب الأساسي':'Basic salary'}: {parseFloat(r.basic_salary||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'بدل السكن':'Housing'}: {parseFloat(r.housing_allowance||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'بدل النقل':'Transport'}: {parseFloat(r.transport_allowance||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'بدلات أخرى':'Other allowances'}: {parseFloat(r.other_allowances||0).toFixed(2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div className="border rounded p-2">
                    <div>{lang==='ar'?'خصم التأمينات':'GOSI'}: {parseFloat(r.gosi_employee||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'استقطاع يدوي':'Manual deduction'}: {parseFloat(r.manual_deduction||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'سلفة محسوبة':'Advance deducted'}: {parseFloat(r.advance_deducted||0).toFixed(2)}</div>
                  </div>
                  <div className="border rounded p-2">
                    <div>{lang==='ar'?'حوافز':'Incentives'}: {parseFloat(r.incentive_amount||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'مستحقات سابقة':'Previous due'}: {parseFloat(r.previous_due_amount||0).toFixed(2)}</div>
                    <div>{lang==='ar'?'الإجمالي':'Gross'}: {gross.toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-2 text-right font-bold">{lang==='ar'?'الصافي':'Net'}: {net.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </div>
      {modal.open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-sm">
            <div className="text-lg font-semibold mb-2">{modal.type==='advance'?(lang==='ar'?'منح سلفة':'Grant Advance'):modal.type==='advance_collect'?(lang==='ar'?'تحصيل سلفة':'Collect Advance'):modal.type==='advance_prompt'?(lang==='ar'?'سلفة مستحقة':'Outstanding advance'):modal.type==='deduction'?(lang==='ar'?'استقطاع':'Deduction'):modal.type==='previous'?(lang==='ar'?'مستحق سابق':'Prior Due'):(lang==='ar'?'حافز':'Incentive')}</div>
            {modal.type==='previous' && (
              <>
                <input type="month" className="border rounded w-full px-3 py-2 mb-1" placeholder={lang==='ar'?'شهر الاستحقاق':'Due month'} value={modal.month} onChange={e=>{ setModal({ ...modal, month: e.target.value }); if (modalMonthError) setModalMonthError('') }} />
                {modalMonthError && (<div className="text-xs text-rose-700 mb-2">{modalMonthError}</div>)}
              </>
            )}
            {modal.type==='advance' && (<input inputMode="numeric" lang="en" dir="ltr" className="border rounded w-full px-3 py-2 mb-2" placeholder={lang==='ar'?'مدة السلفة (بالأشهر)':'Advance duration (months)'} value={modal.duration} onChange={e=>setModal({ ...modal, duration: normalizeDigits(e.target.value).replace(/[^0-9]/g,'') })} />)}
            {modal.type==='advance' && (
              <select className="border rounded w-full px-3 py-2 mb-2" value={modal.method} onChange={e=>setModal({ ...modal, method: e.target.value })}>
                <option value="cash">{lang==='ar'?'نقدي':'Cash'}</option>
                <option value="bank">{lang==='ar'?'تحويل بنكي':'Bank transfer'}</option>
              </select>
            )}
            {modal.type==='advance_collect' && (
              <select className="border rounded w-full px-3 py-2 mb-2" value={modal.method} onChange={e=>setModal({ ...modal, method: e.target.value })}>
                <option value="cash">{lang==='ar'?'نقدي':'Cash'}</option>
                <option value="bank">{lang==='ar'?'تحويل بنكي':'Bank transfer'}</option>
              </select>
            )}
            {modal.type!=='advance_prompt' && (
              <input inputMode="decimal" lang="en" dir="ltr" className="border rounded w-full px-3 py-2 mb-3" placeholder={lang==='ar'?'المبلغ':'Amount'} value={modal.amount} onChange={e=>setModal({ ...modal, amount: sanitizeDecimal(e.target.value) })} />
            )}
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>{ setModal({ open:false, type:'', employeeId:null, amount:'', month: new Date().toISOString().slice(0,7), duration:'', method:'cash' }); setModalMonthError('') }}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              {modal.type==='advance_prompt' ? (
                <>
                  <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={async()=>{ try { if (!payDate) { setError(lang==='ar'?'يرجى تحديد تاريخ السداد':'Please select a payment date'); return } await apiPayroll.pay(runId, { date: payDate, method, items: [{ employee_id: modal.employeeId, advance: parseFloat(modal.amount||0) }] }); const its = await apiPayroll.items(runId); setItems(its); setModal({ open:false, type:'', employeeId:null, amount:'', month: new Date().toISOString().slice(0,7), duration:'', method:'cash' }); setToast(lang==='ar'?'تم خصم السلفة من الراتب':'Advance deducted from salary'); try { const balanceData = await apiEmployees.advanceBalance(modal.employeeId); const newBalances = new Map(advanceBalances); newBalances.set(modal.employeeId, parseFloat(balanceData?.balance || 0)); setAdvanceBalances(newBalances) } catch {} } catch (er) { setError(er.code||'failed') } }}>{lang==='ar'?'خصم من الراتب':'Deduct from salary'}</button>
                  <button className="px-3 py-2 bg-gray-100 rounded" onClick={async()=>{ try { if (!payDate) { setError(lang==='ar'?'يرجى تحديد تاريخ السداد':'Please select a payment date'); return } await apiPayroll.pay(runId, { date: payDate, method, items: [{ employee_id: modal.employeeId }] }); const its = await apiPayroll.items(runId); setItems(its); setModal({ open:false, type:'', employeeId:null, amount:'', month: new Date().toISOString().slice(0,7), duration:'', method:'cash' }); try { const balanceData = await apiEmployees.advanceBalance(modal.employeeId); const newBalances = new Map(advanceBalances); newBalances.set(modal.employeeId, parseFloat(balanceData?.balance || 0)); setAdvanceBalances(newBalances) } catch {} } catch (er) { setError(er.code||'failed') } }}>{lang==='ar'?'تجاهل مؤقتًا':'Ignore for now'}</button>
                </>
              ) : (
                <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={async()=>{
                  try {
                    const n = parseFloat(modal.amount||'')
                    if (!(n>0)) { setError(lang==='ar'?'مبلغ غير صالح':'Invalid amount'); return }
                    if (modal.type==='advance') {
                      const d = modal.duration ? parseInt(modal.duration, 10) : null
                      const extra = { method: modal.method }
                      if (d!=null) extra.duration_months = d
                      await apiEmployees.advance(modal.employeeId, n, extra)
                      const emps = await apiEmployees.list(); setEmployees(emps)
                      // Reload advance balance from journal entries
                      try {
                        const balanceData = await apiEmployees.advanceBalance(modal.employeeId)
                        const newBalances = new Map(advanceBalances)
                        newBalances.set(modal.employeeId, parseFloat(balanceData?.balance || 0))
                        setAdvanceBalances(newBalances)
                      } catch {}
                      setToast(lang==='ar'?'تم منح السلفة':'Advance granted')
                    } else if (modal.type==='advance_collect') {
                      await apiEmployees.advanceCollect(modal.employeeId, n, { method: modal.method })
                      const emps = await apiEmployees.list(); setEmployees(emps)
                      // Reload advance balance from journal entries
                      try {
                        const balanceData = await apiEmployees.advanceBalance(modal.employeeId)
                        const newBalances = new Map(advanceBalances)
                        newBalances.set(modal.employeeId, parseFloat(balanceData?.balance || 0))
                        setAdvanceBalances(newBalances)
                      } catch {}
                      setToast(lang==='ar'?'تم تحصيل السلفة محاسبيًا':'Advance collected')
                    } else if (modal.type==='deduction') {
                      if (!runId) { setError(lang==='ar'?'يرجى اختيار مسير':'Select a run'); return }
                      if (!payDate) { setError(lang==='ar'?'يرجى تحديد تاريخ السداد':'Please select a payment date'); return }
                      await apiPayroll.pay(runId, { date: payDate, method, items: [{ employee_id: modal.employeeId, deduction: n }] })
                      const its = await apiPayroll.items(runId); setItems(its)
                      setToast(lang==='ar'?'تم تسجيل الاستقطاع':'Deduction applied')
                    } else if (modal.type==='previous') {
                      if (!modal.month || !/^\d{4}-\d{2}$/.test(modal.month)) { setModalMonthError(lang==='ar'?'يرجى تحديد شهر صحيح':'Please select a valid month'); return }
                      await apiPayroll.previousDue({ employee_id: modal.employeeId, amount: n, period: modal.month })
                      try { localStorage.setItem('payroll_statements_filter_month', modal.month); localStorage.setItem('prev_dues_version', String(Date.now())) } catch {}
                      setToast(lang==='ar'?'تم إنشاء مستحق سابق':'Prior due created')
                    } else if (modal.type==='incentive') {
                      await apiPayroll.incentive({ employee_id: modal.employeeId, amount: n })
                      setToast(lang==='ar'?'تم تسجيل الحافز محاسبيًا':'Incentive posted')
                    }
                    setModal({ open:false, type:'', employeeId:null, amount:'', month: new Date().toISOString().slice(0,7) }); setModalMonthError('')
                  } catch (er) { setError(er.code||'failed') }
                }}>{lang==='ar'?'تأكيد':'Confirm'}</button>
              )}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded" onAnimationEnd={()=>setToast('')}>{toast}</div>
      )}
    </div>
  )
}
