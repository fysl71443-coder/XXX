import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { partners, products, purchaseOrders, supplierInvoices, settings as apiSettings, payments, invoices } from '../services/api'
import { FaPlus, FaFilePdf, FaFileExcel, FaEye, FaClipboardList, FaFileInvoice, FaTruck, FaMoneyBill, FaUndoAlt, FaFileCsv } from 'react-icons/fa'
import StatusBadge from '../ui/StatusBadge'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import AdvancedFilters from '../components/AdvancedFilters'
import { createPDF, validatePdfDefinition } from '../utils/pdfUtils'
import { print } from '@/printing'
import { t } from '../utils/i18n'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'

export default function Suppliers() {
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', vendorType: '' })
  
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('invoices')
  const [poRows, setPoRows] = useState([])
  const [poLoading, setPoLoading] = useState(false)
  const [invRows, setInvRows] = useState([])
  const [modalSelectedInv, setModalSelectedInv] = useState({})
  const [invLoading, setInvLoading] = useState(false)
  const [prodRows, setProdRows] = useState([])
  const [prodLoading, setProdLoading] = useState(false)
  const [supPayRows, setSupPayRows] = useState([])
  const [supPayLoading, setSupPayLoading] = useState(false)
  const [payRows, setPayRows] = useState([])
  const [payLoading, setPayLoading] = useState(false)
  const [creditsInvs, setCreditsInvs] = useState([])
  const [creditsAmounts, setCreditsAmounts] = useState({})
  const [creditsMethod, setCreditsMethod] = useState('cash')
  const [mainCreditsSupplier, setMainCreditsSupplier] = useState('')
  const [mainCreditsInvs, setMainCreditsInvs] = useState([])
  const [mainCreditsAmounts, setMainCreditsAmounts] = useState({})
  const [mainCreditsMethod, setMainCreditsMethod] = useState('cash')
  const [poForm, setPoForm] = useState({ status: 'draft', date: '', lines: [] })
  const [poCreating, setPoCreating] = useState(false)
  const [invForm, setInvForm] = useState({ purchase_order_id: '', date: '', status: 'issued' })
  const [fin, setFin] = useState({})
  const [supInvActiveTab, setSupInvActiveTab] = useState('invoices')
  const [supInvFilters, setSupInvFilters] = useState({ partner_id: '', status: '', from: '', to: '', due: '' })
  const [supInvLoading, setSupInvLoading] = useState(false)
  const [supInvRows, setSupInvRows] = useState([])
  const [mainSelectedInv, setMainSelectedInv] = useState({})
  const [agingBucket, setAgingBucket] = useState('')
  const [toast, setToast] = useState('')
  const [highlightInvoiceId, setHighlightInvoiceId] = useState(null)
  const [selectedSupInv, setSelectedSupInv] = useState(null)
  const [supInvModalOpen, setSupInvModalOpen] = useState(false)
  const [supInvDetails, setSupInvDetails] = useState(null)
  const [supInvItems, setSupInvItems] = useState([])
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingOrdersCSV, setExportingOrdersCSV] = useState(false)
  const [exportingOrdersPDF, setExportingOrdersPDF] = useState(false)
  const [exportingInvoicesExcel, setExportingInvoicesExcel] = useState(false)
  const [exportingInvoicesPDF, setExportingInvoicesPDF] = useState(false)
  const [exportingAllInvCSV, setExportingAllInvCSV] = useState(false)
  const [exportingAllInvPDF, setExportingAllInvPDF] = useState(false)
  function normalizeDigits(str){
    const map = {
      '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
      '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
    }
    return String(str||'').split('').map(ch => map[ch] ?? ch).join('')
  }
  function sanitizeDecimal(str){
    const s = normalizeDigits(str).replace(/[^0-9.]/g,'')
    const parts = s.split('.')
    const head = parts[0] || ''
    const tail = parts[1] ? parts[1].slice(0,4) : ''
    return tail ? `${head}.${tail}` : head
  }
  
  const [supPdfUrl, setSupPdfUrl] = useState('')
  const [supPdfLoading, setSupPdfLoading] = useState(false)
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const { can } = useAuth()

  const load = useCallback(async function load() {
    setLoading(true)
    try {
      const data = await partners.list({ type: 'supplier' })
      let list = Array.isArray(data) ? data : (data?.items||[])
      list = list.filter(x => { const t = String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' })
      const q = search.trim().toLowerCase()
      if (q) list = list.filter(x => (x.name||'').toLowerCase().includes(q))
      if (filters.status) list = list.filter(x => String(x.status||'active')===filters.status)
      if (filters.vendorType) list = list.filter(x => String(x.vendor_type||'')===filters.vendorType)
      setItems(list)
      try {
        const m = {}
        for (const p of list) {
          try {
            const s = await fetch(`${process.env.REACT_APP_API_URL||'http://localhost:4000/api'}/suppliers/${p.id}/financial-summary`).then(r=>r.json()).catch(()=>({}))
            m[p.id] = { outstanding: Number(s?.outstanding||0), overdue: Number(s?.overdue||0), input_vat: Number(s?.input_vat||0), open_invoices: Number(s?.open_invoices||0) }
          } catch { m[p.id] = { outstanding: 0, overdue: 0, input_vat: 0, open_invoices: 0 } }
        }
        setFin(m)
      } catch {}
    } catch (e) {
      setItems([])
      setFin({})
    } finally {
      setLoading(false)
    }
  }, [search, filters])

  useEffect(() => {
    const invTabs = ['invoices','aging','due']
    if (invTabs.includes(supInvActiveTab)) {
      async function loadSupInv() {
        setSupInvLoading(true)
        try {
          const params = {}
          if (supInvFilters.partner_id) params.partner_id = supInvFilters.partner_id
          if (supInvFilters.from) params.from = supInvFilters.from
          if (supInvFilters.to) params.to = supInvFilters.to
          if (supInvActiveTab!=='invoices' && supInvFilters.status) params.status = supInvFilters.status
          if (supInvActiveTab==='due') params.due = '1'
          const res1 = await supplierInvoices.list(params)
          const res2 = await supplierInvoices.list({ ...params, status: 'draft' })
          const arr1 = res1.items||res1||[]
          const arr2 = res2.items||res2||[]
          const merged = [...arr1, ...arr2]
          const uniq = []
          const seen = new Set()
          for (const r of merged) { const id = r.id; if (!seen.has(id)) { seen.add(id); uniq.push(r) } }
          setSupInvRows(uniq)
        } catch(e) {
          setSupInvRows([])
        } finally {
          setSupInvLoading(false)
        }
      }
      loadSupInv()
    }
  }, [supInvActiveTab, supInvFilters])

  useEffect(() => {
    async function loadSupPayments() {
      setSupPayLoading(true)
      try {
        const params = { party_type: 'supplier' }
        if (supInvFilters.partner_id) params.partner_id = supInvFilters.partner_id
        if (supInvFilters.from) params.from = supInvFilters.from
        if (supInvFilters.to) params.to = supInvFilters.to
        const res = await payments.list(params)
        const arr = res.items||res||[]
        const onlySup = arr.filter(p => {
          const invNo = String(p.invoice?.invoice_number||p.invoice_id||'')
          const invType = String(p.invoice?.type||'').toLowerCase()
          const partnerType = String(p.partner?.vendor_type||p.partner?.type||'').toLowerCase()
          if (invNo.startsWith('PI/')) return true
          if (invType==='purchase') return true
          if (partnerType==='supplier' || partnerType==='vendor') return true
          return false
        })
        setSupPayRows(onlySup)
      } catch {
        setSupPayRows([])
      } finally {
        setSupPayLoading(false)
      }
    }
    if (supInvActiveTab==='payments') loadSupPayments()
  }, [supInvActiveTab, supInvFilters])

  useEffect(() => {
    async function loadMainCredits() {
      if (supInvActiveTab!=='credits') return
      if (!mainCreditsSupplier) { setMainCreditsInvs([]); return }
      try {
        const res = await supplierInvoices.list({ partner_id: mainCreditsSupplier })
        setMainCreditsInvs(res.items||[])
      } catch {
        setMainCreditsInvs([])
      }
    }
    loadMainCredits()
  }, [supInvActiveTab, mainCreditsSupplier])

  const viewSupInvRows = useMemo(() => {
    if (supInvActiveTab !== 'aging') return supInvRows
    function days(d) { const x = Math.ceil((Date.now() - new Date(d).getTime()) / (1000*60*60*24)); return x < 0 ? 0 : x }
    return supInvRows.filter(inv => {
      const isPosted = String(inv.derived_status||'').toLowerCase() === 'posted'
      const remaining = Number(inv.outstanding_amount||0)
      if (!isPosted || !(remaining > 0)) return false
      const dd = days(inv.date)
      if (agingBucket === '0-30') return dd <= 30
      if (agingBucket === '31-60') return dd > 30 && dd <= 60
      if (agingBucket === '61-90') return dd > 60 && dd <= 90
      if (agingBucket === '90+') return dd > 90
      return true
    })
  }, [supInvActiveTab, agingBucket, supInvRows])

useEffect(() => { load() }, [load])
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    Promise.all([
      apiSettings.get('settings_branding').catch(()=>null),
      apiSettings.get('settings_footer').catch(()=>null),
      apiSettings.get('settings_company').catch(()=>null),
    ]).then(([b,f,c])=>{ setBranding(b); setFooterCfg(f); setCompany(c) })
  },[])

  const [company, setCompany] = useState(null)

  useEffect(() => {
    const st = location.state || {}
    if (st.openSupplierId && items.length) {
      const s = items.find(x => String(x.id)===String(st.openSupplierId))
      if (s) { setSelected(s); setModalOpen(true); setActiveTab('invoices'); loadSupplierInvoices(s) }
      if (st.highlightInvoiceId) setHighlightInvoiceId(st.highlightInvoiceId)
    }
  }, [location.state, items])

  useEffect(() => {
    if (highlightInvoiceId) {
      const t = setTimeout(() => setHighlightInvoiceId(null), 4000)
      return () => clearTimeout(t)
    }
  }, [highlightInvoiceId])

  

  async function exportPDF() {
    const companyName = company?.name_en || ''
    const companyVAT = company?.vat_number ? `VAT: ${company.vat_number}` : ''
    const rows = items.slice(0, 300).map((x, i) => [String(i + 1), String(x.name||''), String(x.tax_id||''), String(x.cr_number||''), String(x.email||''), String(x.phone||''), String(x.status||'active'), String(x.vendor_type||'')])
    const body = [[{ text:'No.', bold:true }, { text:'Name', bold:true }, { text:'VAT', bold:true }, { text:'CR', bold:true }, { text:'Email', bold:true }, { text:'Phone', bold:true }, { text:'Status', bold:true }, { text:'Vendor Type', bold:true }], ...rows]
    const doc = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { fontSize: 10 },
      content: [
        { columns: [ { text: companyName, alignment: 'left', fontSize: 11 }, { text: 'Suppliers Dashboard', alignment: 'center', fontSize: 14, bold: true }, { text: companyVAT, alignment: 'right', fontSize: 10 } ], margin: [0, 0, 0, 12] },
        { table: { headerRows: 1, widths: ['auto','*','auto','auto','auto','auto','auto','auto'], body }, layout: 'lightHorizontalLines' }
      ],
      footer: (currentPage, pageCount) => ({ columns: [ { text: `Page ${currentPage} of ${pageCount}`, alignment: 'left', fontSize: 9 }, { text: new Date().toLocaleDateString('en-GB'), alignment: 'right', fontSize: 9 } ], margin: [40, 0, 40, 0] })
    }
    { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
    const pdf = await createPDF(doc)
    pdf.open()
  }
  function exportExcel(){
    setExportingExcel(true)
    try {
      const header = ['Name','VAT','CR','Email','Phone','Status','Vendor Type']
      const data = items.map(x => [x.name||'', x.tax_id||'', x.cr_number||'', x.email||'', x.phone||'', String(x.status||'active'), x.vendor_type||''])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 16 } ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
      XLSX.writeFile(wb, 'suppliers.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  function exportTabExcel(tab){
    if (tab==='orders'){
      const header = ['Order No.','Date','Status','Total']
      const data = poRows.map(r => [r.order_number||r.id, r.date||'', String(r.status||'draft'), Number(r.total||0)])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let rr = 1; rr <= range.e.r; rr++) {
        const cell = ws[XLSX.utils.encode_cell({ r: rr, c: 3 })]
        if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' }
      }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders')
      XLSX.writeFile(wb, 'supplier_orders.xlsx')
    } else if (tab==='invoices'){
      const header = ['Invoice #','Order #','Date','Total','Tax','Status']
      const data = invRows.map(r => [r.invoice_number||r.id, r.order_id||'', r.date||'', Number(r.total||0), Number(r.tax||0), String(r.status||'issued')])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let rr = 1; rr <= range.e.r; rr++) {
        for (let cc of [3,4]) { const cell = ws[XLSX.utils.encode_cell({ r: rr, c: cc })]; if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' } }
      }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Supplier Invoices')
      XLSX.writeFile(wb, 'supplier_invoices.xlsx')
    } else if (tab==='products'){
      const header = ['Name','UOM','Cost','VAT %','Active']
      const data = prodRows.map(p => [p.name||'', p.purchase_uom||p.uom||'Units', Number(p.cost_price||0), Number((p.vat_rate||0.15)*100), p.active!==false])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let rr = 1; rr <= range.e.r; rr++) {
        for (let cc of [2,3]) { const cell = ws[XLSX.utils.encode_cell({ r: rr, c: cc })]; if (cell && cell.v != null) { cell.z = cc===2?'#,##0.00':'0'; cell.t = 'n' } }
      }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Supplier Products')
      XLSX.writeFile(wb, 'supplier_products.xlsx')
    }
  }

  function exportTabCSV(tab){
    const BOM = '\uFEFF'
    if (tab==='orders'){
      const header = ['Order #','Date','Status','Total']
      const data = poRows.map(r => [r.order_number||r.id, r.date||'', String(r.status||'draft'), Number(r.total||0)])
      const csvContent = [header.join(','), ...data.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='supplier_orders.csv'; a.click(); URL.revokeObjectURL(url)
    } else if (tab==='invoices'){
      const header = ['Invoice #','Order #','Date','Total','Tax','Status']
      const data = invRows.map(r => [r.invoice_number||r.id, r.order_id||'', r.date||'', Number(r.total||0), Number(r.tax||0), String(r.status||'issued')])
      const csvContent = [header.join(','), ...data.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='supplier_invoices.csv'; a.click(); URL.revokeObjectURL(url)
    } else if (tab==='products'){
      const header = ['Name','UOM','Cost','VAT %','Active']
      const data = prodRows.map(p => [p.name||'', p.purchase_uom||p.uom||'Units', Number(p.cost_price||0), Number((p.vat_rate||0.15)*100), p.active!==false])
      const csvContent = [header.join(','), ...data.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='supplier_products.csv'; a.click(); URL.revokeObjectURL(url)
    }
  }

  async function exportTabPDF(tab){
    let title = 'Supplier Orders'
    let header = []
    let rows = []
    if (tab==='orders'){
      header = ['Order #','Date','Status','Total']
      rows = poRows.slice(0,300).map(r => [String(r.order_number||r.id), String(r.date||''), String(r.status||'draft'), Number(r.total||0).toFixed(2)])
      title = 'Supplier Orders'
    } else if (tab==='invoices'){
      header = ['Invoice #','Order #','Date','Total','Tax','Status']
      rows = invRows.slice(0,300).map(r => [String(r.invoice_number||r.id), String(r.order_id||''), String(r.date||''), Number(r.total||0).toFixed(2), Number(r.tax||0).toFixed(2), String(r.status||'issued')])
      title = 'Supplier Invoices'
    } else {
      header = ['Name','UOM','Cost','VAT %','Active']
      rows = prodRows.slice(0,300).map(p => [String(p.name||''), String(p.purchase_uom||p.uom||'Units'), Number(p.cost_price||0).toFixed(2), Number((p.vat_rate||0.15)*100).toFixed(0), p.active!==false ? 'Yes' : 'No'])
      title = 'Supplier Products'
    }
    const body = [header.map(h=>({ text:h, bold:true })), ...rows]
    const doc = {
      pageSize: 'A4', pageMargins: [40,40,40,40], defaultStyle: { fontSize: 10 },
      content: [
        { text: title, alignment: 'center', fontSize: 14, bold: true, margin: [0,0,0,12] },
        { table: { headerRows: 1, widths: tab==='products' ? ['*','auto','auto','auto','auto'] : (tab==='invoices' ? ['auto','auto','auto','auto','auto','auto'] : ['auto','auto','auto','auto']), body }, layout: 'lightHorizontalLines' }
      ],
      footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left', fontSize:9 }, { text: new Date().toLocaleDateString('en-GB'), alignment:'right', fontSize:9 } ], margin:[40,0,40,0] })
    }
    const pdf = await createPDF(doc)
    pdf.open()
  }

  const supplierById = useMemo(() => {
    const m = new Map()
    items.forEach(p => m.set(p.id, p))
    return m
  }, [items])

  

  function exportAllInvCSV(){
    const header = ['invoice_number','supplier','date','total','tax','status']
    const rows = (supInvActiveTab==='aging' ? viewSupInvRows : supInvRows)
    const lines = rows.map(r => [r.invoice_number||r.id, (r.partner?.name)||supplierById.get(r.partner_id)?.name||'', r.date||'', Number(r.total||0), Number(r.tax||0), String(r.status||'issued')])
    const csvContent = [
      header.join(','),
      ...lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='all_supplier_invoices.csv'; a.click(); URL.revokeObjectURL(url)
  }

  async function exportAllInvPDF(){
    const rows = (supInvActiveTab==='aging' ? viewSupInvRows : supInvRows).slice(0,500)
    const tableRows = rows.map(r => [String(r.invoice_number||r.id), String((r.partner?.name)||supplierById.get(r.partner_id)?.name||''), String(r.date||''), Number(r.total||0).toFixed(2), Number(r.tax||0).toFixed(2), String(r.status||'issued')])
    const body = [[{ text:'Invoice #', bold:true }, { text:'Supplier', bold:true }, { text:'Date', bold:true }, { text:'Total', bold:true }, { text:'Tax', bold:true }, { text:'Status', bold:true }], ...tableRows]
    const doc = {
      pageSize: 'A4', pageMargins: [40,40,40,40], defaultStyle: { fontSize: 10 },
      content: [
        { text: 'All Supplier Invoices', alignment: 'center', fontSize: 14, bold: true, margin: [0,0,0,12] },
        { table: { headerRows: 1, widths: ['auto','*','auto','auto','auto','auto'], body }, layout: 'lightHorizontalLines' }
      ],
      footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left', fontSize:9 }, { text: new Date().toLocaleDateString('en-GB'), alignment:'right', fontSize:9 } ], margin:[40,0,40,0] })
    }
    const pdf = await createPDF(doc)
    pdf.open()
  }

  async function bulkPostMainSelected(){
    const ids = Object.keys(mainSelectedInv).filter(id => mainSelectedInv[id])
    if (!ids.length) { setToast(lang==='ar'? 'لا توجد فواتير محددة' : 'No invoices selected'); return }
    const rowsById = new Map((supInvRows||[]).map(r => [String(r.id), r]))
    const draftIds = ids.filter(id => !!rowsById.get(id)?.allowed_actions?.post)
    if (!draftIds.length) { setToast(lang==='ar'? 'لا توجد مسودات ضمن المحدد' : 'No drafts in selection'); return }
    for (const id of draftIds){ try { await supplierInvoices.post(id) } catch {} }
    setToast(lang==='ar'?'تم ترحيل الفواتير المحددة':'Selected invoices posted')
    setMainSelectedInv({})
    const params = {}
    if (supInvFilters.partner_id) params.partner_id = supInvFilters.partner_id
    if (supInvFilters.status) params.status = supInvFilters.status
    if (supInvFilters.from) params.from = supInvFilters.from
    if (supInvFilters.to) params.to = supInvFilters.to
    if (supInvActiveTab==='due') params.due = '1'
    const res1 = await supplierInvoices.list(params)
    const res2 = await supplierInvoices.list({ ...params, status: 'draft' })
    const arr1 = res1.items||res1||[]
    const arr2 = res2.items||res2||[]
    const merged = [...arr1, ...arr2]
    const uniq = []
    const seen = new Set()
    for (const r of merged) { const id = r.id; if (!seen.has(id)) { seen.add(id); uniq.push(r) } }
    setSupInvRows(uniq)
  }

  async function openDetail(s){
    setSelected(s); setModalOpen(true); setActiveTab('invoices')
    await loadSupplierInvoices(s)
  }
  function tlvBytes(tag, value){
    const enc = new TextEncoder(); const v = enc.encode(String(value||'')); const out = new Uint8Array(2+v.length); out[0]=tag; out[1]=v.length; out.set(v,2); return out
  }
  function zatcaBase64({ sellerName, vatNumber, timestamp, total, tax }){
    const parts = [tlvBytes(1,sellerName||''), tlvBytes(2,vatNumber||''), tlvBytes(3,timestamp||''), tlvBytes(4,String(Number(total||0).toFixed(2))), tlvBytes(5,String(Number(tax||0).toFixed(2)))]
    const buf = new Uint8Array(parts.reduce((s,p)=>s+p.length,0)); let off=0; for(const p of parts){ buf.set(p,off); off+=p.length }
    let bin=''; for(let i=0;i<buf.length;i++){ bin+=String.fromCharCode(buf[i]) } return btoa(bin)
  }
  async function qrDataUrl(data){
    const resp = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(data)}`)
    const blob = await resp.blob(); const reader = new FileReader(); return await new Promise(resolve=>{ reader.onloadend=()=>resolve(reader.result); reader.readAsDataURL(blob) })
  }
  async function openSupplierInvoice(r){
    setSelectedSupInv(r)
    setSupInvModalOpen(true)
    setSupInvDetails(null)
    setSupInvItems([])
    setSupPdfUrl('')
    setSupPdfLoading(false)
    try {
      // Fetch full invoice (supplier invoices are served from /invoices/:id)
      const full = await supplierInvoices.get(r.id).catch(()=>null)
      let invObj = null
      let itemsList = []
      if (full && full.invoice) {
        invObj = full.invoice
        itemsList = Array.isArray(full.items) ? full.items : (Array.isArray(full.invoice.items) ? full.invoice.items : [])
      } else if (full && full.id) {
        invObj = full
        itemsList = Array.isArray(full.items) ? full.items : ([])
      }
      // Fallbacks: some backends store lines under `lines`
      if (!itemsList || itemsList.length === 0) {
        const alt = (invObj && Array.isArray(invObj.lines)) ? invObj.lines : []
        itemsList = alt
      }
      // Final attempt: fetch items via /invoice_items/:id
      if (!itemsList || itemsList.length === 0) {
        const itemsResp = await invoices.items(r.id).catch(()=>({ items: [] }))
        itemsList = Array.isArray(itemsResp.items) ? itemsResp.items : []
      }
      setSupInvDetails(invObj || r)
      setSupInvItems(itemsList)
    } catch {
      setSupInvDetails(r)
      setSupInvItems([])
    }
  }
  async function generateSupplierInvoicePdf(){
    if (!selectedSupInv) return
    setSupPdfLoading(true)
    setSupPdfUrl('')
    try {
      const inv = supInvDetails || selectedSupInv
      const partner = items.find(p=>p.id===(inv.partner_id || (inv.partner && inv.partner.id))) || null
      const companyName = partner?.name_en || partner?.name || ''
      const companyCR = partner?.cr_number ? `CR: ${partner.cr_number}` : ''
      const companyVAT = partner?.tax_id ? `VAT: ${partner.tax_id}` : ''
      const itemsList = Array.isArray(supInvItems) ? supInvItems : []
      const body = [[{ text:'Description', bold:true }, { text:'Qty', bold:true, alignment:'center' }, { text:'Unit Price', bold:true, alignment:'right' }, { text:'VAT', bold:true, alignment:'right' }, { text:'Line Total', bold:true, alignment:'right' }]]
      for (const it of itemsList){
        const name = it.product?.name || it.name || ''
        const qty = Number((typeof it.quantity!=='undefined' ? it.quantity : it.qty) || 0)
        const unit = Number((typeof it.unit_price!=='undefined' ? it.unit_price : it.price) || 0)
        const rate = Number(it.tax||0)
        const untaxed = qty*unit
        const vat = rate>1 ? (untaxed*rate/100) : (untaxed*rate)
        const totalLine = untaxed + vat
        body.push([ String(name), String(qty), Number(unit).toFixed(2), Number(vat).toFixed(2), Number(totalLine).toFixed(2) ])
      }
      const totalVal = inv.total ?? 0
      const taxVal = inv.tax ?? 0
      const untaxedTotal = Math.max(0, Number(totalVal||0) - Number(taxVal||0))
      const doc = {
        pageSize: 'A4', pageMargins: [36,36,36,36], defaultStyle: { fontSize: 10 },
        content: [
          { columns: [ { text: companyName, alignment:'left', fontSize:12 }, { text: 'Supplier Tax Invoice', alignment:'center', fontSize:14, bold:true }, { text: `${companyCR}${companyCR&&companyVAT?' • ':''}${companyVAT}`, alignment:'right', fontSize:10 } ], margin:[0,0,0,8] },
          { columns: [ { text: `INV No: ${inv.invoice_number||inv.id}` }, { text: `Invoice Date: ${(inv.date||new Date().toISOString().slice(0,10))}`, alignment:'right' } ], margin:[0,0,0,8] },
          { table: { headerRows: 1, widths: ['*','auto','auto','auto','auto'], body }, layout: 'lightHorizontalLines' },
          { columns: [ { text: 'Subtotal', alignment:'right' }, { text: Number(untaxedTotal).toFixed(2)+' SAR', alignment:'right', width: 120 } ], margin:[0,12,0,0] },
          { columns: [ { text: 'VAT', alignment:'right' }, { text: Number(taxVal||0).toFixed(2)+' SAR', alignment:'right', width: 120 } ], margin:[0,4,0,0] },
          { columns: [ { text: 'Total', alignment:'right', bold:true }, { text: Number(totalVal||0).toFixed(2)+' SAR', alignment:'right', width: 120, bold:true } ], margin:[0,4,0,0] }
        ],
        footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left', fontSize:9 }, { text: new Date().toLocaleDateString('en-GB'), alignment:'right', fontSize:9 } ], margin:[36,0,36,0] })
      }
      const pdf = await createPDF(doc)
      pdf.open()
      setSupPdfUrl('')
    } catch { setSupPdfUrl('') }
    finally { setSupPdfLoading(false) }
  }
  async function loadSupplierOrders(s){
    setPoLoading(true)
    try { const res = await purchaseOrders.list({ partner_id: s.id }); setPoRows(res.items||[]) } finally { setPoLoading(false) }
  }
  async function loadSupplierInvoices(s){
    setInvLoading(true)
    try {
      const res1 = await supplierInvoices.list({ partner_id: s.id })
      const res2 = await supplierInvoices.list({ partner_id: s.id, status: 'draft' })
      const arr1 = res1.items||res1||[]
      const arr2 = res2.items||res2||[]
      const merged = [...arr1, ...arr2]
      const uniq = []
      const seen = new Set()
      for (const r of merged) { const id = r.id; if (!seen.has(id)) { seen.add(id); uniq.push(r) } }
      setInvRows(uniq)
    } finally { setInvLoading(false) }
  }
  async function loadSupplierProducts(s){
    setProdLoading(true)
    try {
      const res = await products.list({ supplier_id: s.id })
      const rows = res||[]
      setProdRows(rows)
    } finally { setProdLoading(false) }
  }
  async function loadSupplierPayments(s){
    setPayLoading(true)
    try { const res = await payments.list({ partner_id: s.id, party_type: 'supplier' }); setPayRows(res.items||res||[]) } catch { setPayRows([]) } finally { setPayLoading(false) }
  }
  async function loadSupplierCredits(s){
    try { const res = await supplierInvoices.list({ partner_id: s.id }); setCreditsInvs(res.items||[]) } catch { setCreditsInvs([]) }
  }

  function addPoLineFromProduct(p){
    const nextSl = (poForm.lines.length ? Math.max(...poForm.lines.map(x=>x.sl||0)) : 0) + 1
    const taxRate = 0.15
    const l = { sl: nextSl, product_id: p.id, name: p.name, uom: p.purchase_uom||p.uom||'Units', qty: 1, unit_price: Number(p.cost_price||0), tax: taxRate }
    setPoForm({ ...poForm, lines: [...poForm.lines, l] })
  }

  async function createPurchaseOrder(){
    if (!selected) return
    if (!poForm.lines.length) return
    if (!poForm.date) return
    if (poForm.lines.some(l => Number(l.qty||0)<=0 || Number(l.unit_price||0)<0)) return
    setPoCreating(true)
    try {
      const payload = { partner_id: selected.id, status: poForm.status, date: poForm.date, lines: poForm.lines }
      await purchaseOrders.create(payload)
      await loadSupplierOrders(selected)
      setPoForm({ status: 'draft', date: '', lines: [] })
    } finally { setPoCreating(false) }
  }

  async function createSupplierInvoice(){
    if (!selected || !invForm.purchase_order_id) return
    if (!invForm.date) return
    const po = poRows.find(r => String(r.id)===String(invForm.purchase_order_id))
    const lines = (po?.lines||[]).map(l => ({ name: l.name, product_id: l.product_id, qty: l.qty, uom: l.uom, unit_price: l.unit_price, tax: l.tax }))
    const payload = { partner_id: selected.id, order_id: po?.id, date: invForm.date, status: invForm.status, lines }
    const created = await supplierInvoices.create(payload)
    await loadSupplierInvoices(selected)
    setInvForm({ purchase_order_id: '', date: '', status: 'issued' })
    setToast(lang==='ar'?'تم إنشاء فاتورة المورد بنجاح':'Supplier invoice created')
    setHighlightInvoiceId(created?.id || null)
  }

  async function bulkPostModalSelected(){
    const ids = Object.keys(modalSelectedInv).filter(id => modalSelectedInv[id])
    if (!ids.length) { setToast(lang==='ar'? 'لا توجد فواتير محددة' : 'No invoices selected'); return }
    const rowsById = new Map((invRows||[]).map(r => [String(r.id), r]))
    const draftIds = ids.filter(id => !!rowsById.get(id)?.allowed_actions?.post)
    if (!draftIds.length) { setToast(lang==='ar'? 'لا توجد مسودات ضمن المحدد' : 'No drafts in selection'); return }
    for (const id of draftIds){ try { await supplierInvoices.post(id) } catch {} }
    setToast(lang==='ar'?'تم ترحيل الفواتير المحددة':'Selected invoices posted')
    setModalSelectedInv({})
    if (selected) await loadSupplierInvoices(selected)
  }

  async function postSupplierInvoice(inv){
    if (!inv?.id) return
    try {
      await supplierInvoices.post(inv.id)
      setToast(lang==='ar'?'تم ترحيل الفاتورة':'Invoice posted')
      if (selected) await loadSupplierInvoices(selected)
      else {
        const params = {}
        if (supInvFilters.partner_id) params.partner_id = supInvFilters.partner_id
        if (supInvFilters.status) params.status = supInvFilters.status
        if (supInvFilters.from) params.from = supInvFilters.from
        if (supInvFilters.to) params.to = supInvFilters.to
        if (supInvActiveTab==='due') params.due = '1'
        const res1 = await supplierInvoices.list(params)
        const res2 = await supplierInvoices.list({ ...params, status: 'draft' })
        const arr1 = res1.items||res1||[]
        const arr2 = res2.items||res2||[]
        const merged = [...arr1, ...arr2]
        const uniq = []
        const seen = new Set()
        for (const r of merged) { const id = r.id; if (!seen.has(id)) { seen.add(id); uniq.push(r) } }
        setSupInvRows(uniq)
      }
    } catch {}
  }


  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <PageHeader
        icon={FaTruck}
        title={'Suppliers'}
        subtitle={'Manage supplier relationships, invoices and purchase orders'}
        onHomeClick={() => navigate('/')}
        homeLabel={'Home'}
        actions={[
          (<button key="excel" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=>{ if (!can('reports:export') || exportingExcel) return; setExportingExcel(true); try { exportExcel() } finally { setExportingExcel(false) } }} disabled={!can('reports:export') || exportingExcel}>{exportingExcel ? 'Exporting...' : 'Excel'}</button>),
          (<button key="pdf" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed" onClick={async()=>{ if (!can('reports:print') || exportingPDF) return; setExportingPDF(true); try { await exportPDF() } finally { setExportingPDF(false) } }} disabled={!can('reports:print') || exportingPDF}>{exportingPDF ? 'Generating...' : 'PDF'}</button>),
          (<button key="cards" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={()=>navigate('/suppliers/cards')}><FaEye/> {'Supplier Cards'}</button>)
        ]}
      />
      <main className="max-w-7xl mx_auto px-6 py-6 space-y-4">
        <div className="px-6">
          <AdvancedFilters
            value={{ search, ...filters }}
            onChange={(next) => { setSearch(next.search||''); setFilters({ status: next.status||'', vendorType: next.vendorType||'' }); load() }}
            lang={lang}
            fields={[
              { key: 'search', type: 'text', labelAr: 'بحث', labelEn: 'Search', placeholderAr: 'بحث عن مورد', placeholderEn: 'Search supplier' },
              { key: 'status', type: 'select', labelAr: 'الحالة', labelEn: 'Status', options: [{ value:'active', label: lang==='ar'?'نشط':'Active' }, { value:'inactive', label: lang==='ar'?'غير نشط':'Inactive' }] },
              { key: 'vendorType', type: 'select', labelAr: 'نوع المورد', labelEn: 'Vendor Type', options: [{ value:'VIP', label:'VIP' }, { value:'B2B', label:'B2B' }] },
            ]}
          />
        </div>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => {
            const invCount = Object.values(fin).reduce((s,v)=> s + Number(v.open_invoices||0), 0)
            const dueSum = Object.values(fin).reduce((s,v)=> s + Number(v.outstanding||0), 0)
            const overdueCount = Object.values(fin).filter(v => Number(v.overdue||0) > 0).length
            const taxSum = Object.values(fin).reduce((s,v)=> s + Number(v.input_vat||0), 0)
            return (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white rounded-xl border shadow p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{lang==='ar'?'عدد فواتير المورد':'Supplier Invoices'}</div>
                    <div className="text-2xl font-bold">{invCount}</div>
                  </div>
                  <FaFileInvoice className="w-8 h-8 text-primary-600" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="bg-white rounded-xl border shadow p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي مستحق':'Total Due'}</div>
                    <div className="text-2xl font-bold">{Number(dueSum).toLocaleString('en-US')} <span className="text-sm text-gray-500">SAR</span></div>
                  </div>
                  <FaClipboardList className="w-8 h-8 text-emerald-600" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="bg-white rounded-xl border shadow p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{lang==='ar'?'فواتير متأخرة':'Overdue Invoices'}</div>
                    <div className="text-2xl font-bold">{overdueCount}</div>
                  </div>
                  <FaEye className="w-8 h-8 text-amber-600" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="bg-white rounded-xl border shadow p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي ضريبة المدخلات':'Total Input VAT'}</div>
                    <div className="text-2xl font-bold">{Number(taxSum).toLocaleString('en-US')} <span className="text-sm text-gray-500">SAR</span></div>
                  </div>
                  <FaFilePdf className="w-8 h-8 text-rose-600" />
                </motion.div>
              </>
            )
          })()}
        </section>
        <div className="border rounded p-3 bg-white">
          <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='invoices'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('invoices')}>{lang==='ar'?'الفواتير':'Invoices'}</button>
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='aging'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('aging')}>{lang==='ar'?'التقادم':'Aging'}</button>
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='due'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('due')}>{lang==='ar'?'مستحق':'Due'}</button>
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='paid'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('paid')}>{lang==='ar'?'مدفوعة بالكامل':'Paid'}</button>
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='payments'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('payments')}>{lang==='ar'?'المدفوعات':'Payments'}</button>
              <button className={`px-3 py-1 rounded-full text-sm ${supInvActiveTab==='followups'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>setSupInvActiveTab('followups')}>{lang==='ar'?'متابعة السداد':'Follow-ups'}</button>
              
            </div>
            {(['invoices','aging','due'].includes(supInvActiveTab)) ? (
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ const ok = can('reports:export'); if (!ok || exportingAllInvCSV) return; setExportingAllInvCSV(true); try { exportAllInvCSV() } finally { setExportingAllInvCSV(false) } }} disabled={!can('reports:export') || exportingAllInvCSV}><FaFileCsv/> {exportingAllInvCSV ? (lang==='ar'?'جار التصدير...':'Exporting...') : (lang==='ar'?'CSV':'CSV')}</button>
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1 disabled:bg-gray-100 disabled:text-gray-400" onClick={()=>{ const ok = can('reports:print'); if (!ok || exportingAllInvPDF) return; setExportingAllInvPDF(true); try { exportAllInvPDF() } finally { setExportingAllInvPDF(false) } }} disabled={!can('reports:print') || exportingAllInvPDF}><FaFilePdf/> {exportingAllInvPDF ? (lang==='ar'?'جار التوليد...':'Generating...') : (lang==='ar'?'PDF':'PDF')}</button>
              </div>
            ) : (<div />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
            {(['invoices','aging','due'].includes(supInvActiveTab)) ? (
              <>
                <select className="border rounded p-2" value={supInvFilters.status} onChange={e=>setSupInvFilters({...supInvFilters, status: e.target.value})}>
                  <option value="">{lang==='ar'?'حالة الفاتورة':'Invoice Status'}</option>
                  <option value="issued">{lang==='ar'?'صادرة':'Issued'}</option>
                  <option value="paid">{lang==='ar'?'مدفوعة':'Paid'}</option>
                  <option value="overdue">{lang==='ar'?'متأخرة':'Overdue'}</option>
                  <option value="due">{lang==='ar'?'مستحقة':'Due'}</option>
                  <option value="draft">{lang==='ar'?'مسودة':'Draft'}</option>
                </select>
                <input type="date" className="border rounded p-2" value={supInvFilters.from} onChange={e=>setSupInvFilters({...supInvFilters, from: e.target.value})} />
                <input type="date" className="border rounded p-2" value={supInvFilters.to} onChange={e=>setSupInvFilters({...supInvFilters, to: e.target.value})} />
                {supInvActiveTab==='aging' ? (
                  <select className="border rounded p-2" value={agingBucket} onChange={e=>setAgingBucket(e.target.value)}>
                    <option value="">{lang==='ar'?'كل الفترات':'All buckets'}</option>
                    <option value="0-30">0-30</option>
                    <option value="31-60">31-60</option>
                    <option value="61-90">61-90</option>
                    <option value="90+">90+</option>
                  </select>
                ) : (<div />)}
              </>
            ) : supInvActiveTab==='payments' ? (
              <>
                <select className="border rounded p-2" value={supInvFilters.partner_id} onChange={e=>setSupInvFilters({...supInvFilters, partner_id: e.target.value})}>
                  <option value="">{lang==='ar'?'اختر المورد':'Select Supplier'}</option>
                  {items.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <input type="date" className="border rounded p-2" value={supInvFilters.from} onChange={e=>setSupInvFilters({...supInvFilters, from: e.target.value})} />
                <input type="date" className="border rounded p-2" value={supInvFilters.to} onChange={e=>setSupInvFilters({...supInvFilters, to: e.target.value})} />
              </>
            ) : (
              <>
                <select className="border rounded p-2" value={supInvFilters.partner_id} onChange={e=>setSupInvFilters({...supInvFilters, partner_id: e.target.value})}>
                  <option value="">{lang==='ar'?'اختر المورد':'Select Supplier'}</option>
                  {items.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </>
            )}
          </div>

          {(['invoices','aging','due','paid'].includes(supInvActiveTab)) ? (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                  <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                  <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                  <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                  <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                  <th className="p-2">{lang==='ar'?'المدفوع':'Paid'}</th>
                  <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
                  {supInvActiveTab==='aging' ? (<th className="p-2">{lang==='ar'?'فئة التقادم':'Aging'}</th>) : null}
                  <th className="p-2">{lang==='ar'?'الضريبة':'Tax'}</th>
                  <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                  <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                  
                </tr>
              </thead>
              <tbody>
                {supInvLoading ? (
                  <tr><td className="p-2 text-sm text-gray-600" colSpan={supInvActiveTab==='aging'?10:9}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
                ) : (
                  (supInvActiveTab==='aging' ? viewSupInvRows : (supInvActiveTab==='due' ? supInvRows.filter(rr => { const rem = Number(rr.outstanding_amount||Math.max(0,(rr.ledger_total||0)-(rr.paid_amount||0))); const isPosted = rr.has_posted_journal===true || String(rr.status||'').toLowerCase()==='issued'; return isPosted && rem>0 }) : (supInvActiveTab==='paid' ? supInvRows.filter(rr => { const rem = Number(rr.outstanding_amount||Math.max(0,(rr.ledger_total||0)-(rr.paid_amount||0))); return rem===0 && Number(rr.paid_amount||0)>0 }) : supInvRows))).map(r => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{r.invoice_number||r.id}</td>
                      <td className="p-2">{(r.partner && r.partner.name) || items.find(p=>p.id===(r.partner_id || (r.partner && r.partner.id)))?.name || '-'}</td>
                      <td className="p-2">{r.date}</td>
                      <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                      <td className="p-2">{Number(r.discount_total||r.discount_amount||0).toLocaleString('en-US')}</td>
                      <td className="p-2">{Number(r.paid_amount||0).toLocaleString('en-US')}</td>
                      <td className="p-2">{Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0))).toLocaleString('en-US')}</td>
                      {supInvActiveTab==='aging' ? ( (()=>{
                        function days(d){ const x = Math.ceil((Date.now() - new Date(d).getTime())/(1000*60*60*24)); return x<0?0:x }
                        const dd = days(r.date)
                        const is0_30 = dd <= 30
                        const is31_60 = dd > 30 && dd <= 60
                        const is61_90 = dd > 60 && dd <= 90
                        const label = is0_30 ? (lang==='ar'?'0-30 يوم':'0-30 d') : (is31_60 ? (lang==='ar'?'31-60 يوم':'31-60 d') : (is61_90 ? (lang==='ar'?'61-90 يوم':'61-90 d') : (lang==='ar'?'+90 يوم':'+90 d')))
                        const cls = is0_30 ? 'bg-green-50 text-green-700 border-green-200' : (is31_60 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : (is61_90 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'))
                        return (<td className="p-2"><span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span></td>)
                      })() ) : null}
                      <td className="p-2">{Number(r.tax||0).toLocaleString('en-US')}</td>
                      <td className="p-2">
                        {(() => {
                          const isPosted = r.has_posted_journal === true || String(r.status||'').toLowerCase()==='issued'
                          const label = isPosted ? (lang==='ar'?'منشورة':'Posted') : (lang==='ar'?'مسودة':'Draft')
                          const cls = isPosted ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                          return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>
                        })()}
                      </td>
                      <td className="p-2">
                        <button className="px-2 py-1 bg-blue-100 text-blue-700 rounded" onClick={()=>openSupplierInvoice(r)}>{lang==='ar'?'عرض':'View'}</button>
                      </td>
                      
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : supInvActiveTab==='payments' ? (
            <div>
              {(() => {
                const partnerFilter = String(supInvFilters.partner_id||'')
                const baseRows = (supInvRows||[]).filter(r => !partnerFilter || String(r.partner_id||'')===partnerFilter)
                const paidCount = baseRows.filter(r => String(r.payment_status||'').toLowerCase()==='paid').length
                const partialCount = baseRows.filter(r => String(r.payment_status||'').toLowerCase()==='partial').length
                const unpaidCount = baseRows.filter(r => String(r.payment_status||'').toLowerCase()==='unpaid').length
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3">
                      <div className="text-sm">{lang==='ar'?'مدفوع':'Paid'}</div>
                      <div className="text-2xl font-bold">{paidCount}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded p-3">
                      <div className="text-sm">{lang==='ar'?'مدفوع جزئياً':'Partial'}</div>
                      <div className="text-2xl font-bold">{partialCount}</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded p-3">
                      <div className="text-sm">{lang==='ar'?'غير مدفوع':'Unpaid'}</div>
                      <div className="text-2xl font-bold">{unpaidCount}</div>
                    </div>
                  </div>
                )
              })()}
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                    <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                    <th className="p-2">{lang==='ar'?'الفاتورة':'Invoice'}</th>
                    <th className="p-2">{lang==='ar'?'المبلغ':'Amount'}</th>
                    <th className="p-2">{lang==='ar'?'الطريقة':'Method'}</th>
                  </tr>
                </thead>
                <tbody>
                  {supPayLoading ? (
                    <tr><td className="p-2 text-sm text-gray-600" colSpan={5}>{lang==='ar'?'جار التحميل...':'Loading...'}</td></tr>
                  ) : (
                    (supPayRows||[]).map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{p.date || '-'}</td>
                        <td className="p-2">{p.partner?.name || items.find(x=>String(x.id)===String(p.partner_id))?.name || '-'}</td>
                        <td className="p-2">{p.invoice?.invoice_number || p.invoice_id || '-'}</td>
                        <td className="p-2">{Number(p.amount||0).toLocaleString('en-US')}</td>
                        <td className="p-2">{p.type || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2"><input type="checkbox" onChange={e=>{ const checked = e.target.checked; const next = {}; (supInvRows||[]).forEach(r=>{ if (!supInvFilters.partner_id || String(r.partner_id||'')===String(supInvFilters.partner_id)) next[String(r.id)] = checked }); setMainSelectedInv(next) }} checked={(()=>{ const ids = Object.keys(mainSelectedInv).filter(id => mainSelectedInv[id]); const filteredIds = (supInvRows||[]).filter(r=>!supInvFilters.partner_id || String(r.partner_id||'')===String(supInvFilters.partner_id)).map(r=>String(r.id)); return ids.length>0 && ids.every(id => filteredIds.includes(id)) })()} /></th>
                  <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                  <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                  <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                  <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                  <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {(supInvRows||[]).filter(r => !supInvFilters.partner_id || String(r.partner_id||'')===String(supInvFilters.partner_id)).map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-2"><input type="checkbox" checked={!!mainSelectedInv[String(r.id)]} onChange={e=>{ const checked = e.target.checked; setMainSelectedInv(prev => ({ ...prev, [String(r.id)]: checked })) }} /></td>
                    <td className="p-2">{r.invoice_number||r.id}</td>
                    <td className="p-2">{(r.partner && r.partner.name) || items.find(p=>p.id===(r.partner_id || (r.partner && r.partner.id)))?.name || '-'}</td>
                    <td className="p-2">{r.date}</td>
                    <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                    <td className="p-2">{String(r.status||'issued')}</td>
                  </tr>
                ))}
                {!((supInvRows||[]).filter(r => !supInvFilters.partner_id || String(r.partner_id||'')===String(supInvFilters.partner_id)).length) && (
                  <tr><td className="p-2 text-sm text-gray-600" colSpan={5}>{lang==='ar'?'لا توجد فواتير':'No invoices'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        

        {loading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <motion.div key={item.id} whileHover={{ scale: 1.02 }} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>{item.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'مستحق':'Due'}: {Number(fin[item.id]?.outstanding||0).toLocaleString('en-US')}</span>
                  <span className={`text-xs px-2 py-1 rounded ${Number(fin[item.id]?.overdue||0)>0?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{lang==='ar'?'متأخر':'Past-due'}: {Number(fin[item.id]?.overdue||0).toLocaleString('en-US')}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${String(item.status||'active')==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{String(item.status||'active')==='active'?(lang==='ar'?'نشط':'Active'):(lang==='ar'?'معلق':'Inactive')}</span>
              </div>
              <div className="text-xs text-gray-600">{item.tax_id||'-'} • {item.cr_number||'-'}</div>
              <div className="text-xs text-gray-600">{item.addr_description||'-'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>openDetail(item)}><FaEye/> {lang==='ar'?'تفاصيل':'Details'}</button>
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>{ setSelected(item); setActiveTab('orders'); setModalOpen(true) }}><FaClipboardList/> {lang==='ar'?'طلبات شراء':'POs'}</button>
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>{ setSelected(item); setActiveTab('invoices'); setModalOpen(true); loadSupplierInvoices(item) }}><FaFileInvoice/> {lang==='ar'?'فواتير':'Invoices'}</button>
              </div>
              <div className="mt-3 flex gap-2">
                
              </div>
            </motion.div>
          ))}
        </div>

        {modalOpen && selected && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white border rounded-md w-full max-w-3xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold flex items-center gap-2">
                  <span>{selected.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'مستحق':'Due'}: {Number(fin[selected.id]?.outstanding||0).toLocaleString('en-US')}</span>
                  <span className={`text-xs px-2 py-1 rounded ${Number(fin[selected.id]?.overdue||0)>0?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{lang==='ar'?'متأخر':'Past-due'}: {Number(fin[selected.id]?.overdue||0).toLocaleString('en-US')}</span>
                </div>
                <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setModalOpen(false)}>×</button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='orders'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('orders'); loadSupplierOrders(selected) }}>{lang==='ar'?'طلبات الشراء':'Purchase Orders'}</button>
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='invoices'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('invoices'); loadSupplierInvoices(selected) }}>{lang==='ar'?'فواتير المورد':'Supplier Invoices'}</button>
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='aging'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('aging'); loadSupplierInvoices(selected) }}>{lang==='ar'?'التقادم':'Aging'}</button>
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='due'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('due'); loadSupplierInvoices(selected) }}>{lang==='ar'?'مستحق':'Due'}</button>
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='paid'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('paid'); loadSupplierInvoices(selected); loadSupplierPayments(selected) }}>{lang==='ar'?'الفواتير المدفوعة':'Paid Invoices'}</button>
                <button className={`px-3 py-1 rounded-full text-sm ${activeTab==='followups'?'bg-primary-600 text-white':'bg-gray-100 text-gray-700'}`} onClick={()=>{ setActiveTab('followups'); loadSupplierPayments(selected) }}>{lang==='ar'?'متابعة السداد':'Follow-ups'}</button>
              </div>
              {activeTab==='orders' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{lang==='ar'?'طلبات المورد':'Supplier Orders'}</div>
                  </div>
                  <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-2">#</th>
                          <th className="p-2">{lang==='ar'?'منتج':'Product'}</th>
                          <th className="p-2">Qty</th>
                          <th className="p-2">UoM</th>
                          <th className="p-2">Unit Price</th>
                          <th className="p-2">Tax</th>
                          <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poForm.lines.map((l,i)=> (
                          <tr key={i} className="border-b">
                            <td className="p-2">{l.sl}</td>
                            <td className="p-2">{l.name}</td>
                            <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step={l.uom==='Units'?1:'0.01'} className="border rounded p-1 w-24" value={String(l.qty||'')} onChange={e=>{ const v = sanitizeDecimal(e.target.value); setPoForm({...poForm, lines: poForm.lines.map(x=>x.sl===l.sl?{...x, qty: Number(v||0)}:x)}) }} /></td>
                            <td className="p-2">{l.uom}</td>
                            <td className="p-2"><input type="number" inputMode="decimal" lang="en" dir="ltr" step="0.01" className="border rounded p-1 w-24" value={String(l.unit_price||'')} onChange={e=>{ const v = sanitizeDecimal(e.target.value); setPoForm({...poForm, lines: poForm.lines.map(x=>x.sl===l.sl?{...x, unit_price: Number(v||0)}:x)}) }} /></td>
                            <td className="p-2">{(Number(l.tax||0)*100).toFixed(0)}%</td>
                            <td className="p-2"><button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={()=>setPoForm({...poForm, lines: poForm.lines.filter(x=>x.sl!==l.sl).map((x,idx)=>({...x, sl: idx+1}))})}>{lang==='ar'?'حذف':'Delete'}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  <div className="mt-3">
                    {poLoading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : (
                      <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-2">{lang==='ar'?'رقم الطلب':'Order No.'}</th>
                          <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                          <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                          <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                          <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poRows.map(r => (
                          <tr key={r.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{r.order_number||r.id}</td>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2">{String(r.status||'draft')}</td>
                            <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                            <td className="p-2"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                </div>
              )}
              {activeTab==='aging' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'تحليل أعمار الذمم':'Aging Analysis'}</div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                        <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                        <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                        <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                        <th className="p-2">{lang==='ar'?'المدفوع':'Paid'}</th>
                        <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
                        <th className="p-2">{lang==='ar'?'فئة التقادم':'Aging Bucket'}</th>
                        <th className="p-2">{lang==='ar'?'الضريبة':'VAT'}</th>
                        <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))>0).map(r => (
                        <tr key={r.id} className="border-b">
                          <td className="p-2">{r.invoice_number||r.id}</td>
                          <td className="p-2">{selected?.name||'-'}</td>
                          <td className="p-2">{r.date}</td>
                          <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.paid_amount||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0))).toLocaleString('en-US')}</td>
                          <td className="p-2">{(() => { const d=new Date(r.date); const days=Math.floor((Date.now()-d.getTime())/86400000); return days<=30?'0–30':(days<=60?'31–60':(days<=90?'61–90':'+90')) })()}</td>
                          <td className="p-2">{Number(r.tax||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{(() => { const base = String(r.derived_status||'draft').toLowerCase(); const raw = String(r.status||'').toLowerCase(); const effective = raw==='cancelled' ? 'cancelled' : base; return <StatusBadge status={effective} /> })()}</td>
                        </tr>
                      ))}
                      {!(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))>0).length && (<tr><td className="p-2 text-sm text-gray-600" colSpan={9}>{lang==='ar'?'لا توجد فواتير مستحقة':'No due invoices'}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab==='due' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'فواتير مستحقة':'Due Invoices'}</div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                        <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                        <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                        <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                        <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                        <th className="p-2">{lang==='ار'?'المدفوع':'Paid'}</th>
                        <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
                        <th className="p-2">{lang==='ar'?'الضريبة':'VAT'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))>0).map(r => (
                        <tr key={r.id} className="border-b">
                          <td className="p-2">{r.invoice_number||r.id}</td>
                          <td className="p-2">{selected?.name||'-'}</td>
                          <td className="p-2">{r.date}</td>
                          <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.discount_total||r.discount_amount||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.paid_amount||0).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0))).toLocaleString('en-US')}</td>
                          <td className="p-2">{Number(r.tax||0).toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                      {!(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))>0).length && (<tr><td className="p-2 text-sm text-gray-600" colSpan={8}>{lang==='ar'?'لا توجد فواتير مستحقة':'No due invoices'}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab==='paid' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'الفواتير المدفوعة بالكامل':'Fully Paid Invoices'}</div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                        <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                        <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                        <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                        <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                        <th className="p-2">{lang==='ar'?'المدفوع':'Paid'}</th>
                        <th className="p-2">{lang==='ar'?'تاريخ آخر سداد':'Last Payment Date'}</th>
                        <th className="p-2">{lang==='ar'?'الطريقة':'Method'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))===0 && Number(r.paid_amount||0)>0).map(r => {
                        const pays = (payRows||[]).filter(p => Number(p.invoice_id||0)===Number(r.id))
                        const last = pays.length ? pays.reduce((a,b)=> new Date(a.date)>new Date(b.date)?a:b) : null
                        return (
                          <tr key={r.id} className="border-b">
                            <td className="p-2">{r.invoice_number||r.id}</td>
                            <td className="p-2">{selected?.name||'-'}</td>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.discount_total||r.discount_amount||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.paid_amount||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{last? (last.date||'-') : '-'}</td>
                            <td className="p-2">{last? (last.type||'-') : '-'}</td>
                          </tr>
                        )
                      })}
                      {!(invRows||[]).filter(r => Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))===0 && Number(r.paid_amount||0)>0).length && (<tr><td className="p-2 text-sm text-gray-600" colSpan={8}>{lang==='ar'?'لا توجد فواتير مدفوعة':'No paid invoices'}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab==='invoices' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{lang==='ar'?'فواتير المورد':'Supplier Invoices'}</div>
                  </div>
                  {invLoading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          
                          <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice No.'}</th>
                          <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                          <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                          <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                          <th className="p-2">{lang==='ar'?'الخصم':'Discount'}</th>
                          <th className="p-2">{lang==='ar'?'الضريبة':'VAT'}</th>
                          <th className="p-2">{lang==='ar'?'المدفوع':'Paid'}</th>
                          <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
                          <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                          
                        </tr>
                      </thead>
                      <tbody>
                        {invRows.map(r => (
                          <tr key={r.id} className={`border-b hover:bg-gray-50 ${highlightInvoiceId===r.id?'bg-yellow-50':''}`}>
                            
                            <td className="p-2">{r.invoice_number||r.id}</td>
                            <td className="p-2">{selected?.name||'-'}</td>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.discount_total||r.discount_amount||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.tax||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.paid_amount||0).toLocaleString('en-US')}</td>
                            <td className="p-2">{Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0))).toLocaleString('en-US')}</td>
                            <td className="p-2">
                              {(() => {
                                const isPosted = r.has_posted_journal === true || String(r.status||'').toLowerCase()==='issued'
                                const label = isPosted ? (lang==='ar'?'منشورة':'Posted') : (lang==='ar'?'مسودة':'Draft')
                                const cls = isPosted ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>
                              })()}
                            </td>
                            
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              
              {activeTab==='followups' && (
                <div>
                  {(() => {
                    const postedRows = (invRows||[]).filter(r => r.has_posted_journal===true || String(r.status||'').toLowerCase()==='issued')
                    const agg = new Map()
                    postedRows.forEach(r => {
                      const pid = String(r.partner_id|| (r.partner && r.partner.id) || 'unknown')
                      const cur = agg.get(pid) || { supplier: (selected?.name||items.find(p=>String(p.id)===pid)?.name||'-'), total: 0, paid: 0, remaining: 0, count: 0 }
                      cur.total += Number(r.total||0)
                      cur.paid += Number(r.paid_amount||0)
                      cur.remaining += Number(r.outstanding_amount||Math.max(0,(r.ledger_total||0)-(r.paid_amount||0)))
                      cur.count += 1
                      agg.set(pid, cur)
                    })
                    const rows = Array.from(agg.values())
                    return (
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                            <th className="p-2">{lang==='ar'?'إجمالي الفواتير':'Total Invoices'}</th>
                            <th className="p-2">{lang==='ar'?'المدفوع':'Paid'}</th>
                            <th className="p-2">{lang==='ar'?'المتبقي':'Remaining'}</th>
                            <th className="p-2">{lang==='ar'?'عدد الفواتير':'Count'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r,i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">{r.supplier}</td>
                              <td className="p-2">{Number(r.total||0).toLocaleString('en-US')}</td>
                              <td className="p-2">{Number(r.paid||0).toLocaleString('en-US')}</td>
                              <td className="p-2">{Number(r.remaining||0).toLocaleString('en-US')}</td>
                              <td className="p-2">{r.count}</td>
                            </tr>
                          ))}
                          {!rows.length && (<tr><td className="p-2 text-sm text-gray-600" colSpan={5}>{lang==='ar'?'لا توجد بيانات':'No data'}</td></tr>)}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              )}
              
              
            </div>
          </div>
        )}
      </main>
  {toast && (
    <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-lg px-4 py-2 rounded-lg" onAnimationEnd={() => setToast('')}>{toast}</div>
  )}
  {supInvModalOpen && selectedSupInv && (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-4 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{lang==='ar'?'تفاصيل فاتورة المورد':'Supplier Invoice Details'}</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setSupInvModalOpen(false)}>×</button>
          </div>
        </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>{lang==='ar'?'رقم الفاتورة':'Invoice No.'}: {(supInvDetails?.invoice_number||supInvDetails?.id||selectedSupInv?.invoice_number||selectedSupInv?.id)}</div>
            <div>{lang==='ar'?'التاريخ':'Date'}: {(supInvDetails?.date||selectedSupInv?.date)}</div>
            {(() => { const inv = supInvDetails || selectedSupInv; const total = Number(inv?.total||0); const paid = Number(inv?.paid_amount||0); const outstanding = Number(inv?.outstanding_amount||Math.max(total - paid, 0)); const raw = String(inv?.status||'').toLowerCase(); const basePs = String(inv?.payment_status||'').toLowerCase(); const calc = (outstanding<=0 && total>0) ? 'paid' : ((paid>0 && outstanding>0) ? 'partial' : 'unpaid'); const ps = raw==='cancelled' ? 'cancelled' : (basePs || calc); const label = lang==='ar' ? (ps==='paid' ? 'مدفوعة' : (ps==='partial' ? 'مدفوعة جزئياً' : (ps==='unpaid' ? 'غير مدفوعة' : 'ملغاة'))) : (ps==='paid' ? 'Paid' : (ps==='partial' ? 'Partial' : (ps==='unpaid' ? 'Unpaid' : 'Cancelled'))); const cls = ps==='paid' ? 'bg-green-50 text-green-700 border-green-200' : (ps==='partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : (ps==='unpaid' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-700 border-gray-200')); return (<div>{lang==='ar'?'الحالة':'Status'}: <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span></div>) })()}
            <div>{lang==='ar'?'قبل الضريبة':'Subtotal'}: {Number(((supInvDetails?.total??selectedSupInv?.total)||0) - ((supInvDetails?.tax??selectedSupInv?.tax)||0)).toLocaleString('en-US')}</div>
            <div>{lang==='ar'?'الخصم':'Discount'}: {Number((supInvDetails?.discount_total??supInvDetails?.discount_amount??selectedSupInv?.discount_total??selectedSupInv?.discount_amount)||0).toLocaleString('en-US')}</div>
            <div>{lang==='ar'?'الضريبة':'VAT'}: {Number((supInvDetails?.tax??selectedSupInv?.tax)||0).toLocaleString('en-US')}</div>
            <div>{lang==='ar'?'الإجمالي':'Total'}: {Number((supInvDetails?.total??selectedSupInv?.total)||0).toLocaleString('en-US')}</div>
          </div>
        <div className="border rounded mb-3">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'الصنف':'Item'}</th>
                <th className="p-2">{lang==='ar'?'الكمية':'Qty'}</th>
                <th className="p-2">{lang==='ar'?'السعر':'Unit'}</th>
                <th className="p-2">{lang==='ar'?'الضريبة':'Tax'}</th>
                <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {(supInvItems||[]).map((it,idx)=>{
                const qty = Number((typeof it.quantity!=='undefined' ? it.quantity : it.qty) || 0)
                const unit = Number((typeof it.unit_price!=='undefined' ? it.unit_price : it.price) || 0)
                const vat = Number(it.total_price && it.tax ? it.tax : (it.tax||0))
                const totalLine = Number(it.total_price||0) || (qty*unit + vat)
                return (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{String(it.product?.name||it.name||'')}</td>
                    <td className="p-2">{String(qty)}</td>
                    <td className="p-2">{unit.toLocaleString('en-US')}</td>
                    <td className="p-2">{Number(vat||0).toLocaleString('en-US')}</td>
                    <td className="p-2">{Number(totalLine||0).toLocaleString('en-US')}</td>
                  </tr>
                )
              })}
              {!(supInvItems||[]).length && (
                <tr><td className="p-2 text-gray-600" colSpan={5}>{lang==='ar'?'لا توجد أصناف':'No items'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 bg-gray-100 rounded" onClick={generateSupplierInvoicePdf}>{lang==='ar'?'توليد PDF':'Generate PDF'}</button>
          {supPdfLoading ? (<span className="text-sm text-gray-600">{lang==='ar'?'جار التوليد...':'Generating...'}</span>) : (supPdfUrl ? (<a className="px-2 py-1 bg-blue-100 text-blue-700 rounded" href={supPdfUrl} target="_blank" rel="noreferrer">{lang==='ar'?'فتح PDF':'Open PDF'}</a>) : null)}
        </div>
      </div>
    </div>
  )}
    </div>
  )
}
