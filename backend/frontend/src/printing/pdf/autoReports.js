import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { settings as apiSettings, journal as apiJournal, accounts as apiAccounts, reports as apiReports } from '../../services/api'
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

function toBase64(buffer){ let binary=''; const bytes=new Uint8Array(buffer); for(let i=0;i<bytes.byteLength;i++){ binary+=String.fromCharCode(bytes[i]) } return btoa(binary) }

function computeChecksum(obj){
  try {
    const normalize = (v) => {
      if (v == null) return null
      if (Array.isArray(v)) return v.map(x => normalize(x))
      if (typeof v === 'object') {
        const keys = Object.keys(v).sort()
        const out = {}
        for (const k of keys) out[k] = normalize(v[k])
        return out
      }
      if (typeof v === 'number') return Number(v.toFixed ? v.toFixed(6) : v)
      return v
    }
    const s = JSON.stringify(normalize(obj))
    let h = 0
    for (let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0 }
    return h.toString(16).padStart(8,'0')
  } catch { return '00000000' }
}

async function header(company, branding, title, sub){ const name=(company?.name_en||company?.name||''); const phone=String(company?.phone||''); const addr=String(company?.address||''); const vat=String(company?.vat_number||''); const out=[]; const logo=String(branding?.logo||''); if(/^data:image\/(png|jpe?g|svg)/i.test(logo)){ out.push({ image: logo, width: 120, alignment:'left', margin:[0,0,0,8] }) } out.push({ text:name, fontSize:16, bold:true, alignment:'left' }); if(addr) out.push({ text:addr, fontSize:10, alignment:'left' }); if(phone) out.push({ text:phone, fontSize:10, alignment:'left' }); if(vat) out.push({ text:`VAT: ${vat}`, fontSize:10, alignment:'left' }); out.push({ text:title, fontSize:14, bold:true, alignment:'center', margin:[0,8,0,2] }); if(sub) out.push({ text:sub, fontSize:11, alignment:'center', margin:[0,0,0,10] }); return out }
export { header as _test_header }

function tableHeader(cells){ return cells.map(c=>({ text:c, bold:true, alignment:'center' })) }

export async function generateReportPDF({ reportType='journal', lang='ar', fromDate=null, toDate=null, download=false }){
  try {
    const preferredFont = 'Roboto'
    const company=await apiSettings.get('settings_company').catch(()=>null)
    const branding=await apiSettings.get('settings_branding').catch(()=>null)
    let content=[]
    const titleMap={ journal:'Journal Entries', vat:'VAT Return', income:'Income Statement', balance:'Balance Sheet', ledger:'General Ledger', trialBalance:'Trial Balance' }
    const sub=(fromDate&&toDate)?`${fromDate} → ${toDate}`:''
    content.push(...(await header(company, branding, titleMap[reportType]||String(reportType), sub)))
    if (reportType==='journal'){
    const data=await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const rows=[tableHeader(['Entry #','Date','Status','Description','Debit','Credit'])]
    let td=0, tc=0
    for (const e of (data.items||[])){
      td += Number(e.debit||0); tc += Number(e.credit||0)
      rows.push([
        { text:String(e.entry_number||'-'), alignment:'center', margin:[0,4,0,4] }, 
        { text:String(e.date||''), alignment:'center', margin:[0,4,0,4] }, 
        { text:String(e.status||''), alignment:'left', margin:[0,4,0,4] }, 
        { text:String(e.description||''), alignment:'left', margin:[0,4,0,4] }, 
        { text:Number(e.debit||0).toFixed(2), alignment:'right', margin:[0,4,0,4] }, 
        { text:Number(e.credit||0).toFixed(2), alignment:'right', margin:[0,4,0,4] }
      ])
    }
    content.push({ 
      table:{ 
        headerRows:1, 
        widths:['auto','auto','auto','*','auto','auto'], 
        body: rows 
      }, 
      layout:{
        fillColor: (rowIndex)=> rowIndex===0?'#f8fafc':null,
        hLineColor: '#e5e7eb',
        vLineColor: '#e5e7eb',
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6
      }
    })
    content.push({ 
      text: `Totals — Debit: ${td.toFixed(2)} • Credit: ${tc.toFixed(2)}`, 
      alignment: 'right', 
      bold:true, 
      margin:[0,12,0,0],
      fontSize: 11
    })
  } else if (reportType==='vat'){
    const accTree = await apiAccounts.tree().catch(()=>[])
    const period = await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const flat=[]; (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if(n.children?.length) walk(n.children) }) })(accTree)
    const accMap = new Map(); flat.forEach(a=>{ accMap.set(Number(a.id), { code: String(a.account_code||a.account_number||''), name: String(a.name_en||a.name||'') }) })
    const byCode = new Map()
    for (const it of (period.items||[])){
      for (const p of (it.postings||[])){
        const id = Number(p.account_id||0)
        const codeRaw = String(p.account?.account_code||accMap.get(id)?.code||'').trim()
        const code = codeRaw || String(id||'')
        const prev = byCode.get(code) || { debit:0, credit:0 }
        prev.debit += parseFloat(p.debit||0)
        prev.credit += parseFloat(p.credit||0)
        byCode.set(code, prev)
      }
    }
    const stdRate = 0.15
    const outRow = byCode.get('2110') || { debit:0, credit:0 }
    const inRow = byCode.get('2120') || { debit:0, credit:0 }
    const outputVat = Math.max(0, Number(outRow.credit||0) - Number(outRow.debit||0))
    const inputVat = Math.max(0, Number(inRow.debit||0) - Number(inRow.credit||0))
    const netSales = outputVat / stdRate
    const taxablePurchases = inputVat / stdRate
    const netVat = outputVat - inputVat
    const isAr = lang==='ar'
    const labels = isAr ? {
      title: 'إقرار ضريبة القيمة المضافة',
      taxpayer: 'اسم المُكلَّف / اسم المنشأة',
      vat: 'رقم التسجيل الضريبي',
      period: 'الفترة الضريبية',
      from: 'من',
      to: 'إلى',
      stdSales: 'توريدات خاضعة للنسبة الأساسية (15%)',
      outVat: 'ضريبة المخرجات للنسبة الأساسية',
      purchases: 'إجمالي المشتريات الخاضعة للضريبة',
      inVat: 'ضريبة المدخلات القابلة للخصم',
      net: 'صافي الضريبة المستحقة',
      declaration: 'أقرّ بأن المعلومات الواردة أعلاه صحيحة ودقيقة وفقاً لما ظهر في سجلاتي. أتعهد بدفع الضريبة المستحقة في موعدها.'
    } : {
      title: 'VAT Return',
      taxpayer: 'Taxpayer Name',
      vat: 'VAT Number',
      period: 'Tax Period',
      from: 'From',
      to: 'To',
      stdSales: 'Standard Rated Supplies (15%)',
      outVat: 'Standard Rated Output VAT',
      purchases: 'Total Taxable Purchases',
      inVat: 'Deductible Input VAT',
      net: 'Net VAT Due',
      declaration: 'I declare the information above is true and accurate per my records. I commit to paying the due VAT on time.'
    }
    const name = String(company?.name||company?.name_en||'')
    const vatNumber = String(company?.vat_number||'')
    const submissionDate = new Date().toISOString().slice(0,10)
    content.push({ columns:[
      { text: 'ZATCA', fontSize: 18, bold: true, color: '#006B4B', alignment: isAr?'right':'left' },
      { text: labels.title, fontSize: 16, bold: true, color: '#0EA5A1', alignment: isAr?'left':'right' }
    ], margin:[0,6,0,12] })
    content.push({ columns:[
      { text: `${labels.taxpayer}: ${name}`, alignment: isAr?'right':'left' },
      { text: `${labels.vat}: ${vatNumber}`, alignment: isAr?'left':'right' }
    ] })
    content.push({ columns:[
      { text: `${labels.from}: ${fromDate||'—'}`, alignment: isAr?'right':'left' },
      { text: `${labels.to}: ${toDate||'—'}`, alignment: 'center' },
      { text: `${labels.period}: ${fromDate||''} → ${toDate||''}`, alignment: isAr?'left':'right' }
    ], margin:[0,0,0,10] })
    content.push({ table:{ widths:['*','auto'], body:[
      [{ text: labels.stdSales }, { text: String(Number(netSales||0).toFixed(2)), alignment:'right' }],
      [{ text: labels.outVat }, { text: String(Number(outputVat||0).toFixed(2)), alignment:'right' }]
    ] }, layout:'lightHorizontalLines', margin:[0,0,0,8] })
    content.push({ table:{ widths:['*','auto'], body:[
      [{ text: labels.inVat }, { text: String(Number(inputVat||0).toFixed(2)), alignment:'right' }]
    ] }, layout:'lightHorizontalLines', margin:[0,0,0,8] })
    content.push({ table:{ widths:['*','auto'], body:[
      [{ text: labels.outVat }, { text: String(Number(outputVat||0).toFixed(2)), alignment:'right' }],
      [{ text: labels.inVat }, { text: String(Number(inputVat||0).toFixed(2)), alignment:'right' }],
      [{ text: labels.net, bold:true }, { text: String(Number(netVat||0).toFixed(2)), alignment:'right', bold:true }]
    ] }, layout:'lightHorizontalLines', margin:[0,0,0,8] })
    content.push({ text: labels.declaration, margin:[0,12,0,0] })
  } else if (reportType==='income'){
    const period=await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const start = fromDate ? new Date(fromDate) : null
    const end = toDate ? new Date(toDate) : null
    const accTree = await apiAccounts.tree().catch(()=>[])
    const flat=[]; (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if(n.children?.length) walk(n.children) }) })(accTree)
    const accMap = new Map(); flat.forEach(a=>{ accMap.set(Number(a.id), { type: String(a.type||''), code: String(a.account_code||a.account_number||''), name: String(a.name_en||a.name||'') }) })
    const norm=(t)=>{ const s=String(t||'').trim().toLowerCase(); if(['revenue','income','sales'].includes(s)) return 'revenue'; if(['expense','expenses','cost','cogs','operating expense'].includes(s)) return 'expense'; return null }
    const rev=new Map(), exp=new Map()
    for(const it of (period.items||[])){
      const d = new Date(String(it.date||''))
      if (start && d < start) continue
      if (end && d > end) continue
      for(const p of (it.postings||[])){
        const id = Number(p.account_id||0)
        const codeRaw = String(p.account?.account_code||p.account_code||accMap.get(id)?.code||'').trim()
        const code = codeRaw || String(id||'').trim()
        const name = String(p.account?.name_en||p.account?.name||p.account_name_en||p.account_name||accMap.get(id)?.name||'')
        const typ = norm(p.account?.type||p.account_type||accMap.get(id)?.type)
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
    let revItems = Array.from(rev.entries()).map(([code,v])=>({ code, name:v.name, amount:v.amount })).filter(i=>Math.abs(i.amount)>0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
    let expItems = Array.from(exp.entries()).map(([code,v])=>({ code, name:v.name, amount:v.amount })).filter(i=>Math.abs(i.amount)>0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
    if (revItems.length===0 && expItems.length===0){
      try {
        const api = await apiReports.incomeStatement({ ...(fromDate?{ from: fromDate }:{}), ...(toDate?{ to: toDate }:{}), ...( !fromDate && !toDate ? { period: undefined } : {} ) })
        const r = Array.isArray(api?.revenue_items)?api.revenue_items:[]
        const e = Array.isArray(api?.expense_items)?api.expense_items:[]
        revItems = r.map(x=>({ code:String(x.account_code||''), name:String(x.name||''), amount:Number(x.amount||0) }))
        expItems = e.map(x=>({ code:String(x.account_code||''), name:String(x.name||''), amount:Number(x.amount||0) }))
      } catch {}
    }
    const rt=revItems.reduce((s,i)=>s+i.amount,0)
    const et=expItems.reduce((s,i)=>s+i.amount,0)
    const net=rt-et
    const checksum = computeChecksum({ revenue_items: revItems, expense_items: expItems, revenue_total: rt, expense_total: et, net_income: net })
    const rowsR=[[{ text:'Revenue', bold:true }, { text: Number(rt).toFixed(2), alignment:'right', bold:true }]]; revItems.forEach(i=>rowsR.push([{ text:String(i.name||'') }, { text:Number(i.amount||0).toFixed(2), alignment:'right' }]))
    const rowsE=[[{ text:'Expenses', bold:true }, { text: Number(et).toFixed(2), alignment:'right', bold:true }]]; expItems.forEach(i=>rowsE.push([{ text:String(i.name||'') }, { text:Number(i.amount||0).toFixed(2), alignment:'right' }]))
    content.push({ table:{ headerRows:0, widths:['*','auto'], body: rowsR }, layout:'lightHorizontalLines', margin:[0,0,0,10] })
    content.push({ table:{ headerRows:0, widths:['*','auto'], body: rowsE }, layout:'lightHorizontalLines', margin:[0,0,0,10] })
    content.push({ text: `Net Income: ${Number(net).toFixed(2)}`, alignment:'right', bold:true })
    content.push({ text: `Checksum: ${checksum}`, alignment:'left', fontSize:8, margin:[0,6,0,0] })
  } else if (reportType==='balance'){
    const acc=await apiAccounts.tree().catch(()=>[])
    const per=await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const prevTo=(function(d){ if(!d) return null; try{ const x=new Date(d); x.setDate(x.getDate()-1); return x.toISOString().slice(0,10) } catch{ return null } })(fromDate)
    const pre= prevTo ? await apiJournal.list({ to: prevTo, status:'posted', pageSize:1000 }).catch(()=>({ items:[] })) : { items:[] }
    const flat=[]; (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if(n.children?.length) walk(n.children) }) })(acc)
    const mapAgg=(items)=>{ const m={}; for(const it of (items.items||[])){ for(const p of (it.postings||[])){ const id=p.account_id; if(!m[id]) m[id]={ debit:0, credit:0 }; m[id].debit+=parseFloat(p.debit||0); m[id].credit+=parseFloat(p.credit||0) } } return m }
    const preM=mapAgg(pre), perM=mapAgg(per)
    let assets=0, liabilities=0, equity=0
    for(const a of flat){ const preA=preM[a.id]||{ debit:0, credit:0 }, perA=perM[a.id]||{ debit:0, credit:0 }; const opening=parseFloat(a.opening_balance||0)+ (preA.debit - preA.credit); const closing=opening + (perA.debit - perA.credit); if(String(a.type)==='asset') assets+=closing; else if(String(a.type)==='liability') liabilities += (-closing); else if(String(a.type)==='equity') equity += (-closing) }
    let rows=[[{ text:'Assets' }, { text: Number(assets).toFixed(2), alignment:'right' }],[{ text:'Liabilities' }, { text: Number(liabilities).toFixed(2), alignment:'right' }],[{ text:'Equity' }, { text: Number(equity).toFixed(2), alignment:'right' }]]
    if (Math.abs(assets)+Math.abs(liabilities)+Math.abs(equity) < 0.0001){
      try {
        const rep = await apiReports.trialBalance({ ...(fromDate?{ from: fromDate }:{}), ...(toDate?{ to: toDate }:{}), ...( !fromDate && !toDate ? { period: undefined } : {} ) })
        const arr = Array.isArray(rep?.items)?rep.items:[]
        const sum = { assets:0, liabilities:0, equity:0 }
        for (const x of arr){
          const end = Number(x.ending||0)
          const t = String(x.type||'')
          if (t==='asset') sum.assets += end
          else if (t==='liability') sum.liabilities += (-end)
          else if (t==='equity') sum.equity += (-end)
        }
        rows=[[{ text:'Assets' }, { text: Number(sum.assets).toFixed(2), alignment:'right' }],[{ text:'Liabilities' }, { text: Number(sum.liabilities).toFixed(2), alignment:'right' }],[{ text:'Equity' }, { text: Number(sum.equity).toFixed(2), alignment:'right' }]]
      } catch {}
    }
    content.push({ table:{ widths:['*','auto'], body: rows }, layout:'lightHorizontalLines' })
  } else if (reportType==='trialBalance'){
    const period = await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const start = fromDate ? new Date(fromDate) : null
    const end = toDate ? new Date(toDate) : null
    const accTree = await apiAccounts.tree().catch(()=>[])
    const flat=[]; (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if(n.children?.length) walk(n.children) }) })(accTree)
    const accMap = new Map(); flat.forEach(a=>{ accMap.set(Number(a.id), { code: String(a.account_code||a.account_number||''), name: String(a.name_en||a.name||'') }) })
    const map = new Map()
    for (const je of (period.items||[])){
      const d = new Date(String(je.date||''))
      const postings = Array.isArray(je.postings) ? je.postings : []
      for (const p of postings){
        const id = Number(p.account_id||0)
        const codeRaw = String(p.account?.account_code||p.account_code||accMap.get(id)?.code||'').trim()
        const code = codeRaw || String(id||'').trim()
        const name = String(p.account?.name_en||p.account?.name||p.account_name_en||p.account_name||accMap.get(id)?.name||'')
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
    let items = Array.from(map.values())
      .map(acc => ({ ...acc, ending: acc.beginning + acc.debit - acc.credit }))
      .filter(acc => (acc.beginning!==0 || acc.debit!==0 || acc.credit!==0 || acc.ending!==0))
      .sort((a,b)=> String(a.code).localeCompare(String(b.code)))
    if (items.length===0){
      try {
        const rep = await apiReports.trialBalance({ ...(fromDate?{ from: fromDate }:{}), ...(toDate?{ to: toDate }:{}), ...( !fromDate && !toDate ? { period: undefined } : {} ) })
        const arr = Array.isArray(rep?.items)?rep.items:[]
        items = arr.map(x=>({ code:String(x.account_code||''), name:String(x.name||''), beginning:Number(x.beginning||0), debit:Number(x.debit||0), credit:Number(x.credit||0), ending:Number(x.ending||0) }))
      } catch {}
    }
    const rows=[tableHeader(['Code','Account','Beginning','Debit','Credit','Ending'])]
    let td=0, tc=0
    for (const it of items){
      td += Number(it.debit||0); tc += Number(it.credit||0)
      rows.push([
        { text:String(it.code||''), alignment:'center' },
        { text:String(it.name||''), alignment:'left' },
        { text:Number(it.beginning||0).toFixed(2), alignment:'right' },
        { text:Number(it.debit||0).toFixed(2), alignment:'right' },
        { text:Number(it.credit||0).toFixed(2), alignment:'right' },
        { text:Number(it.ending||0).toFixed(2), alignment:'right' },
      ])
    }
    content.push({ table:{ headerRows:1, widths:['auto','*','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' })
    content.push({ text: `Totals — Debit: ${td.toFixed(2)} • Credit: ${tc.toFixed(2)}`, alignment:'right', bold:true, margin:[0,12,0,0], fontSize: 11 })
  } else if (reportType==='ledger'){
    const per=await apiJournal.list({ from: fromDate||undefined, to: toDate||undefined, status:'posted', pageSize:1000 }).catch(()=>({ items:[] }))
    const accTree = await apiAccounts.tree().catch(()=>[])
    const flat=[]; (function walk(nodes){ (nodes||[]).forEach(n=>{ flat.push(n); if(n.children?.length) walk(n.children) }) })(accTree)
    const accMap = new Map(); flat.forEach(a=>{ accMap.set(Number(a.id), { code: String(a.account_code||a.account_number||''), name: String(a.name_en||a.name||'') }) })
    const sumBy=new Map(); for(const it of (per.items||[])){ for(const p of (it.postings||[])){ const key=Number(p.account_id||0); const prev=sumBy.get(key)||{ debit:0, credit:0, name:(p.account?.name_en||p.account?.name||accMap.get(key)?.name||''), code:(p.account?.account_code||accMap.get(key)?.code||'') }; prev.debit += parseFloat(p.debit||0); prev.credit += parseFloat(p.credit||0); prev.name = prev.name || (p.account?.name_en||p.account?.name||accMap.get(key)?.name||''); sumBy.set(key, prev) } }
    let items = Array.from(sumBy.values()).filter(v => Math.abs(Number(v.debit||0))>0.0001 || Math.abs(Number(v.credit||0))>0.0001)
    if (items.length===0){
      try {
        const rep = await apiReports.trialBalance({ ...(fromDate?{ from: fromDate }:{}), ...(toDate?{ to: toDate }:{}), ...( !fromDate && !toDate ? { period: undefined } : {} ) })
        const arr = Array.isArray(rep?.items)?rep.items:[]
        items = arr.filter(x => Math.abs(Number(x.debit||0))>0.0001 || Math.abs(Number(x.credit||0))>0.0001).map(x=>({ code:String(x.account_code||''), name:String(x.name||''), debit:Number(x.debit||0), credit:Number(x.credit||0) }))
      } catch {}
    }
    const rows=[tableHeader(['Code','Account','Debit','Credit'])]
    let td=0, tc=0
    for(const v of items){ td += Number(v.debit||0); tc += Number(v.credit||0); rows.push([{ text:String(v.code||''), alignment:'center' }, { text:String(v.name||'') }, { text:Number(v.debit||0).toFixed(2), alignment:'right' }, { text:Number(v.credit||0).toFixed(2), alignment:'right' }]) }
    content.push({ table:{ headerRows:1, widths:['auto','*','auto','auto'], body: rows }, layout:'lightHorizontalLines' })
    content.push({ text: `Totals — Debit: ${td.toFixed(2)} • Credit: ${tc.toFixed(2)}`, alignment:'right', bold:true, margin:[0,12,0,0], fontSize: 11 })
  }
    const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content, footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
    const fileName=`${reportType}-${fromDate||'all'}_${toDate||'all'}.pdf`
    const pdf = createPDF(doc)
    if (download) pdf.download(fileName); else pdf.open()
  } catch (error) {
    console.error('Error in generateReportPDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

export async function printProductsPDF({ items=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'Product', bold:true }, { text:'Category', bold:true }, { text:'Stock', bold:true }, { text:'Sale Price', bold:true }, { text:'Cost', bold:true }]]
  for(const x of items){ rows.push([{ text:String(x.name||'') }, { text:String(x.category||''), alignment:'center' }, { text:Number(x.stock_quantity||0).toFixed(2), alignment:'right' }, { text:Number(x.sale_price||0).toFixed(2), alignment:'right' }, { text:Number(x.cost_price||0).toFixed(2), alignment:'right' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Products Report', ''), { table:{ headerRows:1, widths:['*','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printEmployeesCardsPDF({ items=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'No.', bold:true }, { text:'Name', bold:true }, { text:'Dept', bold:true }, { text:'Mobile', bold:true }, { text:'Status', bold:true }]]
  for(const e of items){ rows.push([{ text:String(e.employee_number||'-'), alignment:'center' }, { text:String(e.full_name||'').slice(0,30) }, { text:String(e.department||'-').slice(0,20), alignment:'center' }, { text:String(e.mobile||e.phone||'-'), alignment:'center' }, { text:String(e.status||'active'), alignment:'center' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Employee Cards', ''), { table:{ headerRows:1, widths:['auto','*','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printSuppliersCardsPDF({ items=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'Name', bold:true }, { text:'Phone', bold:true }, { text:'City', bold:true }]]
  for(const s of items){ rows.push([{ text:String(s.name||'-') }, { text:String(s.phone||'-'), alignment:'center' }, { text:String(s.addr_city||s.city||'-'), alignment:'center' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Supplier Cards', ''), { table:{ headerRows:1, widths:['*','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printClientsCardsPDF({ items=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'Name', bold:true }, { text:'Phone', bold:true }, { text:'City', bold:true }]]
  for(const c of items){ rows.push([{ text:String(c.name||'-') }, { text:String(c.phone||'-'), alignment:'center' }, { text:String(c.addr_city||c.city||'-'), alignment:'center' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Client Cards', ''), { table:{ headerRows:1, widths:['*','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printSalesOrdersPDF({ orders=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'Order #', bold:true }, { text:'Date', bold:true }, { text:'Customer', bold:true }, { text:'Activity', bold:true }, { text:'Status', bold:true }, { text:'Amount', bold:true }]]
  for(const o of orders){ rows.push([{ text:String(o.number||o.id||'-'), alignment:'center' }, { text:String(o.date||'').slice(0,10), alignment:'center' }, { text:String(o.customer||'-') }, { text:String(o.activity||'-'), alignment:'center' }, { text:String(o.status||'-'), alignment:'center' }, { text:Number(o.amount||0).toFixed(2), alignment:'right' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Sales Orders', ''), { table:{ headerRows:1, widths:['auto','auto','*','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printExpensesInvoicesPDF({ invoices=[] }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const rows=[[{ text:'Invoice #', bold:true }, { text:'Date', bold:true }, { text:'Total', bold:true }, { text:'Payment', bold:true }, { text:'Status', bold:true }]]
  for(const r of invoices){ rows.push([{ text:String(r.invoice_number||r.id||'-'), alignment:'center' }, { text:String(r.date||'').slice(0,10), alignment:'center' }, { text:Number(r.total||0).toFixed(2), alignment:'right' }, { text:String(r.payment_method||''), alignment:'center' }, { text:String(r.status||''), alignment:'center' }]) }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10 }, content:[ ...header(company, branding, 'Expense Invoices', ''), { table:{ headerRows:1, widths:['auto','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function generatePayrollCostPDF({ data, lang='ar', fromDate=null, toDate=null, download=false }){
  try {
    const preferredFont = 'Roboto'
    const company=await apiSettings.get('settings_company').catch(()=>null)
    const branding=await apiSettings.get('settings_branding').catch(()=>null)
    let content=[]
    const titleMap={ 'ar':'الرواتب مقابل المراكز','en':'Payroll vs Cost Centers' }
    const sub=(fromDate&&toDate)?`${fromDate} → ${toDate}`:''
    content.push(...(await header(company, branding, titleMap[lang]||'Payroll vs Cost Centers', sub)))
    const headers={ 'ar':['المركز','إجمالي الرواتب','الحوافز','الاستقطاعات','الصافي'], 'en':['Cost Center','Gross Payroll','Incentives','Deductions','Net'] }
    const rows=[tableHeader(headers[lang]||headers.en)]
    let gt=0, it=0, dt=0, nt=0
    for(const row of (data?.items||[])){
      gt+=Number(row.gross_total||0)
      it+=Number(row.incentives_total||0)
      dt+=Number(row.deductions_total||0)
      nt+=Number(row.net_total||0)
      rows.push([
        { text:String(row.cost_center||''), alignment:lang==='ar'?'right':'left' },
        { text:Number(row.gross_total||0).toFixed(2), alignment:'right' },
        { text:Number(row.incentives_total||0).toFixed(2), alignment:'right' },
        { text:Number(row.deductions_total||0).toFixed(2), alignment:'right' },
        { text:Number(row.net_total||0).toFixed(2), alignment:'right' }
      ])
    }
    rows.push([
      { text:lang==='ar'?'الإجمالي الكلي':'Grand Total', bold:true },
      { text:Number(gt).toFixed(2), bold:true, alignment:'right' },
      { text:Number(it).toFixed(2), bold:true, alignment:'right' },
      { text:Number(dt).toFixed(2), bold:true, alignment:'right' },
      { text:Number(nt).toFixed(2), bold:true, alignment:'right' }
    ])
    content.push({ table:{ headerRows:1, widths:['*','auto','auto','auto','auto'], body: rows }, layout:'lightHorizontalLines', margin:[0,10,0,0] })
    const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:10, font:preferredFont }, content, footer: (currentPage, pageCount) => ({ columns:[ { text:new Date().toISOString().slice(0,10) }, { text:`Page ${currentPage}/${pageCount}`, alignment:'right' } ] }) }
    { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert(lang==='ar'?'فشل الطباعة — راجع الكونسول لمعرفة الأخطاء':'Print failed — check console for errors'); return } }
    const pdf=createPDF(doc)
    if(download){ const ymd=(fromDate||new Date().toISOString().slice(0,10)).replace(/-/g,''); pdf.download(`payroll-cost-${ymd}.pdf`) } else { pdf.open() }
  } catch(e){ console.error('PDF Generation Error:',e); alert(lang==='ar'?'فشل توليد PDF':'PDF generation failed') }
}

export async function printReceiptPDF({ customer, payment }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const cur = { code: 'SAR', symbol: 'SAR', position: 'suffix' }
  function fmt(n){ try{ const v=Number(n||0); const s=v.toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 }); return cur.position==='prefix'?`${cur.symbol} ${s}`:`${s} ${cur.symbol}` } catch{ const v=Number(n||0); const s=v.toFixed(2); return cur.position==='prefix'?`${cur.symbol} ${s}`:`${s} ${cur.symbol}` } }
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:11 }, content:[ ...header(company, branding, 'Payment Receipt', new Date().toLocaleDateString('en-GB')), { columns:[ { text: `Customer: ${customer?.name||''}` }, { text: `Date: ${new Date().toLocaleDateString('en-GB')}` } ], margin:[0,10,0,10] }, { table:{ widths:['*','auto'], body:[ [{ text:'Amount' }, { text: fmt(payment?.amount||0), alignment:'right' }], [{ text:'Method' }, { text: String(payment?.method||'-'), alignment:'right' }], ...(payment?.note?[ [{ text:'Note' }, { text: String(payment?.note||''), alignment:'right' }] ]:[]) ] }, layout:'lightHorizontalLines', margin:[0,10,0,10] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printCustomerInvoiceSkeletonPDF({ customer }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:11 }, content:[ ...header(company, branding, 'Customer Invoice', new Date().toLocaleDateString('en-GB')), { columns:[ { text: `Customer: ${customer?.name||''}` }, { text: `Date: ${new Date().toLocaleDateString('en-GB')}` } ], margin:[0,10,0,10] }, { table:{ headerRows:1, widths:['*','auto','auto','auto'], body:[ [{ text:'Item' }, { text:'Qty' }, { text:'Price' }, { text:'Total' }], ...Array.from({ length:6 }).map(()=>['', '', '', '']) ] }, layout:'lightHorizontalLines' } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}

export async function printCreditNoteSkeletonPDF({ customer }){
  const company=await apiSettings.get('settings_company').catch(()=>null)
  const branding=await apiSettings.get('settings_branding').catch(()=>null)
  const doc={ pageSize:'A4', pageMargins:[40,40,40,40], defaultStyle:{ fontSize:11 }, content:[ ...header(company, branding, 'Credit Note', new Date().toLocaleDateString('en-GB')), { columns:[ { text: `Customer: ${customer?.name||''}` }, { text: `Date: ${new Date().toLocaleDateString('en-GB')}` } ], margin:[0,10,0,10] }, { text:'Adjustment details to be added later', alignment:'center', margin:[0,10,0,10] } ], footer: (currentPage, pageCount) => ({ columns:[ { text: `Page ${currentPage} of ${pageCount}`, alignment:'left' }, { text: `Generated ${new Date().toISOString().slice(0,10)}`, alignment:'right' } ], margin:[40,0,40,0], fontSize:9 }) }
  { const errs=validatePdfDefinition(doc); if(errs.length){ console.group('🚨 PDF VALIDATION FAILED'); errs.forEach(e=>console.error(e)); console.groupEnd(); alert('فشل الطباعة — راجع الكونسول لمعرفة الأخطاء'); return } }
  createPDF(doc).open()
}