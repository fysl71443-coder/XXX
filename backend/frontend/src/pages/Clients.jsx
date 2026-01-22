import { useEffect, useMemo, useState, useCallback } from 'react'
import api, { partners, invoices, payments, settings as apiSettings, debug as apiDebug, products as apiProducts, auth as apiAuth, reports } from '../services/api'
import ClientsInvoicesAll from './ClientsInvoicesAll'
import ClientsInvoicesPaid from './ClientsInvoicesPaid'
import { useAuth } from '../context/AuthContext'
import ClientStatement from '../components/ClientStatement'
import { FaPlus, FaEdit, FaTrash, FaFilePdf, FaFileExcel, FaHome, FaSearch, FaFilter, FaEye, FaRegEnvelope, FaMoneyBill, FaFileInvoice, FaUndoAlt, FaTags, FaDownload, FaTimes, FaUsers } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPDF } from '../utils/pdfUtils'
import { printReceiptPDF, printCustomerInvoiceSkeletonPDF, printCreditNoteSkeletonPDF } from '../printing/pdf/autoReports'
import { printClientStatementPDF } from '../printing/pdf/reportPdf'
import { print } from '@/printing'
 
 
import AdvancedFilters from '../components/AdvancedFilters'
import { t } from '../utils/i18n'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { periods } from '../services/api'
import ClientsStatsBar from '../components/ClientsStatsBar'
import Button from '../ui/Button'

export default function Clients() {
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'عميل', email: '', phone: '',
    customer_type: '', fixed_discount_pct: '', trade_name: '', legal_name: '', short_name: '', classification: '',
    cr_number: '', cr_city: '', cr_issue_date: '', tax_id: '', vat_registered: false, vat_registration_date: '',
    addr_country: '', addr_city: '', addr_district: '', addr_street: '', addr_building: '', addr_postal: '', addr_additional: '', addr_description: '',
    mobile: '', website: '',
    contact_person_name: '', contact_person_mobile: '', contact_person_email: '', contact_person_role: '',
    gl_account: '1020', pricing_method: 'inclusive', default_payment_method: '', payment_term: '', credit_limit: '', invoice_send_method: 'Email',
    shipping_address: '', billing_address: '',
    internal_notes: '', billing_instructions: '', collection_instructions: '',
    country: '', city: '', tags: [],
    national_id: ''
  })
  const [editing, setEditing] = useState(null)
  const [activeTab, setActiveTab] = useState('customers')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ customerType: '', vatStatus: '', country: '', city: '', tag: '', dateFrom: '', dateTo: '', balanceType: '', invoiceStatus: '' })
  const [selected, setSelected] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [viewMode] = useState('table')
  const [action, setAction] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Cash', note: '', date: '' })
  const [invFilters, setInvFilters] = useState({ partner_id: '', status: '', from: '', to: '', branch: '', due: '' })
  const [payFilters, setPayFilters] = useState({ partner_id: '', invoice_id: '', from: '', to: '' })
  const [payLoading, setPayLoading] = useState(false)
  const [payRows, setPayRows] = useState([])
  const [invTotalsById, setInvTotalsById] = useState({})
  const [invLedgerById, setInvLedgerById] = useState({})
  const [receivablesRows, setReceivablesRows] = useState([])
  const [receivablesLoading, setReceivablesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const partnerById = useMemo(() => {
    const m = new Map()
    const safeItems = Array.isArray(items) ? items : []
    safeItems.forEach(p => m.set(p.id, p))
    return m
  }, [items])
  
  const [followSummaryOpen, setFollowSummaryOpen] = useState(false)
  const [clientStatementOpen, setClientStatementOpen] = useState(false)
  const [branding, setBranding] = useState(null)
  const [company, setCompany] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  
  // CRITICAL: Single useAuth call - unified auth state
  const { user: me, can, loading: authLoading, isLoggedIn, isAdmin } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('open')

  const [error, setError] = useState('')
  
  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await partners.list({ type: 'customer' })
      if (!data) {
        console.warn('[Clients] No data returned from API')
        setItems([])
        return
      }
      const filtered = ((Array.isArray(data)?data:(data?.items||[]))||[]).filter(x => {
        const t = String(x.type||'').toLowerCase()
        return t === 'customer' || x.type === 'عميل'
      })
      setItems(filtered)
    } catch (e) {
      console.error('[Clients] Error loading data:', e)
      if (e?.status === 403) {
        setError(lang === 'ar' ? 'ليس لديك صلاحية لعرض هذه الشاشة' : 'You do not have permission to view this screen')
      } else {
        setError(lang === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data')
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => { 
    // Don't make API calls until auth is ready
    if (authLoading || !isLoggedIn) {
      console.log('[Clients] Waiting for auth before loading data...');
      return;
    }
    load() 
  }, [authLoading, isLoggedIn, load])
  
  // Load period status - only once on mount, after auth is ready
  useEffect(()=>{ 
    if (authLoading || !isLoggedIn) return;
    (async()=>{ 
      try { 
        const d = new Date(); 
        const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
        if (typeof periods?.get === 'function') { 
          const s = await periods.get(per); 
          setPeriodStatus(String(s?.status||'open')) 
        } 
      } catch {} 
    })() 
  },[authLoading, isLoggedIn])
  async function ensureWalkInPartnerId(){
    try {
      const list = await partners.list({ type: 'customer' })
      const found = (Array.isArray(list)?list:[]).find(p => {
        const nm = String(p.name||'').trim().toLowerCase()
        let flag = false
        try {
          const info = p && p.contact_info ? JSON.parse(p.contact_info) : null
          flag = !!(info && (info.walk_in || info.cash_customer))
        } catch {}
        return flag || nm === 'عميل نقدي' || nm === 'cash customer' || nm === 'walk-in'
      })
      if (found) return Number(found.id||0)
      const c = await partners.create({ name: 'عميل نقدي', type: 'customer', customer_type: 'نقدي', phone: null, contact_info: { walk_in: true } })
      return Number(c?.id||0)
    } catch { return null }
  }
  useEffect(() => {
    const p = String((location && location.pathname) || '')
    if (p.startsWith('/clients')){
      if (p==='/clients' || p.endsWith('/')) { setActiveTab('home') }
      else if (p.endsWith('/cash')) { setActiveTab('cash') }
      else if (p.endsWith('/credit')) { setActiveTab('credit') }
      else if (p.endsWith('/receivables')) { setActiveTab('receivables') }
      else if (p.endsWith('/payments')) { setActiveTab('payments') }
      else if (p.endsWith('/paid')) { setActiveTab('paid') }
      else if (p.endsWith('/statements')) { setActiveTab('statements') }
    }
  }, [location.pathname])
  useEffect(() => {
    function onStorage(e){
      if (e.key === 'partners_refresh') { load() }
      if (e.key === 'partner_created') {
        try {
          const created = JSON.parse(e.newValue||'null')
          if (created && created.id) {
            setItems(prev => {
              const exists = prev.some(x => x.id === created.id)
              return exists ? prev : [created, ...prev]
            })
          } else {
            load()
          }
        } catch { load() }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => {
    if (location.state && location.state.created) {
      const created = location.state.created
      setItems(prev => {
        const exists = prev.some(x => x.id === created.id)
        return exists ? prev : [created, ...prev]
      })
      setTimeout(() => navigate('/clients', { replace: true, state: {} }), 0)
    }
  }, [location, navigate])

  

  useEffect(()=>{
    const get = apiSettings?.get
    if (typeof get === 'function') {
      Promise.all([
        get('settings_branding').catch(()=>null),
        get('settings_footer').catch(()=>null),
      ]).then(([b,f])=>{ setBranding(b); setFooterCfg(f) })
    }
  },[])

  useEffect(() => {
    if (location.state && location.state.issuedInvoice) {
      const inv = location.state.issuedInvoice
      setActiveTab('invoices')
      setTimeout(() => navigate('/clients', { replace: true, state: {} }), 0)
    }
  }, [location, navigate])

  useEffect(() => {
    const st = location.state || {}
    if (st.openCustomerId && items.length) {
      const c = items.find(x => String(x.id)===String(st.openCustomerId))
      if (c) { setSelected(c); setModalOpen(true) }
      setTimeout(() => navigate('/clients', { replace: true, state: {} }), 0)
    }
  }, [location.state, items, navigate])


  useEffect(() => {
    const payTabs = ['home','invoices','payments','followups','aging','due','receivables']
    if (payTabs.includes(activeTab)) {
      async function loadPayments() {
        setPayLoading(true)
        try {
          const params = {}
          if (activeTab==='credits') {
            // removed
          } else {
            if (payFilters.partner_id) params.partner_id = payFilters.partner_id
            if (payFilters.invoice_id) params.invoice_id = payFilters.invoice_id
            if (payFilters.from) params.from = payFilters.from
            if (payFilters.to) params.to = payFilters.to
            if ((activeTab==='aging' || activeTab==='due' || activeTab==='receivables') && (invFilters.partner_id || (selected && selected.id))) {
              params.partner_id = invFilters.partner_id || selected.id
            }
          }
          const res = await payments.list({ ...params, party_type: 'customer' })
          setPayRows(res?.items||res||[])
        } catch(e) {
          setPayRows([])
        } finally {
          setPayLoading(false)
        }
      }
      loadPayments()
    }
  }, [activeTab, payFilters, invFilters])

  const [summaryAll, setSummaryAll] = useState(null)
  useEffect(()=>{
    if (activeTab!=='home') return
    (async()=>{
      try {
        const res = await invoices.list({ type:'sale', pageSize: 2000 })
        const rows = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
        const totInv = rows.reduce((s,inv)=> s + (Number(inv.paid_amount||0) + Number(inv.remaining_amount||0)), 0)
        const byLastPay = new Map()
        const safePayRows = Array.isArray(payRows) ? payRows : []
        safePayRows.forEach(p => {
          const id = Number(p.invoice_id||p.invoice?.id||0)
          const prev = byLastPay.get(id)
          const curr = new Date(p.date)
          if (!prev || curr > prev) byLastPay.set(id, curr)
        })
        let totPaid = 0, totRec = 0, daysSum = 0, daysCount = 0
        const safeRows = Array.isArray(rows) ? rows : []
        safeRows.forEach(inv => {
          totPaid += Number(inv.paid_amount||0)
          totRec += Number(inv.remaining_amount||0)
          const last = byLastPay.get(Number(inv.id||0))
          if (last) {
            const invDate = new Date(inv.date)
            const diffDays = Math.max(0, Math.round((last.getTime()-invDate.getTime())/86400000))
            daysSum += diffDays
            daysCount += 1
          }
        })
        const avgDays = daysCount>0 ? (daysSum/daysCount) : 0
        setSummaryAll({ totInv, totPaid, totRec, avgDays })
      } catch {
        setSummaryAll({ totInv:0, totPaid:0, totRec:0, avgDays:0 })
      }
    })()
  },[activeTab, payRows])

  useEffect(()=>{
    if (activeTab !== 'receivables') return
    (async()=>{
      setReceivablesLoading(true)
      try {
        const pid = invFilters.partner_id || (selected?.id || '')
        const res = await reports.customerLedger({ ...(pid?{ partner_id: pid }:{}), from: invFilters.from||'', to: invFilters.to||'' })
        setReceivablesRows(Array.isArray(res?.items)?res.items:[])
      } catch { setReceivablesRows([]) } finally { setReceivablesLoading(false) }
    })()
  },[activeTab, invFilters.partner_id, invFilters.from, invFilters.to, selected])

  useEffect(() => {
    if (activeTab !== 'payments') return
    (async () => {
      try {
        const params = { type: 'sale' }
        if (payFilters.partner_id) params.partner_id = payFilters.partner_id
        if (payFilters.from) params.from = payFilters.from
        if (payFilters.to) params.to = payFilters.to
        const res = await invoices.list(params)
        const rows = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
        const totalsMap = {}
        const ledgerMap = {}
        const safeInvRows = Array.isArray(rows) ? rows : []
        safeInvRows.forEach(inv => {
          totalsMap[inv.id] = Number(inv.total||0)
          ledgerMap[inv.id] = { total: Number(inv.total||0), paid: Number(inv.paid_amount||0), remaining: Number(inv.remaining_amount||0), isCash: !!inv.is_cash_by_ledger }
        })
        setInvTotalsById(totalsMap)
        setInvLedgerById(ledgerMap)
      } catch {
        setInvTotalsById({})
        setInvLedgerById({})
      }
    })()
  }, [activeTab, payFilters])


  const lastPaidByPartner = useMemo(() => {
    const by = new Map()
    const safePayRows = Array.isArray(payRows) ? payRows : []
    safePayRows.forEach(p => {
      const prev = by.get(p.partner_id)
      if (!prev || new Date(p.date) > new Date(prev.date)) by.set(p.partner_id, p)
    })
    return by
  }, [payRows])

  const paidByInvoice = useMemo(() => {
    const by = new Map()
    const safePayRows = Array.isArray(payRows) ? payRows : []
    safePayRows.forEach(p => {
      const k = p.invoice_id || 0
      const prev = by.get(k) || 0
      by.set(k, prev + parseFloat(p.amount||0))
    })
    return by
  }, [payRows])

  const paymentsSummary = useMemo(() => {
    const safePayRows = Array.isArray(payRows) ? payRows : []
    const totalPaid = safePayRows.reduce((s,p)=> s + parseFloat(p.amount||0), 0)
    const ids = Object.keys(invLedgerById || {})
    const totalRemaining = ids.reduce((s,id)=> s + Number(invLedgerById[id]?.remaining||0), 0)
    return { totalPaid, totalRemaining }
  }, [payRows, invLedgerById])

  function statusClass(s){
    const v = String(s||'draft').toLowerCase()
    switch(v){
      case 'paid': return 'bg-green-100 text-green-700'
      case 'partial': return 'bg-yellow-100 text-yellow-700'
      case 'due': return 'bg-red-100 text-red-700'
      case 'open': return 'bg-red-100 text-red-700'
      case 'overdue': return 'bg-red-100 text-red-700'
      case 'posted': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }
  function statusLabel(s){
    const v = String(s||'draft').toLowerCase()
    if (lang==='ar'){
      if (v==='paid') return 'مدفوعة'
      if (v==='overdue') return 'متأخرة'
      if (v==='posted') return 'مستحقة'
      if (v==='due' || v==='open') return 'مستحقة'
      if (v==='partial') return 'جزئية'
      return 'مسودة'
    } else {
      if (v==='paid') return 'Paid'
      if (v==='overdue') return 'Overdue'
      if (v==='posted') return 'Due'
      if (v==='due' || v==='open') return 'Due'
      if (v==='partial') return 'Partial'
      return 'Draft'
    }
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
  async function qrDataUrl(data){
    const resp = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(data)}`)
    const blob = await resp.blob()
    const reader = new FileReader()
    return await new Promise(resolve => { reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob) })
  }

  

  async function save() {
    setSaving(true)
    try {
      const nm = String(form.name||'').trim()
      if (!nm) { alert(lang==='ar'?'يرجى إدخال الاسم':'Please enter name'); setSaving(false); return }
      const payload = {
        name: nm,
        type: 'customer',
        email: form.email || null,
        phone: form.phone || null,
        payment_term: form.payment_term || null,
        addr_description: form.addr_description || null,
        billing_address: form.billing_address || null,
        discount_rate: Math.max(0, Number(form.fixed_discount_pct||0))
      }
      if (String(form.customer_type||'')==='نقدي') {
        const info = { discount_pct: Math.max(0, Number(form.fixed_discount_pct||0)) }
        payload.contact_info = info
      }
      if (editing) {
        await partners.update(editing.id, payload)
      } else {
        await partners.create(payload)
      }
      setForm({
        name: '', type: 'عميل', email: '', phone: '',
        customer_type: '', trade_name: '', legal_name: '', short_name: '', classification: '',
        cr_number: '', cr_city: '', cr_issue_date: '', tax_id: '', vat_registered: false, vat_registration_date: '',
        addr_country: '', addr_city: '', addr_district: '', addr_street: '', addr_building: '', addr_postal: '', addr_additional: '', addr_description: '',
        mobile: '', website: '',
        contact_person_name: '', contact_person_mobile: '', contact_person_email: '', contact_person_role: '',
        gl_account: '1020', pricing_method: 'inclusive', default_payment_method: '', payment_term: '', credit_limit: '', invoice_send_method: 'Email',
        shipping_address: '', billing_address: '',
        internal_notes: '', billing_instructions: '', collection_instructions: '',
        country: '', city: '', tags: [],
        national_id: ''
      })
      setEditing(null)
      await load()
    } catch (e) {
      const code = e?.code || e?.response?.data?.error || 'request_failed'
      if (code==='validation_failed') alert(lang==='ar'?'تحقق من البيانات':'Validate the form')
      else if (code==='duplicate') alert(lang==='ar'?'بيانات مكررة: الاسم أو الهاتف موجود':'Duplicate data: name or phone exists')
      else if (code==='Unauthorized' || e?.status===401) alert(lang==='ar'?'غير مصرح: يرجى تسجيل الدخول':'Unauthorized: please login')
      else alert(lang==='ar'?'فشل الحفظ':'Save failed')
      } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    await partners.remove(id)
    await load()
    try { localStorage.setItem('partners_refresh', String(Date.now())) } catch {}
  }

  async function exportPDF() {
    try {
      const pdfLang = 'en'
      const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang: pdfLang })
      // Logo removed per request
      
      let companyName = ''
      let companyEn = ''
      if (company) {
        companyName = (company.name_en || company.name_ar || '').trim()
        companyEn = (company.name_en || '').trim()
      } else {
         companyName = localStorage.getItem('company_name_en')||localStorage.getItem('company_name')||''
         companyEn = localStorage.getItem('company_name_en')||''
      }

      doc.setFontSize(14)
      const title = 'Customers Dashboard'
      doc.safeText(title, 40, branding?.logo?80:40)

      if (companyName) {
        doc.setFontSize(10)
        doc.safeText(companyName, 40, 40)
        if (companyEn) doc.safeText(companyEn, 40, 55)
      }

      let y = branding?.logo ? 100 : 70
      doc.setFontSize(10)
      
      // Header
      doc.setFillColor(245, 247, 250)
      doc.rect(40, y, 515, 20, 'F')
      doc.setTextColor(0)
      doc.safeText('Name', 50, y+14)
      doc.safeText('Email', 250, y+14)
      doc.safeText('Phone', 400, y+14)
      y += 30

      const safeFiltered = Array.isArray(filtered) ? filtered : []
      const list = safeFiltered.slice(0,100)
      list.forEach((x, i) => {
        doc.safeText(`${i + 1}. ${x.name}`, 50, y)
        doc.safeText(x.email||'-', 250, y)
        doc.safeText(x.phone||'-', 400, y)
        y += 16
        if (y > 780) { doc.addPage(); y = 60 }
      })
      if (footerCfg?.text) { 
        doc.safeText(String(footerCfg.text), 40, 800 > y ? 800 : y+20)
      }
      print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
    } catch (error) {
      console.error('Print error:', error)
      alert(lang === 'ar' ? 'فشل الطباعة. يرجى المحاولة مرة أخرى.' : 'Print failed. Please try again.')
    }
  }

  async function printCustomerStatement(cust) {
    const qs = new URLSearchParams()
    if (cust?.id) qs.set('partner_id', String(cust.id))
    if (filters?.dateFrom) qs.set('from', String(filters.dateFrom))
    if (filters?.dateTo) qs.set('to', String(filters.dateTo))
    const url = `/print/client-statement.html${qs.toString()?`?${qs.toString()}`:''}`
    window.open(url, '_blank')
  }

  async function generateSimpleInvoicePDF(cust) { await printCustomerInvoiceSkeletonPDF({ customer: cust, lang }) }

  async function generateCreditNotePDF(cust) { await printCreditNoteSkeletonPDF({ customer: cust, lang }) }

  function sendReminderEmail(cust) {
    const email = cust.email||''
    if (!email) { alert(lang==='ar'?'لا يوجد بريد للعميل':'No customer email'); return }
    const subject = encodeURIComponent(lang==='ar'?'تذكير بالسداد':'Payment Reminder')
    const body = encodeURIComponent(`${lang==='ar'?'عميلنا الكريم':'Dear customer'}, ${cust.name||''}\n${lang==='ar'?'نأمل تسوية المستحقات في أقرب وقت':'Please settle due amounts soon'}`)
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  async function generateReceiptPDF(cust, payment) { await printReceiptPDF({ customer: cust, payment, lang }) }

  const [exportingExcel, setExportingExcel] = useState(false)
  function exportExcel(rows) {
    setExportingExcel(true)
    try {
      const header = ['Name','Email','Phone','Type']
      const data = rows.map(r => [r.name||'', r.email||'', r.phone||'', r.type||''])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 12 } ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Customers')
      XLSX.writeFile(wb, 'customers.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  const filtered = useMemo(() => {
    let rows = Array.isArray(items) ? items : []
    if (search) rows = rows.filter(x => (`${x.name||''} ${x.email||''} ${x.phone||''}`).toLowerCase().includes(search.toLowerCase()))
    if (filters.customerType) rows = rows.filter(x => (filters.customerType==='Company' ? /شركة|company/i.test(x.name||'') : !/شركة|company/i.test(x.name||'')))
    if (filters.vatStatus) rows = rows.filter(x => (filters.vatStatus==='VAT' ? /\d{15}/.test(x.tax_id||'') : !/\d{15}/.test(x.tax_id||'')))
    if (filters.country) rows = rows.filter(x => (x.country||'').toLowerCase().includes(filters.country.toLowerCase()))
    if (filters.city) rows = rows.filter(x => (x.city||'').toLowerCase().includes(filters.city.toLowerCase()))
    if (filters.tag) rows = rows.filter(x => (x.tags||[]).some(t => String(t).toLowerCase().includes(filters.tag.toLowerCase())))
    const sorted = [...rows].sort((a,b)=>{
      const av = sortBy==='date'?new Date(a.created_at||0).getTime():String(a.name||'').localeCompare(String(b.name||''))
      const bv = sortBy==='date'?new Date(b.created_at||0).getTime():String(b.name||'').localeCompare(String(a.name||''))
      return sortDir==='asc'?av-bv:bv-av
    })
    return sorted
  }, [items, search, filters, sortBy, sortDir])

  const paged = useMemo(() => {
    const safeFiltered = Array.isArray(filtered) ? filtered : []
    const start = (page-1)*pageSize
    return safeFiltered.slice(start, start+pageSize)
  }, [filtered, page, pageSize])

  

  function formatMoney(v){
    const n = Number(v||0)
    try { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' SAR' } catch { return String(n.toFixed(2)) + ' SAR' }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="px-6 py-4 bg-primary-600 text-white shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
              <FaUsers />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{lang==='ar'?'العملاء':'Customers'}</h1>
              <p className="text-sm opacity-80">{lang==='ar'?'إدارة العملاء والفواتير والمدفوعات':'Manage customers, invoices and payments'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-white/20 rounded flex items-center gap-2" onClick={()=> navigate('/') }><FaHome /> {lang==='ar'?'الرئيسية':'Home'}</button>
            <button className="px-3 py-2 bg-white rounded text-primary-700 flex items-center gap-2" onClick={()=> navigate('/clients/create') }><FaPlus /> {lang==='ar'?'إضافة عميل':'Add Customer'}</button>
            <button className="px-3 py-2 bg-white/20 rounded flex items-center gap-2" onClick={()=> navigate('/clients/cards') }><FaUsers /> {lang==='ar'?'بطاقات العملاء':'Customer Cards'}</button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <section className="space-y-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <div className="font-semibold">{error}</div>
          </div>
        ) : null}
        {loading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}

        <div>

        

        {viewMode==='table' ? (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <div className="sticky top-0 bg-gray-50 border-b p-3 flex items-center justify-between">
            <div className="font-semibold">
              {activeTab==='home'?'الرئيسية':activeTab==='cash'?'فواتير المبيعات النقدية':activeTab==='credit'?'فواتير المبيعات الآجلة':activeTab==='invoices'?'الفواتير':activeTab==='receivables'?'المستحقات':activeTab==='payments'?'مدفوعات':activeTab==='paid'?'الفواتير المدفوعة':activeTab==='followups'?'متابعة السداد':activeTab==='statements'?'الكشوفات':'العملاء'}
            </div>
            <div className="flex items-center gap-2">
              
              
              {activeTab==='payments' && (
                <>
                  <select className="border rounded px-2 py-1" value={payFilters.partner_id} onChange={e=>setPayFilters({...payFilters, partner_id: e.target.value})}>
                    <option value="">العميل</option>
                    {(Array.isArray(items) ? items : []).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                  <input type="date" className="border rounded px-2 py-1" value={payFilters.from} onChange={e=>setPayFilters({...payFilters, from: e.target.value})} />
                  <input type="date" className="border rounded px-2 py-1" value={payFilters.to} onChange={e=>setPayFilters({...payFilters, to: e.target.value})} />
                </>
              )}
              
              {activeTab==='followups' && (
                <button className={`px-2 py-1 rounded text-xs ${followSummaryOpen?'bg-primary-600 text-white':'bg-white border'}`} onClick={()=>setFollowSummaryOpen(v=>!v)}>ملخص آخر سداد</button>
              )}
              <button className="p-2 bg-gray-100 rounded disabled:bg-gray-100 disabled:text-gray-400" title={exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : 'Excel'} onClick={()=>{ if (exportingExcel) return; exportExcel(filtered) }} disabled={exportingExcel}>Excel</button>
              <button className="p-2 bg-gray-100 rounded" title="PDF" onClick={exportPDF}><FaFilePdf /></button>
            </div>
          </div>
          {activeTab==='home' ? (
            <div className="p-3">
              {(()=>{
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      {(()=>{ const totInv = (summaryAll?.totInv||0); const totRec = (summaryAll?.totRec||0); const rate = totInv>0 ? ((summaryAll?.totPaid||0)/totInv) : 0; const avgDays = summaryAll?.avgDays||0; return (
                        <>
                          <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'إجمالي الفواتير':'Total Invoices'}</div><div className="text-xl font-bold" dir="ltr">{formatMoney(totInv)}</div></div>
                          <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'إجمالي المستحق':'Total Receivables'}</div><div className="text-xl font-bold" dir="ltr">{formatMoney(totRec)}</div></div>
                          <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'معدل السداد':'Payment Rate'}</div><div className="text-xl font-bold" dir="ltr">{(rate*100).toFixed(1)}%</div></div>
                          <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'متوسط فترة التحصيل':'Avg Collection Period'}</div><div className="text-xl font-bold" dir="ltr">{Math.round(avgDays)} {lang==='ar'?'يوم':'days'}</div></div>
                        </>
                      ) })()}
                    </div>
                    <div className="text-sm text-gray-600">{lang==='ar'?'ملخص عام للعملاء':'Global customers summary'}</div>
                  </>
                )
              })()}
            </div>
          ) : activeTab==='cash' ? (
            <div className="p-3">
              <ClientsInvoicesAll compact mode="cash" />
            </div>
          ) : activeTab==='credit' ? (
            <div className="p-3">
              <ClientsInvoicesAll compact mode="credit" />
            </div>
          ) : activeTab==='invoices' ? (
            <div className="p-3">
              <ClientsInvoicesAll compact defaultPartnerId={invFilters.partner_id || (selected?.id || '')} />
            </div>
          ) : activeTab==='receivables' ? (
            <div className="p-3">
              
              <table className="w-full text-right border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b bg-gray-50">
                    <th className="p-2">العميل</th>
                    <th className="p-2">عدد الفواتير</th>
                    <th className="p-2">إجمالي المستحق</th>
                    <th className="p-2">آخر دفعة</th>
                    <th className="p-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesLoading ? (
                    <tr><td className="p-2 text-sm text-gray-600" colSpan={5}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
                  ) : (()=>{
                    const safeReceivables = Array.isArray(receivablesRows) ? receivablesRows : []
                    const rows = safeReceivables.filter(r => Number(r.closing||0) > 0).map(r => ({ partner_id: Number(r.partner_id||0), name: r.name||`#${r.partner_id}`, count: '-', remaining: Number(r.closing||0) }))
                    return rows.length ? rows.map(r => {
                      const last = lastPaidByPartner.get(r.partner_id)
                      return (
                        <tr key={r.partner_id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.count}</td>
                          <td className="p-2">{Number(r.remaining||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{last?.date || '-'}</td>
                          <td className="p-2">
                            <button className="px-2 py-1 bg-gray-100 rounded mr-2" onClick={()=> setInvFilters(f=>({ ...f, partner_id: String(r.partner_id||'') }))}>عرض الفواتير</button>
                            <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=> printCustomerStatement({ id: r.partner_id, name: r.name })}>طباعة كشف</button>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr><td className="p-2 text-sm text-gray-600" colSpan={5}>{lang==='ar'?'لا توجد مستحقات':'No receivables'}</td></tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          ) : activeTab==='payments' ? (
            <>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">{lang==='ar'?'اختر العميل':'Select Customer'}</label>
                <select className="w-full border rounded px-2 py-1" value={payFilters.partner_id} onChange={e=>setPayFilters({...payFilters, partner_id: e.target.value})}>
                  <option value="">{lang==='ar'?'اختر':'Choose'}</option>
                  {(Array.isArray(items) ? items : []).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">{lang==='ar'?'رقم الفاتورة (اختياري)':'Invoice No. (optional)'}</label>
                <input className="w-full border rounded px-2 py-1" placeholder={lang==='ar'?'رقم الفاتورة':'Invoice ID'} value={payFilters.invoice_id} onChange={e=>setPayFilters({...payFilters, invoice_id: e.target.value})} />
              </div>
              
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'إجمالي المدفوع':'Total Paid'}</div><div className="text-xl font-bold" dir="ltr">{formatMoney(paymentsSummary.totalPaid)}</div></div>
                <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'إجمالي المتبقي':'Total Remaining'}</div><div className="text-xl font-bold" dir="ltr">{formatMoney(paymentsSummary.totalRemaining)}</div></div>
                <div className="bg-white rounded-xl shadow p-3 border"><div className="text-sm text-gray-600">{lang==='ar'?'عدد الدفعات':'Payments Count'}</div><div className="text-xl font-bold" dir="ltr">{Number(payRows.length||0).toLocaleString('en-US')}</div></div>
              </div>
              <div className="flex justify-end">
                <button className="px-3 py-2 bg-emerald-600 text-white rounded flex items-center gap-2" onClick={()=>{
                  const rows = (Array.isArray(payRows) ? payRows : []).filter(p=>{ const s=String(search||'').trim().toLowerCase(); if(!s) return true; const name=(p.partner&&p.partner.name)?String(p.partner.name).toLowerCase():''; const inv=String(p.invoice?.invoice_number||p.invoice_id||'').toLowerCase(); return name.includes(s)||inv.includes(s) })
                  const data = rows.map(p=>({
                    التاريخ: p.date,
                    العميل: (p.partner && p.partner.name) ? p.partner.name : (p.partner_id ? (partnerById.get(p.partner_id)?.name || '-') : 'عميل نقدي'),
                    رقم_الفاتورة: p.invoice?.invoice_number || p.invoice_id || '-',
                    المبلغ: Number(p.amount||0),
                    الطريقة: String(p.type||'').toUpperCase(),
                    المتبقي: (function(){ const id=Number(p.invoice_id||p.invoice?.id||0); const total=Number(invTotalsById[id]||p.invoice?.total||0); const paid=Number(paidByInvoice.get(id)||0); return Math.max(0, total-paid) })(),
                    الحالة: (function(){ const id=Number(p.invoice_id||p.invoice?.id||0); const total=Number(invTotalsById[id]||p.invoice?.total||0); const paid=Number(paidByInvoice.get(id)||0); return (paid>=total && total>0)?'مدفوعة':((paid>0 && paid<total)?'جزئية':'مستحقة') })(),
                  }))
                  const ws = XLSX.utils.json_to_sheet(data)
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Payments')
                  XLSX.writeFile(wb, 'customer-payments.xlsx')
                }}>{lang==='ar'?'Excel':'Excel'}</button>
              </div>
            </div>
              
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b bg-gray-50">
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">العميل</th>
                  <th className="p-2">رقم الفاتورة</th>
                  <th className="p-2">المبلغ</th>
                  <th className="p-2">الطريقة</th>
                  <th className="p-2">المتبقي</th>
                  <th className="p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payLoading ? (
                  <tr><td className="p-2 text-sm text-gray-600" colSpan={7}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
                ) : (
                  (Array.isArray(payRows) ? payRows : []).filter(p => {
                    const s = String(search||'').trim().toLowerCase()
                    if (!s) return true
                    const name = (p.partner && p.partner.name) ? String(p.partner.name).toLowerCase() : ''
                    const inv = String(p.invoice?.invoice_number || p.invoice_id || '').toLowerCase()
                    return name.includes(s) || inv.includes(s)
                  }).map(p => (
                    <tr key={p.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                      <td className="p-2">{p.date}</td>
                      <td className="p-2">{(p.partner && p.partner.name) ? p.partner.name : (p.partner_id ? (partnerById.get(p.partner_id)?.name || '-') : 'عميل نقدي')}</td>
                      <td className="p-2">{p.invoice?.invoice_number || p.invoice_id || '-'}</td>
                      <td className="p-2">{formatMoney(p.amount)}</td>
                      <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${String(p.type).toLowerCase()==='cash'?'bg-amber-100 text-amber-700':(String(p.type).toLowerCase()==='bank'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700')}`}>{p.type}</span></td>
                      <td className="p-2">{(()=>{ const id = Number(p.invoice_id||p.invoice?.id||0); const led = invLedgerById[id] || { remaining: 0 }; return Number(led.remaining||0).toLocaleString('en-US') })()}</td>
                      <td className="p-2">{(()=>{ const id = Number(p.invoice_id||p.invoice?.id||0); const led = invLedgerById[id] || { total: 0, paid: 0, remaining: 0, isCash: false }; const dyn = (Number(led.remaining||0)<=0 && Number(led.total||0)>0) ? 'paid' : ((Number(led.paid||0)>0 && Number(led.remaining||0)>0) ? 'partial' : 'due'); return (<span className={`px-2 py-1 rounded text-xs ${statusClass(dyn)}`}>{statusLabel(dyn)}</span>) })()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </>
          ) : activeTab==='paid' ? (
            <div className="p-3">
              <ClientsInvoicesPaid />
            </div>
          ) : activeTab==='statements' ? (
            <div className="p-3">
              <table className="w-full text-right border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b bg-gray-50">
                    <th className="p-2">العميل</th>
                    <th className="p-2">نوع العميل</th>
                    <th className="p-2">آخر دفعة</th>
                    <th className="p-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(items) ? items : []).filter(c=> String(c.payment_term||'').toLowerCase()!=='immediate').map(c=>{
                    const last = lastPaidByPartner.get(c.id)
                    return (
                      <tr key={c.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">آجل</td>
                        <td className="p-2">{last?.date || '-'}</td>
                        <td className="p-2"><Button variant="ghost" onClick={()=> printCustomerStatement(c)}>طباعة كشف</Button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b bg-gray-50">
                  <th className="p-2">اسم العميل</th>
                  <th className="p-2">البريد</th>
                  <th className="p-2">الهاتف</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(paged) ? paged : []).map(item => (
                  <tr key={item.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                    <td className="p-2 font-medium">{item.name}</td>
                    <td className="p-2 text-gray-600">{item.email||'-'}</td>
                    <td className="p-2 text-gray-600">{item.phone||'-'}</td>
                    <td className="p-2">
                      {(()=>{
                        let disc = ''
                        let term = String(item.payment_term||'').toLowerCase()
                        try { const info = item && item.contact_info ? JSON.parse(item.contact_info) : null; if (info && typeof info.discount_pct!=='undefined') disc = String(info.discount_pct) } catch{}
                        const badge = term==='immediate' ? { cls:'bg-amber-100 text-amber-700', txt:(lang==='ar'?'نقدي':'Cash') } : { cls:'bg-blue-100 text-blue-700', txt:(lang==='ar'?'آجل':'Credit') }
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${badge.cls}`}>{badge.txt}</span>
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{disc?`${disc}%`:'—'}</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={()=>{ setSelected(item); setModalOpen(true) }}><FaEye /> عرض</Button>
                        <Button variant="ghost" onClick={()=>printCustomerStatement(item)}><FaFilePdf /> طباعة كشف</Button>
                        <Button variant="secondary" onClick={()=>{ setEditing(item); setForm({ name:item.name, email:item.email||'', phone:item.phone||'', type:'عميل'}); setModalOpen(true) }}><FaEdit /> تعديل</Button>
                        <Button variant="ghost"><FaUndoAlt /> عكس</Button>
                        <Button variant="danger" onClick={async()=>{ if (!window.confirm(lang==='ar'?"حذف العميل؟":"Delete customer?")) return; try { await remove(item.id) } catch {} }}><FaTrash /> حذف</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab==='followups' && followSummaryOpen && (
            <div className="border-t p-3 bg-white">
              <div className="font-semibold mb-2">آخر سداد لكل عميل</div>
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2">العميل</th>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">رقم الفاتورة</th>
                    <th className="p-2">المبلغ</th>
                    <th className="p-2">الطريقة</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(items) ? items : []).map(p => {
                    const last = lastPaidByPartner.get(p.id)
                    return (
                      <tr key={p.id} className="border-b odd:bg-white even:bg-gray-50">
                        <td className="p-2">{p.name}</td>
                        <td className="p-2">{last?.date || '-'}</td>
                        <td className="p-2">{last?.invoice?.invoice_number || last?.invoice_id || '-'}</td>
                        <td className="p-2">{last ? Number(last.amount||0).toLocaleString('en-US') : '-'}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${String(last?.type||'').toLowerCase()==='cash'?'bg-amber-100 text-amber-700':(String(last?.type||'').toLowerCase()==='bank'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700')}`}>{last?.type || '-'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between p-3 border-t bg-gray-50">
            <div className="text-sm">صفحة {page} من {Math.max(1, Math.ceil((Array.isArray(filtered)?filtered:[]).length/pageSize))}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border rounded" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>السابق</button>
              <button className="px-3 py-1 bg-white border rounded" disabled={page>=Math.ceil((Array.isArray(filtered)?filtered:[]).length/pageSize)} onClick={()=>setPage(p=>Math.min(Math.ceil((Array.isArray(filtered)?filtered:[]).length/pageSize),p+1))}>التالي</button>
              <select className="border rounded px-2 py-1" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
        ) : null}
        </div>
        </section>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{selected?selected.name:(editing? (lang==='ar'?'تعديل عميل':'Edit Customer') : (lang==='ar'?'عرض':'View'))}</div>
              <div className="flex gap-2 items-center">
                <button className="p-2 rounded hover:bg-gray-100" aria-label="close" onClick={()=>setModalOpen(false)}><FaTimes/></button>
                <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setModalOpen(false)}>{lang==='ar'?'إغلاق':'Close'}</button>
                {selected && (
                  <>
                    {(()=>{ const canRemind = can('clients:remind'); return (
                    <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canRemind) return; sendReminderEmail(selected) }} disabled={!canRemind}><FaRegEnvelope/> تذكير</button>) })()}
                
                    {(()=>{ const canInvCreate = can('invoices:create'); return (
                    <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canInvCreate) return; generateSimpleInvoicePDF(selected) }} disabled={!canInvCreate}><FaFileInvoice/> إنشاء فاتورة</button>) })()}
                  </>
                )}
                {editing && (
                  <button className="px-3 py-2 bg-primary-600 text-white rounded flex items-center gap-2 disabled:bg-gray-200 disabled:text-gray-400" 
                    disabled={!can('clients:write') || saving} 
                    onClick={()=>{ if (!can('clients:write') || saving) return; save() }}>
                    <FaEdit/> {lang==='ar'?"حفظ التعديل":"Save"}
                  </button>
                )}
              </div>
            </div>
            {selected ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  {['details','contacts','sales','accounting','followup','notes','docs','activity'].map(tab => (
                    <button key={tab} className="px-3 py-1 bg-gray-100 rounded text-sm">{tab==='details'?'Details':tab==='contacts'?'Contacts':tab==='sales'?'Sales':tab==='accounting'?'Accounting':tab==='followup'?'Follow-up':tab==='notes'?'Notes':tab==='docs'?'Documents':'Activity Log'}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">{lang==='ar'?'معلومات عامة':'General Information'}</div>
                    <div className="text-sm">{lang==='ar'?'الاسم':'Name'}: {selected.name}</div>
                    <div className="text-sm">{lang==='ar'?'النوع':'Type'}: {selected.customer_type||'-'}</div>
                    <div className="text-sm">{lang==='ar'?'الرقم الضريبي':'Tax ID'}: {selected.tax_id||'-'}</div>
                    <div className="text-sm">{lang==='ar'?'البريد':'Email'}: {selected.email||'-'}</div>
                    <div className="text-sm">{lang==='ar'?'الهاتف':'Phone'}: {selected.phone||'-'}</div>
                    <div className="text-sm">{lang==='ar'?'الموقع':'Website'}: {selected.website ? (<a href={selected.website} target="_blank" rel="noreferrer" className="text-blue-600">{selected.website}</a>) : '-'}</div>
                    <div className="text-sm">{lang==='ar'?'العنوان':'Address'}: {`${selected.addr_country||''} ${selected.addr_city||''} ${selected.addr_district||''} ${selected.addr_street||''} ${selected.addr_building||''} ${selected.addr_postal||''}`.trim() || '-'}</div>
                    <div className="text-sm">{lang==='ar'?'وسوم':'Tags'}: {(selected.tags||[]).length ? (selected.tags||[]).join(' • ') : '-'}</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">{lang==='ar'?'سجل النشاط':'Activity Log'}</div>
                    <div className="text-xs text-gray-600">{lang==='ar'?'لا توجد أنشطة':'No activity'}</div>
                  </div>
                </div>
                
                <div className="mt-3 flex gap-2">
                  {(()=>{ const canWrite = can('clients:write'); return (
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canWrite) return; let fixed= '' ; try { const info = selected && selected.contact_info ? JSON.parse(selected.contact_info) : null; fixed = (info && typeof info.discount_pct!=='undefined') ? String(info.discount_pct||'') : '' } catch {} ; setEditing(selected); setForm({ name:selected.name||'', email:selected.email||'', phone:selected.phone||'', type:'عميل', customer_type:selected.customer_type||'', fixed_discount_pct: fixed, tax_id:selected.tax_id||'', national_id:selected.national_id||'', city:selected.city||selected.addr_city||'', country:selected.country||selected.addr_country||'', gl_account:selected.gl_account||'1020' }); }} disabled={!canWrite}><FaEdit/> {lang==='ar'?'تعديل':'Edit'}</button>) })()}
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2" onClick={()=>setClientStatementOpen(v=>!v)}><FaFileInvoice/> {clientStatementOpen ? (lang==='ar'?'إخفاء الكشف':'Hide Statement') : (lang==='ar'?'كشف حساب (مبسّط)':'Client Statement')}</button>
                  
                  {(()=>{ const canPrint = can('reports:print'); return (
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canPrint) return; printCustomerStatement(selected) }} disabled={!canPrint}><FaFilePdf/> {lang==='ar'?'طباعة كشف':'Print Statement'}</button>) })()}
                  {(()=>{ const canInvCreate = can('invoices:create'); return (
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canInvCreate) return; generateSimpleInvoicePDF(selected) }} disabled={!canInvCreate}><FaFileInvoice/> {lang==='ar'?'إنشاء فاتورة':'Create Invoice'}</button>) })()}
                  {(()=>{ const canCredit = can('invoices:credit_note'); return (
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canCredit) return; generateCreditNotePDF(selected) }} disabled={!canCredit}><FaUndoAlt/> {lang==='ar'?'إنشاء إشعار دائن':'Create Credit Note'}</button>) })()}
                  {(()=>{ const canRemind = can('clients:remind'); return (
                  <button className="px-3 py-2 bg-gray-100 rounded flex items-center gap-2 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ if (!canRemind) return; sendReminderEmail(selected) }} disabled={!canRemind}><FaRegEnvelope/> {lang==='ar'?'إرسال تذكير':'Send Reminder'}</button>) })()}
                </div>
                {clientStatementOpen && (
                  <div className="mt-4">
                    <ClientStatement partner={selected} />
                  </div>
                )}
              </div>
            ) : editing ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border rounded p-2" placeholder={lang==='ar'?'اسم العميل':'Customer Name'} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                  <select className="border rounded p-2" value={form.customer_type} onChange={e=>setForm({...form, customer_type: e.target.value})}>
                    <option value="">{lang==='ar'?'نوع العميل':'Type'}</option>
                    <option value="نقدي">{lang==='ar'?'نقدي':'Cash'}</option>
                    <option value="آجل">{lang==='ar'?'آجل (بيع عبر الإنترنت)':'Credit (Online Sales)'}</option>
                  </select>
                  <input className="border rounded p-2" placeholder={lang==='ar'?'البريد الإلكتروني':'Email'} value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
                  <input className="border rounded p-2" placeholder={lang==='ar'?'الهاتف':'Phone'} value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
                  <input className="border rounded p-2" placeholder={lang==='ar'?'المدينة':'City'} value={form.city||''} onChange={e=>setForm({...form, city: e.target.value})} />
                  <input className="border rounded p-2" placeholder={lang==='ar'?'الدولة':'Country'} value={form.country||''} onChange={e=>setForm({...form, country: e.target.value})} />
                  {form.customer_type==='نقدي' ? (
                    <input className="border rounded p-2" placeholder={lang==='ar'?'الخصم الثابت (%)':'Fixed Discount (%)'} value={form.fixed_discount_pct||''} onChange={e=>setForm({...form, fixed_discount_pct: e.target.value})} />
                  ) : null}
                  <input className="border rounded p-2" placeholder={lang==='ar'?'حساب الأستاذ':'GL Account'} value={form.gl_account} onChange={e=>setForm({...form, gl_account: e.target.value})} />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setModalOpen(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
                  <button className="px-3 py-2 bg-primary-600 text-white rounded disabled:bg-gray-200 disabled:text-gray-400" disabled={saving} onClick={async()=>{ if (saving) return; await save(); setModalOpen(false) }}>{lang==='ar'?'حفظ':'Save'}</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      

      

      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{lang==='ar'?'العملاء':'Customers'}</div>
  </Modal>
  </div>
  )
}
