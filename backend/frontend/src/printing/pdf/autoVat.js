import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { initPdfFonts } from './font-loader'
import { createPDF, validatePdfDefinition } from '../../utils/pdfUtils'
const cairoBase64 = ""

// Determine API base URL - same logic as client.js
function getApiBase() {
  // 1. Check for explicit environment variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // 2. Check for runtime override
  if (typeof window !== 'undefined' && window.__API__) {
    return window.__API__;
  }
  // 3. Check if running on development port (4000 or 3000)
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '4000' || port === '3000') {
      return 'http://localhost:5000/api';
    }
    // Otherwise, use same origin (production mode)
    return window.location.origin + '/api';
  }
  // 4. Fallback for SSR/Node environment
  return 'http://localhost:5000/api';
}
const API_BASE = getApiBase()

function toBase64(buffer){
  let binary=''
  const bytes = new Uint8Array(buffer)
  for (let i=0;i<bytes.byteLength;i++){ binary += String.fromCharCode(bytes[i]) }
  return btoa(binary)
}

async function ensureCairo(){
  await initPdfFonts()
}

function tokenHeader(){
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
async function apiGet(path){
  const r = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...tokenHeader() } })
  if (!r.ok) throw new Error('request_failed')
  return await r.json()
}

export async function autoPrintVatPDF({ from, to, lang='ar' }){
  await ensureCairo()
  const company = await apiGet('/settings/settings_company').catch(()=>null)
  const branding = await apiGet('/settings/settings_branding').catch(()=>null)
  const accTree = await apiGet('/accounts')
  const periodData = await apiGet(`/journal${from&&to?`?from=${from}&to=${to}&status=posted&pageSize=1000`:''}`)

  const flat = []
  (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if (n.children?.length) walk(n.children) }) })(accTree)
  const byId = new Map(flat.map(a => [a.id, a]))
  const m = {}
  for (const it of (periodData.items||[])){
    for (const p of (it.postings||[])){
      const id = p.account_id
      if (!m[id]) m[id] = { debit: 0, credit: 0 }
      m[id].debit += parseFloat(p.debit||0)
      m[id].credit += parseFloat(p.credit||0)
    }
  }
  let sales = 0
  let discounts = 0
  let deductible = 0
  byId.forEach((a, id) => {
    const pm = m[id] || { debit: 0, credit: 0 }
    const nameTxt = `${a.name||''} ${a.name_en||''}`.toLowerCase()
    if (String(a.type)==='revenue'){
      const isDiscount = /(discount|خصم)/i.test(nameTxt)
      if (isDiscount){ const val = pm.debit - pm.credit; if (val > 0) discounts += val }
      else { const val = pm.credit - pm.debit; if (val > 0) sales += val }
    } else if (String(a.type)==='expense'){
      const nonDeductible = /(رواتب|اجور|salary|wages|غرامات|fines|رسوم حكومية|government|ترفيه|entertainment|ضيافة|hospitality|سكن|lodging|مركبات.*شخصي|personal)/i.test(nameTxt)
      if (!nonDeductible){ const val = pm.debit - pm.credit; if (val > 0) deductible += val }
    } else if (String(a.type)==='asset'){
      const isFixedAsset = /(أصول ثابتة|fixed assets|معدات|equipment|أجهزة|devices|أثاث|furniture)/i.test(nameTxt)
      if (isFixedAsset){ const val = pm.debit - pm.credit; if (val > 0) deductible += val }
    }
  })
  const netSales = Math.max(0, sales - discounts)
  const stdRate = 0.15
  const outputVat = netSales * stdRate
  const inputVat = Math.max(0, deductible) * stdRate
  const netVat = outputVat - inputVat

  const name = lang==='ar' ? (company?.name_ar || company?.name_en || '') : (company?.name_en || company?.name_ar || '')
  const vatNumber = String(company?.vat_number||'—')
  const title = lang==='ar'?'إقرار ضريبة القيمة المضافة':'VAT Return'
  const labels = {
    taxpayer: lang==='ar'?'اسم المُكلَّف / اسم المنشأة':'Taxpayer Name',
    vat: lang==='ar'?'رقم التسجيل الضريبي':'VAT Number',
    period: lang==='ar'?'الفترة':'Period',
    from: lang==='ar'?'من':'From',
    to: lang==='ar'?'إلى':'To',
    stdSales: lang==='ar'?'توريدات خاضعة للنسبة الأساسية (15%)':'Standard Rated Sales (15%)',
    outVat: lang==='ar'?'ضريبة المخرجات للنسبة الأساسية':'Standard Rated Output VAT',
    inVat: lang==='ar'?'ضريبة المدخلات القابلة للخصم':'Deductible Input VAT',
    net: lang==='ar'?'صافي الضريبة المستحقة / قابلة للاسترداد':'Net VAT Due / Refundable'
  }

  const doc = {
    pageSize: 'A4',
    pageMargins: [40,40,40,40],
    defaultStyle: { font: 'Cairo', fontSize: 11 },
    content: [
      { text: title, fontSize: 18, bold: true, alignment: lang==='ar'?'right':'left', rtl: lang==='ar' },
      { columns: [
        { text: `${labels.taxpayer}: ${name}`, alignment: lang==='ar'?'right':'left', rtl: lang==='ar' },
        { text: `${labels.vat}: ${vatNumber}`, alignment: lang==='ar'?'left':'right', rtl: lang==='ar' }
      ], margin: [0,10,0,10] },
      { columns: [
        { text: `${labels.from}: ${from||'—'}`, alignment: lang==='ar'?'right':'left', rtl: lang==='ar' },
        { text: `${labels.to}: ${to||'—'}`, alignment: lang==='ar'?'center':'center', rtl: lang==='ar' },
        { text: `${labels.period}: ${from||''} → ${to||''}`, alignment: lang==='ar'?'left':'right', rtl: lang==='ar' }
      ], margin: [0,0,0,10] },

      { table: { widths: ['*','auto'], body: [
        [{ text: labels.stdSales, rtl: lang==='ar' }, { text: String(netSales.toFixed(2)), alignment: 'right' }],
        [{ text: labels.outVat, rtl: lang==='ar' }, { text: String(outputVat.toFixed(2)), alignment: 'right' }]
      ] }, layout: 'lightHorizontalLines', margin: [0,10,0,10] },

      { table: { widths: ['*','auto'], body: [
        [{ text: labels.inVat, rtl: lang==='ar' }, { text: String(inputVat.toFixed(2)), alignment: 'right' }]
      ] }, layout: 'lightHorizontalLines', margin: [0,10,0,10] },

      { table: { widths: ['*','auto'], body: [
        [{ text: labels.net, bold: true, rtl: lang==='ar' }, { text: String(netVat.toFixed(2)), alignment: 'right', bold: true }]
      ] }, layout: 'lightHorizontalLines', margin: [0,10,0,10] }
    ]
  }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).print()
}