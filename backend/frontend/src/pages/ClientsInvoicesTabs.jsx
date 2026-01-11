import { useEffect, useMemo, useState } from 'react'
import { invoices, journal, payments } from '../services/api'
import InvoiceControlCard from '../components/InvoiceControlCard'

const INVOICE_TABS = [
  { key: 'draft', label: 'مسودات' },
  { key: 'posted', label: 'مرحلة' },
  { key: 'paid', label: 'مدفوعة' },
  { key: 'overdue', label: 'متأخرة' },
]

export default function ClientsInvoicesTabs({ onChanged }){
  const [tab, setTab] = useState('posted')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(()=>{ (async()=>{ setLoading(true); try { const p = { type: 'sale' }; if (partnerId) p.partner_id = partnerId; if (dateFrom) p.from = dateFrom; if (dateTo) p.to = dateTo; if (tab==='overdue') { p.status = 'open'; p.due = '1' } else { p.status = tab } const res = await invoices.list(p); setRows(res?.items||res||[]) } catch { setRows([]) } finally { setLoading(false) } })() },[tab, partnerId, dateFrom, dateTo])

  const viewRows = useMemo(()=> rows, [rows])

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        {INVOICE_TABS.map(t => (
          <button key={t.key} className={`px-3 py-2 rounded-full ${tab===t.key?'bg-primary-600 text-white':'bg-gray-100 text-gray-800'}`} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="عميل" value={partnerId} onChange={e=>setPartnerId(e.target.value)} />
          <input type="date" className="border rounded px-2 py-1" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          <input type="date" className="border rounded px-2 py-1" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </div>
      </div>
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-2">رقم الفاتورة</th>
            <th className="p-2">العميل</th>
            <th className="p-2">التاريخ</th>
            <th className="p-2">الإجمالي</th>
            <th className="p-2">الخصم</th>
            <th className="p-2">الضريبة</th>
            <th className="p-2">الحالة</th>
            <th className="p-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className="p-2 text-sm text-gray-600" colSpan={8}>جار التحميل...</td></tr>
          ) : (
            viewRows.map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2 text-gray-700">{inv.partner?.name || inv.partner_id || '-'}</td>
                <td className="p-2 text-gray-600">{inv.date}</td>
                <td className="p-2">{Number(inv.total||0).toLocaleString('en-US')}</td>
                <td className="p-2">{(()=>{ const d=Number(((typeof inv.discount_total!=='undefined' && inv.discount_total!==null)?inv.discount_total:inv.discount_amount)||0); return d>0?d.toLocaleString('en-US'):'' })()}</td>
                <td className="p-2">{Number(inv.tax||0).toLocaleString('en-US')}</td>
                <td className="p-2"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{String(inv.status||'draft')}</span></td>
                <td className="p-2"><button className="px-2 py-1 bg-blue-100 text-blue-700 rounded" onClick={()=>{ setSelected(inv); setOpen(true) }}>تحكم</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {open && selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">تحكم بالفاتورة</div>
              <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setOpen(false)}>×</button>
            </div>
            <InvoiceControlCard 
              invoice={selected}
              onEdit={()=>{}}
              onPost={async()=>{
                try {
                  const rel = await journal.findByRelated({ type: 'invoice', id: selected.id })
                  if (!rel) throw new Error('no_journal')
                  await journal.postEntry(rel.id)
                } catch {}
                setOpen(false)
                typeof onChanged==='function' && onChanged()
              }}
              onDelete={()=>{}}
              onUnpost={async()=>{
                try {
                  const rel = await journal.findByRelated({ type: 'invoice', id: selected.id })
                  if (!rel) throw new Error('no_journal')
                  await journal.returnToDraft(rel.id)
                } catch {}
                setOpen(false)
                typeof onChanged==='function' && onChanged()
              }}
              onReverse={async()=>{
                try {
                  const rel = await journal.findByRelated({ type: 'invoice', id: selected.id })
                  if (!rel) throw new Error('no_journal')
                  await journal.reverse(rel.id)
                } catch {}
                setOpen(false)
                typeof onChanged==='function' && onChanged()
              }}
              onViewJournal={()=>{ window.open(`/journal/${selected?.journal_id||''}`, '_blank') }}
            />
          </div>
        </div>
      )}
    </div>
  )
}