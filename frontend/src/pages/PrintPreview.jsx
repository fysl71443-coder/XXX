import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { settings as apiSettings } from '../services/api'
import { print } from '@/printing'

export default function PrintPreview(){
  const { isLoggedIn } = useAuth()
  const [company, setCompany] = useState(null)
  const [branch, setBranch] = useState('china_town')
  const [branchSettings, setBranchSettings] = useState({ logo_base64: '', receipt_font_base64: '', phone: '', print_logo: true, logo_width_mm: 0, logo_height_mm: 0 })
  useEffect(()=>{ (async()=>{ try{ if (!isLoggedIn) return; const c = await apiSettings.get('settings_company'); setCompany(c||null) } catch{} })() },[isLoggedIn])
  useEffect(()=>{ (async()=>{ try{ if (!isLoggedIn) { try { const k = String(branch||'')==='palace_india' ? 'settings_branch_place_india' : `settings_branch_${branch}`; const raw = localStorage.getItem(k); if (raw){ const b = JSON.parse(raw); setBranchSettings({ logo_base64: String(b?.logo_base64||b?.logo||''), receipt_font_base64: String(b?.receipt_font_base64||''), phone: String(b?.phone||''), print_logo: b?.print_logo!==false, logo_width_mm: Number(b?.logo_width_mm||0), logo_height_mm: Number(b?.logo_height_mm||0) }) } } catch {} return } const key = String(branch||'')==='palace_india' ? 'settings_branch_place_india' : `settings_branch_${branch}`; const b = await apiSettings.get(key); setBranchSettings({ logo_base64: String(b?.logo_base64||b?.logo||''), receipt_font_base64: String(b?.receipt_font_base64||''), phone: String(b?.phone||''), print_logo: b?.print_logo!==false, logo_width_mm: Number(b?.logo_width_mm||0), logo_height_mm: Number(b?.logo_height_mm||0) }) } catch{} })() },[branch, isLoggedIn])
  function preview(){
    const companyNameAr = (company?.name_ar||'مطعم التجربة')
    const companyNameEn = (company?.name_en||'Demo Restaurant')
    const vatNumber = company?.vat_number?String(company.vat_number):''
    const phone = branchSettings.phone || company?.phone || ''
    const address = (company?.address_ar || company?.address_en || '')
    const now = new Date()
    const date = now.toISOString().slice(0,10)
    const time = now.toTimeString().slice(0,5)
    print({ type:'thermal', template:'posInvoice', data: {
      logoBase64: branchSettings.logo_base64||'',
      printLogo: (branchSettings?.print_logo !== false),
      logoWidthMm: Number(branchSettings?.logo_width_mm||0),
      logoHeightMm: Number(branchSettings?.logo_height_mm||0),
      currencyIcon: 'data:image/png;base64,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',
      companyEn: companyNameEn,
      companyAr: companyNameAr,
      vatNumber,
      phone,
      address,
      branchName: String(branch).replace(/_/g,' '),
      invoiceNo: 'PREVIEW-0001',
      date,
      time,
      customerName: 'عميل نقدي',
      customerPhone: '',
      tableNumber: 4,
      items: [
        { name: 'شوربة اليوم', qty: 1, price: 35.24 },
        { name: 'pepsi - مشروب غازي', qty: 2, price: 3.50 },
      ],
      subtotal: 42.24,
      vatPct: 15,
      vatAmount: 6.34,
      total: 48.58,
      paymentMethod: 'BANK',
      qrCodeBase64: '',
      fontBase64: branchSettings.receipt_font_base64||'',
    }, autoPrint: true })
  }
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <main className="max-w-xl mx-auto px-6 py-10 space-y-4">
        <h3 className="text-2xl font-bold">معاينة الإيصال الحراري</h3>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">الفرع</label>
          <select className="border rounded p-2 w-full" value={branch} onChange={e=> setBranch(e.target.value)}>
            <option value="china_town">China Town</option>
            <option value="place_india">Place India</option>
          </select>
        </div>
        <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded" onClick={preview}>طباعة معاينة</button>
        <div className="text-sm text-gray-600">تأكد من ضبط خط عربي بصيغة Base64 في إعدادات الفرع.</div>
      </main>
    </div>
  )
}