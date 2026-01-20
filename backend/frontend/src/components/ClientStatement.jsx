import { useEffect, useMemo, useState } from 'react'
import { partners as apiPartners } from '../services/api'

// CRITICAL: This component now uses apiPartners.statement which derives data exclusively from posted journal entries

// CRITICAL: This component now uses apiPartners.statement which derives data exclusively from posted journal entries

export default function ClientStatement({ partner, from: fromProp = '', to: toProp = '', status: statusProp = '', invoice: invoiceProp = '', dueOnly: dueOnlyProp = false, hideFilters = false }) {
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [filters, setFilters] = useState({ status: statusProp||'', from: fromProp||'', to: toProp||'', invoice: invoiceProp||'', dueOnly: Boolean(dueOnlyProp)||false })
  const [loading, setLoading] = useState(false)
  const [statementItems, setStatementItems] = useState([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [openingBalanceDate, setOpeningBalanceDate] = useState('')
  const [closingBalance, setClosingBalance] = useState(0)

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
      if (!partner?.id) { setStatementItems([]); setOpeningBalance(0); setClosingBalance(0); return }
      setLoading(true)
      try {
        // CRITICAL: Use apiPartners.statement which derives data from posted journal entries only
        const params = {}
        if (filters.from) params.from = filters.from
        if (filters.to) params.to = filters.to
        const statementData = await apiPartners.statement(partner.id, params)
        
        // statementData contains items array with debit, credit, date, reference_type, reference_id, etc.
        const items = Array.isArray(statementData?.items) ? statementData.items : []
        
        // Calculate opening balance (balance before from date)
        const openingBal = parseFloat(statementData?.opening_balance || 0)
        setOpeningBalance(openingBal)
        
        // Calculate closing balance
        const closingBal = parseFloat(statementData?.closing_balance || openingBal)
        setClosingBalance(closingBal)
        
        // Set statement items with running balance
        let runningBalance = openingBal
        const itemsWithRunning = items.map(item => {
          const debit = parseFloat(item.debit || 0)
          const credit = parseFloat(item.credit || 0)
          runningBalance += debit - credit
          return {
            ...item,
            debit,
            credit,
            net_amount: debit - credit,
            running_balance: runningBalance
          }
        })
        setStatementItems(itemsWithRunning)
      } catch (e) {
        console.error('[ClientStatement] Error loading statement:', e)
        setStatementItems([])
        setOpeningBalance(0)
        setClosingBalance(0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [partner, filters])

  useEffect(() => {
    if (filters.from) {
      setOpeningBalanceDate(filters.from)
    } else {
      setOpeningBalanceDate('')
    }
  }, [filters.from])

  const viewRows = useMemo(() => {
    let list = statementItems.map(item => {
      const debit = parseFloat(item.debit || 0)
      const credit = parseFloat(item.credit || 0)
      const net = debit - credit
      const remaining = net > 0 ? net : 0
      const status = remaining === 0 ? 'paid' : (net < 0 ? 'partial' : 'unpaid')
      return {
        ...item,
        total: Math.abs(net),
        paid: net < 0 ? Math.abs(net) : 0,
        remaining: remaining,
        _client_status: status,
        invoice_number: item.reference_type === 'invoice' ? `INV-${item.reference_id}` : item.entry_number?.toString() || ''
      }
    })
    if (filters.status) {
      if (filters.status === 'paid') list = list.filter(x => x._client_status === 'paid')
      else if (filters.status === 'partial') list = list.filter(x => x._client_status === 'partial')
      else if (filters.status === 'unpaid') list = list.filter(x => x._client_status === 'unpaid')
    }
    if (filters.invoice) {
      const q = filters.invoice.toLowerCase()
      list = list.filter(x => String(x.invoice_number || '').toLowerCase().includes(q))
    }
    if (filters.dueOnly) {
      list = list.filter(x => x.remaining > 0)
    }
    return list
  }, [statementItems, filters])

  const summary = useMemo(() => {
    const totalInv = viewRows.filter(r => r.debit > 0).reduce((s, r) => s + r.total, 0)
    const totalPaid = viewRows.filter(r => r.credit > 0).reduce((s, r) => s + Math.abs(r.net_amount || 0), 0)
    const totalRem = viewRows.reduce((s, r) => s + r.remaining, 0)
    return { totalInv, totalPaid, totalRem }
  }, [viewRows])

  const ledgerRows = useMemo(() => {
    return statementItems.map(item => ({
      date: item.date,
      type: item.debit > 0 ? 'invoice' : 'payment',
      ref: item.reference_type === 'invoice' ? `INV-${item.reference_id}` : item.entry_number?.toString() || '',
      amount: Math.abs(item.net_amount || 0),
      running: item.running_balance || 0
    }))
  }, [statementItems])

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
            {viewRows.map((inv, idx) => (
              <tr key={inv.id || idx} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number || inv.entry_number}</td>
                <td className="p-2 text-gray-600">{inv.date}</td>
                <td className="p-2">{inv.total.toFixed(2)}</td>
                <td className="p-2">{inv.paid.toFixed(2)}</td>
                <td className="p-2">{inv.remaining.toFixed(2)}</td>
                <td className="p-2">{inv.credit > 0 ? inv.date : '–'}</td>
                <td className="p-2"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{statusLabelClient(inv._client_status)}</span></td>
              </tr>
            ))}
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
        {lang==='ar'?'قاعدة: كشف العميل = قيود اليومية المنشورة فقط (POSTED)':'Rule: Statement = Posted Journal Entries Only (POSTED)'}
      </div>
    </div>
  )
}
