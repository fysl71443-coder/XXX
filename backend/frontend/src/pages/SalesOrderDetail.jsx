import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FaFileInvoice, FaTrash, FaTimes, FaSearch, FaPrint } from 'react-icons/fa'
import { products as apiProducts, partners as apiPartners, audit as apiAudit, invoices as apiInvoices, payments as apiPayments, journal as apiJournal, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { createPDF, ensureImageDataUrl } from '../utils/pdfUtils'
import { print } from '@/printing'

export default function SalesOrderDetail(){
  const navigate = useNavigate()
  const { id, number } = useParams()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [order, setOrder] = useState(null)
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000'
  const [paymentTerms, setPaymentTerms] = useState('60d')
  const [orderDate, setOrderDate] = useState(()=>new Date().toISOString().slice(0,16))
  const [lines, setLines] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [productItems, setProductItems] = useState([])
  const [productQuery, setProductQuery] = useState('')
  const [pickerError, setPickerError] = useState('')
  const [status, setStatus] = useState('in_progress')
  const [activeTab, setActiveTab] = useState('lines')
  const [poNumber, setPoNumber] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [clientLoading, setClientLoading] = useState(false)
  const [clients, setClients] = useState([])
  const [clientQuery, setClientQuery] = useState('')
  const [clientError, setClientError] = useState('')
  const [salesperson, setSalesperson] = useState('')
  const [salesTeam, setSalesTeam] = useState('')
  const [onlineSignature, setOnlineSignature] = useState(false)
  const [onlinePayment, setOnlinePayment] = useState(false)
  const [customerRef, setCustomerRef] = useState('AHC-QT-1106-2025')
  const [tags, setTags] = useState('')
  const [fiscalPosition, setFiscalPosition] = useState('KSA')
  const [incoterm, setIncoterm] = useState('FOB')
  const [incotermLocation, setIncotermLocation] = useState('')
  const [shippingPolicy, setShippingPolicy] = useState('asap')
  const [deliveryDate, setDeliveryDate] = useState(toInputDateTime('16/11/2025 14:06:25'))
  const [deliveryStatus, setDeliveryStatus] = useState('pending')
  const [tracking, setTracking] = useState('')
  const [sourceDocument, setSourceDocument] = useState('')
  const [campaign, setCampaign] = useState('')
  const [medium, setMedium] = useState('')
  const [source, setSource] = useState('')
  const [activities, setActivities] = useState([])

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{
    let mounted = true
    async function load(){
      try {
        const eid = id || number
        const res = await fetch(`${API_BASE}/api/orders/${eid}`)
        if (res.ok) {
          const data = await res.json()
          if (!mounted) return
          setOrder({ id: data.id, order_number: data.order_number, customer_id: data.customer?.id, customer: data.customer?.name || '', address: '', country: '', tax_id: '', email: '', phone: '', deliveryDate: '' })
          try { setOrderDate(new Date(data.date||Date.now()).toISOString().slice(0,16)) } catch { setOrderDate(new Date().toISOString().slice(0,16)) }
          setLines([])
          setStatus(String(data.status||'in_progress').toLowerCase())
        } else {
          setOrder({ id: Number(eid), order_number: String(eid), customer_id: undefined, customer: '', address: '', country: '', tax_id: '', email: '', phone: '', deliveryDate: '' })
          setOrderDate(new Date().toISOString().slice(0,16))
          }
      } catch {
        const eid = id || number
        setOrder({ id: Number(eid), order_number: String(eid), customer_id: undefined, customer: '', address: '', country: '', tax_id: '', email: '', phone: '', deliveryDate: '' })
        setOrderDate(new Date().toISOString().slice(0,16))
      }
    }
    load()
    return ()=>{ mounted = false }
  },[id, number, API_BASE])

  useEffect(()=>{
    return ()=>{
      if (status==='draft' && !order?.customer_id && order?.id){ fetch(`${API_BASE}/api/orders/${order.id}`, { method: 'DELETE' }).catch(()=>{}) }
    }
  },[status, order, API_BASE])

  async function openProductPicker(){
    setPickerOpen(true)
    if (productItems.length===0){
      setPickerLoading(true)
      try {
        const params = order?.customer_id ? { client_id: order.customer_id } : {}
        const items = await apiProducts.list(params)
        setProductItems(items)
        setPickerError(order?.customer_id ? '' : (lang==='ar'?'يرجى اختيار عميل أولاً':'Please select a client first'))
      }
      catch(e){ setProductItems([]); setPickerError('failed') }
      finally { setPickerLoading(false) }
    }
  }

  function closeProductPicker(){ setPickerOpen(false); setProductQuery('') }

  async function openClientPicker(){
    setClientPickerOpen(true)
    if (clients.length===0){
      setClientLoading(true)
      try { const items = await apiPartners.list(); const onlyClients = (items||[]).filter(x => {
        const t = String(x.type||'').toLowerCase();
        return t.includes('عميل') || t.includes('customer')
      }); setClients(onlyClients); setClientError('') }
      catch(e){ setClients([]); setClientError('failed') }
      finally { setClientLoading(false) }
    }
  }

  function closeClientPicker(){ setClientPickerOpen(false); setClientQuery('') }

  function selectClient(c){
    const addr = c.billing_address || c.addr_description || [c.addr_street, c.addr_district, c.addr_city].filter(Boolean).join(' - ')
    const country = c.country || c.addr_country || ''
    const tax = c.tax_id || ''
    const email = c.email || ''
    const phone = c.phone || c.mobile || ''
    setOrder(prev => ({
      ...prev,
      customer_id: c.id,
      customer: c.name || '',
      address: addr || '',
      country,
      tax_id: tax,
      email,
      phone
    }))
    if (c.payment_term) { setPaymentTerms(c.payment_term) }
    closeClientPicker()
    scheduleSave()
  }

  function selectProduct(p){
    const nextSl = (lines.length ? Math.max(...lines.map(x=>x.sl)) : 0) + 1
    const taxRate = getTaxRate(p)
    const newLine = { sl: nextSl, product: p.name, desc: p.name, qty: 1, uom: p.uom || 'Units', unit_price: Number(p.sale_price||0), tax: taxRate, cost: Number(p.cost_price||0), locked: false }
    setLines([...lines, newLine])
    closeProductPicker()
  }

  function removeLine(sl){
    const target = lines.find(x=>x.sl===sl)
    if (!target || target.locked) return
    const updated = lines.filter(x=>x.sl!==sl).map((x, i) => ({ ...x, sl: i+1 }))
    setLines(updated)
  }

  const saveTimer = useRef(null)
  function scheduleSave(){
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(saveOrder, 400)
  }
  function updateLine(sl, patch){
    setLines(lines.map(x=>x.sl===sl?{...x, ...(typeof patch==='function'?patch(x):patch)}:x))
    scheduleSave()
  }

  async function ensureProductsLoaded(){
    if (productItems.length===0){
      setPickerLoading(true)
      try {
        const params = order?.customer_id ? { client_id: order.customer_id } : {}
        const items = await apiProducts.list(params)
        setProductItems(items)
        setPickerError(order?.customer_id ? '' : (lang==='ar'?'يرجى اختيار عميل أولاً':'Please select a client first'))
      }
      catch(e){ setProductItems([]); setPickerError('failed') }
      finally { setPickerLoading(false) }
    }
  }

  async function updatePrices(){
    await ensureProductsLoaded()
    const byName = new Map((productItems||[]).map(p=>[(p.name||'').toLowerCase(), p]))
    setLines(lines.map(l=>{
      const p = byName.get((l.product||'').toLowerCase())
      if (!p) return l
      return { ...l, unit_price: Number(p.sale_price||l.unit_price), cost: Number(p.cost_price||l.cost) }
    }))
  }

  function getTaxRate(p){
    const raw = p.customer_taxes || p.tax_rate || p.vat_rate || ''
    if (typeof raw === 'number') {
      // if provided as 15 or 0.15, normalize to 0.15
      return raw > 1 ? raw/100 : raw
    }
    const s = String(raw).trim()
    const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*%?/)
    if (m) {
      const n = parseFloat(m[1])
      if (!isNaN(n)) return n > 1 ? n/100 : n
    }
    return 0.15
  }

  function markInProgress(){ setStatus('in_progress') }
  function cancelOrder(){
    if (order?.id && lines.length===0){ fetch(`${API_BASE}/api/orders/${order.id}`, { method: 'DELETE' }).catch(()=>{}) }
    setOrder(null)
    navigate('/orders')
  }

  async function saveOrder(){
    try {
      if (!order?.id) return
      if (!order.customer_id || !lines.length || lines.some(l=>Number(l.qty||0)<=0)) { alert(lang==='ar'?'يرجى اختيار عميل وإضافة بنود صالحة':'Please select a client and add valid lines'); return }
      const payload = {
        customer_id: order.customer_id,
        customer: order.customer,
        address: order.address,
        country: order.country,
        tax_id: order.tax_id,
        email: order.email,
        phone: order.phone,
        po_number: poNumber,
        payment_terms: paymentTerms,
        date: orderDate,
        lines,
        status: String(status||'draft').toUpperCase()
      }
      await fetch(`${API_BASE}/api/orders/${order.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      apiAudit.log({ type: 'order_update', order_id: order.id, status, at: new Date().toISOString() })
    } catch {}
  }

  const totals = useMemo(()=>{
    const untaxed = lines.reduce((s,l)=> s + l.qty*l.unit_price, 0)
    const vat = untaxed * 0.15
    const totalAmount = untaxed + vat
    const margin = totalAmount - lines.reduce((s,l)=> s + l.qty*l.cost, 0)
    return { untaxed, vat, total: totalAmount, margin }
  },[lines])

  const finalized = ['ready','invoiced','cancelled'].includes(String(status||'').toLowerCase())


  function createInvoice(){
    setStatus('invoiced')
    navigate('/invoices/new', { state: { fromOrder: { order_id: order?.id, number: (order?.order_number||String(id)), customer_id: order?.customer_id, customer: order?.customer, address: order?.address, tax_id: order?.tax_id, poNumber, lines, paymentTerms, deliveryDate: order?.deliveryDate || '' }, totals } })
  }

  function readyToInvoice(){
    if (!order?.customer_id || !lines.length || lines.some(l=>Number(l.qty||0)<=0)) { alert(lang==='ar'?'يرجى اختيار عميل وإضافة بنود صالحة':'Please select a client and add valid lines'); return }
    setStatus('ready')
    navigate('/invoices/new', { state: { fromOrder: { order_id: order?.id, number: (order?.order_number||String(id)), customer_id: order?.customer_id, customer: order?.customer, address: order?.address, tax_id: order?.tax_id, poNumber, lines, paymentTerms, deliveryDate: order?.deliveryDate || '' }, totals } })
  }

  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportItems, setReportItems] = useState([])
  const [reportError, setReportError] = useState('')
  async function openInvoiceReport(){
    setReportOpen(true)
    setReportLoading(true)
    try {
      const res = await apiInvoices.list({ type: 'sale', order_id: order?.id })
      setReportItems(res?.items||res||[])
      setReportError('')
    } catch { setReportItems([]); setReportError('failed') }
    finally { setReportLoading(false) }
  }
  function closeInvoiceReport(){ setReportOpen(false) }

  function saveDraftAndExit(){
    setStatus('draft')
    Promise.resolve(saveOrder()).finally(()=>navigate('/orders'))
  }

  function saveReadyAndExit(){
    setStatus('ready')
    Promise.resolve(saveOrder()).finally(()=>navigate('/orders'))
  }

  useEffect(()=>{
    (async()=>{
      const cid = order?.customer_id
      const dt = String(orderDate||'').slice(0,10)
      if (!cid || !dt || String(status||'')==='draft') { setActivities([]); return }
      try {
        const invs = await apiInvoices.list({ partner_id: cid, type: 'sale', from: dt })
        const pays = await apiPayments.list({ partner_id: cid, from: dt })
        const jres = await apiJournal.list({ partner_ids: String(cid), from: dt })
        const invItems = (invs?.items||invs||[]).map(x=>({ date: x.date, text: `${lang==='ar'?'فاتورة':'Invoice'} ${x.invoice_number||x.id} ${x.status||''}` }))
        const payItems = (pays?.items||pays||[]).map(p=>({ date: p.date, text: `${lang==='ar'?'دفعة':'Payment'} ${Number(p.amount||0).toFixed(2)} ${lang==='ar'?'ريال':'SR'} ${p.invoice?.invoice_number? (lang==='ar'?'لفاتورة':'for invoice')+` ${p.invoice.invoice_number}` : ''}` }))
        const jrItems = (jres?.items||jres||[]).map(e=>({ date: e.date, text: e.description || (lang==='ar'?'قيد يومية':'Journal Entry') }))
        const base = [{ date: dt, text: (lang==='ar'?'تم إنشاء طلب البيع':'Sales Order created') }]
        const merged = [...base, ...invItems, ...payItems, ...jrItems].filter(x=>!!x.date)
        merged.sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
        setActivities(merged)
      } catch { setActivities([{ date: dt, text: (lang==='ar'?'تم إنشاء طلب البيع':'Sales Order created') }]) }
    })()
  },[order?.customer_id, orderDate, status, lang])

  

  async function printOrder(){ const url = `/print/sales-order.html?id=${encodeURIComponent(id)}`; window.open(url, '_blank') }

function formatEn(n){ try { return parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) } catch { return '0.00' } }
function normalizeDigits(s){ return String(s||'').replace(/[٠-٩]/g, d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]) }

  return (
    !order ? (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
        </main>
      </div>
    ) : (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'طلبات البيع':'Sales Orders'}</h2>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{order?.order_number || String(id)}</span>
            <span className={`px-2 py-1 rounded text-xs ${status==='draft'?'bg-yellow-100 text-yellow-700':status==='in_progress'?'bg-blue-100 text-blue-700':status==='ready'?'bg-purple-100 text-purple-700':status==='invoiced'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{
              status==='draft'?(lang==='ar'?'مسودة':'Draft'):
              status==='in_progress'?(lang==='ar'?'قيد التنفيذ':'In Progress'):
              status==='ready'?(lang==='ar'?'جاهز للفوترة':'Ready to Invoice'):
              status==='invoiced'?(lang==='ar'?'مفوتر':'Invoiced'):
              (lang==='ar'?'ملغي':'Cancelled')
            }</span>
            
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>navigate('/orders')}>{lang==='ar'?'الطلبات':'Orders'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={printOrder}><FaPrint/> {lang==='ar'?'طباعة':'Print'}</button>
            {(()=>{ const allowed = can('sales_orders:write'); return (
            <>
              <button disabled={!allowed} className={`px-3 py-2 ${allowed?'bg-gray-100 hover:bg-gray-200':'bg-gray-300 cursor-not-allowed text-gray-500'} rounded-md`} onClick={()=>{ if(allowed) saveDraftAndExit() }}>{lang==='ar'?'حفظ كمسودة':'Save as Draft'}</button>
              <button disabled={!allowed} className={`px-3 py-2 ${allowed?'bg-gray-100 hover:bg-gray-200':'bg-gray-300 cursor-not-allowed text-gray-500'} rounded-md`} onClick={()=>{ if(allowed) markInProgress() }}>{lang==='ar'?'إبقاء الطلب مفتوح':'Keep Open'}</button>
              {status!=='draft' && (<button disabled={!allowed} className={`px-3 py-2 ${allowed?'bg-gray-100 hover:bg-gray-200':'bg-gray-300 cursor-not-allowed text-gray-500'} rounded-md`} onClick={()=>{ if(allowed) readyToInvoice() }}>{lang==='ar'?'جاهز للفوترة':'Ready to Invoice'}</button>)}
              <button disabled={!allowed} className={`px-3 py-2 ${allowed?'bg-gray-100 hover:bg-gray-200':'bg-gray-300 cursor-not-allowed text-gray-500'} rounded-md`} onClick={()=>{ if(allowed) updatePrices() }}>{lang==='ar'?'تحديث الأسعار':'Update Prices'}</button>
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={openInvoiceReport}>{lang==='ar'?'تقرير الفواتير':'Invoices Report'}</button>
              <button disabled={!allowed} className={`px-3 py-2 ${allowed?'bg-gray-100 hover:bg-gray-200':'bg-gray-300 cursor-not-allowed text-gray-500'} rounded-md`} onClick={()=>{ if(allowed) saveReadyAndExit() }}>{lang==='ar'?'حفظ الآن':'Save Now'}</button>
            </>
            ) })()}
            {status!=='draft' && can('invoices:write') && (<button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center gap-2" onClick={createInvoice}><FaFileInvoice/>{lang==='ar'?'إنشاء فاتورة':'Create Invoice'}</button>)}
            <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md" onClick={()=>{ if(can('sales_orders:write')) cancelOrder() }}>{lang==='ar'?'إلغاء الطلب':'Cancel Order'}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-white border rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold mb-2 px-2 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'معلومات العميل':'Customer Information'}</div>
              <div className="flex items-center justify-between">
                <div className="text-sm">{order.customer || ''}</div>
                <button className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" disabled={finalized} onClick={openClientPicker}>{lang==='ar'?'تغيير العميل':'Change Client'}</button>
              </div>
              {order.address ? (<div className="text-xs text-gray-600">{order.address}</div>) : null}
              {(order.country || order.tax_id) ? (<div className="text-xs text-gray-600">{order.country || ''} ‒ {order.tax_id || ''}</div>) : null}
              {order.email ? (<div className="text-xs text-gray-600">{order.email}</div>) : null}
              {order.phone ? (<div className="text-xs text-gray-600">{order.phone}</div>) : null}
              {paymentTerms ? (<div className="text-xs text-gray-600">{lang==='ar'?`شروط الدفع: ${paymentTerms}`:`Payment Terms: ${paymentTerms}`}</div>) : null}
            </div>
            <div>
              <div className="font-semibold mb-2 px-2 py-1 rounded bg-amber-50 text-amber-700">{lang==='ar'?'بيانات الطلب':'Order Data'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'تاريخ الطلب':'Order Date'}</label>
                  <input type="datetime-local" className="border rounded p-2 w-full" disabled={finalized} value={orderDate} onChange={e=>{ setOrderDate(e.target.value); scheduleSave() }} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'رقم طلب الشراء':'Customer PO Number'}</label>
                  <input className="border rounded p-2 w-full" disabled={finalized} value={poNumber} onChange={e=>{ setPoNumber(e.target.value); scheduleSave() }} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'شروط الدفع':'Payment Terms'}</label>
                  <select className="border rounded p-2 w-full" disabled={finalized} value={paymentTerms} onChange={e=>{ setPaymentTerms(e.target.value); scheduleSave() }}>
                    <option value="Immediate">{lang==='ar'?'فوري':'Immediate'}</option>
                    <option value="15d">15 {lang==='ar'?'يوم':'days'}</option>
                    <option value="30d">30 {lang==='ar'?'يوم':'days'}</option>
                    <option value="60d">60 {lang==='ar'?'يوم':'days'}</option>
                    <option value="90d">90 {lang==='ar'?'يوم':'days'}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='lines'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('lines')}>{lang==='ar'?'بنود الطلب':'Order Lines'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='other'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('other')}>{lang==='ar'?'معلومات أخرى':'Other Info'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='deliveries'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('deliveries')}>{lang==='ar'?'التسليمات':'Deliveries'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='payment'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('payment')}>{lang==='ar'?'طلب الدفع':'Payment Request'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='expenses'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('expenses')}>{lang==='ar'?'النفقات':'Expenses'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='timesheets'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('timesheets')}>{lang==='ar'?'سجلات الوقت':'Timesheets'}</button>
          </div>
          {activeTab==='lines' && (<>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">Sl No</th>
                <th className="p-2">Product</th>
                <th className="p-2">Taxes</th>
                <th className="p-2">Qty</th>
                <th className="p-2">UoM</th>
                <th className="p-2">Unit Price</th>
                <th className="p-2">Cost</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{l.sl}</td>
                  <td className="p-2">
                    <div className="text-sm font-medium">{l.product}</div>
                    <div className="text-xs text-gray-600">{l.desc}</div>
                  </td>
                  <td className="p-2">{formatEn(Number(l.tax||0)*100)}%</td>
                  <td className="p-2">
                    <input type="number" inputMode="decimal" lang="en" dir="ltr" step={l.uom==='Units'?1:'0.01'} min="0" className="border rounded p-1 w-24" disabled={finalized||!!l.locked} value={String(l.qty_input ?? l.qty ?? '')} onChange={e=>{
                      const raw = e.target.value; const norm = normalizeDigits(raw); const n = parseFloat(norm)
                      updateLine(l.sl, prev => ({ qty_input: raw, qty: isNaN(n)?prev.qty:n }))
                    }} onBlur={()=>{ updateLine(l.sl, { qty_input: undefined }) }} />
                    <div className="text-xs text-gray-500 mt-1">{l.uom==='Hours'?(lang==='ar'?'ساعات':'Hours'):l.uom==='Days'?(lang==='ar'?'أيام':'Days'):(lang==='ar'?'وحدات':'Units')}</div>
                  </td>
                  <td className="p-2">
                    <select className="border rounded p-1" disabled={finalized||!!l.locked} value={l.uom} onChange={e=>{
                      const v = e.target.value; setLines(lines.map(x=>x.sl===l.sl?{...x, uom:v}:x))
                    }}>
                      <option value="Units">Units</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </td>
                  <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" min="0" className="border rounded p-1 w-24" disabled={finalized||!!l.locked} value={String(l.unit_price_input ?? l.unit_price ?? '')} onChange={e=>{
                    const raw = e.target.value; const norm = normalizeDigits(raw); const n = parseFloat(norm)
                    updateLine(l.sl, prev => ({ unit_price_input: raw, unit_price: isNaN(n)?prev.unit_price:n }))
                  }} onBlur={()=>{ updateLine(l.sl, { unit_price_input: undefined }) }} /></td>
                  <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" min="0" className="border rounded p-1 w-24" disabled={finalized||!!l.locked} value={String(l.cost_input ?? l.cost ?? '')} onChange={e=>{
                    const raw = e.target.value; const norm = normalizeDigits(raw); const n = parseFloat(norm)
                    updateLine(l.sl, prev => ({ cost_input: raw, cost: isNaN(n)?prev.cost:n }))
                  }} onBlur={()=>{ updateLine(l.sl, { cost_input: undefined }) }} /></td>
                  <td className="p-2">
                    <button className={`px-2 py-1 rounded ${(finalized||l.locked||!can('sales_orders:write'))?'bg-gray-100 text-gray-400':'bg-red-100 text-red-700'}`} disabled={finalized||!!l.locked||!can('sales_orders:write')} onClick={()=>removeLine(l.sl)}><FaTrash/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 mt-3">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" disabled={finalized} onClick={openProductPicker}>{lang==='ar'?'إضافة منتج':'Add a product'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md">{lang==='ar'?'إضافة قسم':'Add a section'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md">{lang==='ar'?'إضافة ملاحظة':'Add a note'}</button>
          </div>
          </>)}
          {activeTab==='other' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border rounded p-3">
                <div className="font-semibold mb-2 px-2 py-1 rounded bg-indigo-50 text-indigo-700">{lang==='ar'?'المبيعات':'Sales'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'مسؤول المبيعات':'Salesperson'}</label>
                    <input className="border rounded p-2 w-full" value={salesperson} onChange={e=>setSalesperson(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'فريق المبيعات':'Sales Team'}</label>
                    <select className="border rounded p-2 w-full" value={salesTeam} onChange={e=>setSalesTeam(e.target.value)}>
                      <option value="">—</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Field Ops">Field Ops</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={onlineSignature} onChange={e=>setOnlineSignature(e.target.checked)} />{lang==='ar'?'توقيع إلكتروني؟':'Online signature?'}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={onlinePayment} onChange={e=>setOnlinePayment(e.target.checked)} />{lang==='ar'?'دفع إلكتروني؟':'Online payment?'}</label>
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="font-semibold mb-2 px-2 py-1 rounded bg-teal-50 text-teal-700">{lang==='ar'?'الفوترة':'Invoicing'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'مرجع العميل':'Customer Reference'}</label>
                    <input className="border rounded p-2 w-full" value={customerRef} onChange={e=>setCustomerRef(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'وسوم':'Tags'}</label>
                    <input className="border rounded p-2 w-full" value={tags} onChange={e=>setTags(e.target.value)} placeholder="VIP, B2B" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'الوضع الضريبي':'Fiscal Position'}</label>
                    <select className="border rounded p-2 w-full" value={fiscalPosition} onChange={e=>setFiscalPosition(e.target.value)}>
                      <option value="KSA">KSA</option>
                      <option value="GCC">GCC</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-white border rounded p-3 md:col-span-2">
                <div className="font-semibold mb-2 px-2 py-1 rounded bg-amber-50 text-amber-700">{lang==='ar'?'التسليم':'Delivery'}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">Incoterm?</label>
                    <select className="border rounded p-2 w-full" value={incoterm} onChange={e=>setIncoterm(e.target.value)}>
                      <option value="EXW">EXW</option>
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                      <option value="DDP">DDP</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Incoterm Location</label>
                    <input className="border rounded p-2 w-full" value={incotermLocation} onChange={e=>setIncotermLocation(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'سياسة الشحن':'Shipping Policy?'}</label>
                    <select className="border rounded p-2 w-full" value={shippingPolicy} onChange={e=>setShippingPolicy(e.target.value)}>
                      <option value="asap">As soon as possible</option>
                      <option value="on_date">On scheduled date</option>
                      <option value="available">When all products are available</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'تاريخ التسليم':'Delivery Date?'}</label>
                    <input type="datetime-local" className="border rounded p-2 w-full" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} />
                    <div className="text-xs text-gray-600 mt-1">Expected: {toHumanDateTime(deliveryDate)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'حالة التسليم':'Delivery Status'}</label>
                    <select className="border rounded p-2 w-full" value={deliveryStatus} onChange={e=>setDeliveryStatus(e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Tracking</label>
                    <input className="border rounded p-2 w-full" value={tracking} onChange={e=>setTracking(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Source Document?</label>
                    <input className="border rounded p-2 w-full" value={sourceDocument} onChange={e=>setSourceDocument(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Campaign?</label>
                    <input className="border rounded p-2 w-full" value={campaign} onChange={e=>setCampaign(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Medium?</label>
                    <input className="border rounded p-2 w-full" value={medium} onChange={e=>setMedium(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Source?</label>
                    <input className="border rounded p-2 w-full" value={source} onChange={e=>setSource(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Untaxed Amount</div>
            <div className="text-xl font-bold">{formatEn(totals.untaxed)} SR</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">VAT Taxes</div>
            <div className="text-xl font-bold">{formatEn(totals.vat)} SR</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-xl font-bold">{formatEn(totals.total)} SR</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Margin</div>
            <div className="text-xl font-bold">{formatEn(totals.margin)} SR</div>
          </div>
        </div>

        {pickerOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{lang==='ar'?'اختيار منتج':'Select a Product'}</div>
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={closeProductPicker}><FaTimes/></button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 bg-white border rounded px-2 flex-1">
                  <FaSearch className="text-gray-500" />
                  <input value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder={lang==='ar'?'بحث عن منتج':'Search product'} className="px-2 py-1 outline-none w-full" />
                </div>
                <button className="px-3 py-2 bg-gray-100 rounded-md" onClick={()=>navigate('/products')}>{lang==='ar'?'إضافة منتج جديد':'Add New Product'}</button>
              </div>
              {pickerError && (
                <div className="p-2 mb-2 text-sm rounded bg-red-50 text-red-700">
                  {lang==='ar'?'فشل الاتصال بالخادم. الرجاء تشغيل الخادم أو المحاولة لاحقًا.':'Failed to fetch from server. Please start backend or retry.'}
                </div>
              )}
              <div className="max-h-80 overflow-auto border rounded">
                {pickerLoading ? (
                  <div className="p-3 text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
                ) : (
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'المنتج':'Product'}</th>
                        <th className="p-2">UoM</th>
                        <th className="p-2">{lang==='ar'?'سعر البيع':'Sale Price'}</th>
                        <th className="p-2">{lang==='ar'?'تكلفة':'Cost'}</th>
                        <th className="p-2">{lang==='ar'?'إضافة':'Add'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(productItems||[]).filter(p=>{
                        const q = productQuery.trim().toLowerCase();
                        if (!q) return true; return (p.name||'').toLowerCase().includes(q)
                      }).map((p,i)=>(
                        <tr key={i} className="border-b">
                          <td className="p-2">{p.name}</td>
                          <td className="p-2">{p.uom||'Units'}</td>
                          <td className="p-2">{Number(p.sale_price||0).toLocaleString()}</td>
                          <td className="p-2">{Number(p.cost_price||0).toLocaleString()}</td>
                          <td className="p-2"><button className="px-2 py-1 bg-primary-600 text-white rounded" onClick={()=>selectProduct(p)}>{lang==='ar'?'إضافة':'Add'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {clientPickerOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{lang==='ar'?'اختيار عميل':'Select a Client'}</div>
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={closeClientPicker}><FaTimes/></button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 bg-white border rounded px-2 flex-1">
                  <FaSearch className="text-gray-500" />
                  <input value={clientQuery} onChange={e=>setClientQuery(e.target.value)} placeholder={lang==='ar'?'بحث عن عميل':'Search client'} className="px-2 py-1 outline-none w-full" />
                </div>
              </div>
              {clientError && (
                <div className="p-2 mb-2 text-sm rounded bg-red-50 text-red-700">
                  {lang==='ar'?'فشل الاتصال بالخادم. الرجاء تشغيل الخادم أو المحاولة لاحقًا.':'Failed to fetch from server. Please start backend or retry.'}
                </div>
              )}
              <div className="max-h-80 overflow-auto border rounded">
                {clientLoading ? (
                  <div className="p-3 text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
                ) : (
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'العميل':'Client'}</th>
                        <th className="p-2">{lang==='ar'?'السجل التجاري':'CR'}</th>
                        <th className="p-2">{lang==='ar'?'إضافة':'Select'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clients||[]).filter(c=>{
                        const q = clientQuery.trim().toLowerCase();
                        if (!q) return true; return (c.name||'').toLowerCase().includes(q)
                      }).map((c,i)=>(
                        <tr key={i} className="border-b">
                          <td className="p-2">{c.name}</td>
                          <td className="p-2">{c.tax_id||''}</td>
                          <td className="p-2"><button className="px-2 py-1 bg-primary-600 text-white rounded" onClick={()=>selectClient(c)}>{lang==='ar'?'اختيار':'Select'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {status!=='draft' && (
          <div className="bg-white border rounded p-4">
            <div className="font-semibold mb-2">{lang==='ar'?'النشاط':'Activity'}</div>
            <div className="space-y-2 text-sm text-gray-700">
              {activities.map((a,i)=>(<div key={i}>{new Date(a.date).toLocaleDateString()} • {a.text}</div>))}
              {activities.length===0 && (<div className="text-gray-500 text-sm">{lang==='ar'?'لا يوجد نشاط':'No activity'}</div>)}
            </div>
          </div>
        )}
      </main>
      {reportOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center" onClick={closeInvoiceReport}>
          <div className="bg-white rounded-lg border shadow-lg w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">{lang==='ar'?'تقرير فواتير الطلب':'Order Invoices Report'}</div>
              <button className="px-2 py-1 bg-gray-100 rounded" onClick={closeInvoiceReport}>{lang==='ar'?'إغلاق':'Close'}</button>
            </div>
            <div className="p-4">
              {reportLoading ? (
                <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
              ) : reportError ? (
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{lang==='ar'?'تعذر تحميل الفواتير':'Failed to load invoices'}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-50 border rounded p-3">
                      <div className="text-sm text-gray-600">{lang==='ar'?'عدد الفواتير':'Invoices Count'}</div>
                      <div className="text-xl font-bold">{(reportItems||[]).length}</div>
                    </div>
                    <div className="bg-gray-50 border rounded p-3">
                      <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي المبالغ':'Total Amount'}</div>
                      <div className="text-xl font-bold">{Number((reportItems||[]).reduce((s,i)=>s+Number(i.total||0),0)).toLocaleString()} SR</div>
                    </div>
                    <div className="bg-gray-50 border rounded p-3">
                      <div className="text-sm text-gray-600">{lang==='ar'?'آخر فاتورة':'Latest Invoice'}</div>
                      <div className="text-xl font-bold">{(reportItems[0]?.invoice_number)||'-'}</div>
                    </div>
                  </div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                        <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                        <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                        <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportItems||[]).map((inv)=> (
                        <tr key={inv.id} className="border-b">
                          <td className="p-2 font-medium">{inv.invoice_number}</td>
                          <td className="p-2 text-gray-600">{inv.date}</td>
                          <td className="p-2">{String(inv.status||'draft')}</td>
                          <td className="p-2">{Number(inv.total||0).toLocaleString()} SR</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    )
  )
}

 

function toInputDateTime(s){
  if (typeof s==='string'){
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`
  }
  try { return new Date().toISOString().slice(0,16) } catch { return '' }
}

 

function toHumanDateTime(s){
  if (typeof s==='string'){
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:00`
  }
  try {
    const d = new Date(s)
    const pad = n => String(n).padStart(2,'0')
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch { return '' }
}
 
