import { useEffect, useMemo, useState, useRef } from 'react'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import { invoices, partners as apiPartners, periods, payments } from '../services/api'
import StatusBadge from '../ui/StatusBadge'
import { t } from '../utils/i18n'
import Button from '../ui/Button'
import { FaEye, FaEdit, FaPrint } from 'react-icons/fa'
import Modal from '../ui/Modal'

export default function ClientsInvoicesAll({ compact=false, defaultPartnerId='', mode='' }){
  const lang = localStorage.getItem('lang')||'ar'
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ partner_id: '', status: '', from: '', to: '', branch: '' })
  const [partners, setPartners] = useState([])
  const partnersById = useMemo(()=>{ const m=new Map(); const safe = Array.isArray(partners) ? partners : []; safe.forEach(p=>m.set(Number(p.id||0), p)); return m },[partners])
  const [helpOpen, setHelpOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('open')
  const [payRows, setPayRows] = useState([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewSrcDoc, setPreviewSrcDoc] = useState('')
  const iframeRef = useRef(null)
  const [page, setPage] = useState(1)
  const pageSize = 10
  useEffect(()=>{ if (defaultPartnerId && String(filters.partner_id||'')!==String(defaultPartnerId)) setFilters(f=>({ ...f, partner_id: String(defaultPartnerId) })) },[defaultPartnerId])

  function formatMoney(v){ const n = Number(v||0); try { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' SAR' } catch { return String(n.toFixed(2)) + ' SAR' } }

  useEffect(()=>{ (async()=>{ try { const list = await apiPartners.list({ type: 'customer' }); setPartners(Array.isArray(list)?list:[]) } catch { setPartners([]) } })() },[])
  useEffect(()=>{ (async()=>{ setLoading(true); try { const q = { type:'sale', ...filters }; const sv = String(q.status||'').toLowerCase(); if (sv==='due' || sv==='overdue') { q.due = '1'; delete q.status } const res = await invoices.list(q); setRows(res?.items||res||[]) } catch { setRows([]) } finally { setLoading(false) } })() },[filters])
  useEffect(()=>{ (async()=>{ try { const d = new Date(); const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; if (typeof periods?.get === 'function') { const s = await periods.get(per); setPeriodStatus(String(s?.status||'open')) } } catch {} })() },[])
  useEffect(()=>{ (async()=>{ try { const params = {}; if (filters.partner_id) params.partner_id = filters.partner_id; if (filters.from) params.from = filters.from; if (filters.to) params.to = filters.to; params.pageSize = 1000; const res = await payments.list({ ...params, party_type: 'customer' }); setPayRows(res?.items||res||[]) } catch { setPayRows([]) } })() },[filters])

  const paidByInvoice = useMemo(()=>{ const by = new Map(); const safe = Array.isArray(payRows) ? payRows : []; safe.forEach(p=>{ const k = Number(p.invoice_id||0); const prev = by.get(k)||0; by.set(k, prev + parseFloat(p.amount||0)) }); return by }, [payRows])
  const paged = useMemo(()=>{
    let list = Array.isArray(rows) ? rows : []
    const remaining = (inv)=>{ const r = Number(inv?.remaining_amount||0); if (r>0 || r===0) return r; const total=Number(inv.total||0); const paid=Number(paidByInvoice.get(Number(inv.id))||0); return Math.max(0, total-paid) }
    if (mode==='cash') {
      list = list.filter(inv => Boolean(inv?.is_cash_by_ledger))
    } else if (mode==='credit') {
      list = list.filter(inv => remaining(inv) > 0)
    }
    const start = (Math.max(1, page)-1) * pageSize
    const end = start + pageSize
    return list.slice(start, end)
  }, [rows, mode, paidByInvoice, page])

  const totalPages = useMemo(()=>{
    const list = (function(){
      let arr = Array.isArray(rows) ? rows : []
      const remaining = (inv)=>{ const r = Number(inv?.remaining_amount||0); if (r>0 || r===0) return r; const total=Number(inv.total||0); const paid=Number(paidByInvoice.get(Number(inv.id))||0); return Math.max(0, total-paid) }
      if (mode==='cash') arr = arr.filter(inv => Boolean(inv?.is_cash_by_ledger))
      else if (mode==='credit') arr = arr.filter(inv => remaining(inv) > 0)
      return arr
    })()
    return Math.max(1, Math.ceil((list||[]).length / pageSize))
  }, [rows, mode, paidByInvoice])
  async function viewInvoice(inv){
    try {
      const base = String(api?.defaults?.baseURL||'').replace(/\/$/, '')
      const url = base ? `${base}/preview/invoice/${inv.id}` : `/api/preview/invoice/${inv.id}`
      const token = localStorage.getItem('token')||''
      const res = await fetch(url, { headers: token? { Authorization: `Bearer ${token}` } : {} })
      const html = await res.text()
      const htmlFixedQR = html.replace(/src="data:image\/png;base64,([^"]+)"/i, (m, b64)=> `src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(b64)}"`)
      setPreviewSrcDoc(htmlFixedQR)
      setPreviewUrl('')
    } catch {
      try {
        const base = String(api?.defaults?.baseURL||'')
        const url = base ? (base.replace(/\/$/, '') + `/preview/invoice/${inv.id}`) : (`/api/preview/invoice/${inv.id}`)
        setPreviewUrl(url)
      } catch { setPreviewUrl(`/api/preview/invoice/${inv.id}`) }
      setPreviewSrcDoc('')
    }
    setPreviewOpen(true)
  }
  function editInvoice(inv){ navigate('/clients', { state: { openCustomerId: inv.partner_id } }) }
  function printInvoice(inv){ }
  async function reload(){ setLoading(true); try { const q = { type:'sale', ...filters }; const sv = String(q.status||'').toLowerCase(); if (sv==='due' || sv==='overdue') { q.due = '1'; delete q.status } const res = await invoices.list(q); setRows(res?.items||res||[]) } catch { setRows([]) } finally { setLoading(false) } }

  return (
    <div className={compact?"":"space-y-4"} dir="rtl">
      {!compact && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">{lang==='ar'?'كل فواتير العملاء':'All Customer Invoices'}</h2>
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={()=> navigate('/customer-invoice')}>{lang==='ar'?'إنشاء فاتورة':'Create Invoice'}</Button>
              <Button variant="ghost" onClick={reload}>{lang==='ar'?'إعادة التحميل':'Reload'}</Button>
              <span className="px-2 py-1 bg-white rounded border"><StatusBadge status={periodStatus} type="period" /></span>
              <Button variant="ghost" onClick={()=> setHelpOpen(true)}>{lang==='ar'?'مساعدة':'Help'}</Button>
            </div>
          </div>
          <div className="bg-white rounded border shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <select className="border rounded px-2 py-2" value={filters.partner_id} onChange={e=>setFilters(f=>({...f, partner_id: e.target.value}))}>
                <option value="">{lang==='ar'?'العميل':'Customer'}</option>
                {(Array.isArray(partners) ? partners : []).map(p=> (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <select className="border rounded px-2 py-2" value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))}>
                <option value="">{lang==='ar'?'الحالة':'Status'}</option>
                <option value="paid">{lang==='ar'?'مدفوعة':'Paid'}</option>
                <option value="due">{lang==='ar'?'مستحقة':'Due'}</option>
                <option value="overdue">{lang==='ar'?'متأخرة':'Overdue'}</option>
                <option value="partial">{lang==='ar'?'جزئية':'Partial'}</option>
              </select>
              <select className="border rounded px-2 py-2" value={filters.branch} onChange={e=>setFilters(f=>({...f, branch: e.target.value}))}>
                <option value="">{lang==='ar'?'الفرع':'Branch'}</option>
                <option value="china_town">China Town</option>
                <option value="place_india">Place India</option>
                <option value="palace_india">Palace India</option>
              </select>
              <input type="date" className="border rounded px-2 py-2" value={filters.from} onChange={e=>setFilters(f=>({...f, from: e.target.value}))} />
              <input type="date" className="border rounded px-2 py-2" value={filters.to} onChange={e=>setFilters(f=>({...f, to: e.target.value}))} />
              <div className="flex gap-2">
                <Button variant="ghost">Excel</Button>
                <Button variant="ghost">PDF</Button>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead className={`${previewOpen?'':'sticky top-0'} bg-white ${previewOpen?'':'z-10'}`}>
          <tr className="border-b bg-gray-50">
            <th className="p-2">رقم الفاتورة</th>
            <th className="p-2">العميل</th>
            <th className="p-2">التاريخ</th>
            <th className="p-2">الإجمالي</th>
            <th className="p-2">الخصم</th>
            <th className="p-2">الضريبة</th>
            <th className="p-2">الحالة</th>
            <th className="p-2">الإجراءات</th>
          </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2 text-sm text-gray-600" colSpan={7}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
            ) : (Array.isArray(paged) ? paged : []).map(inv => (
              <tr key={inv.id} className="border-b odd:bg-white even:bg-gray-50">
                <td className="p-2 font-medium">{inv.invoice_number}</td>
                <td className="p-2">{(()=>{ const pid=Number(inv.partner_id||0); const name = inv.partner?.name || (pid? (partnersById.get(pid)?.name || '') : ''); return name || (lang==='ar'?'عميل نقدي':'Cash Customer') })()}</td>
                <td className="p-2">{inv.date}</td>
                <td className="p-2 text-right" dir="ltr">{formatMoney(inv.total)}</td>
                <td className="p-2 text-right" dir="ltr">{(()=>{ const d=Number(((typeof inv.discount_total!=='undefined' && inv.discount_total!==null)?inv.discount_total:inv.discount_amount)||0); return d>0?formatMoney(d):'' })()}</td>
                <td className="p-2 text-right" dir="ltr">{formatMoney(inv.tax)}</td>
                <td className="p-2"><StatusBadge status={(function(){
                  if (mode==='cash') return 'paid'
                  const total = Number(inv.total||0)
                  const paid = Number(paidByInvoice.get(Number(inv.id))||0)
                  if (paid>=total && total>0) return 'paid'
                  if (paid>0 && paid<total) return 'partial'
                  return 'unpaid'
                })()} /></td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={()=> viewInvoice(inv)}><FaEye /> {lang==='ar'?'عرض':'View'}</Button>
                    <Button variant="secondary" onClick={()=> editInvoice(inv)}><FaEdit /> {lang==='ar'?'تعديل':'Edit'}</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-gray-600">صفحة {page} من {totalPages}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1, p-1))}>{lang==='ar'?'السابق':'Previous'}</button>
          <button className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page>=totalPages} onClick={()=> setPage(p=> Math.min(totalPages, p+1))}>{lang==='ar'?'التالي':'Next'}</button>
        </div>
      </div>
      <Modal open={previewOpen} title={lang==='ar'?'معاينة الإيصال الحراري':'Thermal Receipt Preview'} onClose={()=> setPreviewOpen(false)}>
        <div className="w-full space-y-2" style={{ height: '70vh' }}>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={()=>{ if (previewUrl) window.open(previewUrl, '_blank') }}>{lang==='ar'?'فتح نافذة مستقلة':'Open New Tab'}</Button>
            <Button variant="primary" onClick={()=>{ try { const w = iframeRef.current && iframeRef.current.contentWindow; if (w) { w.focus(); w.print() } } catch {} }}>{lang==='ar'?'طباعة':'Print'}</Button>
          </div>
          {previewSrcDoc ? (
            <iframe ref={iframeRef} srcDoc={previewSrcDoc} title="preview" style={{ width: '100%', height: '100%', border: '0' }} />
          ) : (previewUrl ? (
            <iframe ref={iframeRef} src={previewUrl} title="preview" style={{ width: '100%', height: '100%', border: '0' }} />
          ) : null)}
        </div>
      </Modal>
      {!compact && (
        <Modal open={helpOpen} title={lang==='ar'?'مساعدة':'Help'} onClose={()=>setHelpOpen(false)}>
          <div className="text-sm text-gray-700">{lang==='ar'?'فواتير العملاء':'Customer Invoices'}</div>
        </Modal>
      )}
    </div>
  )
}
