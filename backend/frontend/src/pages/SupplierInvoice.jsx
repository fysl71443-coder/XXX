import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partners, supplierInvoices, payments, products, settings as apiSettings, accounts } from '../services/api'
import { FaFileInvoice, FaCheckCircle, FaPrint, FaSave, FaTimes, FaExclamationTriangle } from 'react-icons/fa'
import PageHeader from '../components/PageHeader'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'
import { motion } from 'framer-motion'
import { sanitizeDecimal, format2 } from '../utils/number'

function toInputDate(d){ try { const dt = new Date(d); const iso = dt.toISOString(); return iso.slice(0,10) } catch { return new Date().toISOString().slice(0,10) } }
function addDays(dateStr, days){ try { const dt = new Date(dateStr||new Date().toISOString().slice(0,10)); dt.setDate(dt.getDate()+days); return dt.toISOString().slice(0,10) } catch { return '' } }
function generateTempNumber(){ try { const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0'); const t = String(now.getTime()).slice(-5); return `PI/${y}/${m}${d}${t}` } catch { return 'PI/AUTO' } }

 

export default function SupplierInvoice(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [invoiceNumber, setInvoiceNumber] = useState(()=>generateTempNumber())
  const [invoiceDate, setInvoiceDate] = useState(()=>toInputDate(new Date()))
  const [dueDate, setDueDate] = useState(()=>addDays(new Date().toISOString().slice(0,10), 30))
  const [status, setStatus] = useState('draft')
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [paidAmount, setPaidAmount] = useState('')
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [showJournal, setShowJournal] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [supplierInfo, setSupplierInfo] = useState({ due: 0, unpaidCount: 0, lastPayment: '', creditLimit: 0 })
  const [supplierProducts, setSupplierProducts] = useState([])
  const [lines, setLines] = useState([{ product: '', desc: '', qty: '', uom: 'Units', unit_price: '', row_discount_pct: '', tax: '0.15' }])
  const [toast, setToast] = useState('')
  const [createdId, setCreatedId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankAccountCode, setBankAccountCode] = useState('')
  const [bankAccounts, setBankAccounts] = useState([])
  const [hasDiscountAcc, setHasDiscountAcc] = useState(false)

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=> window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ try { const n = await supplierInvoices.nextNumber(); if (n && n.next) setInvoiceNumber(n.next) } catch {} })() },[])
  useEffect(()=>{ (async()=>{ try { const list = await partners.list({ type: 'supplier' }); const arr = Array.isArray(list) ? list : (list?.items||[]); setSuppliers(arr.filter(x => { const t=String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' })) } catch { setSuppliers([]) } })() },[])
  useEffect(()=>{ if (invoiceDate) setDueDate(addDays(invoiceDate, 30)) },[invoiceDate])
  useEffect(()=>{ (async()=>{ if (!supplierId) { setSupplierInfo({ due:0, unpaidCount:0, lastPayment:'', creditLimit:0 }); setSupplierProducts([]); return } try { const invs = await supplierInvoices.list({ partner_id: supplierId }); const arr = Array.isArray(invs) ? invs : (Array.isArray(invs?.items)?invs.items:[]); const due = arr.filter(r => String(r.status||'')!=='paid').reduce((s,r)=> s + Number(r.total||0), 0); const unpaid = arr.filter(r => String(r.status||'')!=='paid').length; let last = ''; try { const pay = await payments.list({ partner_id: supplierId }); const rows = Array.isArray(pay) ? pay : (Array.isArray(pay?.items)?pay.items:[]); last = (rows[0]?.date)||'' } catch {} const partner = suppliers.find(x => String(x.id)===String(supplierId))||{}; const creditLimit = Number(partner.credit_limit||0); setSupplierInfo({ due, unpaidCount: unpaid, lastPayment: last, creditLimit }); try { const prods = await products.list({ supplier_id: supplierId }); const list = Array.isArray(prods) ? prods : (Array.isArray(prods?.items)?prods.items:[]); setSupplierProducts(list) } catch { setSupplierProducts([]) } } catch { setSupplierInfo({ due:0, unpaidCount:0, lastPayment:'', creditLimit:0 }); setSupplierProducts([]) } })() },[supplierId, suppliers])
  useEffect(()=>{ (async()=>{ try { const tree = await accounts.tree(); function flat(nodes){ const out=[]; const walk=(arr)=>{ (arr||[]).forEach(n=>{ out.push(n); if (n.children) walk(n.children) }) }; walk(nodes||[]); return out } const all = flat(tree||[]); const banks = all.filter(a => String(a.type||'').toLowerCase()==='bank' || String(a.account_code||'').startsWith('101')); setBankAccounts(banks); const has = all.some(a => String(a.account_code||'')==='5119' || /خصم\s*مكتسب/i.test(String(a.name||'')) || /purchase\s*discount/i.test(String(a.name_en||''))); setHasDiscountAcc(has) } catch { setBankAccounts([]); setHasDiscountAcc(false) } })() },[])
  

  const totals = useMemo(()=>{
    const gross = lines.reduce((s,l)=> s + Number(l.qty||0) * Math.max(0, Number(l.unit_price||0)), 0)
    const discount = lines.reduce((s,l)=>{ const qty=Number(l.qty||0); const unit=Number(l.unit_price||0); const rpct=Math.min(Math.max(Number(l.row_discount_pct||0),0),100)/100; return s + qty * unit * rpct }, 0)
    const untaxed = Math.max(0, gross - discount)
    const vat = untaxed * 0.15
    const total = untaxed + vat
    return { gross, discount, untaxed, vat, total }
  },[lines])

  const paidEffective = (function(){
    const total = Number(totals.total||0)
    if (paymentStatus==='paid') return total
    if (paymentStatus==='partial') return Math.min(Number(paidAmount||0), total)
    return 0
  })()
  const remaining = Math.max(0, Number((totals.total||0)) - paidEffective)

  function setLine(i, patch){ setLines(prev => prev.map((l,idx)=> idx===i ? { ...l, ...patch } : l)) }
  function addLine(){ setLines(prev => [...prev, { product:'', desc:'', qty:'', uom:'Units', unit_price:'', row_discount_pct:'', tax:'0.15' }]) }
  function removeLine(i){ setLines(prev => prev.filter((_,idx)=> idx!==i)) }

  function priceDeviation(l){ if (!supplierId || !l.product || !Number(l.unit_price)) return false; return false }

  function saveDraft(){
    setStatus('draft')
    setToast(lang==='ar'?'تم الحفظ كمسودة':'Saved as draft')
  }
  async function approve(){
    setStatus('approved')
    setToast(lang==='ar'?'تم اعتماد الفاتورة':'Invoice approved')
  }

async function saveInvoice(printAfter=false){
    try {
      if (!supplierId) { setToast(lang==='ar'?'اختر المورد':'Select supplier'); return }
      if (!invoiceDate) { setToast(lang==='ar'?'أدخل التاريخ':'Enter date'); return }
      if (!lines.length || lines.some(l => Number(l.qty||0)<=0)) { setToast(lang==='ar'?'أدخل بنود صالحة':'Enter valid lines'); return }
      if (paymentStatus!=='unpaid' && !paymentMethod) { setToast(lang==='ar'?'اختر طريقة الدفع':'Select payment method'); return }
      if (paymentStatus!=='unpaid' && paymentMethod==='bank' && !bankAccountCode) { setToast(lang==='ar'?'اختر الحساب البنكي':'Select bank account'); return }
      if (paymentStatus==='partial' && !(Number(paidAmount||0)>0)) { setToast(lang==='ar'?'أدخل مبلغ السداد الجزئي':'Enter partial payment amount'); return }
      

      const payload = {
        partner_id: supplierId,
        invoice_number: invoiceNumber||'',
        date: invoiceDate,
        due_date: dueDate||'',
        status: status,
        payment_method: paymentMethod,
        payment_type: (paymentStatus==='unpaid' ? 'credit' : (paymentStatus==='partial' ? 'partial' : (paymentMethod||'').toLowerCase())),
        paid_amount: paymentStatus==='partial' ? paidEffective : 0,
        payment_account_code: paymentStatus==='unpaid' ? undefined : (paymentMethod==='bank' ? (bankAccountCode||undefined) : '1111'),
        bank_account_code: bankAccountCode||undefined,
        lines: lines.map(l => ({
          name: l.product||l.desc||'',
          product_id: l.product_id || undefined,
          qty: Number(l.qty||0),
          uom: l.uom||'Units',
          unit_price: Number(l.unit_price||0),
          discount: Number(l.unit_price||0) * (Math.min(Math.max(Number(l.row_discount_pct||0),0),100)/100),
          tax: 0.15
        }))
      }

      const created = await supplierInvoices.create(payload)
      setCreatedId(created?.id||null)
      setToast(lang==='ar'?'تم حفظ الفاتورة':'Invoice saved')
      if (printAfter) { await printInvoice() }
      navigate('/suppliers', { state: { openSupplierId: supplierId, highlightInvoiceId: created?.id } })
    } catch (e) {
      const code = e?.code || e?.response?.data?.error || 'request_failed'
      if (code==='payment_method_required') setToast(lang==='ar'?'طريقة الدفع مطلوبة':'Payment method required')
      else if (code==='payment_method_invalid') setToast(lang==='ar'?'طريقة دفع غير صالحة':'Invalid payment method')
      else if (code==='bank_account_required') setToast(lang==='ar'?'الحساب البنكي مطلوب':'Bank account required')
      else if (code==='partner_required') setToast(lang==='ar'?'المورد مطلوب':'Supplier required')
      else if (code==='date_required') setToast(lang==='ar'?'التاريخ مطلوب':'Date required')
      else if (code==='Unauthorized' || e?.status===401) setToast(lang==='ar'?'غير مصرح: يرجى تسجيل الدخول':'Unauthorized: please login')
      else setToast(lang==='ar'?'فشل حفظ الفاتورة':'Failed to save invoice')
    }
  }

  async function printInvoice(){
    try {
      const partner = suppliers.find(x => String(x.id)===String(supplierId))
      const name = partner?.name || ''
      const tax = partner?.tax_id || ''
      const header = { columns:[ { text: 'Supplier Invoice', alignment:'center', fontSize:14, bold:true }, { text: `No: ${invoiceNumber}`, alignment:'left', fontSize:10 }, { text: `Date: ${invoiceDate}`, alignment:'right', fontSize:10 } ], margin:[0,0,0,8] }
      const subHeader = { columns:[ { text: `Supplier: ${name}` }, { text: tax ? `VAT: ${tax}` : '' , alignment:'right' } ], margin:[0,0,0,8] }
      const body = [[{ text:'Description', bold:true }, { text:'Qty', bold:true, alignment:'center' }, { text:'Price', bold:true, alignment:'right' }, { text:'VAT', bold:true, alignment:'right' }, { text:'Total', bold:true, alignment:'right' }]]
      for (const l of lines){
        const qty = Number(l.qty||0)
        const rpct = Math.min(Math.max(Number(l.row_discount_pct||0),0),100)/100
        const unit = Math.max(0, Number(l.unit_price||0) - (Number(l.unit_price||0) * rpct))
        const untaxed = qty * unit
        const vat = untaxed * 0.15
        const totalLine = untaxed + vat
        body.push([ String(l.product||l.desc||''), String(qty), Number(unit).toFixed(2), Number(vat).toFixed(2), Number(totalLine).toFixed(2) ])
      }
      const docDef = {
        pageSize: 'A4', pageMargins: [36,36,36,36], defaultStyle: { fontSize: 10 },
        content: [ header, subHeader, { table:{ headerRows:1, widths:['*','auto','auto','auto','auto'], body }, layout:'lightHorizontalLines' },
          { columns:[ { text:'Subtotal', alignment:'right' }, { text: Number(totals.untaxed||0).toFixed(2)+' SAR', alignment:'right', width:120 } ], margin:[0,12,0,0] },
          { columns:[ { text:'VAT', alignment:'right' }, { text: Number(totals.vat||0).toFixed(2)+' SAR', alignment:'right', width:120 } ], margin:[0,4,0,0] },
          { columns:[ { text:'Total', alignment:'right', bold:true }, { text: Number(totals.total||0).toFixed(2)+' SAR', alignment:'right', width:120, bold:true } ], margin:[0,4,0,0] }
        ],
        footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left', fontSize:9 }, { text: new Date().toLocaleDateString('en-GB'), alignment:'right', fontSize:9 } ], margin:[36,0,36,0] })
      }
      const pdf = await createPDF(docDef)
      pdf.open()
    } catch {}
  }

  const outOfCredit = supplierInfo.creditLimit>0 && (supplierInfo.due + totals.total) > supplierInfo.creditLimit
  const statusColor = status==='paid' ? 'bg-green-100 text-green-700' : status==='partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
  const payColor = paymentStatus==='paid' ? 'bg-green-100 text-green-700' : paymentStatus==='partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FB' }} dir="rtl">
      <PageHeader
        icon={FaFileInvoice}
        title={lang==='ar'? 'إنشاء فاتورة مشتريات' : 'Create Purchases Invoice'}
        subtitle={lang==='ar'? 'إدارة فاتورة مشتريات مرتبطة بالمورد' : 'Manage supplier-linked purchase invoice'}
        onHomeClick={()=>navigate('/suppliers')}
        homeLabel={lang==='ar'?'الموردون':'Suppliers'}
        actions={[
          (<motion.button key="draft" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={saveDraft}><FaSave/> {lang==='ar'?'حفظ كمسودة':'Save Draft'}</motion.button>),
          (<motion.button key="print" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={()=>saveInvoice(true)}><FaPrint/> {lang==='ar'?'حفظ وطباعة':'Save & Print'}</motion.button>),
          (<motion.button key="cancel" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={()=>navigate(-1)}><FaTimes/> {lang==='ar'?'إلغاء':'Cancel'}</motion.button>),
        ]}
      />
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border shadow p-4 space-y-3">
              <div className="text-sm text-gray-600">{lang==='ar'?'رقم الفاتورة':'Invoice Number'}</div>
              <input className="border rounded p-2" value={invoiceNumber||''} onChange={e=>setInvoiceNumber(e.target.value)} />
              <div className="text-sm text-gray-600">{lang==='ar'?'تاريخ الفاتورة':'Invoice Date'}</div>
              <input type="date" className="border rounded p-2" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} />
              <div className="text-sm text-gray-600">{lang==='ar'?'تاريخ الاستحقاق':'Due Date'}</div>
              <input type="date" className="border rounded p-2" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
              <div className="text-sm text-gray-600">{lang==='ar'?'خصم % على الإجمالي الفرعي':'Discount % on subtotal'}</div>
              <input type="text" inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 bg-gray-100" value={String(discountPct||'0')} readOnly disabled />
              
              <div className="text-sm text-gray-600">{lang==='ar'?'حالة الفاتورة':'Status'}</div>
              <select className="border rounded p-2" value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="draft">{lang==='ar'?'مسودة':'Draft'}</option>
                <option value="posted">{lang==='ar'?'ترحيل':'Posted'}</option>
              </select>
            </div>
            <div className="bg-white rounded-xl border shadow p-4 space-y-3">
              <div className="text-sm text-gray-600">{lang==='ar'?'المورد':'Supplier'}</div>
              <select className="border rounded p-2" value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
                <option value="">{lang==='ar'?'اختر المورد':'Select Supplier'}</option>
                {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-600">{lang==='ar'?'طريقة الدفع':'Payment Method'}</div>
                <select className="border rounded p-2 w-full" value={paymentMethod} onChange={e=>{ setPaymentMethod(e.target.value); if (e.target.value!=='bank') setBankAccountCode('') }}>
                  <option value="">{lang==='ar'?'اختر':'Select'}</option>
                  <option value="cash">{lang==='ar'?'نقداً/الصندوق':'Cash/Register'}</option>
                  <option value="bank">{lang==='ar'?'البنك':'Bank'}</option>
                </select>
              </div>
              {paymentMethod==='bank' ? (
                <div>
                  <div className="text-sm text-gray-600">{lang==='ar'?'حساب بنكي':'Bank Account'}</div>
                  <select className="border rounded p-2 w-full" value={bankAccountCode} onChange={e=>setBankAccountCode(e.target.value)}>
                    <option value="">{lang==='ar'?'اختر الحساب':'Select Account'}</option>
                    {bankAccounts.map(b => (<option key={b.id||b.account_code} value={b.account_code}>{b.account_code} — {b.name||b.name_en||''}</option>))}
                  </select>
                </div>
              ) : null}
            </div>
            {supplierId ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-600">{lang==='ar'?'إجمالي المستحقات':'Total Outstanding'}</div>
                  <div className="font-semibold">{format2(supplierInfo.due||0)}</div>
                  </div>
                  <div className="border rounded p-2">
                    <div className="text-xs text-gray-600">{lang==='ar'?'فواتير غير مسددة':'Unpaid Invoices'}</div>
                    <div className="font-semibold">{supplierInfo.unpaidCount}</div>
                  </div>
                  <div className="border rounded p-2">
                    <div className="text-xs text-gray-600">{lang==='ar'?'آخر دفعة':'Last Payment'}</div>
                    <div className="font-semibold">{supplierInfo.lastPayment||'-'}</div>
                  </div>
                  <div className={`border rounded p-2 ${outOfCredit?'border-red-300':'border-gray-200'}`}>
                    <div className="text-xs text-gray-600">{lang==='ar'?'حد الائتمان':'Credit Limit'}</div>
                    <div className="font-semibold">{format2(supplierInfo.creditLimit||0)}</div>
                  </div>
                </div>
              ) : null}
              {outOfCredit ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50 text-red-700"><FaExclamationTriangle/> {lang==='ar'?'هذا المورد تجاوز حد الائتمان':'Supplier exceeded credit limit'}</div>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">{lang==='ar'?'بنود المشتريات':'Purchase Items'}</div>
              <div className="flex items-center gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-2 bg-primary-600 text-white rounded" onClick={addLine}>{lang==='ar'?'إضافة صف':'Add Row'}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-2 bg-gray-100 rounded" onClick={()=>saveInvoice(false)}>{lang==='ar'?'حفظ':'Save'}</motion.button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2">{lang==='ar'?'الصنف':'Item'}</th>
                    <th className="p-2">{lang==='ar'?'الوصف':'Description'}</th>
                    <th className="p-2">{lang==='ar'?'الكمية':'Qty'}</th>
                    <th className="p-2">{lang==='ar'?'السعر':'Price'}</th>
                    <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                    <th className="p-2">{lang==='ar'?'الضريبة':'Tax'}</th>
                    <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                    <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l,i)=>{
                    const unit = Math.max(0, Number(l.unit_price||0) - (Number(l.unit_price||0) * (Math.min(Math.max(Number(l.row_discount_pct||0),0),100)/100)))
                    const lineUntaxed = Number(l.qty||0) * unit
                    const lineVat = lineUntaxed * 0.15
                    const lineTotal = lineUntaxed + lineVat
                    const warn = priceDeviation(l)
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <select className="border rounded p-2 w-full" value={l.product} onChange={e=>{ const pid = e.target.value; const prod = supplierProducts.find(p=>String(p.id)===String(pid)); setLine(i, { product: prod?.name||'', unit_price: prod ? String(Number(prod.cost_price||0)) : l.unit_price, uom: prod?.purchase_uom||prod?.uom||l.uom||'Units' }) }}>
                            <option value="">{lang==='ar'?'اختياري':'Optional'}</option>
                            {supplierProducts.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                          </select>
                        </td>
                        <td className="p-2"><input className="border rounded p-2 w-full" value={l.desc} onChange={e=>setLine(i,{ desc: e.target.value })} /></td>
                        <td className="p-2"><input type="text" inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-full" value={l.qty} onChange={e=>setLine(i,{ qty: sanitizeDecimal(e.target.value) })} /></td>
                        <td className="p-2"><input type="text" inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-full" value={l.unit_price} onChange={e=>setLine(i,{ unit_price: sanitizeDecimal(e.target.value) })} /></td>
                        <td className="p-2"><input type="text" inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-full" placeholder={lang==='ar'?'% الخصم':'Discount %'} value={l.row_discount_pct} onChange={e=>setLine(i,{ row_discount_pct: sanitizeDecimal(e.target.value) })} /></td>
                        <td className="p-2"><input type="text" lang="en" dir="ltr" className="border rounded p-2 w-full bg-gray-100" value={'15%'} readOnly disabled /></td>
                        <td className="p-2">{format2(lineTotal||0)}</td>
                        <td className="p-2">
                          <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={()=>removeLine(i)}>{lang==='ar'?'حذف':'Delete'}</button>
                          {warn ? (<span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">{lang==='ar'?'سعر مختلف':'Price deviation'}</span>) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        <aside className="lg:col-span-4 space-y-4">
          <div className={`px-4 py-2 rounded ${toast ? 'bg-yellow-50 text-yellow-700' : ''}`}>{toast}</div>
          <div className="bg-white rounded-xl border shadow p-4 space-y-3">
            <div className="text-sm text-gray-600">{lang==='ar'?'ملخص مالي':'Financial Summary'}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الإجمالي قبل الخصم':'Gross (pre-discount)'}</div>
                <div className="font-semibold">{format2(totals.gross||0)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الخصم':'Discount'}</div>
                <div className="font-semibold">{format2(totals.discount||0)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الصافي قبل الضريبة':'Net (untaxed)'}</div>
                <div className="font-semibold">{format2(totals.untaxed||0)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الضريبة 15%':'VAT 15%'}</div>
                <div className="font-semibold">{format2(totals.vat||0)}</div>
              </div>
              <div className="border rounded p-2 col-span-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الإجمالي':'Total'}</div>
                <div className="font-semibold">{format2(totals.total||0)}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow p-4 space-y-3">
            <div className="text-sm text-gray-600">{lang==='ar'?'حالة الدفع':'Payment Status'}</div>
            <select className="border rounded p-2" value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}>
              <option value="unpaid">{lang==='ar'?'غير مدفوعة':'Unpaid'}</option>
              <option value="partial">{lang==='ar'?'مدفوعة جزئياً':'Partially Paid'}</option>
              <option value="paid">{lang==='ar'?'مدفوعة بالكامل':'Fully Paid'}</option>
            </select>
            {paymentStatus==='partial' && (
              <div>
                <div className="text-sm text-gray-600">{lang==='ar'?'المبلغ المدفوع':'Paid Amount'}</div>
                <input type="text" inputMode="decimal" lang="en" dir="ltr" className="border rounded p-2 w-full" value={String(paidAmountInput ?? paidAmount ?? '')} onChange={e=>{ const raw = sanitizeDecimal(e.target.value); setPaidAmountInput(raw) }} onBlur={()=>{ const raw = String(paidAmountInput||paidAmount||''); const v = Number(raw||0); const clamped = Math.min(Math.max(0, v), Number(totals.total||0)); const next = raw==='' ? '' : sanitizeDecimal(String(clamped)); setPaidAmount(next); setPaidAmountInput(undefined) }} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600">{lang==='ar'?'الإجمالي':'Total'}</div>
                <div className="font-semibold">{format2(totals.total||0)} SAR</div>
              </div>
              <div className="border rounded p-2 bg-green-50 text-green-700">
                <div className="text-xs">{lang==='ar'?'المدفوع':'Paid'}</div>
                <div className="font-semibold">{format2(paidEffective||0)} SAR</div>
              </div>
              <div className="border rounded p-2 bg-amber-50 text-amber-700">
                <div className="text-xs">{lang==='ar'?'المتبقي':'Remaining'}</div>
                <div className="font-semibold">{format2(remaining||0)} SAR</div>
              </div>
            </div>
            <div className={`px-3 py-2 rounded ${payColor}`}>{lang==='ar'?'حالة السداد':'Payment Status'}: {paymentStatus}</div>
          </div>
          <div className="bg-white rounded-xl border shadow p-4 space-y-3">
            <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setShowJournal(v=>!v)}>{showJournal ? (lang==='ar'?'إخفاء المعاينة':'Hide Preview') : (lang==='ar'?'المعاينة المحاسبية':'Accounting Preview')}</button>
            {showJournal && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="font-semibold">{lang==='ar'?'قيد الفاتورة':'Invoice Entry'}</div>
                {(() => { const gross = lines.reduce((s,l)=> s + Number(l.qty||0) * Math.max(0, Number(l.unit_price||0)), 0); return (
                  <>
                    <div>من ح/ المشتريات: {format2(gross||0)} SAR</div>
                    {Number(totals.discount||0)>0 ? (<div>إلى ح/ الخصم المكتسب: {format2(totals.discount||0)} SAR</div>) : null}
                    <div>من ح/ ضريبة مدخلة: {format2(totals.vat||0)} SAR</div>
                    <div>إلى ح/ الموردين: {format2(totals.total||0)} SAR</div>
                  </>
                ) })()}
                {(paymentStatus==='partial' || paymentStatus==='paid') && (
                  <>
                    <div className="font-semibold mt-2">{lang==='ar'?'قيد السداد':'Payment Entry'}</div>
                    <div>من ح/ الموردين: {format2(paidEffective||0)} SAR</div>
                    <div>إلى ح/ النقدية/البنك: {format2(paidEffective||0)} SAR</div>
                  </>
                )}
                {Number(totals.discount||0)>0 && !hasDiscountAcc && (
                  <div className="mt-2">
                    <button className="px-2 py-1 bg-amber-100 text-amber-800 rounded" onClick={async()=>{ try { await accounts.create({ name: 'خصم مكتسب', name_en: 'Purchase Discount Earned', type: 'expense', parent_code: '5110', account_code: '5119' }); setHasDiscountAcc(true); setToast(lang==='ar'?'تم إنشاء حساب الخصم المكتسب':'Discount account created') } catch { setToast(lang==='ar'?'فشل إنشاء حساب الخصم':'Failed to create discount account') } }}>{lang==='ar'?'إنشاء حساب الخصم المكتسب':'Create Discount Account'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}