import pdfMake from 'pdfmake/build/pdfmake'
import vfsFonts from 'pdfmake/build/vfs_fonts'
import QRCode from 'qrcode'

function normalizeDataUrl(img){
  const s = String(img||'')
  if (!s) return ''
  if (s.startsWith('data:image')) return s
  return `data:image/png;base64,${s}`
}

export async function printThermalReceipt({
  logoBase64,
  companyEn,
  companyAr,
  vatNumber,
  phone,
  address,
  branchName,
  invoiceNo,
  date,
  time,
  customerName,
  customerPhone,
  tableNumber,
  items,
  subtotal,
  vatPct,
  vatAmount,
  total,
  paymentMethod,
  qrCodeBase64,
  fontBase64,
  fontName = 'ReceiptArabic',
}){
  let previewWin = null
  try { previewWin = window.open('', '_blank') } catch {}
  if (!pdfMake.vfs) pdfMake.vfs = (vfsFonts && vfsFonts.vfs) ? vfsFonts.vfs : {}
  if (fontBase64 && fontBase64.length > 0){
    const raw = String(fontBase64||'').replace(/^data:[^;]+;base64,/, '')
    pdfMake.vfs[`${fontName}.ttf`] = raw
    pdfMake.fonts = { ...pdfMake.fonts, [fontName]: { normal: `${fontName}.ttf`, bold: `${fontName}.ttf` }, Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-Italic.ttf' } }
  }
  try {
    const ensureFont = async (name) => {
      try {
        if (!pdfMake.vfs) pdfMake.vfs = (vfsFonts && vfsFonts.vfs) ? vfsFonts.vfs : {}
        if (pdfMake.vfs && pdfMake.vfs[name]) return true
        const origin = (typeof window!=='undefined' && window.location && window.location.origin) ? window.location.origin : ''
        const host = (typeof window!=='undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost'
        const base = origin ? (origin.replace(/:\d+$/, ':4000')) : (`http://${host}:4000`)
        const url = `${base}/api/fonts/${name}`
        const resp = await fetch(url)
        if (resp && resp.ok){
          const buf = await resp.arrayBuffer()
          const uint8 = new Uint8Array(buf)
          let binary = ''
          const chunk = 8192
          for (let i=0;i<uint8.length;i+=chunk){ binary += String.fromCharCode.apply(null, uint8.subarray(i, i+chunk)) }
          const base64 = btoa(binary)
          pdfMake.vfs[name] = base64
          return true
        }
        return false
      } catch {
        return false
      }
    }
    let haveTahoma = await ensureFont('Tahoma.ttf')
    if (haveTahoma) { await ensureFont('Tahoma-Bold.ttf') }
    let haveCairo = false
    if (!haveTahoma) { haveCairo = await ensureFont('Cairo-Regular.ttf'); if (haveCairo && pdfMake.vfs) { pdfMake.vfs['Cairo-Bold.ttf'] = pdfMake.vfs['Cairo-Regular.ttf'] } }
    let haveNoto = false
    if (!haveTahoma && !haveCairo) { haveNoto = await ensureFont('NotoSansArabic-Regular.ttf'); if (haveNoto && pdfMake.vfs) pdfMake.vfs['NotoSansArabic-Bold.ttf'] = pdfMake.vfs['NotoSansArabic-Regular.ttf'] }
    if (haveTahoma) {
      pdfMake.fonts = { ...pdfMake.fonts, Tahoma: { normal: 'Tahoma.ttf', bold: 'Tahoma-Bold.ttf' }, Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-Italic.ttf' } }
    } else if (haveCairo) {
      pdfMake.fonts = { ...pdfMake.fonts, Cairo: { normal: 'Cairo-Regular.ttf', bold: 'Cairo-Bold.ttf' }, Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-Italic.ttf' } }
    } else if (haveNoto) {
      pdfMake.fonts = { ...pdfMake.fonts, NotoSansArabic: { normal: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' }, Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-Italic.ttf' } }
    }
    try {
      if (pdfMake.fonts && pdfMake.fonts.Tahoma && !(pdfMake.vfs && pdfMake.vfs['Tahoma.ttf'])) { delete pdfMake.fonts.Tahoma }
      if (pdfMake.fonts && pdfMake.fonts.Cairo && !(pdfMake.vfs && pdfMake.vfs['Cairo-Regular.ttf'])) { delete pdfMake.fonts.Cairo }
      if (pdfMake.fonts && pdfMake.fonts.NotoSansArabic && !(pdfMake.vfs && pdfMake.vfs['NotoSansArabic-Regular.ttf'])) { delete pdfMake.fonts.NotoSansArabic }
    } catch {}
  } catch {}
  const widthPt = 80 * 2.83464567
  const content = []
  if (logoBase64){
    content.push({ image: normalizeDataUrl(logoBase64), width: 120, alignment: 'center', margin: [0, 8, 0, 6] })
  }
  if (companyAr){ content.push({ text: String(companyAr||''), alignment: 'center', rtl: true, fontSize: 12 }) }
  if (companyEn){ content.push({ text: String(companyEn||''), alignment: 'center', fontSize: 12, margin: [0,2,0,0] }) }
  if (vatNumber){ content.push({ text: `VAT No: ${vatNumber}`, alignment: 'center', fontSize: 10 }) }
  if (phone){ content.push({ text: `Phone: ${phone}`, alignment: 'center', fontSize: 10 }) }
  if (address){ content.push({ text: String(address||''), alignment: 'center', fontSize: 10, margin: [10,2,10,0] }) }
  if (branchName){ content.push({ text: `Branch: ${String(branchName||'')}`, alignment: 'center', fontSize: 10 }) }
  content.push({ canvas: [{ type:'line', x1: 10, y1: 0, x2: widthPt-10, y2: 0, lineWidth: 0.5, lineColor: '#000' }], margin: [0,6,0,6] })
  content.push({ text: 'Tax Invoice – Simplified', alignment: 'center', fontSize: 11, margin: [0,0,0,4] })
  content.push({ text: `Invoice: ${invoiceNo}`, alignment: 'center', fontSize: 10 })
  content.push({ text: `Date: ${date}`, alignment: 'center', fontSize: 10 })
  if (time){ content.push({ text: `Time: ${time}`, alignment: 'center', fontSize: 10 }) }
  if (customerName){ content.push({ text: `Customer: ${String(customerName||'')}`, alignment: 'center', fontSize: 10, rtl: /[\u0600-\u06FF]/.test(String(customerName||'')) }) }
  if (customerPhone){ content.push({ text: `Mobile: ${String(customerPhone||'')}`, alignment: 'center', fontSize: 10 }) }
  if (tableNumber){ content.push({ text: `Table: ${String(tableNumber)}`, alignment: 'center', fontSize: 10 }) }
  content.push({ canvas: [{ type:'line', x1: 10, y1: 0, x2: widthPt-10, y2: 0, lineWidth: 0.5, lineColor: '#000' }], margin: [0,4,0,4] })
  const header = [
    { text: 'Item', style: 'th' },
    { text: 'Qty', style: 'th', alignment: 'center' },
    { text: 'Amount', style: 'th', alignment: 'right' },
    { text: 'Subtotal', style: 'th', alignment: 'right' },
    { text: 'VAT', style: 'th', alignment: 'right' },
    { text: 'Total', style: 'th', alignment: 'right' },
  ]
  const body = [header]
  const vatRate = Number(vatPct||0)/100
  for (const it of (items||[])){
    const name = String(it.name||'')
    const qty = Number(it.qty||0)
    const unit = Number(it.price||0)
    const subtotalLine = qty*unit
    const vatLine = subtotalLine*vatRate
    const totalLine = subtotalLine+vatLine
    body.push([
      { text: name, alignment: /[\u0600-\u06FF]/.test(name)?'right':'left', rtl: /[\u0600-\u06FF]/.test(name) },
      { text: qty.toFixed(0), alignment: 'center' },
      { text: unit.toFixed(2), alignment: 'right' },
      { text: subtotalLine.toFixed(2), alignment: 'right' },
      { text: vatLine.toFixed(2), alignment: 'right' },
      { text: totalLine.toFixed(2), alignment: 'right' },
    ])
  }
  content.push({ table: { widths: ['*', 30, 45, 45, 40, 50], body }, layout: 'noHorizontalLines', margin: [6,2,6,6], fontSize: 9 })
  content.push({ canvas: [{ type:'line', x1: 10, y1: 0, x2: widthPt-10, y2: 0, lineWidth: 0.5, lineColor: '#000' }], margin: [0,4,0,4] })
  const totals = [
    { k: 'Subtotal', v: Number(subtotal||0) },
    { k: `VAT (${Number(vatPct||0)}%)`, v: Number(vatAmount||0) },
    { k: 'TOTAL', v: Number(total||0) },
    { k: 'Payment Method', v: String(paymentMethod||'—').toUpperCase() },
  ]
  for (const row of totals){
    content.push({ columns: [ { text: row.k, width: '*', fontSize: 10 }, { text: typeof row.v==='number'?row.v.toFixed(2):row.v, width: 80, alignment: 'right', fontSize: 10 } ], margin: [10,2,10,2] })
  }
  if (!qrCodeBase64){
    try {
      const payload = JSON.stringify({ invoice: invoiceNo, total: Number(total||0), vat: Number(vatAmount||0) })
      qrCodeBase64 = await QRCode.toDataURL(payload, { margin: 0, scale: 3 })
    } catch {}
  }
  if (qrCodeBase64){ content.push({ image: normalizeDataUrl(qrCodeBase64), width: 80, alignment: 'center', margin: [0,6,0,6] }) }
  content.push({ text: 'شكراً لزيارتكم', alignment: 'center', rtl: true, fontSize: 11 })
  content.push({ text: 'Thank you for visiting', alignment: 'center', fontSize: 11, margin: [0,0,0,8] })
  const defFont = (fontBase64?fontName:(
    (pdfMake.fonts && pdfMake.fonts.Cairo && pdfMake.vfs && pdfMake.vfs['Cairo-Regular.ttf'])
      ? 'Cairo'
      : (pdfMake.fonts && pdfMake.fonts.NotoSansArabic && pdfMake.vfs && pdfMake.vfs['NotoSansArabic-Regular.ttf'])
        ? 'NotoSansArabic'
        : (pdfMake.fonts && pdfMake.fonts.Tahoma && pdfMake.vfs && pdfMake.vfs['Tahoma.ttf'])
          ? 'Tahoma'
          : 'Roboto'
  ))
  const dd = { pageSize: { width: widthPt, height: 800 }, pageMargins: [6,6,6,6], content, defaultStyle: { font: defFont } }
  try {
    if (previewWin) {
      pdfMake.createPdf(dd).getBlob((blob)=>{
        try { const url = URL.createObjectURL(blob); previewWin.location.href = url }
        catch {
          try { if (pdfMake.fonts && pdfMake.fonts.Tahoma) delete pdfMake.fonts.Tahoma } catch {}
          const safeDD = { ...dd, defaultStyle: { ...dd.defaultStyle, font: 'Roboto' } }
          pdfMake.createPdf(safeDD).open()
        }
      })
    } else {
      try { pdfMake.createPdf(dd).open() }
      catch {
        try { if (pdfMake.fonts && pdfMake.fonts.Tahoma) delete pdfMake.fonts.Tahoma } catch {}
        const safeDD = { ...dd, defaultStyle: { ...dd.defaultStyle, font: 'Roboto' } }
        pdfMake.createPdf(safeDD).open()
      }
    }
  } catch {
    try { if (pdfMake.fonts && pdfMake.fonts.Tahoma) delete pdfMake.fonts.Tahoma } catch {}
    const safeDD = { ...dd, defaultStyle: { ...dd.defaultStyle, font: 'Roboto' } }
    pdfMake.createPdf(safeDD).open()
  }
}