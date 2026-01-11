import { renderThermalReceipt } from './renderThermalReceipt'

function defaultAutoPrint(template){
  const t = String(template||'').toLowerCase()
  if (t==='posinvoice' || t==='receipt' || t==='poskitchen') return true
  if (t==='incomesummary' || t==='trialbalancesummary' || t==='ledgersummary') return false
  return false
}

export async function printThermal(template, data, autoPrint){
  const html = await renderThermalReceipt(template, data||{})
  const w = window.open('', '_blank', 'fullscreen=yes,resizable=yes,scrollbars=yes')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  function onReady(){
    try { w.focus() } catch {}
    try {
      try { if (w.document.fullscreenEnabled) { w.document.documentElement.requestFullscreen().catch(()=>{}) } } catch {}
      try {
        const scr = (w && w.screen) ? w.screen : (window && window.screen ? window.screen : null)
        const aw = scr ? (scr.availWidth || scr.width || 1024) : 1024
        const ah = scr ? (scr.availHeight || scr.height || 768) : 768
        w.moveTo(0,0)
        w.resizeTo(aw, ah)
      } catch {}
      const style = w.document.createElement('style')
      style.type = 'text/css'
      const paperMm = Number((data&&data.paperWidthMm)||80)
      style.textContent = `@media print{ @page{ size:${paperMm}mm auto; margin:2mm } body{ width:${paperMm}mm !important } } .hdr{ justify-content:center !important; } .title{ text-align:center !important }`
      try { w.document.head.appendChild(style) } catch {}
      const hdr = w.document.querySelector('.hdr')
      if (hdr) { hdr.style.justifyContent = 'center'; hdr.style.textAlign = 'center' }
      const title = w.document.querySelector('.title')
      if (title) { title.style.textAlign = 'center' }
      const rows = w.document.querySelectorAll('.row')
      rows.forEach(r => { r.style.justifyContent = 'center'; r.style.textAlign = 'center'; r.style.gap = '8px' })
    } catch {}
    const shouldPrint = (typeof autoPrint==='boolean') ? autoPrint : defaultAutoPrint(template)
    if (shouldPrint) {
      try { w.print() } catch {}
      // لا تغلق النافذة تلقائيًا؛ الإغلاق يجب أن يتم من المستخدم
    }
  }
  try {
    if (w.document && typeof w.document.readyState === 'string' && w.document.readyState === 'complete') {
      onReady()
    } else if (typeof w.addEventListener === 'function') {
      w.addEventListener('load', onReady)
    } else {
      onReady()
    }
  } catch (_) { onReady() }
  return true
}