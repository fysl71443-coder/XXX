import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { reports as apiReports, accounts as apiAccounts } from '../services/api'

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rep = await apiReports.trialBalance({ ...(from?{ from }:{}), ...(to?{ to }:{} ) })
      setItems(Array.isArray(rep.items) ? rep.items : [])
      setTotals(rep.totals || null)
      setError(null)
    } catch (e) {
      setError('request_failed')
      setItems([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [from, to])

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
      const hasPeriodMovement = Math.abs(debit) > 0.0001 || Math.abs(credit) > 0.0001
      const include = children.length || hasPeriodMovement
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

  function renderRow(node, level=0){
    const hasChildren = (node.children||[]).length>0
    const isOpen = open.has(node.id)
    const drillRows = drill.get(Number(node.id)) || []
    return (
      <>
        <tr className="border-b hover:bg-gray-50">
          <td className="p-2">{String(node.account_code||'')}</td>
          <td className="p-2">
            <div className="flex items-center">
              <div style={{ width: level*16 }}></div>
              {hasChildren ? (
                <button className="w-6 text-gray-500" onClick={()=>toggle(node.id)}>{isOpen?'−':'+'}</button>
              ) : (
                <span className="w-6"></span>
              )}
              <span className="flex items-center gap-2">
                <span>{String(node.name||'')}</span>
                {showOps && (<button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={()=>loadDrill(Number(node.id))}>تفصيل</button>)}
              </span>
            </div>
          </td>
          <td className="p-2">{fmt(Number(node.beginning||0))}</td>
          <td className="p-2">{fmt(Number(node.debit||0))}</td>
          <td className="p-2">{fmt(Number(node.credit||0))}</td>
          <td className="p-2">{fmt(Number(node.ending||0))}</td>
        </tr>
        {showOps && drillRows.length ? (
          <tr className="border-b bg-gray-50">
            <td className="p-2" colSpan={2}>
              <div className="text-xs text-gray-600">حسب نوع العملية</div>
            </td>
            <td className="p-2" colSpan={4}>
              <table className="w-full text-xs text-right">
                <thead>
                  <tr>
                    <th className="p-1">النوع</th>
                    <th className="p-1">عدد</th>
                    <th className="p-1">مدين</th>
                    <th className="p-1">دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r,i)=> (
                    <tr key={i}>
                      <td className="p-1">{labelOpType(r.type)}</td>
                      <td className="p-1">{r.count}</td>
                      <td className="p-1">{fmt(Number(r.debit||0))}</td>
                      <td className="p-1">{fmt(Number(r.credit||0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        ) : null}
        {hasChildren && isOpen ? node.children.map(ch => renderRow(ch, level+1)) : null}
      </>
    )
  }

  

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block px-3 py-2 border rounded" />
        </div>
        <button onClick={load} className="px-3 py-2 bg-primary-600 text-white rounded disabled:opacity-50" disabled={loading}>{loading?'Loading...':'Refresh'}</button>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">عرض التفصيل</label>
          <input type="checkbox" checked={showOps} onChange={e=>setShowOps(e.target.checked)} />
        </div>
      </div>
      {error ? (
        <div className="text-red-600 text-sm">Failed to load trial balance.</div>
      ) : null}
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-2">Code</th>
            <th className="p-2">Account</th>
            <th className="p-2">Beginning</th>
            <th className="p-2">Debit</th>
            <th className="p-2">Credit</th>
            <th className="p-2">Ending</th>
          </tr>
        </thead>
        <tbody>
          {hier.map(n => renderRow(n, 0))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-gray-100 font-semibold">
            <td className="p-2">Totals</td>
            <td className="p-2"></td>
            <td className="p-2"></td>
            <td className="p-2">{fmt(Number(totals?.debit||0))}</td>
            <td className="p-2">{fmt(Number(totals?.credit||0))}</td>
            <td className="p-2"></td>
          </tr>
        </tfoot>
      </table>
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
function labelOpType(t){
  const v = String(t||'')
  if (v==='invoice') return 'بيع'
  if (v==='supplier_invoice') return 'مورد'
  if (v==='expense_invoice') return 'مصروف'
  if (v==='payment') return 'سداد/تحصيل'
  if (v==='payroll_run') return 'مسير رواتب'
  if (!v || v==='manual') return 'يدوي'
  return v
}
