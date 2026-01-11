
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
  if (parts.length > 1) {
    const tail = parts[1].slice(0,4)
    return `${head}.${tail}`
  }
  return head
}

// Test cases
const cases = [
  { input: "150", expected: "150" },
  { input: "150.", expected: "150." },
  { input: "150.2", expected: "150.2" },
  { input: "150.23", expected: "150.23" },
  { input: "150.2345", expected: "150.2345" },
  { input: "150.23456", expected: "150.2345" }, // limit 4 decimals
  { input: ".5", expected: ".5" },
  { input: "abc", expected: "" },
  { input: "12a.3", expected: "12.3" },
  { input: "١٥٠.٢", expected: "150.2" }, // Arabic digits
  { input: "150..", expected: "150." }, // Multiple dots (consecutive) -> split gives ["150", "", ""] -> parts[1] is "" -> "150."
  { input: "150.2.3", expected: "150.2" }, // Multiple dots -> split gives ["150", "2", "3"] -> parts[1] is "2" -> "150.2"
]

let passed = true
cases.forEach(({input, expected}) => {
  const result = sanitizeDecimal(input)
  if (result !== expected) {
    console.error(`FAILED: Input "${input}" => Expected "${expected}", got "${result}"`)
    passed = false
  } else {
    console.log(`PASSED: "${input}" => "${result}"`)
  }
})

if (passed) console.log("All tests passed.")
else process.exit(1)
