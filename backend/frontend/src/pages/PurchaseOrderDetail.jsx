import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FaFileInvoice, FaTrash, FaSearch, FaPrint } from 'react-icons/fa'
import { products as apiProducts, partners as apiPartners, purchaseOrders as apiPO, supplierInvoices as apiSupInv, invoices as apiInvoices, payments as apiPayments, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'

export default function PurchaseOrderDetail(){
  const navigate = useNavigate()
  const { id } = useParams()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [po, setPo] = useState(null)
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState(()=>new Date().toISOString().slice(0,16))
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('draft')
  const [activeTab, setActiveTab] = useState('lines')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [productItems, setProductItems] = useState([])
  const [productQuery, setProductQuery] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [clientLoading, setClientLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierInvNumber, setSupplierInvNumber] = useState('')
  const [toast, setToast] = useState('')
  const [supplierDetails, setSupplierDetails] = useState(null)
  const [activities, setActivities] = useState([])

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=> window.removeEventListener('storage', onStorage) },[])

  useEffect(()=>{
    let mounted = true
    async function load(){
      try {
        const res = await apiPO.get(id)
        const data = res || {}
        if (!mounted) return
        setPo({ id: data.id || Number(id), order_number: data.order_number || String(id) })
        setSupplierId(data.partner_id || '')
        setSupplierName((data.partner && data.partner.name) || '')
        setSupplierInvNumber(String(data.supplier_invoice_number||''))
        try { setOrderDate((data.date||new Date().toISOString()).slice(0,16)) } catch { setOrderDate(new Date().toISOString().slice(0,16)) }
        const lns = (data.lines||[]).map((l,i)=>({ sl: i+1, product: l.product||l.name||'', desc: l.product||l.name||'', qty: Number(l.qty||l.quantity||1), uom: l.uom||l.unit||'Units', unit_price: Number(l.unit_price||l.price||0), tax: Number(l.tax||0.15), cost: Number(l.cost||0), locked: false }))
        setLines(lns)
        setStatus(String(data.status||'draft'))
      } catch {
        setPo({ id: Number(id), order_number: String(id) })
        setStatus('draft')
      }
    }
    load(); return ()=>{ mounted = false }
  },[id])

  useEffect(()=>{
    return ()=>{
      if (status==='draft' && !supplierId && po?.id){ apiPO.remove(po.id).catch(()=>{}) }
    }
  },[status, supplierId, po])

  

  

  async function openProductPicker(){
    setPickerOpen(true)
    if (productItems.length===0){
      setPickerLoading(true)
      try {
        const params = supplierId ? { supplier_id: supplierId } : {}
        const items = await apiProducts.list(params)
        setProductItems(items)
      } catch { setProductItems([]) } finally { setPickerLoading(false) }
    }
  }
  function closeProductPicker(){ setPickerOpen(false); setProductQuery('') }

  async function openSupplierPicker(){
    setClientPickerOpen(true)
    if (suppliers.length===0){
      setClientLoading(true)
      try { const items = await apiPartners.list(); setSuppliers(items.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' })) } catch { setSuppliers([]) } finally { setClientLoading(false) }
    }
  }
  function closeSupplierPicker(){ setClientPickerOpen(false); setSupplierQuery('') }

  function selectSupplier(s){ setSupplierId(s.id); setSupplierName(s.name||''); closeSupplierPicker(); scheduleSave() }

  function selectProduct(p){
    const nextSl = (lines.length ? Math.max(...lines.map(x=>x.sl)) : 0) + 1
    const taxRate = getTaxRate(p)
    const defaultUom = (p.product_type==='Service') ? 'Hours' : (p.purchase_uom || p.uom || 'Units')
    const unitPrice = Number(p.cost_price||p.sale_price||0)
    const newLine = { sl: nextSl, product: p.name, desc: p.name, qty: 1, uom: defaultUom, unit_price: unitPrice, tax: taxRate, cost: Number(p.cost_price||0), locked: false }
    setLines([...lines, newLine])
    closeProductPicker()
  }

  function removeLine(sl){ const target = lines.find(x=>x.sl===sl); if (!target || target.locked) return; const updated = lines.filter(x=>x.sl!==sl).map((x,i)=>({ ...x, sl: i+1 })); setLines(updated) }

  const saveTimer = useRef(null)
  function scheduleSave(){ if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(savePO, 400) }
  function updateLine(sl, patch){ setLines(lines.map(x=>x.sl===sl?{...x, ...(typeof patch==='function'?patch(x):patch)}:x)); scheduleSave() }

  function getTaxRate(p){ const v = p.vat_rate || p.tax_rate || 0.15; return typeof v==='number' ? (v>1?v/100:v) : 0.15 }

  useEffect(()=>{ (async ()=>{ if (!supplierId) { setSupplierDetails(null); return } try { const items = await apiPartners.list(); const s = (items||[]).find(x=>String(x.id)===String(supplierId)); setSupplierDetails(s||null) } catch { setSupplierDetails(null) } })() },[supplierId])

  async function savePO(){
    // REMOVED: Admin check - can() function already has admin bypass
    // if (!can('purchase_orders:write')) return
    try {
      if (!po?.id) return
      const requireValidLines = (status==='ready' || status==='issued')
      if (requireValidLines && (!supplierId || !lines.length || lines.some(l=>Number(l.qty||0)<=0))) { 
        setToast(lang==='ar'?'يرجى اختيار مورد وإضافة بنود صالحة':'Please select a supplier and add valid lines')
        return 
      }
      const payload = { partner_id: supplierId, date: orderDate.slice(0,10), status, lines, supplier_invoice_number: supplierInvNumber?.trim() || null }
      await apiPO.update(po.id, payload)
    } catch {}
  }

  const totals = useMemo(()=>{
    const untaxed = lines.reduce((s,l)=> s + l.qty*l.unit_price, 0)
    const vat = untaxed * 0.15
    const totalAmount = untaxed + vat
    return { untaxed, vat, total: totalAmount }
  },[lines])

  async function createSupplierInvoice(){
    if (!po?.id || !supplierId || !lines.length || !supplierInvNumber.trim()) { setToast(lang==='ar'?'يرجى إدخال رقم فاتورة المورد مع البنود':'Enter supplier invoice number with valid lines'); return }
    const invLines = lines.map(l => ({ product: l.product, qty: l.qty, uom: l.uom, unit_price: l.unit_price, tax: l.tax }))
    const created = await apiSupInv.create({ partner_id: supplierId, order_id: po.id, supplier_invoice_number: supplierInvNumber.trim(), date: new Date().toISOString().slice(0,10), status: 'issued', lines: invLines })
    setToast(lang==='ar'?'تم إنشاء فاتورة المورد':'Supplier invoice created')
    navigate('/suppliers', { state: { openSupplierId: supplierId, highlightInvoiceId: created?.id } })
  }

  const finalized = ['invoiced','cancelled'].includes(String(status||'').toLowerCase())
  useEffect(()=>{
    (async()=>{
      const pid = supplierId
      const dt = String(orderDate||'').slice(0,10)
      if (!pid || !dt || String(status||'')==='draft') { setActivities([]); return }
      try {
        const invs = await apiInvoices.list({ partner_id: pid, type: 'purchase', from: dt })
        const pays = await apiPayments.list({ partner_id: pid, from: dt })
        const invItems = (invs?.items||invs||[]).map(x=>({ date: x.date, text: `${lang==='ar'?'فاتورة شراء':'Supplier Invoice'} ${x.invoice_number||x.id} ${x.status||''}` }))
        const payItems = (pays?.items||pays||[]).map(p=>({ date: p.date, text: `${lang==='ar'?'دفعة':'Payment'} ${Number(p.amount||0).toFixed(2)} ${lang==='ar'?'ريال':'SR'} ${p.invoice?.invoice_number? (lang==='ar'?'لفاتورة':'for invoice')+` ${p.invoice.invoice_number}` : ''}` }))
        const base = [{ date: dt, text: (lang==='ar'?'تم إنشاء طلب الشراء':'Purchase Order created') }]
        const merged = [...base, ...invItems, ...payItems].filter(x=>!!x.date)
        merged.sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
        setActivities(merged)
      } catch { setActivities([{ date: dt, text: (lang==='ar'?'تم إنشاء طلب الشراء':'Purchase Order created') }]) }
    })()
  },[supplierId, orderDate, status, lang])

  function formatEn(n){ try { return parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) } catch { return '0.00' } }

  async function printOrder(){
    const url = `/print/purchase-order.html?id=${encodeURIComponent(id)}`
    window.open(url, '_blank')
    return
    let companyName = ''
    let companyEn = ''
    let companyCR = '—'
    let companyVAT = '—'
    let companyAddr = ''
    let logo = ''
    try {
      const company = await apiSettings.get('settings_company')
      const branding = await apiSettings.get('settings_branding')
      if (branding?.logo) logo = branding.logo
      companyName = (company?.name_ar || company?.name_en || '').trim()
      companyEn = (company?.name_en || '').trim()
      companyCR = company?.cr_number ? `CR: ${company.cr_number}` : '—'
      companyVAT = company?.vat_number ? `VAT: ${company.vat_number}` : '—'
      companyAddr = (company?.address || '').trim()
    } catch {}

    const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 36
    let currentY = 50

    // Logo removed per request

    doc.setFontSize(12)
    doc.safeText(companyEn, margin, currentY)
    doc.safeText(companyName, pageW - margin, currentY, { align: 'right' })
    doc.setFontSize(10)
    doc.safeText(companyCR, margin, currentY + 18)
    doc.safeText(companyVAT, margin, currentY + 32)
    if (companyAddr) doc.safeText(companyAddr, margin, currentY + 46)
    doc.setDrawColor(200)
    doc.line(margin, currentY + 60, pageW - margin, currentY + 60)

    const headerBottom = currentY + 86
    doc.setFontSize(14)
    const title = lang==='ar' ? 'طلب شراء' : 'Purchase Order'
    if (lang==='ar') {
        doc.safeText(title, pageW - margin, headerBottom, { align: 'right' })
    } else {
        doc.safeText(title, margin, headerBottom)
    }
    
    doc.setFontSize(12)
    const midX = pageW/2
    
    doc.safeText(`${po.order_number || String(id)}`, midX, headerBottom, { align: 'center' })

    const infoY = headerBottom + 24
    doc.setFontSize(10)
    
    const dStr = orderDate ? String(orderDate).slice(0,10) : new Date().toISOString().slice(0,10)
    if (lang==='ar') {
        doc.safeText(`التاريخ: ${dStr}`, pageW - margin, infoY, { align: 'right' })
    } else {
        doc.safeText(`Date: ${dStr}`, margin, infoY)
    }
    
    // Supplier Info
    const supName = supplierDetails?.name || supplierName || ''
    const supTax = supplierDetails?.tax_id || ''
    const supAddr = (supplierDetails?.addr_description || supplierDetails?.billing_address || [supplierDetails?.addr_country, supplierDetails?.addr_city].filter(Boolean).join(' - ')) || ''
    
    if (lang==='ar') {
        doc.safeText(`المورد: ${supName}`, pageW - margin, infoY + 16, { align: 'right' })
        if (supAddr) doc.safeText(supAddr, pageW - margin, infoY + 32, { align: 'right' })
        if (supTax) doc.safeText(`الرقم الضريبي: ${supTax}`, pageW - margin, infoY + 48, { align: 'right' })
    } else {
        doc.safeText(`Supplier: ${supName}`, margin, infoY + 16)
        if (supAddr) doc.safeText(supAddr, margin, infoY + 32)
        if (supTax) doc.safeText(`VAT: ${supTax}`, margin, infoY + 48)
    }

    doc.setDrawColor(200)
    doc.line(margin, infoY + 64, pageW - margin, infoY + 64)
    const startY = infoY + 80

    // Table Header
    doc.setFillColor(245, 247, 250)
    doc.rect(margin, startY, pageW - 2*margin, 24, 'F')
    doc.setTextColor(0)
    doc.setFontSize(10)
    
    if (lang==='ar') {
        doc.safeText('المنتج', pageW - margin - 10, startY + 16, { align: 'right' })
        doc.safeText('الكمية', 400, startY + 16, { align: 'right' })
        doc.safeText('السعر', 300, startY + 16, { align: 'right' })
        doc.safeText('الإجمالي', 200, startY + 16, { align: 'right' })
    } else {
        doc.safeText('Product', margin + 10, startY + 16)
        doc.safeText('Qty', 300, startY + 16)
        doc.safeText('Price', 380, startY + 16)
        doc.safeText('Total', 480, startY + 16)
    }

    let y = startY + 40
    lines.forEach(l => {
        const qty = Number(l.qty||0)
        const unit = Number(l.unit_price||0)
        const totalLine = qty * unit
        doc.setFontSize(10)
        
        // Product Name (wrapped)
        const prodName = String(l.product||l.desc||'')
        const splitTitle = doc.splitTextToSize(prodName, 220)
        
        if (lang==='ar') {
            doc.safeText(splitTitle, pageW - margin - 10, y, { align: 'right' })
            doc.safeText(String(qty), 400, y, { align: 'right' })
            doc.safeText(formatEn(unit), 300, y, { align: 'right' })
            doc.safeText(formatEn(totalLine), 200, y, { align: 'right' })
        } else {
            doc.safeText(splitTitle, margin + 10, y)
            doc.safeText(String(qty), 300, y)
            doc.safeText(formatEn(unit), 380, y)
            doc.safeText(formatEn(totalLine), 480, y)
        }
        
        y += (splitTitle.length * 14) + 10
        
        doc.setDrawColor(240)
        doc.line(margin, y - 5, pageW - margin, y - 5)
        
        if (y > 750) { 
            doc.addPage(); 
            y = 60 
        }
    })

    y += 24
    
    if (lang==='ar') {
       doc.safeText(`الإجمالي قبل الضريبة: ${formatEn(totals.untaxed)}`, 200, y, { align: 'right' })
       y += 16
       doc.safeText(`ضريبة القيمة المضافة (15%): ${formatEn(totals.vat)}`, 200, y, { align: 'right' })
       y += 16
       doc.setFontSize(12)
       doc.safeText(`الإجمالي الكلي: ${formatEn(totals.total)}`, 200, y, { align: 'right' })
    } else {
       doc.safeText(`Total Untaxed: ${formatEn(totals.untaxed)}`, 480, y)
       y += 16
       doc.safeText(`VAT (15%): ${formatEn(totals.vat)}`, 480, y)
       y += 16
       doc.setFontSize(12)
       doc.safeText(`Grand Total: ${formatEn(totals.total)}`, 480, y)
    }

    print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
  }

  return (
    !po ? (
      <div className="min-h-screen bg-gray-50" dir="rtl"><main className="max-w-7xl mx-auto px-6 py-6"><div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div></main></div>
    ) : (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'طلبات الشراء':'Purchase Orders'}</h2>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{po?.order_number || String(id)}</span>
            <span className={`px-2 py-1 rounded text-xs ${status==='draft'?'bg-yellow-100 text-yellow-700':status==='in_progress'?'bg-blue-100 text-blue-700':status==='ready'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-700'}`}>{
              status==='draft'?(lang==='ar'?'مسودة':'Draft'):
              status==='in_progress'?(lang==='ar'?'قيد التنفيذ':'In Progress'):
              status==='ready'?(lang==='ar'?'جاهز للفوترة':'Ready to Invoice'):
              (lang==='ar'?'غير معروف':'Unknown')
            }</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={printOrder}><FaPrint/> {lang==='ar'?'طباعة':'Print'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>navigate('/products/purchase-orders')}>{lang==='ar'?'طلبات الشراء':'Purchase Orders'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={async()=>{ setStatus('draft'); await savePO(); navigate('/products/purchase-orders') }}>{lang==='ar'?'حفظ كمسودة':'Save as Draft'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>{ setStatus('in_progress'); scheduleSave() }}>{lang==='ar'?'إبقاء الطلب مفتوح':'Keep Open'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={async()=>{ if (!supplierId || !lines.length || lines.some(l=>Number(l.qty||0)<=0)) { setToast(lang==='ar'?'يرجى اختيار مورد وإضافة بنود صالحة':'Please select a supplier and add valid lines'); return } setStatus('ready'); await savePO(); navigate('/products/purchase-orders') }}>{lang==='ar'?'جاهز للفوترة':'Ready to Invoice'}</button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={async()=>{ if (!supplierId || !lines.length || lines.some(l=>Number(l.qty||0)<=0)) { setToast(lang==='ar'?'يرجى اختيار مورد وإضافة بنود صالحة':'Please select a supplier and add valid lines'); return } setStatus('ready'); await savePO(); navigate('/products/purchase-orders') }}>{lang==='ar'?'حفظ الآن':'Save Now'}</button>
            <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md" onClick={()=>{ if (po?.id && lines.length===0){ apiPO.remove(po.id).catch(()=>{}) } setPo(null); navigate('/products/purchase-orders') }}>{lang==='ar'?'إلغاء الطلب':'Cancel Order'}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-white border rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold mb-2 px-2 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'معلومات المورد':'Supplier Information'}</div>
              <div className="flex items-center justify-between">
                <div className="text-sm space-y-1">
                  <div className="font-medium">{supplierDetails?.name || supplierName || ''}</div>
                  {supplierDetails?.tax_id ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'الرقم الضريبي':'VAT'}: {supplierDetails.tax_id}</div>
                  ) : null}
                  {(supplierDetails?.supplier_type==='Individual' && supplierDetails?.national_id) ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'رقم الهوية':'National ID'}: {supplierDetails.national_id}</div>
                  ) : (supplierDetails?.cr_number ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'السجل التجاري':'CR'}: {supplierDetails.cr_number}</div>
                  ) : null)}
                  {(supplierDetails?.phone || supplierDetails?.mobile) ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'الهاتف':'Phone'}: {supplierDetails.phone || supplierDetails.mobile}</div>
                  ) : null}
                  {supplierDetails?.email ? (
                    <div className="text-xs text-gray-600">Email: {supplierDetails.email}</div>
                  ) : null}
                  {(supplierDetails?.addr_description || supplierDetails?.billing_address || supplierDetails?.addr_country || supplierDetails?.addr_city || supplierDetails?.addr_district || supplierDetails?.addr_street) ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'العنوان':'Address'}: {(supplierDetails.addr_description || supplierDetails.billing_address || [supplierDetails.addr_country, supplierDetails.addr_city, supplierDetails.addr_district, supplierDetails.addr_street].filter(Boolean).join(' - '))}</div>
                  ) : null}
                  {supplierDetails?.payment_term ? (
                    <div className="text-xs text-gray-600">{lang==='ar'?'شرط الدفع':'Payment Term'}: {supplierDetails.payment_term}</div>
                  ) : null}
                </div>
                <button className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" disabled={finalized} onClick={openSupplierPicker}>{lang==='ar'?'تغيير المورد':'Change Supplier'}</button>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2 px-2 py-1 rounded bg-amber-50 text-amber-700">{lang==='ar'?'بيانات الطلب':'Order Data'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'تاريخ الطلب':'Order Date'}</label>
                  <input type="datetime-local" className="border rounded p-2 w-full" disabled={finalized} value={orderDate} onChange={e=>{ setOrderDate(e.target.value); scheduleSave() }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='lines'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('lines')}>{lang==='ar'?'بنود الطلب':'Order Lines'}</button>
            <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='other'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setActiveTab('other')}>{lang==='ar'?'معلومات أخرى':'Other Info'}</button>
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
              {lines.map((l,i)=> (
                <tr key={i} className="border-b">
                  <td className="p-2">{l.sl}</td>
                  <td className="p-2">
                    <div className="text-sm font-medium">{l.product}</div>
                    <div className="text-xs text-gray-600">{l.desc}</div>
                  </td>
                  <td className="p-2">{formatEn(Number(l.tax||0)*100)}%</td>
                  <td className="p-2">
                    <input type="number" inputMode="decimal" lang="en" dir="ltr" step={l.uom==='Units'?1:'0.01'} min="0" className="border rounded p-1 w-24" value={String(l.qty_input ?? l.qty ?? '')} onChange={e=>{
                      const raw = e.target.value; const n = parseFloat(raw); updateLine(l.sl, prev => ({ qty_input: raw, qty: isNaN(n)?prev.qty:n }))
                    }} onBlur={()=>{ updateLine(l.sl, { qty_input: undefined }) }} />
                    <div className="text-xs text-gray-500 mt-1">{l.uom==='Hours'?(lang==='ar'?'ساعات':'Hours'):l.uom==='Days'?(lang==='ar'?'أيام':'Days'):(lang==='ar'?'وحدات':'Units')}</div>
                  </td>
                  <td className="p-2">
                    <select className="border rounded p-1" value={l.uom} onChange={e=>{ const v=e.target.value; setLines(lines.map(x=>x.sl===l.sl?{...x,uom:v}:x)) }}>
                      <option value="Units">Units</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </td>
                  <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" min="0" className="border rounded p-1 w-24" value={String(l.unit_price_input ?? l.unit_price ?? '')} onChange={e=>{
                    const raw=e.target.value; const n=parseFloat(raw); updateLine(l.sl, prev=>({ unit_price_input: raw, unit_price: isNaN(n)?prev.unit_price:n }))
                  }} onBlur={()=>{ updateLine(l.sl, { unit_price_input: undefined }) }} /></td>
                  <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" min="0" className="border rounded p-1 w-24" value={String(l.cost_input ?? l.cost ?? '')} onChange={e=>{
                    const raw=e.target.value; const n=parseFloat(raw); updateLine(l.sl, prev=>({ cost_input: raw, cost: isNaN(n)?prev.cost:n }))
                  }} onBlur={()=>{ updateLine(l.sl, { cost_input: undefined }) }} /></td>
                  <td className="p-2">
                    <button className="px-2 py-1 rounded bg-red-100 text-red-700" onClick={()=>removeLine(l.sl)}><FaTrash/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 mt-3">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={openProductPicker}>{lang==='ar'?'إضافة منتج':'Add a product'}</button>
          </div>
          </>)}
          {activeTab==='other' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border rounded p-3">
                <div className="font-semibold mb-2 px-2 py-1 rounded bg-indigo-50 text-indigo-700">{lang==='ar'?'الفوترة':'Invoicing'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'إجمالي بدون ضريبة':'Untaxed'}</label>
                    <div className="border rounded p-2">{formatEn(totals.untaxed)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">VAT</label>
                    <div className="border rounded p-2">{formatEn(totals.vat)}</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-600">{lang==='ar'?'الإجمالي':'Total'}</label>
                    <div className="border rounded p-2">{formatEn(totals.total)}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="font-semibold mb-2 px-2 py-1 rounded bg-indigo-50 text-indigo-700">{lang==='ar'?'بيانات الفاتورة':'Invoice Data'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-sm text-gray-600">{lang==='ar'?'رقم فاتورة المورد':'Supplier Invoice Number'}</label>
                    <input className="border rounded p-2 w-full" value={supplierInvNumber} onChange={e=>{ setSupplierInvNumber(e.target.value); scheduleSave() }} />
                  </div>
                  <div>
                    <button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center gap-2" onClick={createSupplierInvoice}><FaFileInvoice/>{lang==='ar'?'إنشاء فاتورة شراء':'Create Supplier Invoice'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {pickerOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{lang==='ar'?'اختيار منتج':'Select Product'}</div>
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={closeProductPicker}>×</button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <FaSearch className="text-gray-500" />
                <input className="border rounded p-2 flex-1" placeholder={lang==='ar'?'بحث':'Search'} value={productQuery} onChange={e=>setProductQuery(e.target.value)} />
              </div>
              {pickerLoading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : (
                <div className="max-h-80 overflow-y-auto">
                  {(productItems||[]).filter(p=>(`${p.name} ${p.category}`).toLowerCase().includes((productQuery||'').toLowerCase())).map(p=> (
                    <div key={p.id} className="p-2 border-b hover:bg-gray-50 cursor-pointer" onClick={()=>selectProduct(p)}>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-gray-600">{p.product_type==='Service'?(lang==='ar'?'خدمة':'Service'):(lang==='ar'?'منتج':'Product')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {clientPickerOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{lang==='ar'?'اختيار مورد':'Select Supplier'}</div>
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={closeSupplierPicker}>×</button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <FaSearch className="text-gray-500" />
                <input className="border rounded p-2 flex-1" placeholder={lang==='ar'?'بحث':'Search'} value={supplierQuery} onChange={e=>setSupplierQuery(e.target.value)} />
              </div>
              {clientLoading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : (
                <div className="max-h-80 overflow-y-auto">
                  {(suppliers||[]).filter(s=>(`${s.name} ${s.tax_id} ${s.cr_number}`).toLowerCase().includes((supplierQuery||'').toLowerCase())).map(s=> (
                    <div key={s.id} className="p-2 border-b hover:bg-gray-50 cursor-pointer" onClick={()=>selectSupplier(s)}>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-gray-600">{s.tax_id||''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
      {status!=='draft' && (
        <div className="max-w-7xl mx-auto px-6 pb-6">
          <div className="bg-white border rounded p-4">
            <div className="font-semibold mb-2">{lang==='ar'?'النشاط':'Activity'}</div>
            <div className="space-y-2 text-sm text-gray-700">
              {activities.map((a,i)=>(<div key={i}>{new Date(a.date).toLocaleDateString()} • {a.text}</div>))}
              {activities.length===0 && (<div className="text-gray-500 text-sm">{lang==='ar'?'لا يوجد نشاط':'No activity'}</div>)}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-lg px-4 py-2 rounded-lg" onAnimationEnd={() => setToast('')}>{toast}</div>
      )}
    </div>
    )
  )
}

function formatEn(n){ try { return parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) } catch { return '0.00' } }
 
