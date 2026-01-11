import { useEffect, useMemo, useState } from 'react'
import { reports, settings as apiSettings } from '../services/api'
import { createPDF, validatePdfDefinition } from '../utils/pdfUtils'
import { print } from '@/printing'
import { useNavigate } from 'react-router-dom'
import { FaHome, FaArrowLeft } from 'react-icons/fa'

export default function BusinessDaySalesReport(){
  const navigate = useNavigate()
  const lang = 'en'
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const [dataBoth, setDataBoth] = useState({ china_town: null, place_india: null })
  const [multi, setMulti] = useState(null)
  const [toast, setToast] = useState('')
  const [company, setCompany] = useState(null)
  const [recipient, setRecipient] = useState('')
  

  const canRun = Boolean(date)
  const itemsChina = useMemo(()=> (dataBoth.china_town?.invoices||dataBoth.china_town?.items||[]), [dataBoth])
  const itemsIndia = useMemo(()=> (dataBoth.place_india?.invoices||dataBoth.place_india?.items||[]), [dataBoth])
  const filteredChina = useMemo(()=> itemsChina.filter(r => Number((r?.revenue_amount!=null ? r.revenue_amount : r?.amount)||0) > 0), [itemsChina])
  const filteredIndia = useMemo(()=> itemsIndia.filter(r => Number((r?.revenue_amount!=null ? r.revenue_amount : r?.amount)||0) > 0), [itemsIndia])
  const summaryChina = useMemo(()=> (dataBoth.china_town?.summary||{ invoices_count:0, total_sales:0, total_tax:0, total_discount:0, items_count:0, cash_total:0, bank_total:0 }), [dataBoth])
  const summaryIndia = useMemo(()=> (dataBoth.place_india?.summary||{ invoices_count:0, total_sales:0, total_tax:0, total_discount:0, items_count:0, cash_total:0, bank_total:0 }), [dataBoth])

  useEffect(()=>{ (async()=>{ try{ const c = await apiSettings.get('settings_company'); setCompany(c||null); if (!recipient && c && c.email) setRecipient(String(c.email)) } catch{} })() },[])

  async function load(){
    if (!canRun) return
    setLoading(true)
    setError('')
    try {
      const dSel = String(date||'').trim()
      const china = await reports.businessDaySales({ branch: 'china_town', date: dSel })
      const india = await reports.businessDaySales({ branch: 'place_india', date: dSel })
      setDataBoth({ china_town: china, place_india: india })
      setMulti({ items: [
        { branch: 'china_town', summary: china.summary },
        { branch: 'place_india', summary: india.summary }
      ] })
    } catch (e) {
      setDataBoth({ china_town: null, place_india: null })
      setError(e?.code || e?.status || 'failed')
    } finally { setLoading(false) }
  }

  async function openPrint(){
    if (!dataBoth.china_town || !dataBoth.place_india) return
    setPrintOpen(true)
  }

  async function generatePdf(){
    if (!dataBoth.china_town || !dataBoth.place_india) return
    const url = `/print/business-day-sales.html${date?`?date=${encodeURIComponent(date)}`:''}`
    window.open(url, '_blank')
    setPrintOpen(false)
    return
    const itemsAll = [...filteredChina, ...filteredIndia]
    const totalRevenueAll = itemsAll.reduce((s,r)=> s+Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0),0)
    const name = (company?.name_en || company?.name_ar || '')
    const phone = String(company?.phone||'')
    const addr = String(company?.address_en||company?.address_ar||company?.address||'')
    const vat = String(company?.vat_number||'')
    
    const dailySummaryRows = [
      [ { text: 'Branch', bold: true }, { text: 'Items Sold', bold: true }, { text: 'Invoices', bold: true }, { text: 'Total Sales', bold: true }, { text: 'Cash Total', bold: true }, { text: 'Card Total', bold: true } ],
      [ 'china_town', String(Number(summaryChina.items_count||0)), String(Number(summaryChina.invoices_count||0)), Number(summaryChina.total_sales||0).toFixed(2), Number(summaryChina.cash_total||0).toFixed(2), Number(summaryChina.bank_total||0).toFixed(2) ],
      [ 'place_india', String(Number(summaryIndia.items_count||0)), String(Number(summaryIndia.invoices_count||0)), Number(summaryIndia.total_sales||0).toFixed(2), Number(summaryIndia.cash_total||0).toFixed(2), Number(summaryIndia.bank_total||0).toFixed(2) ],
      [ 'Grand Total', String((Number(summaryChina.items_count||0)+Number(summaryIndia.items_count||0))), String((Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))), (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), (Number(summaryChina.cash_total||0)+Number(summaryIndia.cash_total||0)).toFixed(2), (Number(summaryChina.bank_total||0)+Number(summaryIndia.bank_total||0)).toFixed(2) ]
    ]
    const branchDiscountRows = [
      [ { text: 'Branch', bold: true }, { text: 'Discount', bold: true } ],
      [ 'china_town', Number(summaryChina.total_discount||0).toFixed(2) ],
      [ 'place_india', Number(summaryIndia.total_discount||0).toFixed(2) ],
      [ 'Grand Total', (Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2) ]
    ]
    const doc = {
      pageSize: 'A4', pageMargins: [36,36,36,36], defaultStyle: { fontSize: 10 },
      content: [
        
        ...(name ? [{ text: name, fontSize: 16, bold: true }] : []),
        ...(addr ? [{ text: addr, fontSize: 10 }] : []),
        ...(phone ? [{ text: phone, fontSize: 10 }] : []),
        ...(vat ? [{ text: `VAT: ${vat}`, fontSize: 10 }] : []),
        { text: 'Business Day Sales Report', fontSize: 16, margin: [0,16,0,8], alignment: 'center' },
        { columns: [ { text: `Branches: china_town, place_india` }, { text: `Date: ${date}`, alignment: 'right' } ], margin: [0,0,0,4] },
        { text: 'Time Range: 09:00 → 02:00', margin: [0,0,0,12] },
        { text: 'Daily Summary by Branch', bold: true, margin: [0,0,0,6] },
        { table: { headerRows: 1, widths: ['*','auto','auto','auto','auto','auto'], body: dailySummaryRows }, layout: 'lightHorizontalLines' },
        { text: 'Daily Discounts by Branch', bold: true, margin: [0,12,0,6] },
        { table: { headerRows: 1, widths: ['*','auto'], body: branchDiscountRows }, layout: 'lightHorizontalLines' },
        { text: 'Summary of Invoices', bold: true, margin: [0,12,0,6] },
        { columns: [ { text: `Invoices: ${(Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))}` }, { text: `Total Sales: ${(Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2)}`, alignment: 'right' } ] },
        { columns: [ { text: `Total VAT: ${(Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2)}` }, { text: `Total Discount: ${(Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2)}`, alignment: 'right' } ], margin: [0,0,0,12] },
        { text: 'china_town — Invoices', bold: true, margin: [0,0,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
          [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
          ...filteredChina.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
        ] }, layout: 'lightHorizontalLines' },
        { text: 'place_india — Invoices', bold: true, margin: [0,12,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
          [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
          ...filteredIndia.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
        ] }, layout: 'lightHorizontalLines' },
        { text: 'Totals', bold: true, margin: [0,12,0,6] },
        { columns: [ { text: 'Revenue Sum' }, { text: totalRevenueAll.toFixed(2), alignment: 'right' } ] },
        { columns: [ { text: 'VAT Sum' }, { text: (Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2), alignment: 'right' } ] },
        { columns: [ { text: 'Invoices' }, { text: (Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0)).toFixed(0), alignment: 'right' } ] },
        { columns: [ { text: 'Total Sales' }, { text: (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), alignment: 'right' } ] }
      ]
    }
    const errors = validatePdfDefinition(doc)
    if (errors.length > 0) {
      console.group('🚨 PDF VALIDATION FAILED')
      errors.forEach(e => console.error(e))
      console.groupEnd()
      alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء')
      setPrintOpen(false)
      return
    }
    let pdf
    try { pdf = createPDF(doc) } catch (e) { setError('pdf_failed'); setPrintOpen(false); return }
    try { pdf.print() } catch { try { pdf.open() } catch { setError('pdf_failed') } }
    setPrintOpen(false)
  }

  async function sendPdfReport(){
    try {
      if (!dataBoth.china_town || !dataBoth.place_india) return
      const itemsAll = [...filteredChina, ...filteredIndia]
      const totalRevenueAll = itemsAll.reduce((s,r)=> s+Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0),0)
      const name = (company?.name_en || company?.name_ar || '')
      const phone = String(company?.phone||'')
      const addr = String(company?.address_en||company?.address_ar||company?.address||'')
      const vat = String(company?.vat_number||'')
      
      const dailySummaryRows = [
        [ { text: 'Branch', bold: true }, { text: 'Items Sold', bold: true }, { text: 'Invoices', bold: true }, { text: 'Total Sales', bold: true }, { text: 'Cash Total', bold: true }, { text: 'Card Total', bold: true } ],
        [ 'china_town', String(Number(summaryChina.items_count||0)), String(Number(summaryChina.invoices_count||0)), Number(summaryChina.total_sales||0).toFixed(2), Number(summaryChina.cash_total||0).toFixed(2), Number(summaryChina.bank_total||0).toFixed(2) ],
        [ 'place_india', String(Number(summaryIndia.items_count||0)), String(Number(summaryIndia.invoices_count||0)), Number(summaryIndia.total_sales||0).toFixed(2), Number(summaryIndia.cash_total||0).toFixed(2), Number(summaryIndia.bank_total||0).toFixed(2) ],
        [ 'Grand Total', String((Number(summaryChina.items_count||0)+Number(summaryIndia.items_count||0))), String((Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))), (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), (Number(summaryChina.cash_total||0)+Number(summaryIndia.cash_total||0)).toFixed(2), (Number(summaryChina.bank_total||0)+Number(summaryIndia.bank_total||0)).toFixed(2) ]
      ]
      const branchDiscountRows = [
        [ { text: 'Branch', bold: true }, { text: 'Discount', bold: true } ],
        [ 'china_town', Number(summaryChina.total_discount||0).toFixed(2) ],
        [ 'place_india', Number(summaryIndia.total_discount||0).toFixed(2) ],
        [ 'Grand Total', (Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2) ]
      ]
      const doc = {
        pageSize: 'A4', pageMargins: [36,36,36,36], defaultStyle: { fontSize: 10 },
        content: [
          
          ...(name ? [{ text: name, fontSize: 16, bold: true }] : []),
          ...(addr ? [{ text: addr, fontSize: 10 }] : []),
          ...(phone ? [{ text: phone, fontSize: 10 }] : []),
          ...(vat ? [{ text: `VAT: ${vat}`, fontSize: 10 }] : []),
          { text: 'Business Day Sales Report', fontSize: 16, margin: [0,16,0,8], alignment: 'center' },
          { columns: [ { text: `Branches: china_town, place_india` }, { text: `Date: ${date}`, alignment: 'right' } ], margin: [0,0,0,4] },
          { text: 'Time Range: 09:00 → 02:00', margin: [0,0,0,12] },
          { text: 'Daily Summary by Branch', bold: true, margin: [0,0,0,6] },
          { table: { headerRows: 1, widths: ['*','auto','auto','auto','auto','auto'], body: dailySummaryRows }, layout: 'lightHorizontalLines' },
          { text: 'Daily Discounts by Branch', bold: true, margin: [0,12,0,6] },
          { table: { headerRows: 1, widths: ['*','auto'], body: branchDiscountRows }, layout: 'lightHorizontalLines' },
          { text: 'Summary of Invoices', bold: true, margin: [0,12,0,6] },
          { columns: [ { text: `Invoices: ${(Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))}` }, { text: `Total Sales: ${(Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2)}`, alignment: 'right' } ] },
          { columns: [ { text: `Total VAT: ${(Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2)}` }, { text: `Total Discount: ${(Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2)}`, alignment: 'right' } ], margin: [0,0,0,12] },
        { text: 'china_town — Invoices', bold: true, margin: [0,0,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
            [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
            ...filteredChina.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
          ] }, layout: 'lightHorizontalLines' },
        { text: 'place_india — Invoices', bold: true, margin: [0,12,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
            [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
            ...filteredIndia.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
          ] }, layout: 'lightHorizontalLines' },
          { text: 'Totals', bold: true, margin: [0,12,0,6] },
          { columns: [ { text: 'Revenue Sum' }, { text: totalRevenueAll.toFixed(2), alignment: 'right' } ] },
          { columns: [ { text: 'VAT Sum' }, { text: (Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2), alignment: 'right' } ] },
          { columns: [ { text: 'Invoices' }, { text: (Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0)).toFixed(0), alignment: 'right' } ] },
          { columns: [ { text: 'Total Sales' }, { text: (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), alignment: 'right' } ] }
        ]
      }
      const errors = validatePdfDefinition(doc)
      if (errors.length > 0) {
        console.group('🚨 PDF VALIDATION FAILED')
        errors.forEach(e => console.error(e))
        console.groupEnd()
        alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء')
        return
      }
      let pdf
      try { pdf = createPDF(doc) } catch (e) { setError('pdf_failed'); return }
      const ymd = String(date||'').replace(/-/g,'')
      const filename = `Business_Day_Sales_Report_${ymd}.pdf`
      await new Promise((resolve, reject)=>{
        try { pdf.getBase64(async (b64)=>{ try {
          const to = String(recipient||'').trim()
          if (!to) { setError('email_required'); reject(new Error('email_required')); return }
          const r = await reports.sendBusinessDaySales({ to, subject: `Business Day Sales Report – ${date}`, text: 'تم إرسال التقرير حسب اليوم المحاسبي المحدد.', pdf_name: filename, pdf_base64: b64 })
          if (r && r.previewUrl) { try { window.open(r.previewUrl, '_blank') } catch {} }
          setToast(r && r.previewUrl ? 'تم الإرسال — تمت المعاينة عبر البريد التجريبي' : 'تم إرسال التقرير بنجاح.'); setTimeout(()=> setToast(''), 4000)
          resolve(true)
        } catch (e) { setError(e?.code||'send_failed'); reject(e) } }) } catch (e) { setError('pdf_failed'); reject(e) }
      })
    } catch {}
  }

  async function downloadPdfReport(){
    if (!dataBoth.china_town || !dataBoth.place_india) return
    const itemsAll = [...filteredChina, ...filteredIndia]
    const totalRevenueAll = itemsAll.reduce((s,r)=> s+Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0),0)
    const name = (company?.name_en || company?.name_ar || '')
    const phone = String(company?.phone||'')
    const addr = String(company?.address_en||company?.address_ar||company?.address||'')
    const vat = String(company?.vat_number||'')
    
      const dailySummaryRows = [
        [ { text: 'Branch', bold: true }, { text: 'Items Sold', bold: true }, { text: 'Invoices', bold: true }, { text: 'Total Sales', bold: true }, { text: 'Cash Total', bold: true }, { text: 'Card Total', bold: true } ],
        [ 'china_town', String(Number(summaryChina.items_count||0)), String(Number(summaryChina.invoices_count||0)), Number(summaryChina.total_sales||0).toFixed(2), Number(summaryChina.cash_total||0).toFixed(2), Number(summaryChina.bank_total||0).toFixed(2) ],
        [ 'place_india', String(Number(summaryIndia.items_count||0)), String(Number(summaryIndia.invoices_count||0)), Number(summaryIndia.total_sales||0).toFixed(2), Number(summaryIndia.cash_total||0).toFixed(2), Number(summaryIndia.bank_total||0).toFixed(2) ],
        [ 'Grand Total', String((Number(summaryChina.items_count||0)+Number(summaryIndia.items_count||0))), String((Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))), (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), (Number(summaryChina.cash_total||0)+Number(summaryIndia.cash_total||0)).toFixed(2), (Number(summaryChina.bank_total||0)+Number(summaryIndia.bank_total||0)).toFixed(2) ]
      ]
      const branchDiscountRows = [
        [ { text: 'Branch', bold: true }, { text: 'Discount', bold: true } ],
        [ 'china_town', Number(summaryChina.total_discount||0).toFixed(2) ],
        [ 'place_india', Number(summaryIndia.total_discount||0).toFixed(2) ],
        [ 'Grand Total', (Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2) ]
      ]
    const doc = {
      pageSize: 'A4', pageMargins: [36,36,36,36], defaultStyle: { fontSize: 10 },
      content: [
        
        ...(name ? [{ text: name, fontSize: 16, bold: true }] : []),
        ...(addr ? [{ text: addr, fontSize: 10 }] : []),
        ...(phone ? [{ text: phone, fontSize: 10 }] : []),
        ...(vat ? [{ text: `VAT: ${vat}`, fontSize: 10 }] : []),
        { text: 'Business Day Sales Report', fontSize: 16, margin: [0,16,0,8], alignment: 'center' },
        { columns: [ { text: `Branches: china_town, place_india` }, { text: `Date: ${date}`, alignment: 'right' } ], margin: [0,0,0,4] },
        { text: 'Time Range: 09:00 → 02:00', margin: [0,0,0,12] },
          { text: 'Daily Summary by Branch', bold: true, margin: [0,0,0,6] },
          { table: { headerRows: 1, widths: ['*','auto','auto','auto','auto','auto'], body: dailySummaryRows }, layout: 'lightHorizontalLines' },
          { text: 'Daily Discounts by Branch', bold: true, margin: [0,12,0,6] },
          { table: { headerRows: 1, widths: ['*','auto'], body: branchDiscountRows }, layout: 'lightHorizontalLines' },
        { text: 'Summary of Invoices', bold: true, margin: [0,12,0,6] },
        { columns: [ { text: `Invoices: ${(Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0))}` }, { text: `Total Sales: ${(Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2)}`, alignment: 'right' } ] },
        { columns: [ { text: `Total VAT: ${(Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2)}` }, { text: `Total Discount: ${(Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toFixed(2)}`, alignment: 'right' } ], margin: [0,0,0,12] },
        { text: 'china_town — Invoices', bold: true, margin: [0,0,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
          [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
          ...filteredChina.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
        ] }, layout: 'lightHorizontalLines' },
        { text: 'place_india — Invoices', bold: true, margin: [0,12,0,6] },
        { table: { headerRows: 1, widths: [120,140,90,90,90,100], body: [
          [ { text: 'Invoice', bold: true }, { text: 'Branch', bold: true }, { text: 'Revenue', bold: true }, { text: 'VAT', bold: true }, { text: 'Discount', bold: true }, { text: 'Total', bold: true, alignment: 'right' } ],
          ...filteredIndia.map(r => [ String(r.invoice_number||''), String(r.branch||''), Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toFixed(2), Number((r.vat_amount||0)).toFixed(2), Number((r.discount_amount||0)).toFixed(2), { text: Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toFixed(2), alignment: 'right' } ])
        ] }, layout: 'lightHorizontalLines' },
        { text: 'Totals', bold: true, margin: [0,12,0,6] },
        { columns: [ { text: 'Revenue Sum' }, { text: totalRevenueAll.toFixed(2), alignment: 'right' } ] },
        { columns: [ { text: 'VAT Sum' }, { text: (Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toFixed(2), alignment: 'right' } ] },
        { columns: [ { text: 'Invoices' }, { text: (Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0)).toFixed(0), alignment: 'right' } ] },
        { columns: [ { text: 'Total Sales' }, { text: (Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toFixed(2), alignment: 'right' } ] }
      ]
    }
    const errors2 = validatePdfDefinition(doc)
    if (errors2.length > 0) {
      console.group('🚨 PDF VALIDATION FAILED')
      errors2.forEach(e => console.error(e))
      console.groupEnd()
      alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء')
      return
    }
    let pdf
    try { pdf = createPDF(doc) } catch (e) { setError('pdf_failed'); return }
    const ymd = String(date||'').replace(/-/g,'')
    const filename = `Business_Day_Sales_Report_${ymd}.pdf`
    try { pdf.download(filename) } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={'ltr'}>
      <header className="sticky top-0 z-10 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-700">Business Day Sales Report</h1>
            <p className="text-gray-600">Choose business day to view the report (all branches)</p>
            <div className="mt-2 flex items-center gap-2">
              <button className="px-3 py-2 bg-gray-100 rounded border flex items-center gap-2" onClick={()=> navigate(-1)}>
                <FaArrowLeft />
                <span>رجوع</span>
              </button>
              <button className="px-3 py-2 bg-gray-100 rounded border flex items-center gap-2" onClick={()=> navigate('/') }>
                <FaHome />
                <span>الرئيسية</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="relative">
              <label className="block text-xs text-gray-600 mb-1">Business Day</label>
              <input type="date" className="border rounded px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1">Starts 09:00 AM ends 02:00 AM next day</div>
            </div>
            <button className="px-3 py-2 bg-primary-600 text-white rounded disabled:bg-gray-200 disabled:text-gray-400" disabled={!canRun} onClick={load}>View Report</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {!dataBoth.china_town && !loading && (
          <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 rounded p-4">Please choose branch and day to view the report</div>
        )}

        {loading && (
          <div className="text-gray-600 text-sm">Loading...</div>
        )}

        {!!error && (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded p-3 text-sm mb-4">Failed to load report{error && ` (${String(error)})`}</div>
        )}

        {dataBoth.china_town && dataBoth.place_india && (
          <div className="space-y-6">
            {multi && (
              <>
              <section className="bg-white border rounded p-4">
                <div className="font-semibold mb-2">Daily Summary by Branch</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 border">Branch</th>
                        <th className="px-3 py-2 border">Items Sold</th>
                        <th className="px-3 py-2 border">Invoices</th>
                        <th className="px-3 py-2 border">Total Sales</th>
                        <th className="px-3 py-2 border">Cash Total</th>
                        <th className="px-3 py-2 border">Card Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multi.items.map(r => (
                        <tr key={r.branch}>
                          <td className="px-3 py-2 border">{r.branch}</td>
                          <td className="px-3 py-2 border">{Number(r.summary?.items_count||0).toLocaleString('en-US')}</td>
                          <td className="px-3 py-2 border">{Number(r.summary?.invoices_count||0).toLocaleString('en-US')}</td>
                          <td className="px-3 py-2 border">{Number(r.summary?.total_sales||0).toLocaleString('en-US')}</td>
                          <td className="px-3 py-2 border">{Number(r.summary?.cash_total||0).toLocaleString('en-US')}</td>
                          <td className="px-3 py-2 border">{Number(r.summary?.bank_total||0).toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 border">Grand Total</td>
                        <td className="px-3 py-2 border">{multi.items.reduce((s,r)=> s + Number(r.summary?.items_count||0),0).toLocaleString('en-US')}</td>
                        <td className="px-3 py-2 border">{multi.items.reduce((s,r)=> s + Number(r.summary?.invoices_count||0),0).toLocaleString('en-US')}</td>
                        <td className="px-3 py-2 border">{multi.items.reduce((s,r)=> s + Number(r.summary?.total_sales||0),0).toLocaleString('en-US')}</td>
                        <td className="px-3 py-2 border">{multi.items.reduce((s,r)=> s + Number(r.summary?.cash_total||0),0).toLocaleString('en-US')}</td>
                        <td className="px-3 py-2 border">{multi.items.reduce((s,r)=> s + Number(r.summary?.bank_total||0),0).toLocaleString('en-US')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            <section className="bg-white border rounded p-4">
              <div className="font-semibold mb-2">Branch Discounts</div>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 border">Branch</th>
                      <th className="px-3 py-2 border">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 border">china_town</td>
                      <td className="px-3 py-2 border">{Number(summaryChina.total_discount||0).toLocaleString('en-US')}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border">place_india</td>
                      <td className="px-3 py-2 border">{Number(summaryIndia.total_discount||0).toLocaleString('en-US')}</td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2 border">Grand Total</td>
                      <td className="px-3 py-2 border">{(Number(summaryChina.total_discount||0)+Number(summaryIndia.total_discount||0)).toLocaleString('en-US')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
              </>
            )}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded p-4">
                <div className="text-sm text-gray-600">Invoices</div>
                <div className="text-2xl font-semibold text-gray-800">{(Number(summaryChina.invoices_count||0) + Number(summaryIndia.invoices_count||0)).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-white border rounded p-4">
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="text-2xl font-semibold text-gray-800">{(Number(summaryChina.total_sales||0) + Number(summaryIndia.total_sales||0)).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-white border rounded p-4">
                <div className="text-sm text-gray-600">Total VAT</div>
                <div className="text-2xl font-semibold text-gray-800">{(Number(summaryChina.total_tax||0) + Number(summaryIndia.total_tax||0)).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-white border rounded p-4">
                <div className="text-sm text-gray-600">Total Discount</div>
                <div className="text-2xl font-semibold text-gray-800">{(Number(summaryChina.total_discount||0) + Number(summaryIndia.total_discount||0)).toLocaleString('en-US')}</div>
              </div>
            </section>

            <section className="bg-white border rounded overflow-hidden">
              <div className="max-h-[50vh] overflow-y-auto">
                <div className="px-3 py-2 font-semibold">china_town — Invoices</div>
                <table className="w-full text-right border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b">
                      <th className="p-2">Invoice</th>
                      <th className="p-2">Branch</th>
                      <th className="p-2">Revenue</th>
                      <th className="p-2">VAT</th>
                      <th className="p-2">Discount</th>
                      <th className="p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChina.map((r,idx)=> (
                      <tr key={idx} className="border-b">
                        <td className="p-2 text-blue-700 cursor-pointer underline">{String(r.invoice_number||'')}</td>
                        <td className="p-2">{String(r.branch||'')}</td>
                        <td className="p-2">{Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toLocaleString('en-US')}</td>
                        <td className="p-2">{Number(r.vat_amount||0).toLocaleString('en-US')}</td>
                        <td className="p-2">{Number(r.discount_amount||0).toLocaleString('en-US')}</td>
                        <td className="p-2 font-semibold">{Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                    {!filteredChina.length && (
                      <tr><td className="p-2 text-sm text-gray-600" colSpan={6}>No data</td></tr>
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 font-semibold">place_india — Invoices</div>
                <table className="w-full text-right border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b">
                      <th className="p-2">Invoice</th>
                      <th className="p-2">Branch</th>
                      <th className="p-2">Revenue</th>
                      <th className="p-2">VAT</th>
                      <th className="p-2">Discount</th>
                      <th className="p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndia.map((r,idx)=> (
                      <tr key={idx} className="border-b">
                        <td className="p-2 text-blue-700 cursor-pointer underline">{String(r.invoice_number||'')}</td>
                        <td className="p-2">{String(r.branch||'')}</td>
                        <td className="p-2">{Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0).toLocaleString('en-US')}</td>
                        <td className="p-2">{Number(r.vat_amount||0).toLocaleString('en-US')}</td>
                        <td className="p-2">{Number(r.discount_amount||0).toLocaleString('en-US')}</td>
                        <td className="p-2 font-semibold">{Number((r.total_sales!=null?r.total_sales:((r.revenue_amount!=null?r.revenue_amount:r.amount)||0)+(r.vat_amount||0))).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                    {!filteredIndia.length && (
                      <tr><td className="p-2 text-sm text-gray-600" colSpan={6}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sticky bottom-0 bg-gray-50 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 text-sm">
                  <div>Revenue Sum: {[...filteredChina, ...filteredIndia].reduce((s,r)=> s+Number((r.revenue_amount!=null?r.revenue_amount:r.amount)||0),0).toLocaleString('en-US')}</div>
                  <div>VAT Sum: {(Number(summaryChina.total_tax||0)+Number(summaryIndia.total_tax||0)).toLocaleString('en-US')}</div>
                  <div className="font-semibold">Invoices: {(Number(summaryChina.invoices_count||0)+Number(summaryIndia.invoices_count||0)).toLocaleString('en-US')}</div>
                  <div className="font-semibold">Total Sales: {(Number(summaryChina.total_sales||0)+Number(summaryIndia.total_sales||0)).toLocaleString('en-US')}</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="fixed bottom-4 right-4 flex gap-2">
        <input type="email" placeholder="Recipient email" className="px-3 py-2 border rounded w-64" value={recipient} onChange={e=>setRecipient(e.target.value)} />
        <button className="px-3 py-2 bg-gray-100 rounded border disabled:bg-gray-100 disabled:text-gray-400" disabled={!dataBoth.china_town || !dataBoth.place_india} onClick={openPrint}>Print Report</button>
        <button className="px-3 py-2 bg-primary-600 text-white rounded disabled:bg-gray-300 disabled:text-gray-200" disabled={!dataBoth.china_town || !dataBoth.place_india} onClick={sendPdfReport}>Send PDF Report</button>
        <button className="px-3 py-2 bg-gray-100 rounded border disabled:bg-gray-100 disabled:text-gray-400" disabled={!dataBoth.china_town || !dataBoth.place_india} onClick={downloadPdfReport}>Download PDF</button>
      </div>

      {printOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Print Preview</div>
              <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=>setPrintOpen(false)}>×</button>
            </div>
              <div className="text-sm text-gray-700 mb-4">
              <div>Company: —</div>
              <div>Branches: china_town, place_india</div>
              <div>Date: {date}</div>
              <div>Time Range: 09:00 AM → 02:00 AM</div>
              </div>
              <div className="flex items-center gap-2">
              <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={generatePdf}>Print</button>
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setPrintOpen(false)}>Cancel</button>
              </div>
          </div>
        </div>
      )}
      {!!toast && (
        <div className="fixed bottom-4 left-4 bg-green-50 text-green-800 border border-green-200 rounded px-3 py-2 text-sm">{toast}</div>
      )}
    </div>
  )
}