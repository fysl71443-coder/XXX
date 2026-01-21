import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners as apiPartners, products as apiProducts, invoices as apiInvoices } from '../services/api'
import { print } from '@/printing'
import { createPDF } from '../utils/pdfUtils'

export default function Sales(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [branch, setBranch] = useState('place_india')
  const [customerName, setCustomerName] = useState('')
  const [specialDiscountPct, setSpecialDiscountPct] = useState('')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustDisc, setNewCustDisc] = useState('0')
  const [newCustAddr, setNewCustAddr] = useState('')
  const [newCustPayment, setNewCustPayment] = useState('نقدي')

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=> window.removeEventListener('storage', onStorage) },[])

  useEffect(()=>{ setLoadingProducts(true); apiProducts.list().then(list=>{ const arr = Array.isArray(list)?list:[]; setProducts(arr.map(p=>({ id: p.id||p.product_id||p.code||p.sku||p.name, name: p.name, price_before_tax: Number(p.sale_price||p.price||0) }))) }).catch(()=>setProducts([])).finally(()=>setLoadingProducts(false)) },[])
  useEffect(()=>{ 
    setLoadingInvoices(true); 
    apiInvoices.list({ type: 'sale' })
      .then(r=>{ 
        const items = r?.items || r || [];
        // Sort by date descending and limit to recent 50
        const sorted = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 50);
        setInvoices(sorted);
      })
      .catch(()=>setInvoices([]))
      .finally(()=>setLoadingInvoices(false)) 
  },[])

  useEffect(()=>{ updateSpecialDiscountVisibility() }, [customerName, specialDiscountPct])

  function addItem(){ const next = { product_id: 0, quantity: 1, price_before_tax: 0, tax_amount: 0, discount: 0, total_price: 0 }; setItems(prev=>[...prev, next]) }
  function removeItem(idx){ setItems(prev=> prev.filter((_,i)=> i!==idx)) }
  function updateItem(idx, patch){ setItems(prev=> prev.map((it,i)=> i===idx ? { ...it, ...(typeof patch==='function'?patch(it):patch) } : it )) }

  function recalc(idx){ setItems(prev=> prev.map((it,i)=>{ if (i!==idx) return it; const prod = products.find(p=> String(p.id)===String(it.product_id)); const baseUnit = Number(prod?.price_before_tax||0); const qty = Number(it.quantity||0); const price = baseUnit * qty; const rowDiscPct = Number(it.discount||0)||0; const discVal = price * (rowDiscPct/100); const taxable = price - discVal - (Number(specialDiscountPct||0)>0 ? price*(Number(specialDiscountPct)/100) : 0); const tax = taxable * 0.15; const total = taxable + tax; return { ...it, price_before_tax: price, tax_amount: tax, total_price: total } })) }

  function isSpecialDiscountVisible(){ const nm = String(customerName||'').trim().toUpperCase(); const dv = parseFloat(specialDiscountPct||'0')||0; return nm==='KEETA' || nm==='HUNGER' || dv>0 }
  function updateSpecialDiscountVisibility(){ const v = isSpecialDiscountVisible(); const el = document.getElementById('special-discount-row'); if (el) el.style.display = v ? '' : 'none'; if (!v) setSpecialDiscountPct('') }

  async function submitForm(){ try {
      if (!customerName || items.length===0 || items.some(it=> Number(it.quantity||0)<=0)) { alert(lang==='ar'?'يرجى إدخال عميل وبنود صحيحة':'Please enter a customer and valid items'); return }
      let partnerId = 0
      try { const list = await apiPartners.list(); const found = (Array.isArray(list)?list:[]).find(p=> String(p.name||'').trim().toLowerCase()===String(customerName||'').trim().toLowerCase()); if (found) partnerId = Number(found.id||0) } catch {}
      if (!partnerId) {
        try {
          const nm = String(customerName||'').trim()
          const paymentTerm = newCustPayment==='نقدي' ? 'Immediate' : '30d'
          const customerType = newCustPayment==='نقدي' ? 'cash_registered' : 'credit'
          const phoneRaw = String(newCustPhone||'').trim()
          const phoneDigits = phoneRaw.replace(/\D/g, '')
          const addr = String(newCustAddr||'').trim()
          const disc = parseFloat(newCustDisc||0)
          if (customerType==='credit') {
            if (!phoneDigits || phoneDigits.length < 8 || /^0+$/.test(phoneDigits)) { alert(lang==='ar'?'رقم هاتف غير صالح لعميل آجل':'Invalid phone for credit customer'); return }
            if (!addr || String(addr).toUpperCase()==='NULL') { alert(lang==='ar'?'العنوان مطلوب لعميل آجل':'Address required for credit customer'); return }
          }
          if (!isFinite(disc) || disc < 0 || disc > 100) { alert(lang==='ar'?'نسبة الخصم يجب أن تكون بين 0 و 100':'Discount % must be between 0 and 100'); return }
          const payload = {
            name: nm,
            type: 'customer',
            phone: phoneRaw,
            addr_description: String(newCustAddr||'').trim(),
            payment_term: paymentTerm,
            discount_rate: Number(newCustDisc||0),
            contact_info: { discount_pct: Number(newCustDisc||0) },
            customer_type: customerType
          }
          const c = await apiPartners.create(payload)
          partnerId = Number(c?.id||c?.customer?.id||0)
        } catch {}
      }
      if (!partnerId) { alert(lang==='ar'?'تعذر تحديد العميل':'Failed to resolve customer'); return }
      const untaxed = items.reduce((s,it)=> s + Number(it.price_before_tax||0), 0)
      const tax = items.reduce((s,it)=> s + Number(it.tax_amount||0), 0)
      const total = items.reduce((s,it)=> s + Number(it.total_price||0), 0)
      await apiInvoices.create({ partner_id: partnerId, type: 'sale', branch, date: new Date(date).toISOString(), total, tax, status: 'open', payment_method: String(paymentMethod||'').toLowerCase() })
      alert(lang==='ar'?'تم إنشاء الفاتورة':'Invoice created')
      navigate('/orders')
    } catch (e) { alert(lang==='ar'?'فشل إنشاء الفاتورة':'Failed to create invoice') }
  }

  async function printOrder(){ const rows = items.filter(it=> Number(it.quantity||0)>0 && (it.product_id || it.price_before_tax || it.total_price)); const now = new Date(); const dt = now.toLocaleDateString() + ' ' + now.toLocaleTimeString(); const hdr = 'PRINT ORDER / طباعة الطلب'; const doc = await createPDF({ orientation:'p', unit:'pt', format:'a4', lang }); let y = 40; doc.setFontSize(16); doc.safeText(hdr, 40, y); y+=24; doc.setFontSize(11); doc.safeText(dt, 40, y); y+=16; doc.setDrawColor(200); doc.line(40, y+2, doc.internal.pageSize.getWidth()-40, y+2); y+=12; doc.setFontSize(12); rows.forEach(it=>{ const prod = products.find(p=> String(p.id)===String(it.product_id)); const name = prod ? prod.name : ''; const qty = Number(it.quantity||0); const unit = Number(it.price_before_tax||0)/Math.max(1,qty); const disc = Number(it.discount||0) * (unit*qty) / 100; const tax = Number(it.tax_amount||0); const total = Number(it.total_price||0); doc.safeText(String(name||''), 40, y); doc.safeText(qty.toFixed(2), 300, y, { align: 'right' }); doc.safeText(unit.toFixed(2), 360, y, { align: 'right' }); doc.safeText(disc.toFixed(2), 450, y, { align: 'right' }); doc.safeText(tax.toFixed(2), 520, y, { align: 'right' }); doc.safeText(total.toFixed(2), 580, y, { align: 'right' }); y+=16 }); y+=8; const subtotal = rows.reduce((s,it)=> s + ((Number(it.price_before_tax||0))), 0); const discTotal = rows.reduce((s,it)=> s + ((Number(it.discount||0)||0) * (Number(it.price_before_tax||0)) / 100), 0); const taxTotal = rows.reduce((s,it)=> s + Number(it.tax_amount||0), 0); const grand = rows.reduce((s,it)=> s + Number(it.total_price||0), 0); doc.setFontSize(12); doc.safeText('Subtotal', 40, y); doc.safeText(subtotal.toFixed(2), 580, y, { align:'right' }); y+=16; doc.safeText('Discount', 40, y); doc.safeText(discTotal.toFixed(2), 580, y, { align:'right' }); y+=16; doc.safeText('Tax', 40, y); doc.safeText(taxTotal.toFixed(2), 580, y, { align:'right' }); y+=16; doc.safeText('Grand Total', 40, y); doc.safeText(grand.toFixed(2), 580, y, { align:'right' }); print({ type:'pdf', template:'adapter', data:{ adapter: doc }, autoPrint: true }) }

  const totals = useMemo(()=>{ const untaxed = items.reduce((s,it)=> s + Number(it.price_before_tax||0), 0); const tax = items.reduce((s,it)=> s + Number(it.tax_amount||0), 0); const total = items.reduce((s,it)=> s + Number(it.total_price||0), 0); return { untaxed, tax, total } }, [items])

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold">💰 {lang==='ar'?'المبيعات':'Sales'}</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded" onClick={()=>navigate('/products')}>📦 {lang==='ar'?'المخزون':'Inventory'}</button>
            <button className="px-3 py-2 border rounded" onClick={()=>navigate('/products/purchase-orders')}>🛒 {lang==='ar'?'المشتريات':'Purchases'}</button>
            <button className="px-3 py-2 border rounded" onClick={()=>navigate('/')}>🏠 {lang==='ar'?'الرئيسية':'Dashboard'}</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="font-semibold mb-3">{lang==='ar'?'إنشاء فاتورة جديدة':'Create New Invoice'}</h5>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-3 text-sm">
            <b>💡 {lang==='ar'?'ملاحظة':'Note'}:</b> {lang==='ar'?'الوجبات يتم تحميلها تلقائياً من نظام إدارة التكاليف مع الأسعار المحسوبة':'Meals are automatically loaded from Cost Management system with calculated prices'}
            <button className="ml-2 underline" onClick={()=>navigate('/products')}>{lang==='ar'?'إدارة الوجبات':'Manage Meals'}</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-sm text-gray-600">{lang==='ar'?'التاريخ':'Date'}</label>
              <input type="date" className="border rounded p-2 w-full" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">{lang==='ar'?'طريقة الدفع':'Payment Method'}</label>
              <select className="border rounded p-2 w-full" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                <option value="cash">{lang==='ar'?'نقداً':'Cash'}</option>
                <option value="card">{lang==='ar'?'بطاقة':'Card'}</option>
                <option value="bank_transfer">{lang==='ar'?'تحويل بنكي':'Bank Transfer'}</option>
                <option value="check">{lang==='ar'?'شيك':'Check'}</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">{lang==='ar'?'الفرع':'Branch'}</label>
              <select className="border rounded p-2 w-full" value={branch} onChange={e=>setBranch(e.target.value)}>
                <option value="place_india">Place India</option>
                <option value="china_town">China Town</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">{lang==='ar'?'العميل':'Customer'}</label>
              <input className="border rounded p-2 w-full" value={customerName} onChange={e=>setCustomerName(e.target.value)} />
              <div className="mt-1"><button type="button" className="px-2 py-1 border rounded text-sm" onClick={()=>{ setAddCustomerOpen(true); setNewCustName(''); setNewCustPhone(''); setNewCustDisc('0') }}>➕ {lang==='ar'?'عميل جديد':'New Customer'}</button></div>
            </div>
          </div>

          <div id="special-discount-row" className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3" style={{ display: 'none' }}>
            <div>
              <label className="text-sm text-gray-600">{lang==='ar'?'نسبة خصم العميل':'Customer Discount %'}</label>
              <input className="border rounded p-2 w-full" value={specialDiscountPct} onChange={e=>setSpecialDiscountPct(e.target.value)} placeholder={lang==='ar'?'أدخل نسبة الخصم':'Enter customer discount %'} />
              <div className="text-xs text-gray-500">{lang==='ar'?'تطبق على كل العناصر عند وجود خصم عميل':'Applied to all items when a customer-specific discount is set.'}</div>
            </div>
          </div>

          <h6 className="font-semibold mb-2">{lang==='ar'?'عناصر الفاتورة (الوجبات الجاهزة)':'Invoice Items (Ready Meals)'}</h6>
          <div className="space-y-2">
            {items.map((it, idx)=> (
              <div key={idx} className="grid grid-cols-12 gap-2 border rounded p-3 bg-gray-50">
                <div className="col-span-12 md:col-span-3">
                  <label className="text-sm text-gray-600">{lang==='ar'?'الوجبة':'Meal'}</label>
                  <select className="border rounded p-2 w-full" value={it.product_id} onChange={e=>{ updateItem(idx, { product_id: e.target.value }); recalc(idx) }}>
                    <option value={0}>{lang==='ar'?'اختر الوجبة':'Select Meal'}</option>
                    {products.map(m=> (<option key={m.id} value={m.id}>{m.name}</option>))}
                  </select>
                </div>
                <div className="col-span-6 md:col-span-1">
                  <label className="text-sm text-gray-600">{lang==='ar'?'الكمية':'Quantity'}</label>
                  <input type="number" className="border rounded p-2 w-full" value={it.quantity} onChange={e=>{ updateItem(idx, { quantity: Number(e.target.value||0) }); recalc(idx) }} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-sm text-gray-600">{lang==='ar'?'السعر':'Price'}</label>
                  <input className="border rounded p-2 w-full" readOnly value={Number(it.price_before_tax||0).toFixed(2)} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-sm text-gray-600">{lang==='ar'?'الضريبة':'Tax'}</label>
                  <input className="border rounded p-2 w-full" readOnly value={Number(it.tax_amount||0).toFixed(2)} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-sm text-gray-600">{lang==='ar'?'الخصم':'Discount'}</label>
                  <input type="number" step="0.01" className="border rounded p-2 w-full" value={it.discount} onChange={e=>{ updateItem(idx, { discount: Number(e.target.value||0) }); recalc(idx) }} />
                </div>
                <div className="col-span-6 md:col-span-1">
                  <label className="text-sm text-gray-600">{lang==='ar'?'الإجمالي':'Total'}</label>
                  <input className="border rounded p-2 w-full" readOnly value={Number(it.total_price||0).toFixed(2)} />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-end">
                  <button type="button" className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={()=>removeItem(idx)}>−</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button type="button" className="px-3 py-2 border rounded" onClick={addItem}>➕ {lang==='ar'?'إضافة وجبة':'Add Meal'}</button>
              <button type="button" className="px-3 py-2 border rounded" onClick={printOrder}>PRINT ORDER-طباعة الطلب</button>
            </div>
            <div>
              <button type="button" className="px-4 py-2 bg-primary-600 text-white rounded" onClick={submitForm}>{lang==='ar'?'حفظ وإنشاء':'Save'}</button>
            </div>
          </div>
        </div>

        {invoices.length>0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h5 className="font-semibold mb-3">{lang==='ar'?'الفواتير السابقة':'Previous Invoices'}</h5>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No'}</th>
                    <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                    <th className="p-2">{lang==='ar'?'الفرع':'Branch'}</th>
                    <th className="p-2">{lang==='ar'?'العميل':'Customer'}</th>
                    <th className="p-2">{lang==='ar'?'طريقة الدفع':'Payment Method'}</th>
                    <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                    <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                    <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                    <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv)=>{
                    const status = String(inv.status||'open').toLowerCase()
                    const badge = status==='paid' ? 'bg-green-100 text-green-700' : (status==='partial' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-800')
                    const invBranch = String(inv.branch || branch || '').toLowerCase().replace(/\s+/g, '_')
                    const branchLabel = invBranch==='place_india' || invBranch==='palace_india' ? 'Place India' : invBranch==='china_town' ? 'China Town' : (invBranch||'-')
                    const branchBadge = invBranch==='place_india' || invBranch==='palace_india' ? 'bg-blue-300 text-white' : 'bg-pink-300 text-white'
                    const discount = Number(inv.discount_amount || inv.discount_total || 0)
                    const paymentLabel = (function(){
                      const pm = String(inv.payment_method||'').toLowerCase()
                      if (pm==='cash') return lang==='ar'?'نقدي':'Cash'
                      if (pm==='card') return lang==='ar'?'بطاقة':'Card'
                      if (pm==='bank' || pm==='bank_transfer') return lang==='ar'?'تحويل':'Transfer'
                      if (pm==='credit') return lang==='ar'?'آجل':'Credit'
                      if (pm==='multi' || pm==='multiple') return lang==='ar'?'متعدد':'Multi'
                      return '-'
                    })()
                    return (
                      <tr key={inv.id} className="border-b">
                        <td className="p-2 font-semibold">{inv.invoice_number}</td>
                        <td className="p-2">{String(inv.date||'').slice(0,10)}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${branchBadge}`}>{branchLabel}</span></td>
                        <td className="p-2">{inv.partner?.name || (lang==='ar'?'عميل نقدي':'Walk-in')}</td>
                        <td className="p-2">{paymentLabel}</td>
                        <td className="p-2">{discount > 0 ? discount.toFixed(2) : '-'}</td>
                        <td className="p-2">{Number(inv.total||0).toFixed(2)}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${badge}`}>{status==='paid'?(lang==='ar'?'مدفوع':'Paid'):status==='partial'?(lang==='ar'?'جزئي':'Partial'):(lang==='ar'?'غير مدفوع':'Unpaid')}</span></td>
                        <td className="p-2">
                          <button className="px-2 py-1 bg-blue-100 text-blue-700 rounded mr-1" onClick={()=> window.open(`/api/preview/invoice/${inv.id}?currency=SAR&symbol=${encodeURIComponent('﷼')}`,'_blank')}>👁 {lang==='ar'?'عرض':'View'}</button>
                          <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={()=> alert('Delete disabled')}>🗑️ {lang==='ar'?'حذف':'Delete'}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {addCustomerOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-md">
              <div className="px-4 py-3 border-b flex items-center justify-between"><div className="font-semibold">{lang==='ar'?'إضافة عميل':'Add Customer'}</div><button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setAddCustomerOpen(false)}>×</button></div>
              <div className="p-4 space-y-2">
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'الاسم':'Name'}</label>
                  <input className="border rounded p-2 w-full" value={newCustName} onChange={e=>setNewCustName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'الهاتف':'Phone'}</label>
                  <input className="border rounded p-2 w-full" value={newCustPhone} onChange={e=>setNewCustPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'العنوان':'Address'}</label>
                  <textarea rows={2} className="border rounded p-2 w-full" value={newCustAddr} onChange={e=>setNewCustAddr(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'طريقة الدفع':'Payment Terms'}</label>
                  <select className="border rounded p-2 w-full" value={newCustPayment} onChange={e=>setNewCustPayment(e.target.value)}>
                    <option value="نقدي">{lang==='ar'?'نقدي':'Cash'}</option>
                    <option value="آجل">{lang==='ar'?'آجل':'Credit'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">{lang==='ar'?'نسبة الخصم':'Discount %'}</label>
                  <input type="number" step="0.01" className="border rounded p-2 w-full" value={newCustDisc} onChange={e=>setNewCustDisc(e.target.value)} />
                </div>
              </div>
              <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setAddCustomerOpen(false)}>{lang==='ar'?'إغلاق':'Close'}</button>
                <button className="px-2 py-1 bg-primary-600 text-white rounded" onClick={async()=>{
                  const nm = newCustName.trim(); if (!nm) { alert(lang==='ar'?'الاسم مطلوب':'Name is required'); return }
                  const paymentTerm = newCustPayment==='نقدي' ? 'Immediate' : '30d'
                  const customerType = newCustPayment==='نقدي' ? 'cash_registered' : 'credit'
                  const phoneRaw = newCustPhone.trim()
                  const phoneDigits = phoneRaw.replace(/\D/g,'')
                  const addr = newCustAddr.trim()
                  const disc = parseFloat(newCustDisc||0)
                  if (customerType==='credit') {
                    if (!phoneDigits || phoneDigits.length < 8 || /^0+$/.test(phoneDigits)) { alert(lang==='ar'?'رقم هاتف غير صالح لعميل آجل':'Invalid phone for credit customer'); return }
                    if (!addr || String(addr).toUpperCase()==='NULL') { alert(lang==='ar'?'العنوان مطلوب لعميل آجل':'Address required for credit customer'); return }
                  }
                  if (!isFinite(disc) || disc < 0 || disc > 100) { alert(lang==='ar'?'نسبة الخصم يجب أن تكون بين 0 و 100':'Discount % must be between 0 and 100'); return }
                  try {
                    const payload = { name: nm, type: 'customer', phone: phoneRaw, addr_description: addr, payment_term: paymentTerm, discount_rate: Number(newCustDisc||0), contact_info: { discount_pct: Number(newCustDisc||0) }, customer_type: customerType }
                    const res = await apiPartners.create(payload)
                    setCustomerName(res?.name || nm)
                    setSpecialDiscountPct(String(parseFloat(newCustDisc||'0')||0))
                    setAddCustomerOpen(false)
                  } catch (e) {
                    const code = e?.code||''; if (code==='validation_failed') alert(lang==='ar'?'تحقق من البيانات':'Validate the form'); else if (code==='duplicate') alert(lang==='ar'?'بيانات مكررة: الاسم أو الهاتف موجود':'Duplicate data: name or phone exists'); else if (code==='Unauthorized' || e?.status===401) alert(lang==='ar'?'غير مصرح: يرجى تسجيل الدخول':'Unauthorized: please login'); else alert(lang==='ar'?'فشل في الحفظ':'Save failed')
                  }
                }}>{lang==='ar'?'حفظ':'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}