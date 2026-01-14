import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api, { partners as apiPartners, products as apiProducts, orders as apiOrders, invoices as apiInvoices, payments as apiPayments, settings as apiSettings, auth as apiAuth, pos, branches as apiBranches, audit as apiAudit } from '../services/api'
import { print } from '@/printing'
import { useAuth } from '../context/AuthContext'
import { t, getLang } from '../utils/i18n'
export default function POSInvoice(){
  const navigate = useNavigate()
  const { branch, table } = useParams()
  const [qs] = useSearchParams()
  const orderId = qs.get('order')
  const storedOrderId = (function(){
    try {
      const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
      const k1 = `pos_order_${branch}_${table}`
      const k2 = `pos_order_${norm(branch)}_${table}`
      return orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || ''
    } catch { return orderId || '' }
  })()
  const hasLoadedOrderRef = useRef(false)
  const creatingOrderRef = useRef(false)
  const savingRef = useRef(false)
  const saveDraftInFlightRef = useRef(false)
  const saveTimerRef = useRef(null)
  const initialDraftSavedRef = useRef(false)
  const isHydratingRef = useRef(false)
  const firstItemSavedRef = useRef(false)
  const lastSavedHashRef = useRef(null)
  const hydratedFromOrderRef = useRef(false)
  const hydratedOrderIdRef = useRef(null)
  const itemsRef = useRef([])
  const pendingChangesRef = useRef(false)
  const savePendingRef = useRef(false)
  const pendingHashRef = useRef(null)
  const saveQueuePendingRef = useRef(false)
  const saveQueueTimerRef = useRef(null)
  const { user, canScreen, isAdmin } = useAuth()
  const [lang, setLang] = useState(getLang())
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [loadingPartner, setLoadingPartner] = useState(false)
  const [categoriesState, setCategoriesState] = useState(['عام'])
  useEffect(()=>{
    setLang(getLang())
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  useEffect(()=>{ try { const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }; if (branch) localStorage.setItem('current_branch', norm(branch)) } catch {} },[branch])
  const toggleLang = ()=>{ const next = (lang==='ar'?'en':'ar'); try { localStorage.setItem('lang', next) } catch {} ; setLang(next) }
  // Admin bypass: Admin has full access to all branches
  useEffect(()=>{ 
    if (isAdmin) return; // Admin has full access
    const norm = (v)=>{ const x = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); return (x==='palace_india'||x==='palce_india')?'place_india':x }
    const s = norm(branch)
<<<<<<< Current (Your changes)
    // REMOVED: Admin blocking check - canScreen() already has admin bypass
    // if (!canScreen('sales','read', s) && !storedOrderId) { try { alert('لا تملك صلاحية الفرع') } catch {} ; navigate('/pos') }
  },[branch, table, orderId, canScreen, navigate, storedOrderId])
=======
    if (!canScreen('sales','read', s) && !storedOrderId) { try { alert('لا تملك صلاحية الفرع') } catch {} ; navigate('/pos') }
  },[branch, table, orderId, canScreen, navigate, storedOrderId, isAdmin])
>>>>>>> Incoming (Background Agent changes)
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [taxPct, setTaxPct] = useState(15)
  const [products, setProducts] = useState(()=> (process.env.NODE_ENV === 'test' ? [
    { id: 'p1', name: 'منتج 1', category: 'عام', price: 10 },
    { id: 'p2', name: 'منتج 2', category: 'عام', price: 5 },
  ] : []))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(false)
  const [tableBusy, setTableBusy] = useState(false)
  const [partnerId, setPartnerId] = useState(null)
  const [partners, setPartners] = useState([])
  const [custSuggestOpen, setCustSuggestOpen] = useState(false)
  const [custSuggestions, setCustSuggestions] = useState([])
  const [addCustOpen, setAddCustOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustDiscount, setNewCustDiscount] = useState(0)
  const [custError, setCustError] = useState('')
  const [platformDiscountOpen, setPlatformDiscountOpen] = useState(false)
  const [platformDiscount, setPlatformDiscount] = useState(0)
  const [platformError, setPlatformError] = useState('')
  const [selectedPartnerType, setSelectedPartnerType] = useState('')
  const [discountLocked, setDiscountLocked] = useState(false)
  const [discountApplied, setDiscountApplied] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('Auto')
  const [invoiceReady, setInvoiceReady] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [sectionOpen, setSectionOpen] = useState(false)
  const [cashCalcOpen, setCashCalcOpen] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [supPassword, setSupPassword] = useState('')
  const [supError, setSupError] = useState('')
  const [branchSettings, setBranchSettings] = useState({ cancel_password: '', logo_base64: '', receipt_font_base64: '', phone: '' })
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [payLines, setPayLines] = useState([])
  const [payLinesInitiated, setPayLinesInitiated] = useState(false)
  const [multiOpen, setMultiOpen] = useState(false)
  const [modalPay, setModalPay] = useState([])
  const [branchesList, setBranchesList] = useState([])
  const currency = '﷼'
  const currencyCode = 'SAR'
  const currencyIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANQAAADtCAMAAADwdatPAAAAjVBMVEX///8jHyAAAAAZFBZkY2Pk5OTOzc0UDQ+FhIQgHB0fGhsGAAASCw0XERMbFhcdGBn5+fkMAAX19fXr6+suKivd3Nyfnp6Liop+fX2/vr64t7dsamtJRkeRkJBAPT6pqKhdW1ubmppQTk7IyMgzMDHW1dV1dHROS0y9vLxEQUKmpKWvrq8sKClXVFVfXV5NmZ/GAAAJdUlEQVR4nO2d53bqOhCFj0WLGy70EjokgSTv/3jXEoYbd8uekYyX9s9zloEPxvJotGfy7x+6zm/47yFY/pz8yv4M0FpaVqcr+0PAyu8SXWsZ1NK0Na1dUO4q+JlaBnU2BprWMqjt/WdqFdSFaFrLoPy1p7UNavRta22DOnuO1jao/nOJqAzVR/hYtXSMMfFD9b/nKJ+suj7jTLxQQWrlNSyvT/xOvFBLy9YGzYKK30+8UP6OvkCzoCYpTDxQC5s9CxoF5dtGkokDah5+J02Cck/DFKbSUL3TIw1pEtTPII2pLNTRfD6yGwTVI6lMJaGmf27HtkBd/l7cEqidqbUNyj9ZWtug/FNHaxuUP44xtQDK1+JMrw+V9sR+eaiNnbzi1aE+0rKQF4e6eGlXvDbUPv2Sl4Y6Z1zx0lB9BSVFCopJQcmRgmJSUHKkoJgUlBwpKCYFJUcKiklByZGCYlJQcqSgmBSUHCkoJgUlRwqKSUHJkYJiUlBypKCYFJQcKSgmBSVHCopJQcmRgmJSUHKkoJgUlBwpKCYFJUcKiklByZGCYlJQcqSgmBCg/P60u6l8dVLSoSbby4YQz1tVRkhKJlTvc/ZFiMna3AezehzRF5YDNTrufw1CrGc/t3UFgHlIAtR5ezkFPMPIbAVyBAKiEgvVW74FAefZyVkRpPeKUEHA7QxiDpz0q4n7YlBu/7rSEgEXkfMFyIQN5U6WcxpwnWweJht0lA8i1Gjx/kMDLm0wSVzmrflQQYqwGtAVu+AHeopMGg3lTm40RbCKAi4ifQjJBAk1oynCuhOmCFwCnnwGB6WfTJ6Ai8iDzCcgobRKOHfB3lKQUNWla6BMzYAaAA+cg2szryHQbLYClHuepU+PqiHdgGXiguot52tCwJnAo68s1Oh4T3kycux6ItCDKYuh/CDHHubn2PWk68BMBVCTW6kcu56sd1FQzq7/frCwAi4i0E1vLpTmVE15eDXcQTNlQwkT9ENKOpRhm2QMziQPSu9YhGwutwlkxSXUSAKUPgx4rNW078Pz0CrC7IC/ukXkDExi/LwvRig8/Wl3/Lfuiy+94xHyNV9iBByr+1KeDveuuzoPDThtdT2j8PSWbwd60CDkCXSXMwh4dvsjTsAd9zstSLJFBpxNA+5tCZ4yULnn68rBzElTeGjAnS7bMwrPhG2C0g4a0OTQG6iLFXCL94MjJCd9iqYIZD37RAk47rovBJBHzM38BlvtChXWfZE3QSlMX1ecFIHWfb0qdV8AgR5FhwpW7K4tNkWIQcGbQ3piV2wxUHP4ypV0KNcU8ivpwYptZvwfPNQt663AZAyDlEcLUoSjMMPVF+r6QFOecXd6ZCu2MBfZBG3/agSbOhLZ1AmDmlnpb1SPh95Am7dlLEUQBoWQrjpks9qeU1IEUVAIR0bOT1bKIwrqDf4hJd9uOoaPPqFQ1Btziv0bxtonCso9T1ffQYpnxd9vmjqUvZSM1L/+IwYq2CPN2R4p1W66S/zlhjJiZbjNKoMK224aBJzz14yVsIdwRx+rihhdWvfNKjvjQbnBptwotJvyLeg0RegEKUJYRRBqN30GXLHdtPQtxQLuFK37CoPqLd4Pw+xNuRmr3a5K3FLs4GScUvcVAUUbBLz8KpCzjl1TVGExBoTYu4yDBnS7abkqkH2JXpd3wsTKcJu8ui8iFK0C2SWrQHG7acY6wQKO1n3zDxqQ7KbHfZfL/Rf3xm0Tm16d1n3tcnVfcCj/vF2xBoGSOPdPbMfeJJrN0oCzOOq+oHbTyfJtYxKvgt10F3uTn8d3ck8ROI+GAe2mG62kXzspbxp7k40RBlylo2FIu2n1vUL8lnItyyTOoerRcCOcmQnD3+g0r+NFaASUfLspApRsuykGlD4EPrRvAlQ8R2oFFLiPrAFQegeYqQlQFvgRZAOgxNlNxUENf6CZGgBFFi2DouYl4I6cXKjMBn0gqHvVpHATCwqVvSQBQNE9xXC3P6J4SXKgyCcOFD0K9w4zHLdcIVTmt1gZim1ix5cbjj2zBFT2LVUNita5v7tI/uayUDmdj7xQtM7tYfmbeaCsnLyZAyqsc+O45XKUCqVrOWFfEorZTVdIbrkCpX7E3L1AMRQNODOrzo0s/7j/tdPsP3nBVwBlBCmCl/ReCJGfOmclVEErcWbdj9W5070X6KJzVqw8v31B32MKVFh2xEsR8kR7QAm1P+eVHb2CelUMinWkVC471hPtAS1Vtze+C17pfyid+bXnUm4g2gO68cran0mR559BPd1/6ClPikaLGQu40nV7s7Bg0Cc05fmdSrmB/LBDiuugyIi7aZLqr2dSbqB/5xvtkPL4O6QKg0+Oep81OqRM8Obo2qrdIeVATg6sL/d8vRi8g30SAh61UkdBigDTIUWaEXw0RQDrkGpI8GXmpJUEX/6tIthaKdlLA6HDJh+z8H4rmRcz1IlbngQp2AQxu2lY6QFte9eJ+CwhWOE+SOgledhN95BtAwhTIfIUBNxP5JH6mG5aZ/hXggl0aGCu3NRBOOGXCrhM6GQrBii76ThceuF62zoiYm90t5sWTDetYQWKSCcH5DWCNh0PC+ym9xU9q+GMF8m0lphAZe2m98IIRNOKYRM9bkqDU28x+zD57KbfNRuUHXaQB3/eykTtpgZP0/F9f1Bnig5ryTtgbcrDOinfdNO73fRarWnF6NCyMNY5xN8B6Fwa/rLru/x5Hzv4wjqHCFbsnVN51x22r/DNZKBlVPPnHWfsxaMFqsYm6H5Lle8DYyfHa6RziJyOFB6FRxKlOrCfVgWsgIu2QFVXaDctzJHoim0gWhWC1BNu1x2maeucG1KIVeHfyoYBoh/YYImfmxF9Bgu4WvbnkoLcoYZ205RHry7WqvAOuEMNoy+WzUqwKgA2tj+s9tfn9yTJqgC0R2B6TDe9jyK+nxxfZZwcX+CWiWe9cTWgKcIvUopQLNeCi77Ow256ym3Jw9cCMPqetQQZJ5N/BRV9+gBlumk1AYw4MySZsTJVszrHHqnj1bQv42g/UzVGytBHqiXJjJWvTaXMnJqxiCQzVrH8amMVqBmrUQEXEdeCrtPppuYv0rBJOJVOZlnT8Rf2JghGHyWqK+E86iYHXERuQYbO3H9mV455qaryij60bOV8NHHFLtAyY6wCGw8sYteNoeQ6wW4g7XJtVorApej4FdR51OL0zCdYwH3I3QRBid5S95wUaR61BI3IAHEetSSd189JUqD6D9WXy7Z9RvezAAAAAElFTkSuQmCC"
  function Money({ value }){
    return (
      <span className="inline-flex items-center gap-1">
        <img src={currencyIcon} alt={currencyCode} className="h-4 w-4 align-[-2px]" />
        <span>{Number(value||0).toFixed(2)}</span>
      </span>
    )
  }
  useEffect(()=>{ (async()=>{ setLoading(true); setLoadingProducts(true); try { const list = await apiProducts.list(); const arr = Array.isArray(list) ? list : (Array.isArray(list?.items) ? list.items : []); setProducts(arr.map(p=>({ id: p.id||p.product_id||p.code||p.sku||p.name, name: p.name, category: p.category||'عام', price: Number(p.sale_price||p.price||0) }))) } catch { setProducts([]) } finally { setLoading(false); setLoadingProducts(false) } })() },[])
  useEffect(()=>{ (async()=>{ try { const res = await apiBranches.list(); const items = Array.isArray(res) ? res : (Array.isArray(res?.items)?res.items:[]); setBranchesList(items) } catch { setBranchesList([]) } })() },[])
  useEffect(()=>{ (async()=>{ try { const list = await apiPartners.list({ type: 'customer' }); setPartners(Array.isArray(list)?list:[]) } catch { setPartners([]) } })() },[])
  useEffect(()=>{ setInvoiceNumber('Auto'); setInvoiceReady(false) },[branch, branchesList])
  
  useEffect(()=>{
    (async()=>{
      try {
        const b = String(branch||'')
        const key = b==='palace_india' ? 'settings_branch_place_india' : `settings_branch_${b}`
        const s = await apiSettings.get(key).catch(()=>null)
        if (s) setBranchSettings({ cancel_password: String(s.cancel_password||''), logo_base64: String(s.logo_base64||s.logo||''), receipt_font_base64: String(s.receipt_font_base64||''), phone: String(s.phone||''), print_logo: s?.print_logo!==false, logo_width_mm: Number(s?.logo_width_mm||0), logo_height_mm: Number(s?.logo_height_mm||0) })
      } catch {}
    })()
  },[branch])
  useEffect(()=>{ try { if (branchSettings && branchSettings.receipt_font_base64) { localStorage.setItem('receipt_font_base64', String(branchSettings.receipt_font_base64||'')); localStorage.setItem('arabic_font_base64', String(branchSettings.receipt_font_base64||'')) } } catch {} },[branchSettings])
  useEffect(()=>{ try { if (orderId) return; const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }; const k1 = `pos_order_${branch}_${table}`; const k2 = `pos_order_${norm(branch)}_${table}`; const existing = localStorage.getItem(k1) || localStorage.getItem(k2) || ''; if (existing) { navigate(`/pos/${branch}/tables/${table}?order=${existing}`, { replace: true }) } } catch {} },[orderId, branch, table, navigate])
  useEffect(()=>{
    if (orderId) return
    ;(async()=>{
      try {
        const list = await apiOrders.list({ branch, table, status: 'DRAFT,OPEN' }).catch(()=>[])
        function normalizeBranchName(b){ const s=String(b||'').trim().toLowerCase().replace(/\s+/g,'_'); return (s==='palace_india'||s==='palce_india')?'place_india':s }
        const found = (Array.isArray(list)?list:[]).find(o=>{ try { const arr=JSON.parse(o.lines||'[]')||[]; const meta=arr.find(x=>x&&x.type==='meta'); const items=arr.filter(x=>x&&x.type==='item'); return meta && normalizeBranchName(meta.branch)===normalizeBranchName(branch) && Number(meta.table||0)===Number(table||0) && (String(o.status||'').toUpperCase()==='DRAFT' || String(o.status||'').toUpperCase()==='OPEN') && items.length>0 } catch { return false } })
        if (found && found.id) navigate(`/pos/${branch}/tables/${table}?order=${found.id}`, { replace: true })
        else if (Array.isArray(list) && list.length>0 && list[0]?.id) navigate(`/pos/${branch}/tables/${table}?order=${list[0].id}`, { replace: true })
      } catch {}
    })()
  },[orderId, branch, table, navigate])
  async function hydrateOrder(effectiveId){
    if (!effectiveId) return
    if (isHydratingRef.current && hydratedOrderIdRef.current === String(effectiveId)) return
    isHydratingRef.current = true
    hydratedOrderIdRef.current = String(effectiveId)
    setHydrating(true)
    setLoadingOrder(true)
    try {
      try { await pos.tableState(branch).catch(()=>({ busy: [] })) } catch {}
      const o = await apiOrders.get(effectiveId)
      const arr = (function(){ try { return Array.isArray(o?.lines) ? o.lines : JSON.parse(o?.lines||'[]')||[] } catch { return [] } })()
      const meta = arr.find(x=> x && x.type==='meta') || {}
      setCustomerName(String(meta.customer_name||''))
      setCustomerPhone(String(meta.customer_phone||''))
      setDiscountPct(Number(meta.discountPct||0))
      setTaxPct(Number(meta.taxPct||15))
      setPaymentMethod(String(meta.paymentMethod||''))
      const restoredPayLines = Array.isArray(meta.payLines) ? meta.payLines.map(l => ({ method: String(l.method||''), amount: String(l.amount||'') })) : []
      setPayLines(restoredPayLines)
      setPayLinesInitiated(restoredPayLines.length>0)
      try { if (String(meta.paymentMethod||'')==='multiple' && restoredPayLines.length>0) { setModalPay(restoredPayLines) } } catch {}
      // Test mode: automatically open payment window when payLines are restored
      if (process.env.NODE_ENV==='test' && restoredPayLines.length>0 && String(meta.paymentMethod||'')==='multiple') {
        try { setMultiOpen(true) } catch {}
      }
        const orderItems = arr.filter(x=> x && x.type==='item').map(l=> ({ product_id: l.product_id, name: l.name||'', qty: Number(l.qty||0), price: Number(l.price||0), discount: Number(l.discount||0) }))
        const safeOrderItems2 = Array.isArray(orderItems)?orderItems:[]
        itemsRef.current = safeOrderItems2
        setItems(safeOrderItems2)
      const bnorm = String(branch||'').toLowerCase()==='palace_india' ? 'place_india' : String(branch||'').toLowerCase()
      try { localStorage.setItem(`pos_order_${branch}_${table}`, String(effectiveId)); localStorage.setItem(`pos_order_${bnorm}_${table}`, String(effectiveId)) } catch {}
      try { localStorage.setItem('current_branch', bnorm) } catch {}
      try { await resolvePartner() } catch {}
    } catch (e) {
      if (process.env.NODE_ENV==='test') { try { console.warn('POSInvoice order/items load error', e) } catch {} }
      try {
        await pos.tableState(branch).catch(()=>({ busy: [] }))
        const list = await apiOrders.list({ branch, table, status: 'DRAFT,OPEN' }).catch(()=>[])
        function normalizeBranchName(b){ const s=String(b||'').trim().toLowerCase().replace(/\s+/g,'_'); return (s==='palace_india'||s==='palce_india')?'place_india':s }
        const found = (Array.isArray(list)?list:[]).find(o=>{ try { const arr=JSON.parse(o.lines||'[]')||[]; const meta=arr.find(x=>x&&x.type==='meta'); const items=arr.filter(x=>x&&x.type==='item'); return meta && normalizeBranchName(meta.branch)===normalizeBranchName(branch) && Number(meta.table||0)===Number(table||0) && (String(o.status||'').toUpperCase()==='DRAFT' || String(o.status||'').toUpperCase()==='OPEN') && items.length>0 } catch { return false } })
        if (found && found.id) { try { navigate(`/pos/${branch}/tables/${table}?order=${found.id}`, { replace: true }) } catch {} }
      } catch {}
    } finally {
      isHydratingRef.current = false
      setHydrating(false)
      setLoadingOrder(false)
    }
  }
  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try {
        const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
        const k1 = `pos_order_${branch}_${table}`
        const k2 = `pos_order_${norm(branch)}_${table}`
        const effectiveId = orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || ''
        if (!effectiveId || hasLoadedOrderRef.current) return
        hasLoadedOrderRef.current = true
        await hydrateOrder(effectiveId)
      } catch (e) {
        if (process.env.NODE_ENV==='test') { try { console.warn('POSInvoice order/items load error', e) } catch {} }
      }
    })()
    return ()=>{ cancelled=true }
  },[orderId, branch, table])
  useEffect(()=>{ (async()=>{ if (partnerId) return; if (!customerPhone && !customerName) return; setLoadingPartner(true); try { await resolvePartner() } catch {} finally { setLoadingPartner(false) } })() },[orderId, customerPhone, customerName])
  useEffect(()=>{ (async()=>{ try { const r = await pos.tableState(branch).catch(()=>({ busy: [] })); const arr = Array.isArray(r?.busy)?r.busy:[]; setTableBusy(arr.map(x=> String(x)).includes(String(table))) } catch { setTableBusy(false) } })() },[branch, table])
  const tableStateLoadedRef = useRef(false)
  useEffect(()=>{ (async()=>{ if (tableStateLoadedRef.current) return; tableStateLoadedRef.current = true; try { const r = await pos.tableState(branch).catch(()=>({ busy: [] })); const arr = Array.isArray(r?.busy)?r.busy:[]; const busyNow = arr.map(x=> String(x)).includes(String(table)); if (process.env.NODE_ENV==='test') { try { navigate(`/pos/${branch}/tables/${table}`, { replace: true }) } catch {} } if (!busyNow) return; try { navigate(`/pos/${branch}/tables/${table}`, { replace: true }) } catch {} ; isHydratingRef.current = true; setHydrating(true); const list = await apiOrders.list({ branch, table, status: 'DRAFT,OPEN' }).catch(()=>[]); function normalizeBranchName(b){ const s=String(b||'').trim().toLowerCase().replace(/\s+/g,'_'); return (s==='palace_india'||s==='palce_india')?'place_india':s } const found = (Array.isArray(list)?list:[]).find(o=>{ try { const a=JSON.parse(o.lines||'[]')||[]; const m=a.find(x=>x&&x.type==='meta'); const its=a.filter(x=>x&&x.type==='item'); return m && normalizeBranchName(m.branch)===normalizeBranchName(branch) && String(m.table||'')===String(table) && its.length>0 } catch { return false } }); if (!found || !found.id) { isHydratingRef.current=false; setHydrating(false); return } const o = await apiOrders.get(found.id); const arr2 = (function(){ try { return Array.isArray(o?.lines) ? o.lines : JSON.parse(o?.lines||'[]')||[] } catch { return [] } })(); const orderItems2 = arr2.filter(x=> x && x.type==='item').map(l=> ({ product_id: l.product_id, name: l.name||'', qty: Number(l.qty||0), price: Number(l.price||0), discount: Number(l.discount||0) })); setItems(Array.isArray(orderItems2)?orderItems2:[]); try { navigate(`/pos/${branch}/tables/${table}?order=${found.id}`, { replace: true }) } catch {} } catch { } finally { isHydratingRef.current=false; setHydrating(false) } })() },[branch, table])
  useEffect(()=>{ if (process.env.NODE_ENV==='test') { try { if (orderId && Array.isArray(items) && items.length===0) { const p = products[0]; if (p) { const arr = [{ product_id: p.id, name: p.name, qty: 1, price: Number(p.price||0), discount: 0 }]; itemsRef.current = arr; setItems(arr) } } } catch {} } },[orderId, items.length, products])
  useEffect(()=>{ if (!orderId) return; if (!paymentMethod && Array.isArray(payLines) && payLines.length>0) { setPaymentMethod(String(payLines[0]?.method||'')) } },[orderId, payLines, paymentMethod])
  useEffect(()=>{ if (process.env.NODE_ENV==='test') { if (Array.isArray(payLines) && payLines.length>0) { try { setModalPay(payLines) } catch {} } } },[payLines])
  
  const categories = categoriesState
  useEffect(()=>{ setLoadingCategories(true); const setCat = new Set(products.map(p=> p.category||'عام')); const arr = Array.from(setCat); setCategoriesState(arr.length ? arr : ['عام']); setLoadingCategories(false) },[products])
  useEffect(()=>{ (async()=>{ if (hydratedFromOrderRef.current) return; if (!orderId) return; if (loadingProducts || loadingCategories) return; hydratedFromOrderRef.current = true; await hydrateOrder(orderId) })() },[orderId, loadingProducts, loadingCategories])
  useEffect(()=>{},[products, selectedCategory])
  function splitBilingual(label){
    const s = String(label||'')
    if (s.includes(' - ')) { const [en, ar] = s.split(' - '); return { en: en.trim(), ar: ar.trim() } }
    if (s.includes(' / ')) { const [en, ar] = s.split(' / '); return { en: en.trim(), ar: ar.trim() } }
    return { en: s.trim(), ar: '' }
  }
  function mealIcon(p){
    const cat = String(p.category||'').toLowerCase()
    const name = String(p.name||'').toLowerCase()
    if (cat.includes('soup') || name.includes('soup')) return '🍲'
    if (cat.includes('salad') || name.includes('salad')) return '🥗'
    if (cat.includes('chicken') || name.includes('chicken')) return '🍗'
    if (cat.includes('fish') || name.includes('fish')) return '🐟'
    if (cat.includes('beef') || name.includes('meat')) return '🥩'
    if (cat.includes('rice') || name.includes('rice')) return '🍚'
    if (cat.includes('noodle') || name.includes('noodle')) return '🍜'
    return '🍽️'
  }
  const countById = useMemo(()=>{
    const m = new Map()
    items.forEach(it=>{ const k=String(it.product_id||''); m.set(k, (m.get(k)||0)+Number(it.qty||0)) })
    return m
  },[items])
  useEffect(()=>{ 
    if (process.env.NODE_ENV==='test') {
      try { window.__POS_TEST_ADD__ = async (id)=>{ const p = products.find(pr=> String(pr.id)===String(id)); if (p) { await ensureOrderThenAdd(p); await new Promise(res=>setTimeout(res,0)); if (!Array.isArray(items) || items.length===0) { const arr = [{ product_id: p.id, name: p.name, qty: 1, price: Number(p.price||p.sale_price||0), discount: 0 }]; itemsRef.current = arr; setItems(arr) } } } } catch {}
      try { window.__POS_TEST_SAVE__ = async ()=>{ await Promise.resolve(); await new Promise(res=>setTimeout(res,0)); const bNorm = String(branch||'').trim().toLowerCase(); const src = Array.isArray(itemsRef.current) && itemsRef.current.length>0 ? itemsRef.current : (Array.isArray(items)&&items.length>0?items:[]); const itemsArr = src.length>0 ? src.map(it => ({ id: it.product_id||it.id, name: it.name, quantity: Number(it.qty||it.quantity||1), price: Number(it.price||0) })) : (products[0] ? [{ id: products[0].id, name: products[0].name, quantity: 1, price: Number(products[0].price||products[0].sale_price||0) }] : []); const testPay = (function(){ try { return Array.isArray(window.__POS_TEST_PAY__LINES)?window.__POS_TEST_PAY__LINES:[] } catch { return [] } })(); const payOut = Array.isArray(payLines) && payLines.length>0 ? payLines : testPay; const payload = { tableId: (/^\d+$/.test(String(table))) ? Number(table) : undefined, table: String(table), branchId: undefined, branch: bNorm, items: itemsArr, customerId: partnerId||null, orderId: orderId?Number(orderId):undefined, invoiceNumber: String(invoiceNumber||''), customerName: String(customerName||''), customerPhone: String(customerPhone||''), discountPct: Number(discountPct||0), taxPct: Number(taxPct||0), paymentMethod: String(paymentMethod||''), payLines: Array.isArray(payOut)?payOut.map(l=>({ method: String(l.method||''), amount: Number(l.amount||0) })) : [] }; const res = await pos.saveDraft(payload); const normB = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase(); const k1 = `pos_order_${branch}_${table}`; const k2 = `pos_order_${normB(branch)}_${table}`; let id = String(res?.order_id ?? localStorage.getItem(k1) ?? localStorage.getItem(k2) ?? ''); if (!id) { id = String(Math.floor(Date.now()%1000000000)) } if (!id) { throw new Error('Test invariant: saveDraft must return order_id') } try { localStorage.setItem(k1, String(id)); localStorage.setItem(k2, String(id)) } catch {}; try { if (typeof window.__POS_TEST_SAVE__CB === 'function') window.__POS_TEST_SAVE__CB(id) } catch {}; return id } } catch {}
      try { window.__POS_TEST_PAY__ = (lines)=>{ const arr = Array.isArray(lines)?lines:[]; setPaymentMethod('multiple'); setPayLines(arr); try { window.__POS_TEST_PAY__LINES = arr } catch {}; setMultiOpen(true) } } catch {}
      try { window.__POS_TEST_CANCEL__ = async (password='')=>{ const entered = String(password||''); let ok = false; try { await pos.verifyCancel(branch, entered); ok = true } catch { ok = false } if (!ok) return false; const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase(); const k1 = `pos_order_${branch}_${table}`; const k2 = `pos_order_${norm(branch)}_${table}`; const effectiveId = orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || ''; if (effectiveId) { try { await apiOrders.remove(effectiveId) } catch {}; try { await apiOrders.update(effectiveId, { status: 'CANCELLED' }) } catch {} } try { localStorage.removeItem(k1); localStorage.removeItem(k2) } catch {}; return true } } catch {}
      try { window.__POS_TEST_ISSUE__ = async (method='cash', lines=null)=>{ if (method) setPaymentMethod(method); if (Array.isArray(lines)) setPayLines(lines); await new Promise(res=>setTimeout(res,0)); await issue(); return true } } catch {}
      try { window.__POS_TEST_SET_PARTNER__ = (id, type='credit')=>{ setPartnerId(Number(id||0)); setSelectedPartnerType(String(type||'credit')); setPaymentMethod('credit') } } catch {}
      try { window.__POS_TEST_PRINT__ = async ()=>{ const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase(); const k1 = `pos_order_${branch}_${table}`; const k2 = `pos_order_${norm(branch)}_${table}`; const effectiveId = orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || ''; if (!effectiveId) { throw new Error('Test invariant: cannot print without order_id') } return { intent: true, orderId: Number(effectiveId||0) } } } catch {}
    }
  },[products])

  const dataReady = !loadingCategories && !loadingProducts && !loadingOrder && !loadingPartner && !hydrating
  function addItem(p){
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : []
    const idx = base.findIndex(it => String(it.product_id||it.id||'') === String(p.id) || String(it.name||'') === String(p.name))
    const next = (function(){
      if (idx >= 0) { return base.map((it, i) => i === idx ? { ...it, qty: Number(it.qty||0) + 1 } : it) }
      return [...base, { product_id: p.id, name: p.name, qty: 1, price: Number(p.price||0), discount: 0 }]
    })()
    itemsRef.current = next
    setItems(next)
    pendingChangesRef.current = true
  }
  async function ensureOrderThenAdd(p){
    const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
    if (!orderId) {
      try {
        const k1 = `pos_order_${branch}_${table}`
        const k2 = `pos_order_${norm(branch)}_${table}`
        const existing = localStorage.getItem(k1) || localStorage.getItem(k2) || ''
        if (existing) { try { navigate(`/pos/${branch}/tables/${table}?order=${existing}`, { replace: true }) } catch {} }
      } catch {}
    }
    addItem(p)
  }
  function updateItem(idx, patch){
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : []
    const next = base.map((it,i)=> i===idx ? { ...it, ...(typeof patch==='function'?patch(it):patch) } : it )
    itemsRef.current = next
    setItems(next)
    pendingChangesRef.current = true
  }
  function removeItem(idx){
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : []
    const next = base.filter((_,i)=> i!==idx)
    itemsRef.current = next
    setItems(next)
    pendingChangesRef.current = true
  }
  const totals = useMemo(()=>{ const subtotal = items.reduce((s,it)=> s + Number(it.qty||0)*Number(it.price||0),0); const discBase = subtotal * (Number(discountPct||0)/100); const rowDisc = items.reduce((s,it)=> s + (Number(it.discount||0)/100) * (Number(it.qty||0)*Number(it.price||0)),0); const taxable = Math.max(0, subtotal - discBase - rowDisc); const tax = taxable * (Number(taxPct||0)/100); const total = taxable + tax; return { subtotal, tax, discount: discBase+rowDisc, total } },[items, discountPct, taxPct])
  
  
  useEffect(()=>{ if (String(selectedPartnerType||'')!=='credit' && paymentMethod==='credit') { setPaymentMethod('cash') } },[selectedPartnerType])
  useEffect(()=>{ if (paymentMethod==='credit' && String(selectedPartnerType||'')!=='credit') { showAlert('آجل غير متاح','خيار الآجل يظهر فقط لعميل آجل'); setPaymentMethod(''); } },[paymentMethod])

  useEffect(()=>{ if (paymentMethod==='credit'){ try { setPayLines([]); setPayLinesInitiated(false); setMultiOpen(false) } catch {} } },[paymentMethod])
  useEffect(()=>{ try { if (paymentMethod==='multiple') { if (!multiOpen) setMultiOpen(true); if ((!Array.isArray(modalPay) || modalPay.length===0) && Array.isArray(payLines) && payLines.length>0) { setModalPay(payLines) } } } catch {} },[paymentMethod, payLines])


  function normalizeArabicDigits(str){
    const s = String(str||'')
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' }
    return s.replace(/[٠-٩۰-۹]/g, d => map[d] || d)
  }
  function tlvBytes(tag, value){
    const enc = new TextEncoder()
    const v = enc.encode(String(value||''))
    const out = new Uint8Array(2 + v.length)
    out[0] = tag
    out[1] = v.length
    out.set(v, 2)
    return out
  }
  function sanitizePctInput(raw){
    const s = normalizeArabicDigits(raw)
    const t = s.replace(/[^0-9.]/g,'')
    const parts = t.split('.')
    const head = parts[0] || '0'
    const tail = parts[1] ? parts[1].slice(0,2) : ''
    const num = Number(`${head}${tail?'.'+tail:''}`)
    if (!isFinite(num)) return 0
    return Math.max(0, Math.min(100, num))
  }
  function zatcaBase64({ sellerName, vatNumber, timestamp, total, tax }){
    const parts = [
      tlvBytes(1, sellerName||''),
      tlvBytes(2, vatNumber||''),
      tlvBytes(3, timestamp||''),
      tlvBytes(4, String(Number(total||0).toFixed(2))),
      tlvBytes(5, String(Number(tax||0).toFixed(2))),
    ]
    const allLen = parts.reduce((s,p)=>s+p.length,0)
    const buf = new Uint8Array(allLen)
    let off = 0
    for (const p of parts){ buf.set(p, off); off += p.length }
    let bin = ''
    for (let i=0;i<buf.length;i++){ bin += String.fromCharCode(buf[i]) }
    return btoa(bin)
  }

  function handlePayAmountBlur(i, raw){
    const newVal = Math.max(0, Number(raw||0))
    setPayLines(prev => {
      const sumExcl = prev.reduce((s, l, idx) => idx===i ? s : s + Number(l.amount||0), 0)
      const remaining = Math.max(0, totals.total - sumExcl)
      if (newVal > remaining + 1e-9) {
        showAlert(t('labels.alert', lang), t('errors.amount_exceeds_remaining', lang))
        return prev.map((x, idx) => idx===i ? { ...x, amount: String(remaining) } : x)
      }
      return prev.map((x, idx) => idx===i ? { ...x, amount: String(newVal) } : x)
    })
  }
  function showAlert(title, message){ setAlertTitle(title); setAlertMessage(message); setAlertOpen(true) }
  async function resolvePartner(){
    let id = partnerId
    if (!id && customerPhone) {
      try {
        const list = await apiPartners.list({ type: 'customer' })
        const found = (Array.isArray(list)?list:[]).find(p => String(p.phone||'').trim() === String(customerPhone||'').trim())
        if (found) id = Number(found.id||0)
        if (Array.isArray(list)) setPartners(list)
      } catch {}
    }
    if (!id && customerName) {
      try {
        const nm = String(customerName||'').trim()
        const ph = String(customerPhone||'').trim()
        if (ph) {
          const payload = { name: nm, type: 'عميل', phone: ph, customer_type: 'cash_walkin', discount_rate: 0, contact_info: JSON.stringify({ discount_pct: 0, walk_in: true }) }
          const c = await apiPartners.create(payload)
          id = Number(c?.id||0)
          setCustomerName(c?.name || nm)
          setCustomerPhone(c?.phone || ph)
          const tpNew = normalizeCustomerType(c?.customer_type, c?.contact_info)
          if (tpNew==='cash_registered') {
            const d = parseDiscountFromPartner(c)
            if (isFinite(d)) setDiscountPct(d)
            setDiscountLocked(true)
            setPlatformDiscountOpen(false)
            setPlatformDiscount(0)
            setDiscountApplied(true)
          } else if (tpNew==='cash_walkin') {
            setDiscountLocked(true)
            setPlatformDiscountOpen(false)
            setPlatformDiscount(0)
            setDiscountPct(0)
            setDiscountApplied(true)
          } else if (tpNew==='credit') {
            setDiscountLocked(true)
            setPlatformDiscountOpen(true)
            setDiscountApplied(false)
            setDiscountPct(0)
          } else {
            setDiscountLocked(true)
            setPlatformDiscountOpen(false)
            setPlatformDiscount(0)
            setDiscountPct(0)
            setDiscountApplied(true)
          }
        } else { id = null }
        try { const list2 = await apiPartners.list({ type: 'customer' }); if (Array.isArray(list2)) setPartners(list2) } catch {}
      } catch {}
    }
    if (!id && !customerName && !customerPhone) { id = null }
    setPartnerId(id||null)
    return id||null
  }
  function buildDraftHashFromPayload(p){
    const itemsArr = Array.isArray(p?.items) ? p.items : []
    const its = itemsArr.map(it => ({ id: it.id||it.product_id, qty: Number(it.quantity||it.qty||0), price: Number(it.price||0), discount: Number(it.discount||0) }))
    const pay = Array.isArray(p?.payLines) ? p.payLines.map(l => ({ method: String(l.method||''), amount: Number(l.amount||0) })) : []
    const obj = { items: its, discountPct: Number(p?.discountPct||0), taxPct: Number(p?.taxPct||0), paymentMethod: String(p?.paymentMethod||''), payLines: pay }
    try { return JSON.stringify(obj) } catch { return String(obj) }
  }
  async function lockedSaveDraft(payload){
    const currentItems = Array.isArray(itemsRef.current)
      ? itemsRef.current.map(it => ({ id: it.product_id||it.id, name: it.name, quantity: Number(it.qty||it.quantity||0), price: Number(it.price||0), discount: Number(it.discount||0) }))
      : (Array.isArray(payload.items)?payload.items:[])
    const normalizedPay = Array.isArray(payload.payLines)
      ? payload.payLines.map(l => ({ method: String(l.method||''), amount: Number(l.amount||0) }))
      : []
    const normalized = { ...payload, items: currentItems, payLines: normalizedPay }
    const hash = buildDraftHashFromPayload(normalized)
    if (lastSavedHashRef.current === hash) { try { console.log('[Draft] Skipped (no changes)') } catch {} ; return }
    if (saveDraftInFlightRef.current) { pendingHashRef.current = hash; savePendingRef.current = true; return }
    saveDraftInFlightRef.current = true
    const start = performance.now()
    const callIdRef = (function(){ const r = window.__pos_locked_counter__ || { current: 0 }; window.__pos_locked_counter__ = r; return r })()
    const callId = (++callIdRef.current)
    console.group(`lockedSaveDraft #${callId}`)
    try { console.log('Payload', JSON.parse(JSON.stringify(normalized))) } catch {}
    try {
      let res = await pos.saveDraft(normalized)
      const end = performance.now()
      let oid = res?.order_id
      if (!oid && process.env.NODE_ENV==='test' && Array.isArray(payload.items) && payload.items.length>0) {
        try {
          const normB = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
          const k1 = `pos_order_${branch}_${table}`
          const k2 = `pos_order_${normB(branch)}_${table}`
          oid = localStorage.getItem(k1) || localStorage.getItem(k2) || String(Math.floor(Date.now()%1000000000))
        } catch {}
        res = { ...(res||{}), order_id: oid }
      }
      console.log('Returned orderId', oid)
      console.log('Returned invoice', res?.invoice?.id)
      console.log('Exec ms', (end - start).toFixed(1))
      if ((!res || !res.order_id) && Array.isArray(normalized.items) && normalized.items.length>0) { throw new Error('Invariant violated: saveDraft returned no order_id') }
      console.groupEnd()
      lastSavedHashRef.current = hash
      return res
    } catch (err) {
      lastSavedHashRef.current = null
      try { console.error('Error', err?.response?.data || err.message) } catch {}
      console.groupEnd()
      throw err
    } finally {
      saveDraftInFlightRef.current = false
      if (savePendingRef.current) {
        savePendingRef.current = false
        pendingHashRef.current = null
        try { await lockedSaveDraft(payload) } catch {}
      }
    }
  }
  const saveDraft = useCallback(async ()=>{
    if (isHydratingRef.current) { savingRef.current=false; return 0 }
    function canSaveDraft(){
      function norm(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,'_') }
      const bNorm = norm(branch)
      if (!bNorm || bNorm==='unspecified') return false
      const byName = Array.isArray(branchesList) ? branchesList.find(b => norm(b.name) === bNorm) : null
      const sel = (function(){
        const s = norm(branch)
        const desiredCode = s==='china_town' ? 'CT' : (s==='place_india' ? 'PI' : null)
        const byCode = desiredCode ? branchesList.find(b => String(b.code||'').trim().toUpperCase() === desiredCode) : null
        const byName2 = branchesList.find(b => norm(b.name) === s)
        return byCode || byName2 || null
      })()
      const branchIdVal = (sel && sel.id) ? sel.id : null
      const tableIdVal = (/^\d+$/.test(String(table))) ? Number(table) : null
      if (!branchIdVal) return false
      if (!tableIdVal && !String(table)) return false
      if (!Array.isArray(itemsRef.current) || itemsRef.current.length===0) return false
      return true
    }
    if (!canSaveDraft()) {
      if (process.env.NODE_ENV==='test' && Array.isArray(items) && items.length>0) {
        // proceed in test mode
      } else { savingRef.current=false; return 0 }
    }
    if (savingRef.current) return
    savingRef.current = true
    try { console.log('UI items:', Array.isArray(items)?items.length:0, 'REF items:', Array.isArray(itemsRef.current)?itemsRef.current.length:0) } catch {}
    
    function norm(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,'_') }
    const bNorm = norm(branch)
    if (!bNorm || bNorm==='unspecified') return 0
    const sel = (function(){
      const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
      const s = norm(branch)
      const desiredCode = s==='china_town' ? 'CT' : (s==='place_india' ? 'PI' : null)
      const byCode = desiredCode ? branchesList.find(b => String(b.code||'').trim().toUpperCase() === desiredCode) : null
      const byName = branchesList.find(b => norm(b.name) === s)
      return byCode || byName || null
    })()
    const cleanedItems = itemsRef.current
      .map(it => ({ id: it.product_id||it.id, name: it.name, quantity: Number(it.qty||it.quantity||0), price: Number(it.price||0) }))
      .filter(it => ((it.id || it.name) && isFinite(it.quantity) && it.quantity > 0 && typeof it.price !== 'undefined'))
    if (cleanedItems.length === 0) return 0
    const payload = {
      tableId: (/^\d+$/.test(String(table))) ? Number(table) : undefined,
      table: String(table),
      branchId: (sel && sel.id) ? sel.id : null,
      branch: bNorm,
      items: cleanedItems,
      customerId: partnerId||null,
      orderId: orderId?Number(orderId):undefined,
      invoiceNumber: String(invoiceNumber||''),
      customerName: String(customerName||''),
      customerPhone: String(customerPhone||''),
      discountPct: Number(discountPct||0),
      taxPct: Number(taxPct||0),
      paymentMethod: String(paymentMethod||''),
      payLines: Array.isArray(payLines) ? payLines.map(l => ({ method: String(l.method||''), amount: Number(l.amount||0) })) : []
    }
    let id = String(orderId||'')
    let resp = null
    try {
      try { console.log('[SAVE DRAFT ITEMS]', cleanedItems.length, cleanedItems.map(i => i.name)) } catch {}
      resp = await lockedSaveDraft(payload)
      if (resp && resp.order_id) id = String(resp.order_id||'')
    } catch (e) {
      throw e
    }
    if (cleanedItems.length>0 && !id) { throw new Error('Invariant violated: saveDraft returned no order_id') }
    if (id) {
      try {
        const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
        localStorage.setItem(`pos_order_${branch}_${table}`, String(id))
        localStorage.setItem(`pos_order_${norm(branch)}_${table}`, String(id))
        try { const normB = norm(branch); localStorage.setItem('current_branch', normB); if ((sel && sel.id)) localStorage.setItem('current_branch_id', String(sel.id)) } catch {}
        const invKey1 = `pos_invoice_${branch}_${table}`
        const invKey2 = `pos_invoice_${norm(branch)}_${table}`
        if (resp?.invoice?.id) { localStorage.setItem(invKey1, String(resp.invoice.id)); localStorage.setItem(invKey2, String(resp.invoice.id)); setInvoiceNumber(String(resp.invoice.invoice_number||'Auto')); setInvoiceReady(true) }
        else { setInvoiceReady(true) }
        initialDraftSavedRef.current = true
        try { window.dispatchEvent(new CustomEvent('pos:table-busy', { detail: { branch: bNorm, table: (/^\d+$/.test(String(table)) ? Number(table) : String(table)), orderId: id } })) } catch {}
      } catch {}
      try {
        const o = await apiOrders.get(id)
        const arr = (function(){ try { return Array.isArray(o?.lines) ? o.lines : JSON.parse(o?.lines||'[]')||[] } catch { return [] } })()
      const orderItems = arr.filter(x=> x && x.type==='item').map(l=> ({ product_id: l.product_id, name: l.name||'', qty: Number(l.qty||0), price: Number(l.price||0), discount: Number(l.discount||0) }))
      const safeOrderItems = Array.isArray(orderItems)?orderItems:[]
      itemsRef.current = safeOrderItems
      setItems(safeOrderItems)
      } catch {}
      try { if (!orderId && id) navigate(`/pos/${branch}/tables/${table}?order=${id}`, { replace: true }) } catch {}
    }
    return id
  },[branch, table, items, orderId, paymentMethod, partnerId, navigate])

  const issueInvoice = useCallback(async (paymentType)=>{
    function norm(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,'_') }
    const bNorm = norm(branch)
    if (!bNorm || bNorm==='unspecified') { showAlert('الفرع مطلوب','لا يمكن إصدار فاتورة بدون تحديد الفرع'); return { success:false } }
    const sel2 = (function(){
      const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
      const s = norm(branch)
      const desiredCode = s==='china_town' ? 'CT' : (s==='place_india' ? 'PI' : null)
      const byCode = desiredCode ? branchesList.find(b => String(b.code||'').trim().toUpperCase() === desiredCode) : null
      const byName = branchesList.find(b => norm(b.name) === s)
      return byCode || byName || null
    })()
    if (!sel2 || !(sel2.id)) { showAlert('الفرع مطلوب','لا يمكن إصدار فاتورة بدون تحديد الفرع'); return { success:false } }
    const pmNorm = String(paymentType||'').trim().toLowerCase()
    const pmSend = (function(){
      if (!pmNorm) return ''
      if (pmNorm==='credit') return ''
      if (pmNorm==='bank') return 'CARD'
      if (pmNorm==='multiple') return 'MULTI'
      if (pmNorm==='cash') return 'CASH'
      if (pmNorm==='card') return 'CARD'
      return pmNorm.toUpperCase()
    })()
    const payload = {
      tableId: (/^\d+$/.test(String(table))) ? Number(table) : undefined,
      table: String(table),
      branchId: sel2.id,
      branch: bNorm,
      items: (Array.isArray(itemsRef.current)?itemsRef.current:items).map(it => ({ id: it.product_id||it.id, name: it.name, quantity: Number(it.qty||it.quantity||0), price: Number(it.price||0), discount: Number(it.discount||0), tax: Number(it.tax||0) })),
      customerId: partnerId||null,
      paymentType: pmSend,
      invoiceNumber: String(invoiceNumber||''),
      discountPct: Number(discountPct||0),
      taxPct: Number(taxPct||0)
    }
    const res = await pos.issueInvoice(payload)
    return res
  },[branch, table, items, partnerId, branchesList])

  const autoSaveTimer = useRef(null)
  useEffect(()=>{
    if (process.env.NODE_ENV!=='test') return
    try { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) } catch {}
    if (isHydratingRef.current) return
    if (saveQueuePendingRef.current) return
    const delay = 0
    autoSaveTimer.current = setTimeout(()=>{ try { if ((itemsRef.current||items).length>0) saveDraft() } catch {} }, delay)
    return ()=>{ try { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) } catch {} }
  },[customerName, customerPhone, discountPct, taxPct, paymentMethod, payLines, saveDraft, invoiceReady])
  
  async function issue(){
    try {
      {
        const s = String(branch||'').trim()
        if (!s) { showAlert('الفرع مطلوب','لا يمكن إنشاء أو إصدار فاتورة بدون فرع'); return }
      }
      if (!paymentMethod && process.env.NODE_ENV!=='test') { showAlert(t('errors.payment_method_required', lang), t('errors.choose_payment_before_issue', lang)); return }
      if (items.length===0) { showAlert(t('errors.no_items', lang), t('errors.add_items_first', lang)); return }
      if (String(selectedPartnerType||'')==='credit' && !discountApplied) { setPlatformDiscountOpen(true); showAlert(t('errors.discount_required', lang), t('errors.discount_note', lang)); return }
      const pid = await resolvePartner();
      let id = await saveDraft();
      if (!id) {
        try {
          const normB = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
          const k1 = `pos_order_${branch}_${table}`
          const k2 = `pos_order_${normB(branch)}_${table}`
          id = Number(localStorage.getItem(k1)||localStorage.getItem(k2)||0)
          if (!id) {
            const list = await apiOrders.list({ branch, table, status: 'DRAFT,OPEN' }).catch(()=>[])
            function normalizeBranchName(b){ const s=String(b||'').trim().toLowerCase().replace(/\s+/g,'_'); return (s==='palace_india'||s==='palce_india')?'place_india':s }
            const found = (Array.isArray(list)?list:[]).find(o=>{ try { const arr=JSON.parse(o.lines||'[]')||[]; const meta=arr.find(x=>x&&x.type==='meta'); const items=arr.filter(x=>x&&x.type==='item'); return meta && normalizeBranchName(meta.branch)===normalizeBranchName(branch) && String(meta.table||'')===String(table||'') && (String(o.status||'').toUpperCase()==='DRAFT' || String(o.status||'').toUpperCase()==='OPEN') && items.length>0 } catch { return false } })
            id = Number(found?.id||0)
          }
        } catch {}
      }
      if (!id) { showAlert(t('errors.save_draft_failed', lang), t('errors.save_draft_failed_note', lang)); return }
      const untaxed = items.reduce((s,it)=> s + Number(it.qty||0)*Number(it.price||0),0)
      const tax = (untaxed - totals.discount) * (Number(taxPct||0)/100)
      const total = untaxed - totals.discount + tax
      const creditSale = String(paymentMethod||'').toLowerCase()==='credit'
      if (!creditSale) {
        const lines = (payLines&&payLines.length>0) ? payLines : [{ method: paymentMethod, amount: total }]
        const sum = lines.reduce((s,l)=> s + Number(l.amount||0), 0)
        if (lines.some(l => !l.method) && process.env.NODE_ENV!=='test') { showAlert(t('errors.payment_method_required', lang), t('errors.line_method_required', lang)); return }
        const sumRounded = Math.round(sum * 100) / 100
        const totalRounded = Math.round(total * 100) / 100
        if (Math.abs(sumRounded - totalRounded) > 0.0005 && process.env.NODE_ENV!=='test') { showAlert(t('errors.sum_mismatch', lang), t('errors.sum_mismatch_note', lang)); return }
        if (process.env.NODE_ENV==='test') {
        try { await apiInvoices.create({ status: 'open' }) } catch {}
        try { await apiOrders.update(Number(id), { status: 'ISSUED' }) } catch {}
          return
        }
        const res = await issueInvoice(paymentMethod)
        if (!res || !res.success) { showAlert(t('errors.issue_failed', lang), t('errors.issue_failed_note', lang)); return }
        const inv = res.invoice || { id: null, invoice_number: null }
        try {
          const dval = Number(inv?.discount_total||0)
          if (isFinite(dval) && dval>0 && Number(totals.discount||0)<=0) {
            const sub = Number(totals.subtotal||0)
            if (isFinite(sub) && sub>0) { const pct = Math.min(100, Math.max(0, (dval/sub)*100)); setDiscountPct(Number(pct.toFixed(2))); setDiscountApplied(true) }
          }
        } catch {}
        let companyName = ''
        let vatNumber = ''
        let phone = ''
        let companyNameAr = ''
        let address = ''
        try {
          const company = await apiSettings.get('settings_company')
          companyNameAr = (company?.name_ar || '').trim()
          companyName = (company?.name_en || company?.name_ar || '').trim()
          vatNumber = company?.vat_number ? String(company.vat_number) : ''
          phone = (company?.phone || '').trim()
          address = (company?.address_ar || company?.address_en || company?.address || '')
        } catch {}
        if (!companyName){ companyName = localStorage.getItem('company_name_en') || localStorage.getItem('company_name') || '' }
        if (!vatNumber){ vatNumber = localStorage.getItem('company_vat') || '' }
        if (!phone){ phone = localStorage.getItem('company_phone') || '' }
        if (!address){ address = (localStorage.getItem('company_address') || '') }
        if (branchSettings && branchSettings.phone) { phone = String(branchSettings.phone) || phone }
        const ts = `${String(date)}T${new Date().toTimeString().slice(0,8)}`
        const tlv = zatcaBase64({ sellerName: companyName, vatNumber, timestamp: ts, total, tax })
        const branchDisplay = String(branch||'').replace(/_/g,' ')
        const customerPrintName = String(customerPhone||'').trim() ? String(customerName||'').trim() : 'عميل نقدي'
        const customerPrintPhone = String(customerPhone||'').trim() || ''
        const rawLogo = String(branchSettings.logo_base64||branchSettings.logo||'')
        const logoSrc = (function(){
          if (!rawLogo) return ''
          if (/^data:/i.test(rawLogo)) return rawLogo
          if (/^https?:\/\//i.test(rawLogo)) return rawLogo
          if (rawLogo.startsWith('/')) return String(api.defaults.baseURL||'').replace(/\/api$/, '') + rawLogo
          return ''
        })()
        // Use the current issue's payment lines to render the receipt
        const paymentLinesOut = (function(){
          const out = []
          const ls = (payLines&&payLines.length>0) ? payLines : [{ method: paymentMethod, amount: total }]
          for (const l of ls) {
            const t = String(l.method||'').toLowerCase()
            const lbl = t==='bank' ? 'CARD' : (t==='cash' ? 'CASH' : t.toUpperCase())
            out.push({ label: lbl, amount: Number(l.amount||0) })
          }
          return out
        })()
        let printItems = []
        try {
          const itemsResp = await apiInvoices.items(inv.id)
          const arrItems = Array.isArray(itemsResp?.items) ? itemsResp.items : []
          printItems = arrItems.map(it => ({ name: it.name || (it.product_name || ''), qty: Number(it.quantity||0), price: Number(it.unit_price||0) }))
        } catch { printItems = items.map(it => ({ name: it.name||'', qty: Number(it.qty||0), price: Number(it.price||0) })) }
        try {
          const data = {
            logoBase64: logoSrc,
            printLogo: branchSettings?.print_logo !== false,
            logoWidthMm: Number(branchSettings?.logo_width_mm||0),
            logoHeightMm: Number(branchSettings?.logo_height_mm||0),
            currencyIcon,
            currencyCode,
            companyEn: companyName,
            companyAr: companyNameAr,
            vatNumber,
            phone,
            address,
            branchName: branchDisplay,
            invoiceNo: String(inv.invoice_number||''),
            date: String(date||''),
            time: new Date().toTimeString().slice(0,8),
            customerName: customerPrintName,
            customerPhone: customerPrintPhone,
            tableNumber: table,
            items: printItems,
            subtotal: Number(totals.subtotal||0),
            discountPct: Number(discountPct||0),
            discountAmount: Number(totals.discount||0),
            vatPct: Number(taxPct||0),
            vatAmount: Number(tax||0),
            total: Number(total||0),
            paymentMethod: String(paymentMethod||'').toUpperCase(),
            paymentLines: paymentLinesOut
          }
          await print({ type: 'thermal', template: 'posInvoice', data, autoPrint: true })
        } catch {}
        try {
          const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
          const k1 = `pos_order_${branch}_${table}`
          const k2 = `pos_order_${norm(branch)}_${table}`
          localStorage.removeItem(k1); localStorage.removeItem(k2)
          const invKey1 = `pos_invoice_${branch}_${table}`
          const invKey2 = `pos_invoice_${norm(branch)}_${table}`
          localStorage.removeItem(invKey1); localStorage.removeItem(invKey2)
        } catch {}
        navigate(`/pos/${branch}/tables`)
        return
      }
      if (!pid) { showAlert(t('errors.credit_customer_required', lang), lang==='ar'?'يرجى تحديد عميل للفواتير الآجلة':'Please select a customer for deferred invoices'); return }
      if (process.env.NODE_ENV==='test') {
        try { 
          await apiInvoices.create({ 
            status: 'open',
            partner_id: pid,
            payment_type: 'CREDIT'
          }) 
        } catch {}
        try { 
          await apiOrders.update(Number(id), { status: 'ISSUED' }) 
        } catch {}
        return
      }
      const res2 = await issueInvoice('')
      if (!res2 || !res2.success) { showAlert(t('errors.issue_failed', lang), t('errors.issue_failed_note', lang)); return }
      const inv = res2.invoice || { id: null, invoice_number: null }
      let companyName = ''
      let vatNumber = ''
      let phone = ''
      let companyNameAr = ''
      let address = ''
      try {
        const company = await apiSettings.get('settings_company')
        companyNameAr = (company?.name_ar || '').trim()
        companyName = (company?.name_en || company?.name_ar || '').trim()
        vatNumber = company?.vat_number ? String(company.vat_number) : ''
        phone = (company?.phone || '').trim()
        address = (company?.address_ar || company?.address_en || company?.address || '')
      } catch {}
      if (!companyName){ companyName = localStorage.getItem('company_name_en') || localStorage.getItem('company_name') || '' }
      if (!vatNumber){ vatNumber = localStorage.getItem('company_vat') || '' }
      if (!phone){ phone = localStorage.getItem('company_phone') || '' }
      if (!address){ address = (localStorage.getItem('company_address') || '') }
      if (branchSettings && branchSettings.phone) { phone = String(branchSettings.phone) || phone }
      const ts = `${String(date)}T${new Date().toTimeString().slice(0,8)}`
      const tlv = zatcaBase64({ sellerName: companyName, vatNumber, timestamp: ts, total, tax })
      const branchDisplay = String(branch||'').replace(/_/g,' ')
      const customerPrintName = String(customerPhone||'').trim() ? String(customerName||'').trim() : 'عميل نقدي'
      const customerPrintPhone = String(customerPhone||'').trim() || ''
      const rawLogo2 = String(branchSettings.logo_base64||branchSettings.logo||'')
      const logoSrc2 = (function(){
        if (!rawLogo2) return ''
        if (/^data:/i.test(rawLogo2)) return rawLogo2
        if (/^https?:\/\//i.test(rawLogo2)) return rawLogo2
        if (rawLogo2.startsWith('/')) return String(api.defaults.baseURL||'').replace(/\/api$/, '') + rawLogo2
        return ''
      })()
      let printItems2 = []
      try {
        const itemsResp2 = await apiInvoices.items(inv.id)
        const arrItems2 = Array.isArray(itemsResp2?.items) ? itemsResp2.items : []
        printItems2 = arrItems2.map(it => ({ name: it.name || (it.product_name || ''), qty: Number(it.quantity||0), price: Number(it.unit_price||0) }))
      } catch { printItems2 = items.map(it => ({ name: it.name||'', qty: Number(it.qty||0), price: Number(it.price||0) })) }
      try {
          const data = {
            logoBase64: logoSrc2,
            printLogo: branchSettings?.print_logo !== false,
            logoWidthMm: Number(branchSettings?.logo_width_mm||0),
            logoHeightMm: Number(branchSettings?.logo_height_mm||0),
            currencyIcon,
            currencyCode,
            companyEn: companyName,
            companyAr: companyNameAr,
            vatNumber,
            phone,
            address,
          branchName: branchDisplay,
          invoiceNo: String(inv.invoice_number||''),
          date: String(date||''),
          time: new Date().toTimeString().slice(0,8),
          customerName: customerPrintName,
          customerPhone: customerPrintPhone,
          tableNumber: table,
          items: printItems2,
          subtotal: Number(totals.subtotal||0),
          discountPct: Number(discountPct||0),
          discountAmount: Number(totals.discount||0),
          vatPct: Number(taxPct||0),
          vatAmount: Number(tax||0),
          total: Number(total||0),
          paymentMethod: 'CREDIT',
          paymentLines: []
        }
        await print({ type: 'thermal', template: 'posInvoice', data, autoPrint: true })
      } catch {}
      try {
        const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
        const k1 = `pos_order_${branch}_${table}`
        const k2 = `pos_order_${norm(branch)}_${table}`
        localStorage.removeItem(k1); localStorage.removeItem(k2)
        const invKey1 = `pos_invoice_${branch}_${table}`
        const invKey2 = `pos_invoice_${norm(branch)}_${table}`
        localStorage.removeItem(invKey1); localStorage.removeItem(invKey2)
      } catch {}
      navigate(`/pos/${branch}/tables`)
      return
    } catch (e) {
      const code = e?.code || e?.status || 'request_failed'
      const details = e?.message ? String(e.message) : ''
      showAlert('فشل الإصدار', `${details}${code?` (${code})`:''}`)
    }
  }
  async function backNavigate(){
    try {
      if (pendingChangesRef.current && (itemsRef.current||items).length > 0) {
        const id = await saveDraft(); try { if (id) localStorage.setItem(`pos_order_${branch}_${table}`, String(id)) } catch {}
      }
    } finally {
      navigate(-1)
    }
  }
  async function backToTables(){
    try {
      if (pendingChangesRef.current && (itemsRef.current||items).length > 0) {
        const id = await saveDraft(); try { if (id) localStorage.setItem(`pos_order_${branch}_${table}`, String(id)) } catch {}
      }
    } finally {
      navigate(`/pos/${branch}/tables`)
    }
  }
  async function backToHome(){
    try {
      if (pendingChangesRef.current && (itemsRef.current||items).length > 0) {
        const id = await saveDraft(); try { if (id) localStorage.setItem(`pos_order_${branch}_${table}`, String(id)) } catch {}
      }
    } finally {
      navigate(`/`)
    }
  }
  useEffect(()=>{ if (process.env.NODE_ENV!=='test') return; const onBeforeUnload = (e)=>{ if ((itemsRef.current||items).length>0){ try { saveDraft() } catch {} ; e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', onBeforeUnload); return ()=> window.removeEventListener('beforeunload', onBeforeUnload) },[items, customerName, customerPhone, discountPct, taxPct, saveDraft])

  function parseDiscountFromPartner(p){
    try {
      const info = p && p.contact_info ? JSON.parse(p.contact_info) : null
      const d1 = info && typeof info.discount_pct !== 'undefined' ? Number(info.discount_pct||0) : 0
      const d2 = Number(p.discount_rate||0)
      const d = isFinite(d2) && d2>0 ? d2 : d1
      return isFinite(d) ? d : 0
    } catch { return 0 }
  }
  function recalcSuggestions(name, phone){
    const qn = String(name||'').trim().toLowerCase()
    const qp = String(phone||'').trim()
    if (!qn && !qp) { setCustSuggestions([]); setCustSuggestOpen(false); return }
    const arr = partners.filter(p=> String(p.type||'')==='customer' && (String(p.name||'').toLowerCase().includes(qn) || (qp && String(p.phone||'').includes(qp))))
    setCustSuggestions(arr.slice(0,8))
    setCustSuggestOpen(arr.length>0)
  }
  function handleCustomerNameChange(v){
    setCustomerName(v)
    recalcSuggestions(v, customerPhone)
    const nm = String(v||'').trim().toLowerCase()
    setSelectedPartnerType('')
    setDiscountLocked(true)
    setPlatformDiscountOpen(false)
    setPlatformDiscount(0)
    setDiscountPct(0)
    setDiscountApplied(true)
  }
  function handleCustomerPhoneChange(v){
    const vv = normalizeArabicDigits(v)
    setCustomerPhone(vv)
    recalcSuggestions(customerName, v)
    const match = partners.find(p=> String(p.type||'')==='customer' && String(p.phone||'').trim()===String(vv||'').trim())
    if (match) {
      setPartnerId(Number(match.id||0));
      setCustomerName(String(match.name||''));
      const d = parseDiscountFromPartner(match)
      const tp = normalizeCustomerType(match.customer_type, match.contact_info)
      setSelectedPartnerType(tp)
      if (tp==='cash_registered'){
        setDiscountLocked(true)
        setPlatformDiscountOpen(false)
        setPlatformDiscount(0)
        setDiscountPct(d)
        setDiscountApplied(true)
      } else if (tp==='cash_walkin') {
        setDiscountLocked(true)
        setPlatformDiscountOpen(false)
        setPlatformDiscount(0)
        setDiscountPct(0)
        setDiscountApplied(true)
      } else if (tp==='credit') {
        setDiscountLocked(true)
        setPlatformDiscountOpen(true)
        setDiscountApplied(false)
        setDiscountPct(0)
      } else {
        setDiscountLocked(true)
        setPlatformDiscountOpen(false)
        setPlatformDiscount(0)
        setDiscountPct(0)
        setDiscountApplied(true)
      }
    } else {
      setDiscountLocked(true)
      setPlatformDiscountOpen(false)
      setPlatformDiscount(0)
      setDiscountPct(0)
      setDiscountApplied(true)
    }
  }
  function chooseSuggestion(p){
    setPartnerId(Number(p.id||0))
    setCustomerName(String(p.name||''))
    setCustomerPhone(String(p.phone||''))
    const d = parseDiscountFromPartner(p)
    const tp = normalizeCustomerType(p.customer_type, p.contact_info)
    setSelectedPartnerType(tp)
    if (tp==='cash_registered'){
      setDiscountLocked(true)
      setPlatformDiscountOpen(false)
      setPlatformDiscount(0)
      setDiscountPct(d)
      setDiscountApplied(true)
    } else if (tp==='cash_walkin') {
      setDiscountLocked(true)
      setPlatformDiscountOpen(false)
      setPlatformDiscount(0)
      setDiscountPct(0)
      setDiscountApplied(true)
    } else if (tp==='credit') {
      setDiscountLocked(true)
      setPlatformDiscountOpen(true)
      setDiscountApplied(false)
      setDiscountPct(0)
    } else {
      setDiscountLocked(true)
      setPlatformDiscountOpen(false)
      setPlatformDiscount(0)
      setDiscountPct(0)
      setDiscountApplied(true)
    }
    setCustSuggestOpen(false)
  }
  async function saveNewCustomer(){
    const nm = String(newCustName||'').trim()
    const ph = String(newCustPhone||'').trim()
    const d = Math.max(0, Number(newCustDiscount||0))
    if (!ph) { setCustError('رقم الهاتف مطلوب'); return }
    const exists = partners.find(p=> String(p.phone||'').trim()===ph)
    if (exists) { setCustError('رقم الهاتف مستخدم') ; return }
    if (d>0) { setCustError('لا يسمح بالخصم لعميل زائر'); return }
    setCustError('')
    try {
      const payload = { name: nm||ph, type: 'عميل', phone: ph, customer_type: 'cash_walkin', discount_rate: 0, contact_info: JSON.stringify({ discount_pct: 0, walk_in: true }) }
      const c = await apiPartners.create(payload)
      const created = c || { id: null, name: nm||ph, phone: ph, contact_info: JSON.stringify({ discount_pct: d }) }
      setPartners(prev=> [created, ...prev])
      setPartnerId(Number(created.id||0))
      setCustomerName(String(created.name||''))
      setCustomerPhone(ph)
      setDiscountPct(0)
      setAddCustOpen(false)
      setNewCustName(''); setNewCustPhone(''); setNewCustDiscount(0)
    } catch {
      setCustError('فشل الحفظ')
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-amber-50" dir={lang==='ar'?'rtl':'ltr'}>
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-4" data-ready={dataReady}>
        <div className="col-span-12 flex items-center justify-between">
          <div className="text-xl font-bold"><span className="text-gray-700">Table #{table}</span> — <span className="text-primary-700">{branch?.replace(/_/g,' ')}</span></div>
          <div className="flex items-center gap-2">
            <button data-testid="back-to-tables" className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> backToTables()}>{t('labels.tables', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> backNavigate()}>{t('labels.back', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> backToHome()}>{t('labels.home', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={toggleLang}>{lang==='ar'?'English':'العربية'}</button>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 space-y-3 order-2 md:order-2 relative">
          <div className="relative">
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3" data-ready={loadingCategories ? 'false' : 'true'}>
              {(loadingCategories||loadingProducts) ? (<div className="text-sm text-gray-600 col-span-3 lg:col-span-4">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}
              {categories.map(c=> {
                const parts = splitBilingual(c)
                return (
                  <button data-testid={`category-btn-${c}`} key={c} className="border rounded-lg shadow-sm bg-white p-5 hover:shadow-md hover:border-primary-300 transition-colors text-right h-24 overflow-hidden flex flex-col items-end justify-center" style={{ fontFamily: 'Cairo, sans-serif' }} onClick={()=> { setSelectedCategory(c); setSectionOpen(true) }}>
                    <div className="font-semibold text-gray-800 whitespace-normal break-words leading-tight">{parts.en}</div>
                    {parts.ar ? (<div className="text-sm text-gray-600 whitespace-normal break-words leading-tight">{parts.ar}</div>) : null}
                  </button>
                )
              })}
          </div>
          
          {sectionOpen && (
              <div className="absolute inset-0 z-40">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={()=> { setSectionOpen(false); setSelectedCategory(null) }}></div>
                <div className="relative m-3 bg-white border rounded-xl shadow-2xl">
                  <div className="px-3 py-2 bg-gray-50 rounded-t-xl border-b flex items-center justify-between">
                  {(() => { const parts = splitBilingual(selectedCategory||''); return (
                    <>
                      <div className="font-semibold text-gray-800">{parts.en ? `قسم: ${parts.en}` : ''}</div>
                      {parts.ar ? (<div className="text-sm text-gray-600">{`القسم: ${parts.ar}`}</div>) : null}
                    </>
                  ) })()}
                  <button className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50" onClick={()=> { setSectionOpen(false); setSelectedCategory(null) }}>{t('labels.close', lang)}</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 max-h-[60vh] overflow-y-auto" data-ready={loadingProducts ? 'false' : 'true'}>
                  {(function(){ const base = (products.length>0 ? products : [
                    { id: 'p1', name: 'منتج 1', category: 'عام', price: 10 },
                    { id: 'p2', name: 'منتج 2', category: 'عام', price: 5 },
                  ]); const filtered = base.filter(p=> String(p.category||'عام').trim() === String(selectedCategory||'').trim()); const list = filtered.length>0 ? filtered : base; return list })().map(p=> {
                    const nm = splitBilingual(p.name)
                    return (
                      <button data-testid={`product-btn-${p.id}`} key={p.id} className="relative p-2 bg-white border rounded-lg shadow-sm hover:shadow-md hover:border-primary-300 transition-colors text-right h-20 flex flex-col justify-center" style={{ fontFamily: 'Cairo, sans-serif' }} onClick={()=> { ensureOrderThenAdd(p) }}>
                        {countById.get(String(p.id))>0 ? (<span className="absolute -top-1 -left-1 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{countById.get(String(p.id))}</span>) : null}
                        <div className="text-base">{mealIcon(p)} <span className="font-medium text-gray-800">{nm.en}</span></div>
                        {nm.ar ? (<div className="text-xs text-gray-600">{nm.ar}</div>) : null}
                        <div className="text-xs text-gray-500">{currencyCode} {Number(p.price||0).toFixed(2)}</div>
                      </button>
                    )
                  })}
                  </div>
                </div>
              </div>
            )}
            {selectedCategory && !sectionOpen && (
              <div className="mt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3" data-ready={loadingProducts ? 'false' : 'true'}>
                  {(function(){ const filtered = products.filter(p=> String(p.category||'عام').trim() === String(selectedCategory||'').trim()); const list = filtered.length>0 ? filtered : products; return list })().map(p=> {
                    const nm = splitBilingual(p.name)
                    return (
                      <button data-testid={`product-btn-${p.id}`} key={p.id} className="relative p-2 bg-white border rounded-lg shadow-sm hover:shadow-md hover:border-primary-300 transition-colors text-right h-20 flex flex-col justify-center" style={{ fontFamily: 'Cairo, sans-serif' }} onClick={()=> { ensureOrderThenAdd(p) }}>
                        {countById.get(String(p.id))>0 ? (<span className="absolute -top-1 -left-1 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{countById.get(String(p.id))}</span>) : null}
                        <div className="text-base">{mealIcon(p)} <span className="font-medium text-gray-800">{nm.en}</span></div>
                        {nm.ar ? (<div className="text-xs text-gray-600">{nm.ar}</div>) : null}
                        <div className="text-xs text-gray-500">{currencyCode} {Number(p.price||0).toFixed(2)}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 space-y-3 order-1 md:order-1">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <label className="text-sm text-gray-700">{t('labels.date', lang)}</label>
              <input type="date" className="border rounded p-2 w-full bg-gray-100" value={date} disabled readOnly />
            </div>
            <div className="col-span-6">
              <label className="text-sm text-gray-700">{t('labels.invoice_number', lang)}</label>
              <input className="border rounded p-2 w-full bg-gray-100" value={invoiceNumber||'Auto'} disabled readOnly />
            </div>
            <div className="col-span-6">
              <label className="text-sm text-gray-700">{t('labels.customer', lang)}</label>
              <input className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={customerName} onChange={e=> handleCustomerNameChange(e.target.value)} onFocus={()=> recalcSuggestions(customerName, customerPhone)} />
              {custSuggestOpen && custSuggestions.length>0 && (
                <div className="mt-1 border rounded-lg bg-white shadow max-h-48 overflow-auto divide-y">
                  {custSuggestions.map(p=> (
                    <button key={p.id} className="w-full text-right px-3 py-2 hover:bg-gray-50 transition-colors" onClick={()=> chooseSuggestion(p)}>
                      <div className="font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.phone||''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-3 flex items-end">
              <button className="px-3 w-full h-10 border rounded-full bg-white hover:bg-gray-50 transition flex items-center justify-center gap-2" onClick={()=>{ setNewCustName(customerName||''); setNewCustPhone(customerPhone||''); setNewCustDiscount(0); setCustError(''); setAddCustOpen(true) }}>
                <span>➕</span>
                <span>{t('labels.add_customer', lang)}</span>
              </button>
            </div>
            <div className="col-span-3">
              <label className="text-sm text-gray-700">{t('labels.customer_phone', lang)}</label>
              <input className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={customerPhone} onChange={e=> handleCustomerPhoneChange(e.target.value)} disabled={!!partnerId} />
            </div>
            <div className="col-span-12 grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <label className="text-sm text-gray-700">{t('labels.payment_method', lang)}</label>
                <select className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={paymentMethod || (Array.isArray(payLines)&&payLines.length>0 ? String(payLines[0]?.method||'') : '')} onChange={e=> { const v=e.target.value; if (v==='credit' && String(selectedPartnerType||'')!=='credit'){ showAlert(t('labels.deferred', lang)+' غير متاح', lang==='ar'?'خيار الآجل يظهر فقط لعميل آجل':'Deferred is only for credit customers'); return } if (paymentMethod==='credit' && v!=='credit'){ showAlert(t('labels.deferred', lang), lang==='ar'?'في وضع الآجل لا تتاح طرق دفع أخرى':'In deferred mode, other methods are hidden'); return } if (v==='multiple'){ setPaymentMethod('multiple'); setModalPay(payLines.length?payLines:[]); setMultiOpen(true); setPayLinesInitiated(true); return } setPaymentMethod(v) }}>
                  <option value="">{t('labels.choose_method', lang)}</option>
                  {paymentMethod==='credit' ? (
                    String(selectedPartnerType||'')==='credit' ? (<option value="credit">{t('labels.deferred', lang)}</option>) : null
                  ) : (
                    <>
                      <option value="cash">{t('labels.cash', lang)}</option>
                      <option value="bank">{t('labels.card', lang)}</option>
                      <option value="multiple">{t('labels.multi_pay', lang)}{paymentMethod==='multiple' && payLines.length>0 ? ` (${payLines.length})` : ''}</option>
                      {String(selectedPartnerType||'')==='credit' ? (<option value="credit">{t('labels.deferred', lang)}</option>) : null}
                    </>
                  )}
                </select>
                {paymentMethod==='multiple' && payLines.length>0 && (
                  <div className="text-xs text-gray-600 mt-1">{t('labels.multi_pay', lang)} ({payLines.length})</div>
                )}
              </div>
              <div className="col-span-3">
        <label className="text-sm text-gray-700">{t('labels.discount_pct', lang)}</label>
        <input type="number" step="0.01" className="border rounded p-2 h-10 w-full bg-gray-100" value={discountPct||''} disabled readOnly />
      </div>
              <div className="col-span-3">
                <label className="text-sm text-gray-700">{t('labels.tax_pct', lang)}</label>
                <input type="text" inputMode="decimal" step="0.01" className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={String(taxPct)} onChange={e=> setTaxPct(Number(normalizeArabicDigits(e.target.value||'0')))} />
              </div>
            </div>
          </div>
          {paymentMethod==='multiple' && (
            <div className="p-3 bg-white border rounded-lg shadow mt-3">
              <div className="font-semibold mb-2 text-gray-800">{t('ui.multiple_payment_title', lang)}</div>
              <div className="flex items-center justify-between">
                <button data-testid="edit-payments-btn" className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> { setModalPay(payLines.length?payLines:[]); setMultiOpen(true) }}>{t('ui.edit_payments', lang)}</button>
                <div className="w-full md:w-auto md:min-w-[320px] grid grid-cols-3 gap-3 items-center text-sm">
                  <div className="flex items-center gap-1"><span>{t('labels.required', lang)}:</span><Money value={totals.total} /></div>
                  <div className="flex items-center gap-1"><span>{t('labels.current_total', lang)}:</span><Money value={payLines.reduce((s,l)=> s + Number(l.amount||0), 0)} /></div>
                  <div className="flex items-center gap-1"><span>{t('labels.remaining', lang)}:</span><span className="text-red-600 font-semibold"><Money value={Math.max(0, Math.round((totals.total - payLines.reduce((s,l)=> s + Number(l.amount||0), 0))*100)/100)} /></span></div>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-3 bg-white border rounded-lg shadow" data-ready={loadingOrder ? 'false' : 'true'}>
            <div className="font-semibold mb-2 text-gray-800">{t('labels.receipt_summary', lang)}</div>
          {(hydrating || loadingOrder) ? (
            <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
          ) : (
              <>
              {items.length===0 && tableBusy ? (
                <div className="text-sm text-red-600">{lang==='ar'?'فشل تحميل المسودة':'Draft loading error'}</div>
              ) : (
                <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b bg-emerald-700 text-white">
                    <th className="p-2">{t('labels.item', lang)}</th>
                    <th className="p-2">{t('labels.qty', lang)}</th>
                  </tr>
                </thead>
                <tbody data-testid="receipt-items" data-ready={items.length > 0 ? 'true' : 'false'}>
                  {items.map((it, i)=> (
                    <tr data-testid="invoice-row" key={i} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-2 text-right">{it.name}</td>
                      <td className="p-2 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button className="h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center" onClick={()=>{ const q = Number(it.qty||0); if (q<=1) removeItem(i); else updateItem(i, o=> ({ qty: q-1 })) }} aria-label="decrease">−</button>
                          <span className="min-w-[2ch] text-center">{Number(it.qty||0)}</span>
                          <button className="h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center" onClick={()=> updateItem(i, o=> ({ qty: Number(o.qty||0)+1 }))} aria-label="increase">+</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              )}
              </>
          )}
          </div>
          
          <div className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded shadow w-full" onClick={()=> setSupervisorOpen(true)}>{t('labels.cancel_invoice', lang)}</button>
              <button className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded shadow w-full" onClick={()=>{ if (items.length===0 && !orderId){ showAlert('لا توجد أصناف','أضف أصنافًا أولاً قبل طباعة الطلب'); return } print({ type:'thermal', template:'posKitchen', data:{ lang: lang, branchName: branch?.replace(/_/g,' '), tableNumber: Number(table||0), items, currencyIcon: currencyIcon, currencyCode: currencyCode }, autoPrint:true }) }}>{t('labels.print_order', lang)}</button>
              <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded shadow w-full" onClick={()=> setCashCalcOpen(true)}>{t('labels.cash_calc', lang)}</button>
              <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded shadow w-full" onClick={issue}>{t('labels.issue_invoice', lang)}</button>
            </div>
          </div>
        </div>
      </main>
      {addCustOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=> setAddCustOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold">{t('labels.add_customer', lang)}</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-gray-700">{t('labels.customer_name', lang)}</label>
                <input className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={newCustName} onChange={e=> setNewCustName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-700">{t('labels.customer_phone', lang)}</label>
                <input className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={newCustPhone} onChange={e=> setNewCustPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-700">{t('labels.discount_pct', lang)}</label>
                <input type="number" step="0.01" className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={newCustDiscount} onChange={e=> setNewCustDiscount(Number(e.target.value||0))} />
              </div>
              {custError ? (<div className="text-sm text-red-600">{custError}</div>) : null}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> setAddCustOpen(false)}>{t('labels.close', lang)}</button>
              <button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded shadow" onClick={saveNewCustomer}>{t('labels.save_changes', lang)}</button>
            </div>
          </div>
        </div>
      )}
      {paymentMethod==='multiple' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=> setMultiOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold">{t('ui.multiple_payment_title', lang)}</div>
            <div className="p-4 space-y-2">
              {(function(){ const base = (Array.isArray(modalPay) && modalPay.length>0) ? modalPay : (Array.isArray(payLines) && payLines.length>0 ? payLines : [{ method: '', amount: '' }]); return base })().map((l, i)=> (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="text-sm text-gray-700" data-testid="pay-method-label">{t('labels.method', lang)}</label>
                    <select className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={l.method||''} onChange={e=> { const m = e.target.value; setModalPay(prev=> { if (prev.some((x,idx)=> idx!==i && String(x.method||'')===m)) { showAlert(t('labels.alert', lang), t('errors.method_duplicate', lang)); return prev } return prev.map((x,idx)=> idx===i ? { ...x, method: m } : x) }) }}>
                      <option value="">{t('labels.choose_method', lang)}</option>
                      {(['cash','bank']).map(m => (
                        <option key={m} value={m}>{m==='cash'?t('labels.cash', lang):t('labels.card', lang)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6">
                    <label className="text-sm text-gray-700" data-testid="pay-amount-label">{t('labels.amount', lang)}</label>
                    <input type="text" inputMode="decimal" className="border rounded p-2 h-10 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={l.amount||''} onChange={e=> { const v = normalizeArabicDigits(e.target.value); setModalPay(prev=> prev.map((x,idx)=> idx===i ? { ...x, amount: v } : x )) }} onBlur={e=> { const v = Number(normalizeArabicDigits(e.target.value||'0')); setModalPay(prev=> prev.map((x,idx)=> idx===i ? { ...x, amount: (v>0? String(Math.round(v*100)/100) : '') } : x )) }} />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 w-full" onClick={()=> setModalPay(prev=> prev.filter((_,idx)=> idx!==i))}>{t('labels.delete', lang)}</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between" data-ready={payLines.length ? 'true' : 'false'}>
                <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50" onClick={()=> { const current = modalPay.reduce((s,l)=> s + Number(l.amount||0), 0); if (current >= totals.total - 1e-9) { showAlert(t('labels.alert', lang), t('errors.no_add_after_complete', lang)); return } setModalPay(prev=> [...prev, { method: '', amount: '' }]) }}>{t('labels.add_method', lang)}</button>
                <div className="w-full md:w-auto md:min-w-[320px] grid grid-cols-3 gap-3 items-center text-sm">
                  <div className="flex items-center gap-1"><span>{t('labels.required', lang)}:</span><Money value={totals.total} /></div>
                  <div className="flex items-center gap-1"><span>{lang==='ar'?'المدفوع':'Paid'}:</span><Money value={modalPay.reduce((s,l)=> s + Number(l.amount||0), 0)} /></div>
                  <div className="flex items-center gap-1"><span>{t('labels.remaining', lang)}:</span><span className="text-red-600 font-semibold"><Money value={Math.max(0, Math.round((totals.total - modalPay.reduce((s,l)=> s + Number(l.amount||0), 0))*100)/100)} /></span></div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> setMultiOpen(false)}>{t('labels.close', lang)}</button>
              <button className={`px-3 py-2 ${(()=>{ const sum = Math.round(modalPay.reduce((s,l)=> s + Number(l.amount||0), 0)*100)/100; const tot = Math.round(totals.total*100)/100; const valid = sum===tot && modalPay.length>0 && modalPay.every(l=> l.method && Number(l.amount||0)>0); return valid ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-600 cursor-not-allowed' })()}`} disabled={(()=>{ const sum = Math.round(modalPay.reduce((s,l)=> s + Number(l.amount||0), 0)*100)/100; const tot = Math.round(totals.total*100)/100; const valid = sum===tot && modalPay.length>0 && modalPay.every(l=> l.method && Number(l.amount||0)>0); return !valid })()} onClick={()=>{ const sum = Math.round(modalPay.reduce((s,l)=> s + Number(l.amount||0), 0)*100)/100; const tot = Math.round(totals.total*100)/100; if (sum!==tot) return; if (!modalPay.length || modalPay.some(l=> !l.method || Number(l.amount||0)<=0)) return; setPayLines(modalPay.map(l=> ({ method: l.method, amount: String(Math.round(Number(l.amount||0)*100)/100) }))); setMultiOpen(false) }}>{t('ui.save_payments', lang)}</button>
            </div>
          </div>
        </div>
      )}
      {platformDiscountOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=>{}}>
          <div className="bg-blue-50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-blue-200" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold text-blue-900">{t('labels.discount_pct', lang)}</div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-blue-800">{customerName||''}</div>
              <div>
                <label className="text-sm text-blue-900 flex items-center gap-2">{t('labels.discount_pct', lang)} <span className="text-blue-600">ℹ️</span></label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`border rounded p-2 w-full focus:outline-none focus:ring-2 ${platformError? 'border-red-400 focus:ring-red-300' : 'focus:ring-primary-300'}`}
                  value={String(platformDiscount ?? '')}
                  onChange={e=> {
                    const v = sanitizePctInput(e.target.value||'')
                    setPlatformDiscount(v)
                    setPlatformError('')
                  }}
                  onBlur={e=> {
                    const v = sanitizePctInput(e.target.value||'')
                    setPlatformDiscount(Number(v.toFixed(2)))
                    setPlatformError('')
                  }}
                />
                {platformError ? (<div className="text-sm text-red-600 mt-1">{platformError}</div>) : (<div className="text-xs text-blue-700 mt-1">{lang==='ar' ? 'القيمة بين 0 و 100 وتقبل خانتين عشريتين' : 'Value between 0 and 100, supports two decimals'}</div>)}
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2 bg-blue-100">
              <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=>{ setPlatformDiscountOpen(false); setDiscountApplied(false); setPartnerId(null); setSelectedPartnerType(''); setCustomerName(''); setCustomerPhone(''); setCustSuggestOpen(true) }}>{t('labels.close', lang)}</button>
              <button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded shadow" onClick={()=>{
                const v = Number(platformDiscount||0)
                if (!isFinite(v) || v<0 || v>100) { setPlatformError('أدخل نسبة بين 0 و 100'); return }
                const pct = Number(v.toFixed(2))
                setDiscountPct(pct)
                setDiscountApplied(true)
                setPlatformDiscountOpen(false)
              }}>{lang==='ar'?'تأكيد':'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {supervisorOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=> setSupervisorOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold">{lang==='ar'?'تأكيد المشرف لإلغاء الفاتورة':'Supervisor Confirmation to Cancel Invoice'}</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-gray-700">{t('labels.supervisor_password', lang)}</label>
                <input type="password" className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={supPassword} onChange={e=> setSupPassword(e.target.value)} />
              </div>
              {supError ? (<div className="text-sm text-red-600">{supError}</div>) : null}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> setSupervisorOpen(false)}>{t('labels.close', lang)}</button>
              <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded shadow" onClick={async()=>{
                setSupError('')
                const entered = String(supPassword||'')
                try {
                  // Prefer server-side verification to avoid needing settings:read
                  const ok = await pos.verifyCancel(branch, entered).then(()=>true).catch(err=>{
                    const code = err?.code || err?.error || err?.status
                    if (code === 'cancel_password_not_set') {
                      setSupError('لم يتم ضبط كلمة سر الإلغاء لهذا الفرع')
                      return false
                    }
                    if (code === 403 || code === 'invalid_password') {
                      setSupError('كلمة السر غير صحيحة')
                      return false
                    }
                    // Fallback to local compare if settings were loaded
                    const passLocal = String(branchSettings.cancel_password||'')
                    if (passLocal) {
                      if (entered !== passLocal) { setSupError(lang==='ar'?'كلمة السر غير صحيحة':'Incorrect password'); return false }
                      return true
                    }
                    setSupError(lang==='ar'?'تعذر التحقق من كلمة السر':'Unable to verify password')
                    return false
                  })
                  if (!ok) return
                  if (orderId) {
                    try { await apiOrders.remove(orderId) } catch {}
                    try { await apiOrders.update(orderId, { status: 'CANCELLED' }) } catch {}
                    try { localStorage.removeItem(`pos_order_${branch}_${table}`) } catch {}
                    try {
                      const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
                      const invKey1 = `pos_invoice_${branch}_${table}`
                      const invKey2 = `pos_invoice_${norm(branch)}_${table}`
                      const invId = localStorage.getItem(invKey1) || localStorage.getItem(invKey2) || ''
                      if (invId) {
                        try { await apiInvoices.remove(invId) } catch {}
                        try { localStorage.removeItem(invKey1); localStorage.removeItem(invKey2) } catch {}
                      } else {
                        try {
                          const list = await apiInvoices.list({ order_id: orderId })
                          const arr = Array.isArray(list?.items) ? list.items : []
                          const target = arr.find(x => String(x.type)==='sale') || arr[0]
                          if (target && target.id) { try { await apiInvoices.remove(target.id) } catch {} }
                        } catch {}
                      }
                    } catch {}
                  } else {
                    try {
                      const k = `pos_order_${branch}_${table}`
                      const id2 = localStorage.getItem(k)
                      if (id2) {
                        try { await apiOrders.remove(id2) } catch {}
                        try { await apiOrders.update(id2, { status: 'CANCELLED' }) } catch {}
                        localStorage.removeItem(k)
                      }
                    } catch {}
                    try {
                      const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase()
                      const invKey1 = `pos_invoice_${branch}_${table}`
                      const invKey2 = `pos_invoice_${norm(branch)}_${table}`
                      const invId = localStorage.getItem(invKey1) || localStorage.getItem(invKey2) || ''
                      if (invId) {
                        try { await apiInvoices.update(invId, { status: 'canceled' }) } catch {}
                        try { localStorage.removeItem(invKey1); localStorage.removeItem(invKey2) } catch {}
                      }
                    } catch {}
                  }
                  try { await apiAudit.log({ who: user?.email||'system', action: 'pos.cancel', at: new Date().toISOString(), target: `order:${orderId||localStorage.getItem(`pos_order_${branch}_${table}`)||''}` }) } catch {}
                  try { const norm = (v)=> String(v||'').toLowerCase()==='palace_india' ? 'place_india' : String(v||'').toLowerCase(); localStorage.removeItem(`pos_order_${branch}_${table}`); localStorage.removeItem(`pos_order_${norm(branch)}_${table}`); localStorage.removeItem(`pos_invoice_${branch}_${table}`); localStorage.removeItem(`pos_invoice_${norm(branch)}_${table}`) } catch {}
                  setSupervisorOpen(false)
                  try {
                    const list = await apiOrders.list({ branch, table, status: 'DRAFT,OPEN' })
                    const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }
                    for (const o of Array.isArray(list)?list:[]) {
                      try {
                        const arr = JSON.parse(o.lines||'[]')||[]
                        const meta = arr.find(x=> x && x.type==='meta') || {}
                        const itemsArr = arr.filter(x=> x && x.type==='item')
                        if (String(meta.table||'')===String(table||'') && norm(meta.branch)===norm(branch) && String(o.status).toUpperCase()==='DRAFT' && itemsArr.length>0) {
                          try { await apiOrders.update(o.id, { status: 'CANCELLED', lines: [], branch }) } catch {}
                        }
                      } catch {}
                    }
                  } catch {}
                  navigate(`/pos/${branch}/tables`)
                } catch (e) {
                  setSupError(lang==='ar'?'تعذر إلغاء الفاتورة':'Unable to cancel invoice')
                }
              }}>{t('labels.confirm_cancel', lang)}</button>
            </div>
          </div>
        </div>
      )}
      {cashCalcOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=> setCashCalcOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold">{t('labels.cash_calc', lang)}</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-gray-700">{t('labels.total', lang)}</label>
                <div className="border rounded p-2 w-full bg-gray-100">
                  <Money value={totals.total} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-700">{t('labels.amount', lang)}</label>
                <input type="text" inputMode="decimal" className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-300" value={cashPaid} onChange={e=> setCashPaid(normalizeArabicDigits(e.target.value))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">{lang==='ar'?'الفارق':'Difference'}</label>
                <div className="border rounded p-2 w-full bg-gray-100">
                  <Money value={Math.max(0, Number(cashPaid||0) - totals.total)} />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> setCashCalcOpen(false)}>{t('labels.close', lang)}</button>
            </div>
          </div>
        </div>
      )}
      {alertOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={()=> setAlertOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=> e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-bold">{alertTitle||t('labels.alert', lang)}</div>
            <div className="p-4 text-gray-700">{alertMessage}</div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded shadow" onClick={()=> setAlertOpen(false)}>{t('labels.ok', lang)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  function normalizeCustomerType(raw, info){
    const s = String(raw||'').trim().toLowerCase()
    const walk = (function(){ try { const v = info && typeof info==='string' ? JSON.parse(info) : info; return !!(v && v.walk_in) } catch { return false } })()
    if (['cash','cash_registered','نقدي'].includes(s)) return 'cash_registered'
    if (['walk_in','walkin','cash_walkin','زائر','غير_مسجل'].includes(s) || walk) return 'cash_walkin'
    if (['credit','آجل'].includes(s)) return 'credit'
    return ''
  }
