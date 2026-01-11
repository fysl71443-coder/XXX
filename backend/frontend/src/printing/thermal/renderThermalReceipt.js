import QRCode from 'qrcode'

function fmt(v, lang){
  try { return Number(v||0).toLocaleString(lang==='ar'?'ar-EG':'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } catch { return String(Number(v||0).toFixed(2)) }
}

function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

async function qrSrc(data){
  const raw = data.qrCodeBase64||data.qrBase64||''
  if (raw) return raw
  const p = data.qrPayload||data.qrString||''
  if (!p) {
    const alt = [
      String(data.companyEn||data.companyAr||'').trim(),
      String(data.vatNumber||'').trim(),
      `${String(data.date||'')} ${String(data.time||'')}`.trim(),
      String(Number(data.total||0).toFixed(2)),
      String(Number(data.vatAmount||0).toFixed(2))
    ].join('|')
    try { return await QRCode.toDataURL(alt, { width: 256, margin: 1, errorCorrectionLevel: 'M' }) } catch { return '' }
  }
  try { return await QRCode.toDataURL(String(p), { width: 256, margin: 1, errorCorrectionLevel: 'M' }) } catch { return '' }
}

export async function renderThermalReceipt(template, data){
  const lang = String(data.lang||'ar')
  const dir = lang==='ar'?'rtl':'ltr'
  const paperMm = Number(data.paperWidthMm||80)
  const qr = await qrSrc(data)
  const icon = data.currencyIcon ? `<img src='${data.currencyIcon}' alt='${esc(data.currencyCode||'SAR')}' style='height:12px'/>` : '﷼'
  if (String(template||'')==='incomeSummary'){
    const style = `@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm } } body{ font-family: Arial, Tahoma, sans-serif; margin:0 auto; padding:2mm; width:${paperMm}mm; direction:${dir} } .center{ text-align:center } .line{ display:flex; justify-content:space-between; gap:8px; font-size:12px } .sep{ border-top:1px dashed #000; margin:4px 0 }`
    const rows = [
      `<div class='center' style='font-weight:700;font-size:14px'>${esc(data.companyAr||data.companyEn||'')}</div>`,
      `<div class='center' style='font-size:12px'>${esc(data.period||'')}</div>`,
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='line'><div>Net Income / صافي الدخل</div><div>${fmt(data.netIncome||0, lang)}</div></div>`,
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='center' style='font-size:10px'>Checksum: ${esc(data.checksum||'00000000')}</div>`
    ]
    return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'/><title>INCOME SUMMARY</title><style>${style}</style></head><body>${rows.join('')}</body></html>`
  }
  if (String(template||'')==='trialBalanceSummary'){
    const style = `@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm } } body{ font-family: Arial, Tahoma, sans-serif; margin:0 auto; padding:2mm; width:${paperMm}mm; direction:${dir} } .center{ text-align:center } .line{ display:flex; justify-content:space-between; gap:8px; font-size:12px } .sep{ border-top:1px dashed #000; margin:4px 0 }`
    const debit = Number((data.totals&&data.totals.debit)||data.debit||0)
    const credit = Number((data.totals&&data.totals.credit)||data.credit||0)
    const balanced = !!data.balanced
    const rows = [
      `<div class='center' style='font-weight:700;font-size:14px'>${esc(data.companyAr||data.companyEn||'')}</div>`,
      `<div class='center' style='font-size:12px'>${esc(data.period||'')}</div>`,
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='line'><div>Debit / مدين</div><div>${fmt(debit, lang)}</div></div>`,
      `<div class='line'><div>Credit / دائن</div><div>${fmt(credit, lang)}</div></div>`,
      (balanced?`<div class='line'><div>Balanced / متوازن</div><div>✓</div></div>`:''),
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='center' style='font-size:10px'>Checksum: ${esc(data.checksum||'00000000')}</div>`
    ]
    return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'/><title>TRIAL BALANCE SUMMARY</title><style>${style}</style></head><body>${rows.join('')}</body></html>`
  }
  if (String(template||'')==='ledgerSummary'){
    const style = `@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm } } body{ font-family: Arial, Tahoma, sans-serif; margin:0 auto; padding:2mm; width:${paperMm}mm; direction:${dir} } .center{ text-align:center } .line{ display:flex; justify-content:space-between; gap:8px; font-size:12px } .sep{ border-top:1px dashed #000; margin:4px 0 }`
    const debit = Number((data.totals&&data.totals.debit)||0)
    const credit = Number((data.totals&&data.totals.credit)||0)
    const balanced = !!data.balanced
    const rows = [
      `<div class='center' style='font-weight:700;font-size:14px'>${esc(data.companyAr||data.companyEn||'')}</div>`,
      `<div class='center' style='font-size:12px'>${esc(data.period||'')}</div>`,
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='line'><div>Ledger Totals / إجمالي القيود</div><div></div></div>`,
      `<div class='line'><div>Debit / مدين</div><div>${fmt(debit, lang)}</div></div>`,
      `<div class='line'><div>Credit / دائن</div><div>${fmt(credit, lang)}</div></div>`,
      (balanced?`<div class='line'><div>Balanced / متوازن</div><div>✓</div></div>`:''),
      `<div class='sep'>─────────────────────────────</div>`,
      `<div class='center' style='font-size:10px'>Checksum: ${esc(data.checksum||'00000000')}</div>`
    ]
    return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'/><title>LEDGER SUMMARY</title><style>${style}</style></head><body>${rows.join('')}</body></html>`
  }
  if (String(template||'')==='posKitchen'){
    const rows = Array.isArray(data.items)?data.items.map(it=>`<tr><td>${esc(it.name)}</td><td class='c'>${Number(it.qty||0)}</td><td class='c'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(it.price,lang)}</span></td><td class='l'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(Number(it.qty||0)*Number(it.price||0),lang)}</span></td></tr>`).join(''):''
    return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'/><title>ORDER</title><style>@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm } } body{ font-family: Arial, Tahoma, sans-serif; margin:0 auto; padding:2mm; width:${paperMm}mm; direction:${dir} } .t{ text-align:center; font-weight:600; margin:2mm 0 } .r{ display:flex; justify-content:space-between; font-size:12px } .h{ border-top:1px dashed #000; margin:2mm 0 } table{ width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px } th,td{ padding:2px 0; word-wrap:break-word } th{ text-align:${dir==='rtl'?'right':'left'} } .c{ text-align:center } .l{ text-align:${dir==='rtl'?'left':'right'} } .n{ text-align:center; font-size:11px; margin-top:2mm }</style></head><body><div class='t'>طلب المطبخ</div><div class='r'><div>${esc(data.branchName||'')}</div><div>${esc(String(data.tableNumber||''))}</div></div><div class='h'></div><table><thead><tr><th>${dir==='rtl'?'الصنف':'Item'}</th><th>${dir==='rtl'?'الكمية':'Qty'}</th><th>${dir==='rtl'?'سعر':'Price'}</th><th>${dir==='rtl'?'الإجمالي':'Sum'}</th></tr></thead><tbody>${rows}</tbody></table><div class='h'></div><div class='n'>${dir==='rtl'?'هذا الإيصال لمتابعة الطلبات وليس فاتورة رسمية':'This receipt is for orders tracking only'}</div></body></html>`
  }
  const printLogo = (function(){ const v = data.printLogo; return (typeof v === 'undefined') ? true : !!v })()
  const lw = Number(data.logoWidthMm||0)
  const lh = Number(data.logoHeightMm||0)
  const logoStyle = (lw>0 || lh>0) ? `style="${lw>0?`width:${lw}mm;`:''}${lh>0?`height:${lh}mm;`:''}max-width:none;object-fit:contain;display:block;margin:2px auto 0"` : ''
  const logo = (data.logoBase64 && printLogo)?`<img class='logo' src='${data.logoBase64}' alt='' ${logoStyle}/>`:''
  const branchName = String(data.branchName||'')
  const companyLine = `<div class='center' style='font-weight:700;font-size:14px'>${esc(data.companyEn||data.companyAr||'')}</div>`
  const addrLine = data.address?`<div class='center'>${esc(String(data.address||''))}</div>`:''
  const vatLine = `<div class='center'>VAT No.: ${esc(String(data.vatNumber||'—'))}</div>`
  const phoneLine = `<div class='center'>Phone: ${esc(String(data.phone||''))}</div>`
  const dateLine = `<div class='center'>Date / التاريخ : ${esc(String(data.date||''))}</div>`
  const timeLine = `<div class='center'>Time / الوقت   : ${esc(String(data.time||''))}</div>`
  const invLine = `<div class='center'>Invoice No.: ${esc(String(data.invoiceNo||''))}</div>`
  const branchBiLine = `<div class='line'><div>الفرع : ${esc(branchName.toUpperCase())}</div><div>Branch : ${esc(branchName.toUpperCase())}</div></div>`
  const tableBiLine = (typeof data.tableNumber!=='undefined') ? `<div class='line'><div>الطاولة : ${esc(String(data.tableNumber||''))}</div><div>Table : ${esc(String(data.tableNumber||''))}</div></div>` : ''
  const custEnLine = (function(){
    const name = String(data.customerName||'')
    const lower = name.toLowerCase()
    let en = name
    if (name==='عميل نقدي' || lower==='cash customer' || lower==='cash') en = 'CASH Customer'
    else if (name==='عميل آجل' || lower==='credit customer' || lower==='credit') en = 'Credit Customer'
    return `<div class='line'><div>Customer : ${esc(en)}</div><div></div></div>`
  })()
  const custArLine = (function(){
    const name = String(data.customerName||'')
    const lower = name.toLowerCase()
    let ar = name
    if (name==='عميل نقدي' || lower==='cash customer' || lower==='cash') ar = 'عميل نقدي'
    else if (name==='عميل آجل' || lower==='credit customer' || lower==='credit') ar = 'عميل آجل'
    return `<div class='line'><div>العميل   : ${esc(ar)}</div><div></div></div>`
  })()
  const custBiLine = (function(){
    const en = custEnLine.replace(/^<div class='line'><div>Customer :\s*/,'').replace(/<\/div><div><\/div><\/div>$/,'')
    const ar = custArLine.replace(/^<div class='line'><div>العميل\s*:\s*/,'').replace(/<\/div><div><\/div><\/div>$/,'')
    return `<div class='line'><div>العميل : ${ar}</div><div>Customer : ${en}</div></div>`
  })()
  const sep = `<div class='sep'>─────────────────────────────</div>`
  const rowsHtml = Array.isArray(data.items)?data.items.map(it=>{
    const amt = Number(it.qty||0)*Number(it.price||0)
    return `<tr><td class='item'>${esc(it.name)}</td><td class='qty'>${Number(it.qty||0)}</td><td class='amt'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(amt,'en')}</span></td></tr>`
  }).join(''):''
  const tableHead = `<thead>
    <tr><th class='item' style='width:54%'>الصنف / Item</th><th class='qty' style='width:16%'>الكمية / Qty</th><th class='amt' style='width:30%'>المبلغ / Amount</th></tr>
  </thead>`
  const totalsHtml = `
    <div class='line'><div>Subtotal / إجمالي الأصناف</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(data.subtotal,'en')}</span></div></div>
    <div class='line'><div>Discount / الخصم${data.discountPct>0?` (${fmt(data.discountPct,'en')}%)`:''}</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(data.discountAmount||0,'en')}</span></div></div>
    <div class='line'><div>VAT ${fmt(data.vatPct||0,'en')}% / الضريبة</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(data.vatAmount,'en')}</span></div></div>
    <div class='line total'><div>TOTAL / الإجمالي الكلي</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(data.total,'en')}</span></div></div>
  `
  const payLinesHtml = (function(){
    const labelPayments = 'طرق الدفع / Payment Method'
    function mapLabelAr(t){ const s = String(t||'').toLowerCase(); if (s==='card' || s==='bank') return 'بطاقة'; if (s==='cash') return 'نقدي'; if (s==='credit') return 'آجل'; if (s==='multiple') return 'مزيج'; return s.toUpperCase() }
    const linesArr = Array.isArray(data.paymentLines) ? data.paymentLines : []
    if (linesArr.length > 0) {
      const rows = linesArr.map(l => `<div class='line'><div>${esc(mapLabelAr(l.label||l.method||''))}</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(l.amount,'en')}</span></div></div>`).join('')
      return `<div class='line'><div class='f'>${labelPayments}:</div><div></div></div>${rows}`
    }
    const paymentsArr = Array.isArray(data.payments) ? data.payments : []
    if (paymentsArr.length > 0) {
      const agg = {}
      for (const p of paymentsArr) { const k = mapLabelAr(p.type); agg[k] = (agg[k]||0) + Number(p.amount||0) }
      const rows = Object.entries(agg).map(([k,v]) => `<div class='line'><div>${esc(k)}</div><div class='ltr'><span class='currency' style='display:inline-flex;align-items:center;gap:3px'>${icon}${fmt(v,'en')}</span></div></div>`).join('')
      return `<div class='line'><div class='f'>${labelPayments}:</div><div></div></div>${rows}`
    }
    if (data.paymentStatus && String(data.paymentStatus).toLowerCase()==='unpaid') {
      return `<div class='line'><div>Payment Status / حالة الدفع:</div><div>Unpaid / غير مدفوعة</div></div>`
    }
    if (data.paymentMethod) {
      const pm = mapLabelAr(data.paymentMethod)
      return `<div class='line'><div>Payment Method / طريقة الدفع:</div><div>${esc(pm)}</div></div>`
    }
    return ''
  })()
  const qrImg = qr?`<img src='${qr}' alt='QR' style='width:96px;height:96px;object-fit:contain;display:block;margin:6px auto'/>`:''
  const thanks = (function(){
    const arabicOnly = !!data.footerArabicOnly
    if (arabicOnly) return `<div class='center' style='margin-top:6px'>شكراً لزيارتكم</div>`
    return `<div class='center' style='margin-top:6px'>شكراً لزيارتكم</div><div class='center'>Thank you for visiting</div>`
  })()
  return `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'/><title>RECEIPT</title><style>@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm } .toolbar{ display:none } .logo{ max-width:70%; height:auto; image-rendering:pixelated; -webkit-print-color-adjust:exact; print-color-adjust:exact } } body{ margin:0 auto; padding:2mm; width:${paperMm}mm; direction:${dir}; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact } .receipt{ width:${paperMm}mm; font-family:'Courier New', monospace; font-size:12px; line-height:1.2; direction:${dir}; text-align:${dir==='rtl'?'right':'left'}; color:#000; font-weight:700 } .logo{ max-width:70%; height:auto; object-fit:contain; image-rendering:pixelated; display:block; margin:2px auto 0 } .center{text-align:center;font-size:12px} .line{display:flex;justify-content:space-between;align-items:center;margin:2px 0;font-size:12px} .sep{font-family:monospace;text-align:center;margin:4px 0} .ltr{ direction:ltr; text-align:left } table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px} th,td{padding:2px 0;border-bottom:1px dashed #000;word-wrap:break-word;color:#000} th{font-weight:bold;text-align:${dir==='rtl'?'right':'left'}} .item{text-align:${dir==='rtl'?'right':'left'}} .qty{text-align:center} .amt{text-align:right} .total{font-weight:bold} .toolbar{ position:fixed; top:6px; right:6px; display:flex; gap:6px } .toolbar button{ padding:6px 10px; border:1px solid #ddd; background:#f9f9f9; border-radius:6px; cursor:pointer } .toolbar button:hover{ background:#f0f0f0 }</style></head><body><div class='toolbar'><button onclick='window.print()'>Print</button><button onclick='window.close()'>Close</button></div><div class='receipt'>${logo?`${logo}`:''}<div class='receipt-header'>${companyLine}${addrLine}${vatLine}${phoneLine}${branchBiLine}${tableBiLine}${custBiLine}${invLine}${dateLine}${timeLine}</div>${sep}<table>${tableHead}<tbody>${rowsHtml}</tbody></table>${sep}${totalsHtml}${sep}${payLinesHtml}${qrImg}${thanks}</div></body></html>`
}