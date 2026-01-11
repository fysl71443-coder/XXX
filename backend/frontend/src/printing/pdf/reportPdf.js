import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { reports as apiReports, journal as apiJournal, accounts as apiAccounts, invoices as apiInvoices, payments as apiPayments, settings as apiSettings } from '../../services/api'
import { createPDF, validatePdfDefinition } from '../../utils/pdfUtils'

pdfMake.vfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : (pdfMake.vfs || {})
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-Italic.ttf',
  },
}

function currencyInfo(code){ const c=String(code||'SAR').toUpperCase(); if(c==='SAR') return { code:'SAR', symbol:'SAR', position:'suffix' }; if(c==='USD') return { code:'USD', symbol:'$', position:'prefix' }; if(c==='EUR') return { code:'EUR', symbol:'€', position:'prefix' }; return { code:c, symbol:c, position:'suffix' } }
function fmtAmount(v, cur){ const n=Number(v||0); const s=(function(){ try{ return n.toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 }) } catch{ return String(n.toFixed(2)) } })(); return cur.position==='prefix'? `${cur.symbol} ${s}` : `${s} ${cur.symbol}` }

async function header(company, branding, title, sub){ const name=(company?.name_en||company?.name_ar||''); const phone=String(company?.phone||''); const addr=String(company?.address||''); const vat=String(company?.vat_number||''); const h=[{ text:name, fontSize:16, bold:true, alignment:'left' }, { text:addr, fontSize:10, alignment:'left' }, { text:phone||'', fontSize:10, alignment:'left' }, { text:vat?(`VAT: ${vat}`):'', fontSize:10, alignment:'left' }]; const t={ text:title, fontSize:14, bold:true, alignment:'center', margin:[0,8,0,2] }; const s=sub?{ text:sub, fontSize:11, alignment:'center', margin:[0,0,0,10] }:null; const out=[]; const logo=String(branding?.logo||''); if(/^data:image\/(png|jpe?g|svg)/i.test(logo)){ out.push({ image: logo, width: 120, alignment:'left', margin:[0,0,0,8] }) } out.push(...h, t); if(s) out.push(s); return out }
export { header as _test_header }

export async function printJournalPDF({ from, to }){ const company=await apiSettings.get('settings_company').catch(()=>null); const branding=await apiSettings.get('settings_branding').catch(()=>null); const data=await apiJournal.list({ from, to, status:'posted', pageSize: 1000 }).catch(()=>({ items:[] })); const rows=[[{ text:'Entry #', bold:true }, { text:'Date', bold:true }, { text:'Status', bold:true }, { text:'Description', bold:true }, { text:'Debit', bold:true }, { text:'Credit', bold:true }]]; let totalD=0, totalC=0; for(const e of (data.items||[])){ totalD += Number(e.debit||0); totalC += Number(e.credit||0); rows.push([{ text: String(e.entry_number||'-'), alignment:'center' }, { text: String(e.date||''), alignment:'center' }, { text: String(e.status||'') }, { text: String(e.description||'') }, { text: Number(e.debit||0).toFixed(2), alignment:'right' }, { text: Number(e.credit||0).toFixed(2), alignment:'right' }]) } const head=await header(company, branding, 'Journal Entries Report', (from&&to)? `${from} → ${to}` : ''); const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...head, { table:{ headerRows:1, widths:['auto','auto','auto','*','auto','auto'], body: rows }, layout:'lightHorizontalLines' }, { text: `Totals — Debit: ${totalD.toFixed(2)} • Credit: ${totalC.toFixed(2)}`, alignment:'right', bold:true, margin:[0,8,0,0] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }; const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } createPDF(doc).open() }

export async function printTrialBalancePDF({ from, to }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const period=await apiJournal.list({ from, to, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
  const start = from ? new Date(from) : null
  const end = to ? new Date(to) : null
  const map = new Map()
  for (const je of (period.items||[])){
    const d = new Date(String(je.date||''))
    const postings = Array.isArray(je.postings) ? je.postings : []
    for (const p of postings){
      const code = String(p.account?.account_code||'').trim()
      if (!code) continue
      const name = String(p.account?.name_en||p.account?.name||'')
      const debit = Number(p.debit||0)
      const credit = Number(p.credit||0)
      if (!map.has(code)) map.set(code, { code, name, beginning:0, debit:0, credit:0, ending:0 })
      const acc = map.get(code)
      if (start && d < start){ acc.beginning += (debit - credit) }
      else if ((!start || d >= start) && (!end || d <= end)){
        acc.debit += debit
        acc.credit += credit
      }
    }
  }
  const items = Array.from(map.values())
    .map(acc => ({ ...acc, ending: acc.beginning + acc.debit - acc.credit }))
    .filter(acc => (acc.beginning!==0 || acc.debit!==0 || acc.credit!==0 || acc.ending!==0))
    .sort((a,b)=> String(a.code).localeCompare(String(b.code)))
  const rows=[[{ text:'Code', bold:true }, { text:'Account', bold:true }, { text:'Beginning', bold:true }, { text:'Debit', bold:true }, { text:'Credit', bold:true }, { text:'Ending', bold:true }]]
  let td=0, tc=0
  for(const it of items){
    td += Number(it.debit||0); tc += Number(it.credit||0)
    rows.push([{ text: String(it.code||''), alignment:'center' }, { text: String(it.name||'') }, { text: Number(it.beginning||0).toFixed(2), alignment:'right' }, { text: Number(it.debit||0).toFixed(2), alignment:'right' }, { text: Number(it.credit||0).toFixed(2), alignment:'right' }, { text: Number(it.ending||0).toFixed(2), alignment:'right' }])
  }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Trial Balance', (from&&to)? `${from} → ${to}` : ''), { table:{ headerRows:1, widths:['auto','*','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' }, { text: `Totals — Debit: ${td.toFixed(2)} • Credit: ${tc.toFixed(2)}`, alignment:'right', bold:true, margin:[0,8,0,0] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return }
  createPDF(doc).open()
}

export async function printIncomeStatementPDF({ from, to }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const period=await apiJournal.list({ from, to, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
  const start = from ? new Date(from) : null
  const end = to ? new Date(to) : null
  const norm=(t)=>{ const s=String(t||'').trim().toLowerCase(); if(['revenue','income','sales'].includes(s)) return 'revenue'; if(['expense','expenses','cost','cogs','operating expense'].includes(s)) return 'expense'; return null }
  const rev=new Map(), exp=new Map()
  for(const it of (period.items||[])){
    const d = new Date(String(it.date||''))
    if (start && d < start) continue
    if (end && d > end) continue
    for(const p of (it.postings||[])){
      const code=String(p.account?.account_code||'').trim()
      if(!code) continue
      const name=String(p.account?.name_en||p.account?.name||'')
      const typ=norm(p.account?.type)
      if(!typ) continue
      const debit=Number(p.debit||0)
      const credit=Number(p.credit||0)
      if(typ==='revenue'){
        const prev=rev.get(code)||{ name, amount:0 }
        prev.amount += (credit - debit)
        prev.name = prev.name || name
        rev.set(code, prev)
      } else if(typ==='expense'){
        const prev=exp.get(code)||{ name, amount:0 }
        prev.amount += (debit - credit)
        prev.name = prev.name || name
        exp.set(code, prev)
      }
    }
  }
  const revItems = Array.from(rev.entries()).map(([code,v])=>({ code, name:v.name, amount:v.amount })).filter(i=>Math.abs(i.amount)>0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
  const expItems = Array.from(exp.entries()).map(([code,v])=>({ code, name:v.name, amount:v.amount })).filter(i=>Math.abs(i.amount)>0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
  const revTot=revItems.reduce((s,i)=>s+i.amount,0)
  const expTot=expItems.reduce((s,i)=>s+i.amount,0)
  const net=revTot-expTot
  const rowsR=[[{ text:'Revenue', bold:true }, { text: Number(revTot).toFixed(2), alignment:'right', bold:true }]]
  revItems.forEach(i=>rowsR.push([{ text: String(i.name||'') }, { text: Number(i.amount||0).toFixed(2), alignment:'right' }]))
  const rowsE=[[{ text:'Expenses', bold:true }, { text: Number(expTot).toFixed(2), alignment:'right', bold:true }]]
  expItems.forEach(i=>rowsE.push([{ text: String(i.name||'') }, { text: Number(i.amount||0).toFixed(2), alignment:'right' }]))
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Income Statement', (from&&to)? `${from} → ${to}` : ''), { table:{ headerRows:0, widths:['*','auto'], body: rowsR }, layout:'lightHorizontalLines', margin:[0,0,0,10] }, { table:{ headerRows:0, widths:['*','auto'], body: rowsE }, layout:'lightHorizontalLines', margin:[0,0,0,10] }, { text: `Net Income: ${Number(net).toFixed(2)}`, alignment:'right', bold:true } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return }
  createPDF(doc).open()
}

export async function printAccountStatementPDF({ accountId, from, to }){ const company=await apiSettings.get('settings_company').catch(()=>null); const branding=await apiSettings.get('settings_branding').catch(()=>null); const entries=await apiJournal.byAccount(accountId,{ from, to, pageSize:1000 }).catch(()=>[]); let totalD=0,totalC=0; const rows=[[{ text:'Date', bold:true }, { text:'Description', bold:true }, { text:'Debit', bold:true }, { text:'Credit', bold:true }]]; for(const e of (entries||[])){ totalD+=Number(e.debit||0); totalC+=Number(e.credit||0); rows.push([{ text: String(e.journal?.date||''), alignment:'center' }, { text: String(e.journal?.description||'') }, { text: Number(e.debit||0).toFixed(2), alignment:'right' }, { text: Number(e.credit||0).toFixed(2), alignment:'right' }]) } const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Account Statement', (from&&to)? `${from} → ${to}` : ''), { table:{ headerRows:1, widths:['auto','*','auto','auto'], body: rows }, layout:'lightHorizontalLines' }, { text: `Totals — Debit: ${totalD.toFixed(2)} • Credit: ${totalC.toFixed(2)}`, alignment:'right', bold:true, margin:[0,8,0,0] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }; const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } createPDF(doc).open() }

export async function printClientStatementPDF({ partnerId, from, to }){ const company=await apiSettings.get('settings_company').catch(()=>null); const branding=await apiSettings.get('settings_branding').catch(()=>null); const invRes=await apiInvoices.list({ partner_id: partnerId, from, to, type:'sale' }).catch(()=>({ items:[] })); const payRes=await apiPayments.list({ partner_id: partnerId, from, to }).catch(()=>({ items:[] })); const rows=[[{ text:'Invoice', bold:true }, { text:'Date', bold:true }, { text:'Amount', bold:true }, { text:'Paid', bold:true }, { text:'Remaining', bold:true }]]; const paidByInv=new Map(); for(const p of (payRes.items||[])){ const k=p.invoice_id||0; const prev=paidByInv.get(k)||0; paidByInv.set(k, prev+Number(p.amount||0)) } let total=0, totalPaid=0, totalRem=0; for(const inv of (invRes.items||invRes||[])){ const amt=Number(inv.total||0); const paid=Number(paidByInv.get(inv.id)||0); const rem=Math.max(0, amt-paid); total += amt; totalPaid += paid; totalRem += rem; rows.push([{ text: String(inv.invoice_number||inv.id), alignment:'center' }, { text: String(inv.date||''), alignment:'center' }, { text: amt.toFixed(2), alignment:'right' }, { text: paid.toFixed(2), alignment:'right' }, { text: rem.toFixed(2), alignment:'right' }]) } const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Customer Statement', (from&&to)? `${from} → ${to}` : ''), { table:{ headerRows:1, widths:['auto','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' }, { text: `Totals — Invoices: ${total.toFixed(2)} • Paid: ${totalPaid.toFixed(2)} • Remaining: ${totalRem.toFixed(2)}`, alignment:'right', bold:true, margin:[0,8,0,0] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }; const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } createPDF(doc).open() }