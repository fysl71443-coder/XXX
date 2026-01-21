import React, { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { reports as apiReports, accounts as apiAccounts } from '../services/api'
import { FaSync, FaFileExcel, FaFilePdf, FaChevronDown, FaChevronRight } from 'react-icons/fa'

export default function TrialBalance() {
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [accTree, setAccTree] = useState([])
  const [open, setOpen] = useState(() => new Set())
  const [drill, setDrill] = useState(() => new Map())
  const [showOps, setShowOps] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')
  
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const rep = await apiReports.trialBalance(params)
      console.log('[TrialBalance] Response:', rep)
      const itemsArray = Array.isArray(rep.items) ? rep.items : (Array.isArray(rep) ? rep : [])
      setItems(itemsArray)
      setTotals(rep.totals || null)
      if (itemsArray.length === 0 && !rep.totals) {
        setError('no_data')
      } else {
        setError(null)
      }
    } catch (e) {
      console.error('[TrialBalance] Error loading:', e)
      if (e?.status === 403) {
        setError(lang === 'ar' ? 'ليس لديك صلاحية لعرض ميزان المراجعة' : 'You do not have permission to view trial balance')
      } else {
        setError('request_failed')
      }
      setItems([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, lang])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    (async()=>{
      try {
        const tree = await apiAccounts.tree()
        setAccTree(Array.isArray(tree)?tree:[])
      } catch { setAccTree([]) }
    })()
  }, [])

  const tbMap = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const id = Number(it.account_id||0)
      if (!id) continue
      m.set(id, {
        beginning: Number(it.beginning||0),
        debit: Number(it.debit||0),
        credit: Number(it.credit||0),
        ending: Number(it.ending||0)
      })
    }
    return m
  }, [items])

  const hier = useMemo(() => {
    function walk(node){
      const self = tbMap.get(Number(node.id)) || { beginning: 0, debit: 0, credit: 0, ending: 0 }
      const children = Array.isArray(node.children)?node.children.map(walk).filter(Boolean):[]
      const agg = children.reduce((s,c)=>({ beginning: s.beginning + c.beginning, debit: s.debit + c.debit, credit: s.credit + c.credit, ending: s.ending + c.ending }), { beginning: 0, debit: 0, credit: 0, ending: 0 })
      const beginning = self.beginning + agg.beginning
      const debit = self.debit + agg.debit
      const credit = self.credit + agg.credit
      const ending = self.ending + agg.ending
      // Always include accounts that have children (parent accounts)
      // For leaf accounts, include them if they have any movement OR if they're in the trial balance data
      const hasPeriodMovement = Math.abs(debit) > 0.0001 || Math.abs(credit) > 0.0001
      const hasBeginningBalance = Math.abs(beginning) > 0.0001
      const hasEndingBalance = Math.abs(ending) > 0.0001
      const isInTrialBalance = tbMap.has(Number(node.id))
      const include = children.length > 0 || hasPeriodMovement || hasBeginningBalance || hasEndingBalance || isInTrialBalance
      if (!include) return null
      return { id: node.id, account_code: node.account_code || node.account_number, name: node.name, type: node.type, beginning, debit, credit, ending, children }
    }
    const out = (accTree||[]).map(walk).filter(Boolean)
    return out
  }, [accTree, tbMap])

  useEffect(() => {
    const s = new Set()
    hier.forEach(n=>s.add(n.id))
    setOpen(s)
  }, [hier])

  function toggle(id){ const s = new Set(open); if (s.has(id)) s.delete(id); else s.add(id); setOpen(s) }
  async function loadDrill(accountId){
    try {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      params.account_id = accountId
      const rep = await apiReports.trialBalanceDrilldown(params)
      const items = Array.isArray(rep.items)?rep.items:[]
      const byType = new Map()
      for (const r of items){
        const k = String(r.related_type||'') || 'manual'
        const agg = byType.get(k) || { count: 0, debit: 0, credit: 0 }
        agg.count += 1
        agg.debit += Number(r.debit||0)
        agg.credit += Number(r.credit||0)
        byType.set(k, agg)
      }
      const s = new Map(drill)
      s.set(Number(rep.account_id||accountId), Array.from(byType.entries()).map(([type, v])=>({ type, count: v.count, debit: v.debit, credit: v.credit })))
      setDrill(s)
    } catch {}
  }

  function exportExcel() {
    setExportingExcel(true)
    try {
      const flatData = []
      function flattenNodes(nodes, level = 0) {
        for (const node of nodes || []) {
          flatData.push({
            [lang === 'ar' ? 'رقم الحساب' : 'Account Code']: node.account_code || node.account_number || '',
            [lang === 'ar' ? 'اسم الحساب' : 'Account Name']: '  '.repeat(level) + (node.name || ''),
            [lang === 'ar' ? 'رصيد أول المدة' : 'Beginning']: Number(node.beginning || 0),
            [lang === 'ar' ? 'مدين' : 'Debit']: Number(node.debit || 0),
            [lang === 'ar' ? 'دائن' : 'Credit']: Number(node.credit || 0),
            [lang === 'ar' ? 'رصيد آخر المدة' : 'Ending']: Number(node.ending || 0)
          })
          flattenNodes(node.children, level + 1)
        }
      }
      flattenNodes(hier)
      
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(flatData)
      ws['!cols'] = [
        { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'ميزان المراجعة' : 'Trial Balance')
      XLSX.writeFile(wb, 'trial_balance.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  function renderRow(node, level=0){
    const hasChildren = (node.children||[]).length>0
    const isOpen = open.has(node.id)
    const drillRows = drill.get(Number(node.id)) || []
    const hasMovement = Math.abs(Number(node.debit || 0)) > 0.01 || Math.abs(Number(node.credit || 0)) > 0.01
    
    return (
      <React.Fragment key={node.id}>
        <tr className={`border-b hover:bg-gray-50 transition ${hasChildren ? 'font-medium bg-gray-50' : ''}`}>
          <td className="p-2 text-sm font-mono">{String(node.account_code || node.account_number || '')}</td>
          <td className="p-2">
            <div className="flex items-center">
              <div style={{ width: level*20 }}></div>
              {hasChildren ? (
                <button className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded" onClick={()=>toggle(node.id)}>
                  {isOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-6"></span>
              )}
              <span className="flex items-center gap-2">
                <span className={`text-sm ${hasChildren ? 'font-semibold' : ''}`}>{String(node.name||'')}</span>
                {showOps && !hasChildren && hasMovement && (
                  <button className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition" onClick={()=>loadDrill(Number(node.id))}>
                    {lang === 'ar' ? 'تفصيل' : 'Details'}
                  </button>
                )}
              </span>
            </div>
          </td>
          <td className={`p-2 text-sm ${Number(node.beginning||0) < 0 ? 'text-red-600' : ''}`}>{fmt(Number(node.beginning||0))}</td>
          <td className="p-2 text-sm text-blue-700">{Number(node.debit||0) > 0.01 ? fmt(Number(node.debit||0)) : '—'}</td>
          <td className="p-2 text-sm text-red-700">{Number(node.credit||0) > 0.01 ? fmt(Number(node.credit||0)) : '—'}</td>
          <td className={`p-2 text-sm font-medium ${Number(node.ending||0) < 0 ? 'text-red-600' : ''}`}>{fmt(Number(node.ending||0))}</td>
        </tr>
        {showOps && drillRows.length ? (
          <tr className="border-b bg-blue-50">
            <td className="p-2" colSpan={2}>
              <div className="text-xs text-blue-700 font-medium">{lang === 'ar' ? 'حسب نوع العملية' : 'By Operation Type'}</div>
            </td>
            <td className="p-2" colSpan={4}>
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-blue-800">
                    <th className="p-1">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="p-1">{lang === 'ar' ? 'عدد' : 'Count'}</th>
                    <th className="p-1">{lang === 'ar' ? 'مدين' : 'Debit'}</th>
                    <th className="p-1">{lang === 'ar' ? 'دائن' : 'Credit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r,i)=> (
                    <tr key={i} className="hover:bg-blue-100">
                      <td className="p-1">{labelOpType(r.type, lang)}</td>
                      <td className="p-1">{r.count}</td>
                      <td className="p-1 text-blue-700">{fmt(Number(r.debit||0))}</td>
                      <td className="p-1 text-red-700">{fmt(Number(r.credit||0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        ) : null}
        {hasChildren && isOpen ? node.children.map(ch => renderRow(ch, level+1)) : null}
      </React.Fragment>
    )
  }

  

  // Calculate balance status
  const isBalanced = totals && Math.abs(Number(totals.debit || 0) - Number(totals.credit || 0)) < 0.01

  return (
    <div className="bg-white p-4 rounded shadow space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-gray-600">{lang === 'ar' ? 'من' : 'From'}</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="text-sm text-gray-600">{lang === 'ar' ? 'إلى' : 'To'}</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50 flex items-center gap-2 hover:bg-primary-700 transition" disabled={loading}>
          <FaSync className={loading ? 'animate-spin' : ''} />
          {loading ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Loading...') : (lang === 'ar' ? 'تحديث' : 'Refresh')}
        </button>
        <button onClick={exportExcel} className="px-3 py-2 bg-green-700 text-white rounded flex items-center gap-2 disabled:opacity-50 hover:bg-green-800 transition" disabled={exportingExcel || !hier.length}>
          <FaFileExcel /> {lang === 'ar' ? 'Excel' : 'Excel'}
        </button>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border">
          <input type="checkbox" id="showOps" checked={showOps} onChange={e=>setShowOps(e.target.checked)} className="rounded" />
          <label htmlFor="showOps" className="text-sm text-gray-600 cursor-pointer">{lang === 'ar' ? 'عرض التفصيل' : 'Show Details'}</label>
        </div>
      </div>
      
      {/* Balance Status Badge */}
      {totals && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {isBalanced 
            ? (lang === 'ar' ? 'الميزان متوازن ✓' : 'Balanced ✓')
            : (lang === 'ar' ? `فرق: ${fmt(Math.abs(Number(totals.debit || 0) - Number(totals.credit || 0)))}` : `Difference: ${fmt(Math.abs(Number(totals.debit || 0) - Number(totals.credit || 0)))}`)}
        </div>
      )}
      
      {error === 'request_failed' ? (
        <div className="text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200">
          <div className="font-semibold">{lang === 'ar' ? 'فشل تحميل ميزان المراجعة' : 'Failed to load trial balance'}</div>
          <div className="text-xs mt-1">{lang === 'ar' ? 'تحقق من اتصال الخادم.' : 'Please check server connection.'}</div>
        </div>
      ) : typeof error === 'string' && error !== 'no_data' ? (
        <div className="text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200">
          <div className="font-semibold">{error}</div>
        </div>
      ) : error === 'no_data' ? (
        <div className="text-amber-600 text-sm p-4 bg-amber-50 rounded border border-amber-200">
          <div className="font-semibold">{lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}</div>
          <div className="text-xs mt-1">{lang === 'ar' ? 'تأكد من وجود قيود منشورة في الفترة المحددة.' : 'Make sure there are posted journal entries in the selected period.'}</div>
        </div>
      ) : null}
      
      {hier.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'رقم الحساب' : 'Code'}</th>
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'اسم الحساب' : 'Account'}</th>
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'رصيد أول المدة' : 'Beginning'}</th>
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="p-2 text-gray-700">{lang === 'ar' ? 'رصيد آخر المدة' : 'Ending'}</th>
              </tr>
            </thead>
            <tbody>
              {hier.map(n => renderRow(n, 0))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-gray-200 font-bold">
                <td className="p-3">{lang === 'ar' ? 'المجموع' : 'Totals'}</td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-blue-700">{fmt(Number(totals?.debit||0))}</td>
                <td className="p-3 text-red-700">{fmt(Number(totals?.credit||0))}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : !error && !loading ? (
        <div className="text-center text-gray-500 py-8">
          {lang === 'ar' ? 'اختر فترة ثم اضغط تحديث' : 'Select a period and click Refresh'}
        </div>
      ) : null}
    </div>
  )
}

function fmt(n){
  try {
    const val = Number(n||0)
    const abs = Math.abs(val)
    const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
    return val < 0 ? `(${s})` : s
  } catch { const v = Number(n||0); const s = Math.abs(v).toFixed(2); return v < 0 ? `(${s})` : s }
}

function labelOpType(t, lang = 'ar'){
  const v = String(t||'')
  const labels = {
    'invoice': { ar: 'بيع', en: 'Sale' },
    'supplier_invoice': { ar: 'مورد', en: 'Supplier' },
    'expense_invoice': { ar: 'مصروف', en: 'Expense' },
    'payment': { ar: 'سداد/تحصيل', en: 'Payment' },
    'payroll_run': { ar: 'مسير رواتب', en: 'Payroll' },
    'manual': { ar: 'يدوي', en: 'Manual' },
    '': { ar: 'يدوي', en: 'Manual' }
  }
  return labels[v]?.[lang] || v
}
