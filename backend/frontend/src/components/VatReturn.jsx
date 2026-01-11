import React, { useEffect, useMemo, useRef, useState } from 'react'
import { accounts as apiAccounts, journal as apiJournal, settings as apiSettings } from '../services/api'
 

export default function VatReturn() {
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  const pdfRef = useRef(null)
  const [taxpayerName, setTaxpayerName] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [submissionDate, setSubmissionDate] = useState('')
  const [stdRate] = useState(0.15)
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [expensesTotal, setExpensesTotal] = useState(0)

  const ZATCA_PRIMARY = '#006B4B'
  const ZATCA_ACCENT = '#0EA5A1'

  const outputVat = useMemo(() => {
    const base = Math.max(0, parseFloat(revenueTotal || 0))
    const rate = parseFloat(String(stdRate))
    return isFinite(base * rate) ? base * rate : 0
  }, [revenueTotal, stdRate])

  const inputVat = useMemo(() => {
    const base = Math.max(0, parseFloat(expensesTotal || 0))
    const rate = parseFloat(String(stdRate))
    return isFinite(base * rate) ? base * rate : 0
  }, [expensesTotal, stdRate])

  const netVat = useMemo(() => {
    const out = parseFloat(outputVat || 0)
    const inp = parseFloat(inputVat || 0)
    return out - inp
  }, [outputVat, inputVat])

  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const qm = Math.floor(m / 3) * 3
    const start = new Date(y, qm, 1)
    const end = new Date(y, qm + 3, 0)
    const isoStart = start.toISOString().slice(0, 10)
    const isoEnd = end.toISOString().slice(0, 10)
    setFrom(isoStart)
    setTo(isoEnd)
    setSubmissionDate(now.toISOString().slice(0, 10))
  }, [])

  const handlePrint = () => {
    try { window.print() } catch {}
  }

  useEffect(() => {
    async function loadData() {
      if (!from || !to) return
      try {
        const [acc, periodData] = await Promise.all([
          apiAccounts.tree(),
          apiJournal.list({ from, to, status: 'posted', pageSize: 1000 })
        ])
        const flat = []
        const walk = (nodes) => { for (const n of (nodes||[])) { flat.push(n); walk(n.children) } }
        walk(acc)
        const byId = new Map(flat.map(a => [a.id, a]))
        const m = {}
        for (const it of (periodData.items||[])) {
          for (const p of (it.postings||[])) {
            const id = p.account_id
            if (!m[id]) m[id] = { debit: 0, credit: 0 }
            m[id].debit += parseFloat(p.debit||0)
            m[id].credit += parseFloat(p.credit||0)
          }
        }
        const nameText = (a)=>`${a?.name||''} ${a?.name_en||''}`.toLowerCase()
        const isOutVatName = (txt)=> /(vat|ضريبة).*(output|المخرجات|payable|المستحقة)/i.test(txt)
        const isInVatName = (txt)=> /(vat|ضريبة).*(input|المدخلات|recoverable|القابلة للاسترداد)/i.test(txt)
        const outCandidates = flat.filter(a => String(a.account_code)==='2110' || isOutVatName(nameText(a)))
        const inCandidates = flat.filter(a => String(a.account_code)==='2120' || isInVatName(nameText(a)))
        const sumOut = outCandidates.reduce((s,a)=>{ const pm=m[a.id]||{debit:0,credit:0}; return s + Math.max(0, Number(pm.credit||0) - Number(pm.debit||0)) }, 0)
        const sumIn = inCandidates.reduce((s,a)=>{ const pm=m[a.id]||{debit:0,credit:0}; return s + Math.max(0, Number(pm.debit||0) - Number(pm.credit||0)) }, 0)
        const outputVatAmt = Math.max(0, sumOut)
        const inputVatAmt = Math.max(0, sumIn)

        let salesNet = 0
        let discounts = 0
        byId.forEach((a, id) => {
          const pm = m[id] || { debit: 0, credit: 0 }
          const txt = nameText(a)
          if (String(a.type)==='revenue') {
            const isDiscount = /(discount|خصم)/i.test(txt)
            if (isDiscount) {
              const val = (pm.debit - pm.credit)
              if (val > 0) discounts += val
            } else {
              const val = (pm.credit - pm.debit)
              if (val > 0) salesNet += val
            }
          }
        })
        salesNet = Math.max(0, salesNet - discounts)

        const revenueBase = outputVatAmt>0 ? (outputVatAmt / stdRate) : salesNet
        const purchasesBase = inputVatAmt>0 ? (inputVatAmt / stdRate) : 0
        setRevenueTotal(Math.max(0, revenueBase))
        setExpensesTotal(Math.max(0, purchasesBase))
        try {
          const company = await apiSettings.get('settings_company')
          const name = (company?.name_ar || company?.name_en || '').trim()
          const vat = (company?.vat_number || '').trim()
          setTaxpayerName(name || '—')
          setVatNumber(vat || '—')
        } catch {
          setTaxpayerName('—')
          setVatNumber('—')
        }
      } catch {
        setRevenueTotal(0)
        setExpensesTotal(0)
      }
    }
    loadData()
  }, [from, to, stdRate])


  return (
    <div className="space-y-4" dir={lang==='ar'?'rtl':'ltr'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/zatca.svg"
            alt="ZATCA"
            className="w-28 h-16 object-contain"
            onError={e => {
              e.currentTarget.onerror = null
              e.currentTarget.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 400 120"><rect width="400" height="120" fill="${ZATCA_PRIMARY}" rx="8"/><text x="50%" y="55%" font-size="28" font-family="Tahoma, Arial" fill="#fff" text-anchor="middle">ZATCA</text></svg>`
              )
            }}
          />
          <div>
            <h2 className="text-2xl font-bold" style={{ color: ZATCA_ACCENT }}>{lang==='ar'?'إقرار ضريبة القيمة المضافة':'VAT Return'}</h2>
            <div className="text-sm text-gray-600">{lang==='ar'?'نموذج متوافق قابل للطباعة و التصدير':'Exportable & printable compliant form'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded shadow hover:bg-gray-100 transition">{lang==='ar'?'طباعة':'Print'}</button>
        </div>
      </div>

      <div ref={pdfRef} id="vat-print" className="bg-white rounded-lg shadow p-6 print:p-0 print:shadow-none">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{lang==='ar'?'اسم المُكلَّف / اسم المنشأة':'Taxpayer Name'}</label>
            <input className="w-full border rounded p-2" value={taxpayerName} readOnly />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{lang==='ar'?'رقم التسجيل الضريبي':'VAT Number'}</label>
            <input className="w-full border rounded p-2" value={vatNumber} readOnly />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{lang==='ar'?'الفترة الضريبية (من)':'Tax Period (From)'}</label>
            <input type="date" className="w-full border rounded p-2" value={from} readOnly />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{lang==='ar'?'الفترة الضريبية (إلى)':'Tax Period (To)'}</label>
            <input type="date" className="w-full border rounded p-2" value={to} readOnly />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{lang==='ar'?'تاريخ التقديم':'Submission Date'}</label>
            <input type="date" className="w-full border rounded p-2" value={submissionDate} readOnly />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: ZATCA_ACCENT }}>{lang==='ar'?'إجمالي المبيعات الخاضعة للضريبة':'Total Taxable Sales'}</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="p-3 border w-2/3">{lang==='ar'?'توريدات خاضعة للنسبة الأساسية (15%)':'Standard Rated Sales (15%)'}</td>
                <td className="p-3 border">{Number(revenueTotal||0).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-3 border">{lang==='ar'?'ضريبة المخرجات للنسبة الأساسية':'Standard Rated Output VAT'}</td>
                <td className="p-3 border">{Number(outputVat).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: ZATCA_ACCENT }}>{lang==='ar'?'إجمالي المشتريات الخاضعة للضريبة':'Total Taxable Purchases'}</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="p-3 border w-2/3">{lang==='ar'?'ضريبة المدخلات القابلة للخصم':'Deductible Input VAT'}</td>
                <td className="p-3 border">{Number(inputVat).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: ZATCA_ACCENT }}>{lang==='ar'?'صافي الضريبة المستحقة':'Net VAT Due'}</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="p-3 border w-2/3">{lang==='ar'?'ضريبة المخرجات':'Output VAT'}</td>
                <td className="p-3 border">{Number(outputVat).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-3 border">{lang==='ar'?'ضريبة المدخلات':'Input VAT'}</td>
                <td className="p-3 border">{Number(inputVat||0).toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="p-3 border">{lang==='ar'?'صافي الضريبة المستحقة / قابلة للاسترداد':'Net VAT Due / Refundable'}</td>
                <td className="p-3 border">{Number(netVat).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold mb-2" style={{ color: ZATCA_ACCENT }}>{lang==='ar'?'التصديق':'Certification'}</h3>
          <div className="border rounded p-4">
            <p className="mb-4">{lang==='ar'?'أقرّ بأن المعلومات الواردة أعلاه صحيحة ودقيقة وفقاً لما ظهر في سجلاتي. أتعهد بدفع الضريبة المستحقة في موعدها.':'I certify that the information provided above is true and accurate according to my records. I pledge to pay the due tax on time.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">{lang==='ar'?'اسم المصرح':'Name'}</label>
                <input className="w-full border rounded p-2" value={taxpayerName} readOnly />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{lang==='ar'?'تاريخ':'Date'}</label>
                <input type="date" className="w-full border rounded p-2" value={submissionDate} readOnly />
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden; }
          #vat-print, #vat-print * { visibility: visible; }
          #vat-print { position: absolute; left: 0; top: 0; width: 180mm; max-height: calc(297mm - 20mm); overflow: hidden; }
          #vat-print { font-size: 12px; line-height: 1.25; }
          #vat-print h2 { font-size: 18px; }
          #vat-print h3 { font-size: 14px; }
          #vat-print .p-6 { padding: 8mm !important; }
          #vat-print .p-3 { padding: 6px !important; }
          #vat-print .gap-4 { gap: 8px !important; }
          #vat-print .mb-6 { margin-bottom: 10px !important; }
          #vat-print .mt-6 { margin-top: 10px !important; }
          #vat-print .mt-8 { margin-top: 12px !important; }
          #vat-print table { width: 100%; border-collapse: collapse; }
          #vat-print td, #vat-print th { padding: 6px; }
          #vat-print section { page-break-inside: avoid; }
          .print\\:p-0 { padding: 0 !important; }
        }
        input[readOnly] { background: transparent; }
      `}</style>
    </div>
  )
}
