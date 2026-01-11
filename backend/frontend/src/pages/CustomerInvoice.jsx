import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { invoices, audit as apiAudit, settings as apiSettings, partners as apiPartners } from '../services/api'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'
import Button from '../ui/Button'
import FormField from '../ui/FormField'

export default function CustomerInvoice(){
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [toast, setToast] = useState('')
  const fromOrder = location.state?.fromOrder || {}
  const [customer, setCustomer] = useState(fromOrder.customer || '')
  const [address, setAddress] = useState(fromOrder.address || '')
  const [country] = useState('')
  const [taxId] = useState(fromOrder.tax_id || '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(fromOrder.paymentTerms || '30d')
  const [deliveryDate, setDeliveryDate] = useState(()=>toInputDate(fromOrder.deliveryDate || new Date().toLocaleDateString()))
  const [lines] = useState(fromOrder.lines || [])
  const [status, setStatus] = useState('draft')
  const [createdInvoiceId, setCreatedInvoiceId] = useState(null)
  const poNumber = fromOrder.poNumber || ''
  const [partnerId, setPartnerId] = useState('')
  const [partners, setPartners] = useState([])

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    ;(async ()=>{
      try {
        const n = await invoices.nextNumber()
        if (n && n.next) setInvoiceNumber(n.next)
      } catch {}
    })()
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{
    (async()=>{
      try {
        const list = await apiPartners.list({ type: 'customer' })
        setPartners(Array.isArray(list)?list:[])
      } catch { setPartners([]) }
    })()
  },[])

  const totals = useMemo(()=>{
    const untaxed = lines.reduce((s,l)=> s + l.qty*l.unit_price, 0)
    const vat = untaxed * 0.15
    const total = untaxed + vat
    return { untaxed, vat, total }
  },[lines])

  function saveDraft(){
    setStatus('draft')
    setToast(lang==='ar'?'تم الحفظ كمسودة':'Saved as draft')
  }

  async function issueInvoice(){
    setStatus('issued')
    const ref = invoiceNumber || ''
    setPaymentRef(ref)
    try {
      if (!invoiceDate) throw new Error('date_required')
      const pid = partnerId ? Number(partnerId) : (fromOrder.customer_id || null)
      const pm = pid ? 'credit' : ''
      const payload = { invoice_number: ref, date: invoiceDate, partner_id: pid, order_id: fromOrder.order_id || null, customer, address, tax_id: taxId, payment_terms: paymentTerms, delivery_date: deliveryDate, lines, total: totals.total, tax: totals.vat, status: 'issued', payment_method: pm }
      const created = await invoices.create(payload)
      setCreatedInvoiceId(created?.id || null)
      apiAudit.log({ type: 'invoice_issue', invoice_id: created?.id, number: ref, at: new Date().toISOString() })
      setToast(lang==='ar'?'تم إصدار الفاتورة':'Invoice issued')
      navigate('/clients', { state: { issuedInvoice: created } })
    } catch {
      setToast(lang==='ar'?'فشل حفظ الفاتورة على الخادم':'Failed to save invoice to server')
    }
  }

  async function cancelInvoice(){
    try {
      if (createdInvoiceId) { await invoices.remove(createdInvoiceId) }
    } catch {}
    navigate(-1)
  }

  async function printInvoice(){
    if (!createdInvoiceId) { alert(lang==='ar'? 'يرجى حفظ الفاتورة أولاً' : 'Please save the invoice first'); return }
    const url = `/print/invoice.html?id=${encodeURIComponent(createdInvoiceId)}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'فاتورة عميل':'Customer Invoice'}</h2>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{invoiceNumber}</span>
            {fromOrder.number ? (
              <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">{lang==='ar'?'مرتبطة بطلب':'Linked to Order'} {fromOrder.number}</span>
            ) : null}
            <span className={`px-2 py-1 rounded text-xs ${status==='issued'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{status==='issued'?(lang==='ar'?'صادرة':'Issued'):(lang==='ar'?'مسودة':'Draft')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={()=>navigate(-1)}>{lang==='ar'?'رجوع':'Back'}</Button>
            <Button variant="secondary" onClick={()=>navigate('/products/sales-orders')}>{lang==='ar'?'الطلبات':'Orders'}</Button>
            <Button variant="danger" onClick={cancelInvoice}>{lang==='ar'?'إلغاء الفاتورة':'Cancel Invoice'}</Button>
            <Button variant="primary" disabled={!invoiceDate} onClick={issueInvoice}>{lang==='ar'?'إصدار فاتورة':'Issue Invoice'}</Button>
            <Button variant="ghost" onClick={printInvoice}>{lang==='ar'?'طباعة الفاتورة':'Print Invoice'}</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-white border rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold mb-2 px-2 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'معلومات العميل':'Customer Information'}</div>
              <label className="block text-xs text-gray-600 mb-1">{lang==='ar'?'اختر عميلًا مسجلًا':'Select Registered Customer'}</label>
              <select className="w-full border rounded px-2 py-1 mb-2" value={partnerId} onChange={e=>{ const v=e.target.value; setPartnerId(v); const p=partners.find(x=>String(x.id)===String(v)); setCustomer(p?.name||''); }}>
                <option value="">{lang==='ar'?'بدون اختيار':'None'}</option>
                {partners.map(p=> (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <FormField
                label={lang==='ar'?'العميل':'Customer'}
                required
                value={customer}
                onChange={e=>setCustomer(e.target.value)}
                validate={v=>!String(v||'').trim() ? (lang==='ar'?'الاسم مطلوب':'Name required') : ''}
              />
              <div className="text-xs text-gray-600 mt-1">{taxId}</div>
              <div className="mt-2">
                <FormField
                  label={lang==='ar'?'العنوان':'Address'}
                  type="textarea"
                  value={address}
                  onChange={e=>setAddress(e.target.value)}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">{country}</div>
              {poNumber ? (<div className="text-xs text-gray-600 mt-1">{lang==='ar'?'رقم طلب الشراء':'PO Number'}: {poNumber}</div>) : null}
            </div>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <FormField
                    label={lang==='ar'?'تاريخ الفاتورة':'Invoice Date'}
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e=>setInvoiceDate(e.target.value)}
                    validate={v=>!String(v||'').trim() ? (lang==='ar'?'التاريخ مطلوب':'Date required') : ''}
                  />
                </div>
                <div>
                  <FormField
                    label={lang==='ar'?'مرجع الدفع':'Payment Reference'}
                    value={paymentRef}
                    onChange={e=>setPaymentRef(e.target.value)}
                  />
                </div>
                <div>
                  <FormField
                    label={lang==='ar'?'شروط الدفع':'Payment Terms'}
                    type="select"
                    value={paymentTerms}
                    onChange={e=>setPaymentTerms(e.target.value)}
                  >
                    <option value="Immediate">{lang==='ar'?'فوري':'Immediate'}</option>
                    <option value="15d">15 {lang==='ar'?'يوم':'days'}</option>
                    <option value="30d">30 {lang==='ar'?'يوم':'days'}</option>
                    <option value="60d">60 {lang==='ar'?'يوم':'days'}</option>
                    <option value="90d">90 {lang==='ar'?'يوم':'days'}</option>
                  </FormField>
                </div>
                <div>
                  <FormField
                    label={lang==='ar'?'تاريخ التسليم':'Delivery Date'}
                    type="date"
                    value={deliveryDate}
                    onChange={e=>setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <button className="px-3 py-1 rounded-full text-sm bg-primary-600 text-white">{lang==='ar'?'بنود الفاتورة':'Invoice Lines'}</button>
            <button className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">{lang==='ar'?'معلومات أخرى':'Other Info'}</button>
            <button className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">{lang==='ar'?'الضرائب':'Taxes'}</button>
          </div>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">Product</th>
                <th className="p-2">Qty</th>
                <th className="p-2">UoM</th>
                <th className="p-2">Unit Price</th>
                <th className="p-2">Tax</th>
                <th className="p-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">
                    <div className="text-sm font-medium">{l.product}</div>
                    <div className="text-xs text-gray-600">{l.desc}</div>
                  </td>
                  <td className="p-2">{formatEn(l.qty)}</td>
                  <td className="p-2">{l.uom}</td>
                  <td className="p-2">{formatEn(l.unit_price)}</td>
                  <td className="p-2">{formatEn(l.qty*l.unit_price*0.15)}</td>
                  <td className="p-2">{formatEn(l.qty*l.unit_price)} SR</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <div className="text-sm text-gray-600">Amount Due</div>
            <div className="text-xl font-bold">{formatEn(totals.total)} SR</div>
          </div>
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-lg px-4 py-2 rounded-lg" onAnimationEnd={() => setToast('')}>{toast}</div>
      )}
    </div>
  )
}

function toInputDate(s){
  if (typeof s==='string'){
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
  }
  try { return new Date().toISOString().slice(0,10) } catch { return '' }
}

function formatEn(n){
  try { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n||0)) } catch { return String(n||0) }
}
