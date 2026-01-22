import { printThermal } from './thermal/thermalEngine'
import { printPdf } from './pdf/pdfEngine'
let _request = null

export async function print({ type, template, data, autoPrint }){
  const t = String(type||'').toLowerCase()
  if (t === 'thermal') {
    try {
      if (!_request) {
        try { _request = (await import('../services/api/client')).request } catch {}
      }
      const payload = { template: String(template||'posInvoice'), data }
      const res = _request ? await _request('/print/thermal', { method: 'POST', body: JSON.stringify(payload) }) : null
      if (res && res.ok) return true
    } catch (_) {
      // Fallback to browser thermal HTML print
    }
    const result = await printThermal(String(template||'posInvoice'), data||{}, (typeof autoPrint==='boolean')?autoPrint:undefined)
    // If data.returnHtml is true, return the HTML string
    if (data && data.returnHtml && typeof result === 'string') {
      return result
    }
    return result
  }
  if (t === 'pdf') return printPdf(String(template||'generic'), data||{}, !!autoPrint)
  return Promise.resolve(false)
}