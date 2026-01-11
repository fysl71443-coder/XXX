import { useEffect, useMemo, useState } from 'react'
import { invoices as apiInvoices, payments as apiPayments } from '../services/api'

export default function ClientStatement({ partner, from: fromProp = '', to: toProp = '', status: statusProp = '', invoice: invoiceProp = '', dueOnly: dueOnlyProp = false, hideFilters = false }) {
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [filters, setFilters] = useState({ status: statusProp||'', from: fromProp||'', to: toProp||'', invoice: invoiceProp||'', dueOnly: Boolean(dueOnlyProp)||false })
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [payments, setPayments] = useState([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [openingBalanceDate, setOpeningBalanceDate] = useState('')

  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    setFilters({
      status: statusProp||'',
      from: fromProp||'',
      to: toProp||'',
      invoice: invoiceProp||'',
      dueOnly: Boolean(dueOnlyProp)||false,
    })
  }, [statusProp, fromProp, toProp, invoiceProp, dueOnlyProp])

  useEffect(() => {
    async function load() {
      if (!partner?.id) { setRows([]); setPayments([]); return }
      setLoading(true)
      try {
        const params = { partner_id: partner.id }
        if (filters.from) params.from = filters.from
        if (filters.to) params.to = filters.to
        if (filters.dueOnly) params.due = '1'
        params.type = 'sale'
        const invRes = await apiInvoices.list(params)
        const invs = (invRes.items||[]).filter(x => !['draft','cancelled','reversed'].includes(String(x.status||'').toLowerCase()))
        setRows(invs)
        const payParams = { partner_id: partner.id }
        if (filters.from) payParams.from = filters.from
        if (filters.to) payParams.to = filters.to
        const payRes = await apiPayments.list(payParams)
        setPayments(payRes.items||[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [partner, filters])

  useEffect(() => {
    async function loadOpening() {
      if (!partner?.id) { setOpeningBalance(0); setOpeningBalanceDate(''); return }
      const from = String(filters.from||'')
      if (!from) { setOpeningBalance(0); setOpeningBalanceDate(''); return }
      const d = new Date(from)
      d.setDate(d.getDate()-1)
      const prev = d.toISOString().slice(0,10)
      setOpeningBalanceDate(from)
      try {
        const invRes = await apiInvoices.list({ partner_id: partner.id, type: 'sale', to: prev })
        const invs = (invRes.items||[]).filter(x => !['draft','cancelled','reversed'].includes(String(x.status||'').toLowerCase()))
        const payRes = await apiPayments.list({ partner_id: partner.id, to: prev })
        const pays = payRes.items||[]
        const paidMap = new Map()
        pays.forEach(p => { const k = Number(p.invoice_id||0); const prevAmt = paidMap.get(k)||0; paidMap.set(k, prevAmt + parseFloat(p.amount||0)) })
        let ob = 0
        invs.forEach(inv => { const total = parseFloat(inv.total||0); const pid = Number(inv.id||0); const paid = parseFloat(paidMap.get(pid)||0); const rem = Math.max(0, total - paid); ob += rem })
        setOpeningBalance(ob)
      } catch {
        setOpeningBalance(0)
      }
    }
    loadOpening()
  }, [partner, filters.from])

  const paidByInvoice = useMemo(() => {
    const by = new Map()
    payments.forEach(p => {
      const k = p.invoice_id || 0
      const prev = by.get(k) || 0
      by.set(k, prev + parseFloat(p.amount||0))
    })
    return by
  }, [payments])

  const viewRows = useMemo(() => {
    let list = rows.map(inv => {
      const total = parseFloat(inv.total||0)
      let paid = (typeof inv.paid_amount!=='undefined') ? parseFloat(inv.paid_amount||0) : parseFloat(paidByInvoice.get(inv.id)||0)
      let remaining = (typeof inv.remaining_amount!=='undefined') ? parseFloat(inv.remaining_amount||0) : Math.max(0, total - paid)
      const isCash = !!inv.is_cash_by_ledger
      if (isCash) { paid = total; remaining = 0 }
      const status = remaining===0 ? 'paid' : (paid>0 ? 'partial' : 'unpaid')
      return { ...inv, total, paid, remaining, _client_status: status }
    })
    if (filters.status) {
      if (filters.status==='paid') list = list.filter(x => x._client_status==='paid')
      else if (filters.status==='partial') list = list.filter(x => x._client_status==='partial')
      else if (filters.status==='unpaid') list = list.filter(x => x._client_status==='unpaid')
    }
    if (filters.invoice) {
      const q = filters.invoice.toLowerCase()
      list = list.filter(x => String(x.invoice_number||'').toLowerCase().includes(q))
    }
    return list
  }, [rows, paidByInvoice, filters])

  const summary = useMemo(() => {
    const totalInv = viewRows.reduce((s, r) => s + r.total, 0)
    const totalPaid = viewRows.reduce((s, r) => s + r.paid, 0)
    const totalRem = viewRows.reduce((s, r) => s + r.remaining, 0)
    return { totalInv, totalPaid, totalRem }
  }, [viewRows])

  const ledgerRows = useMemo(() => {
    const events = []
    rows.forEach(inv => { events.push({ date: inv.date, type: 'invoice', ref: inv.invoice_number, amount: parseFloat(inv.total||0) }) })
    payments.forEach(p => { events.push({ date: p.date, type: 'payment', ref: (p.invoice?.invoice_number||p.invoice_id||p.id), amount: parseFloat(p.amount||0) }) })
    events.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime())
    let run = openingBalance
    return events.map(e => { run = e.type==='invoice' ? (run + e.amount) : (run - e.amount); return { ...e, running: run } })
  }, [rows, payments, openingBalance])

  function statusLabelClient(v){
    const s = String(v||'').toLowerCase()
    if (lang==='ar') {
      if (s==='paid') return 'مسددة'
      if (s==='partial') return 'مسددة جزئيًا'
      return 'غير مسددة'
    } else {
      if (s==='paid') return 'Paid'
      if (s==='partial') return 'Partially Paid'
      return 'Unpaid'
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {!hideFilters && (
        <div className="border rounded p-3 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{lang==='ar'?'🧾 كشف حساب العميل':'Customer Statement'}</div>
              <div className="text-sm text-gray-600">{lang==='ar'?'العميل':'Customer'}: {partner?.name||'-'}</div>
              <div className="text-xs text-gray-500">{lang==='ar'?'العملة':'Currency'}: ريال سعودي</div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">{lang==='ar'?'من':'From'}</label>
                <input type="date" className="border rounded px-2 py-1" value={filters.from} onChange={e=>setFilters({...filters, from: e.target.value})} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">{lang==='ar'?'إلى':'To'}</label>
                <input type="date" className="border rounded px-2 py-1" value={filters.to} onChange={e=>setFilters({...filters, to: e.target.value})} />
              </div>
              <select className="border rounded px-2 py-1" value={filters.status} onChange={e=>setFilters({...filters, status: e.target.value})}>
                <option value="">{lang==='ar'?'الحالة':'Status'}</option>
                <option value="paid">{lang==='ar'?'مسددة':'Paid'}</option>
                <option value="unpaid">{lang==='ar'?'غير مسددة':'Unpaid'}</option>
                <option value="partial">{lang==='ar'?'جزئي':'Partial'}</option>
              </select>
              <input className="border rounded px-2 py-1" placeholder={lang==='ar'?'رقم فاتورة':'Invoice No.'} value={filters.invoice} onChange={e=>setFilters({...filters, invoice: e.target.value})} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.dueOnly} onChange={e=>setFilters({...filters, dueOnly: e.target.checked})} />
                {lang==='ar'?'عرض المستحق فقط':'Show due only'}
              </label>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 p-4 rounded border">
          <div className="text-amber-700">{lang==='ar'?'رصيد افتتاحي':'Opening Balance'}</div>
          <div className="text-xl font-bold text-amber-700">{openingBalance.toFixed(2)} ريال</div>
          <div className="text-xs text-amber-700">{lang==='ar'?'تاريخ':'Date'}: {openingBalanceDate||'—'}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded border">
          <div className="text-blue-700">{lang==='ar'?'الفواتير بالفترة':'Invoices (Period)'}</div>
          <div className="text-xl font-bold text-blue-700">{summary.totalInv.toFixed(2)} ريال</div>
        </div>
        <div className="bg-green-50 p-4 rounded border">
          <div className="text-green-700">{lang==='ar'?'المدفوع بالفترة':'Paid (Period)'}</div>
          <div className="text-xl font-bold text-green-700">{summary.totalPaid.toFixed(2)} ريال</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded border">
          <div className="text-indigo-700">{lang==='ar'?'رصيد ختامي':'Closing Balance'}</div>
          <div className="text-xl font-bold text-indigo-700">{(openingBalance + summary.totalInv - summary.totalPaid).toFixed(2)} ريال</div>
        </div>
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="sticky top-0 bg-gray-50 border-b p-3 flex items-center justify-between">
          <div className="font-semibold">{lang==='ar'?'📄 تفاصيل الفواتير':'Invoice Details'}</div>
          {loading ? (<div className="text-xs text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}
        </div>
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice'}</th>
              <th className="p-2">{lang==='ar'?'تاريخ الفاتورة':'Date'}</th>
              <th className="p-2">{lang==='ar'?'قيمة الفاتورة':'Amount'}</th>
              <th className="p-2">{lang==='ar'?'المسدد':'Paid'}</th>
              <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
              <th className="p-2">{lang==='ar'?'تاريخ السداد':'Payment Date'}</th>
              <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map(inv => {
              const lastPay = payments.filter(p => p.invoice_id===inv.id).sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())[0]
              return (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{inv.invoice_number}</td>
                  <td className="p-2 text-gray-600">{inv.date}</td>
                  <td className="p-2">{inv.total.toFixed(2)}</td>
                  <td className="p-2">{inv.paid.toFixed(2)}</td>
                  <td className="p-2">{inv.remaining.toFixed(2)}</td>
                  <td className="p-2">{lastPay?.date || '–'}</td>
                  <td className="p-2"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{statusLabelClient(inv._client_status)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="sticky top-0 bg-gray-50 border-b p-3 flex items-center justify-between">
          <div className="font-semibold">{lang==='ar'?'🧮 حركات الحساب':'Account Movements'}</div>
        </div>
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
              <th className="p-2">{lang==='ar'?'النوع':'Type'}</th>
              <th className="p-2">{lang==='ar'?'المرجع':'Reference'}</th>
              <th className="p-2">{lang==='ar'?'المبلغ':'Amount'}</th>
              <th className="p-2">{lang==='ar'?'الرصيد المتحرك':'Running Balance'}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-amber-50/50">
              <td className="p-2">{openingBalanceDate||'—'}</td>
              <td className="p-2">{lang==='ar'?'رصيد افتتاحي':'Opening'}</td>
              <td className="p-2">—</td>
              <td className="p-2">{openingBalance.toFixed(2)}</td>
              <td className="p-2">{openingBalance.toFixed(2)}</td>
            </tr>
            {ledgerRows.map((e, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-2">{e.date}</td>
                <td className="p-2">{e.type==='invoice' ? (lang==='ar'?'فاتورة':'Invoice') : (lang==='ar'?'دفعة':'Payment')}</td>
                <td className="p-2">{String(e.ref||'')}</td>
                <td className="p-2">{e.amount.toFixed(2)}</td>
                <td className="p-2">{e.running.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-t bg-indigo-50/50">
              <td className="p-2" colSpan={4}>{lang==='ar'?'الرصيد الختامي':'Closing Balance'}</td>
              <td className="p-2">{(openingBalance + summary.totalInv - summary.totalPaid).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500">
        {lang==='ar'?'قاعدة: كشف العميل = فواتير مبيعات + سندات قبض فقط':'Rule: Statement = Sales Invoices + Receipts only'}
      </div>
    </div>
  )
}
