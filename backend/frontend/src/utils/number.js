function normalizeDigitsAndSeparators(str){
  const map = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
    '٫':'.','٬':'',',':'','،':''
  }
  return Array.from(String(str||'')).map(c => (map[c]!==undefined ? map[c] : c)).join('')
}

export function sanitizeDecimal(str){
  const s = normalizeDigitsAndSeparators(str)
  let t = s.replace(/[^0-9.]/g,'')
  const dotIdx = t.indexOf('.')
  if (dotIdx !== -1) {
    t = t.slice(0, dotIdx+1) + t.slice(dotIdx+1).replace(/\./g,'')
  }
  const parts = t.split('.')
  const head = parts[0] || ''
  const tail = parts[1] ? parts[1].slice(0,2) : ''
  if (dotIdx !== -1) return `${head || '0'}.${tail}`
  return head
}

export function format2(v){
  try { return new Intl.NumberFormat('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(v||0)) }
  catch { const n = Number(v||0); return n.toFixed(2) }
}