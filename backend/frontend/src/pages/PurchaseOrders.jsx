import { useEffect, useMemo, useState } from 'react'
import { FaHome, FaSearch, FaFileExcel, FaFilePdf, FaTrash } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { createPDF, ensureImageDataUrl } from '../utils/pdfUtils'
import { print } from '@/printing'
import { t } from '../utils/i18n'
import { purchaseOrders, settings as apiSettings } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function PurchaseOrders(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(80)
  const [toast, setToast] = useState('')
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [branding, setBranding] = useState(null)
  const [company, setCompany] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const { can } = useAuth()

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{
    Promise.all([
      apiSettings.get('settings_branding').catch(()=>null),
      apiSettings.get('settings_company').catch(()=>null),
      apiSettings.get('settings_footer').catch(()=>null),
    ]).then(([b,c,f])=>{ setBranding(b); setCompany(c); setFooterCfg(f) })
  },[])

  useEffect(()=>{
    async function load(){
      setLoading(true)
      try {
        const res = await purchaseOrders.list()
        const items = res.items||res||[]
        const mapped = items.map(it => ({ id: it.id, number: it.order_number||it.id, date: it.date||'', supplier: it.partner?.name || '-', status: String(it.status||'draft'), amount: Number(it.total||0) }))
        setOrders(mapped)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    load()
  },[])

  const filtered = useMemo(()=>{
    if (!search) return orders
    const q = search.toLowerCase()
    return orders.filter(o => (`${o.number} ${o.supplier} ${o.status}`).toLowerCase().includes(q))
  },[orders, search])

  const paged = useMemo(()=>{
    const start = (page-1)*pageSize
    return filtered.slice(start, start+pageSize)
  },[filtered, page, pageSize])

  async function handleAddPO(){
    try {
      const canPOWrite = can('purchase_orders:write')
      if (!canPOWrite) { setToast(lang==='ar'?'هذه العملية تتطلب صلاحيات':'Permission required'); return }
      const created = await purchaseOrders.create({ status: 'draft' })
      setToast(lang==='ar'?'تم إنشاء طلب الشراء':'Purchase order created')
      if (created?.id) { navigate(`/products/purchase-orders/${created.id}`); return }
      const res = await purchaseOrders.list()
      const items = res.items||res||[]
      const mapped = items.map(it => ({ id: it.id, number: it.order_number||it.id, date: it.date||'', supplier: it.partner?.name || '-', status: String(it.status||'draft'), amount: Number(it.total||0) }))
      setOrders(mapped)
      const last = items[items.length-1]
      if (last?.id) navigate(`/products/purchase-orders/${last.id}`)
    } catch {
      setToast(lang==='ar'?'فشل إنشاء طلب الشراء':'Failed to create purchase order')
    }
  }

  function exportExcel(){
    const canExport = can('reports:export')
    if (!canExport) return
    setExportingExcel(true)
    try {
      const header = ['Order No.','Date','Supplier','Status','Amount']
      const lines = filtered.map(o => [o.number, o.date, o.supplier, o.status, Number(o.amount||0)])
      const ws = XLSX.utils.aoa_to_sheet([header, ...lines])
      ws['!cols'] = [ { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 14 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let r = 1; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 4 })]
        if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' }
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders')
      XLSX.writeFile(wb, 'purchase_orders.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  

  async function exportPDF(){ const canPrint = can('reports:print'); if (!canPrint) return; setExportingPDF(true); try { const url = `/print/purchase-orders.html${search?`?q=${encodeURIComponent(search)}`:''}`; window.open(url, '_blank'); } finally { setExportingPDF(false) } }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'طلبات الشراء':'Purchase Orders'}</h2>
            <div className="flex items-center gap-2 bg-white border rounded px-2">
              <FaSearch className="text-gray-500" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث...':'Search...'} className="px-2 py-1 outline-none" />
            </div>
            <span className="text-sm text-gray-600">{(page-1)*pageSize+1}-{Math.min(page*pageSize, filtered.length)} / {filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/products')}> 
              <FaHome /> {lang==='ar'?'المنتجات':'Products'}
            </button>
            {(()=>{ const canPOWrite = can('purchase_orders:write'); return (
            <button className={`px-3 py-2 ${canPOWrite?'bg-primary-600 hover:bg-primary-700 text-white':'bg-gray-300 text-gray-200 cursor-not-allowed'} rounded-md`} onClick={()=>{ if (!canPOWrite) return; handleAddPO() }} disabled={!canPOWrite}>{lang==='ar'?'إضافة طلب شراء':'Add Purchase Order'}</button>) })()}
            {(()=>{ const canExport = can('reports:export'); return (
            <button className={`px-3 py-2 ${canExport?'bg-gray-100 hover:bg-gray-200':'bg-gray-200 cursor-not-allowed'} rounded-md flex items-center gap-2 disabled:opacity-50`} onClick={()=>{ if (!canExport || exportingExcel) return; exportExcel() }} disabled={!canExport || exportingExcel}><FaFileExcel/> {exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : 'Excel'}</button>) })()}
            {(()=>{ const canPrint = can('reports:print'); return (
            <button className={`px-3 py-2 ${canPrint?'bg-gray-100 hover:bg-gray-200':'bg-gray-200 cursor-not-allowed'} rounded-md flex items-center gap-2 disabled:opacity-50`} onClick={()=>{ if (!canPrint || exportingPDF) return; exportPDF() }} disabled={!canPrint || exportingPDF}><FaFilePdf/> {exportingPDF ? (lang==='ar'?'جارٍ الفتح...':'Opening...') : (lang==='ar'?'طباعة':'Print')}</button>) })()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">{lang==='ar'?'رقم الطلب':'Order No.'}</th>
                <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                <th className="p-2">{lang==='ar'?'المورد':'Supplier'}</th>
                <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                <th className="p-2">{lang==='ar'?'المبلغ':'Amount (SR)'}</th>
                <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o, idx) => (
                <tr key={`${o.id||o.number}-${idx}`} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>navigate(`/products/purchase-orders/${o.id||o.number}`)}>
                  <td className="p-2 font-medium">{o.number}</td>
                  <td className="p-2 text-gray-600">{o.date}</td>
                  <td className="p-2">{o.supplier}</td>
                  <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${o.status==='draft'?'bg-blue-50 text-blue-700':'bg-purple-50 text-purple-700'}`}>{o.status}</span></td>
                  <td className="p-2">{formatEn(o.amount)}</td>
                  <td className="p-2">
                    {(()=>{ const canPODelete = can('purchase_orders:delete'); return (
                    <button className={`px-2 py-1 ${canPODelete?'bg-red-100 text-red-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded flex items-center gap-1`} onClick={async(e)=>{ e.stopPropagation(); if (!canPODelete) return; if (!window.confirm(lang==='ar'?'حذف طلب الشراء؟':'Delete PO?')) return; try { await purchaseOrders.remove(o.id); const res = await purchaseOrders.list(); const items = res.items||res||[]; const mapped = items.map(it => ({ id: it.id, number: it.order_number||it.id, date: it.date||'', supplier: it.partner?.name || '-', status: String(it.status||'draft'), amount: Number(it.total||0) })); setOrders(mapped) } catch {} }} disabled={!canPODelete}><FaTrash/> {lang==='ar'?'حذف':'Delete'}</button>) })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 border-t bg-gray-50">
            <div className="text-sm">صفحة {page} من {Math.max(1, Math.ceil(filtered.length/pageSize))}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border rounded" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>{lang==='ar'?'السابق':'Prev'}</button>
              <button className="px-3 py-1 bg-white border rounded" disabled={page>=Math.ceil(filtered.length/pageSize)} onClick={()=>setPage(p=>Math.min(Math.ceil(filtered.length/pageSize),p+1))}>{lang==='ar'?'التالي':'Next'}</button>
              <select className="border rounded px-2 py-1" value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }}>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={80}>80</option>
              </select>
            </div>
          </div>
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-lg px-4 py-2 rounded-lg" onAnimationEnd={() => setToast('')}>{toast}</div>
      )}
    </div>
  )
}

function formatEn(n){
  try { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n||0)) } catch { return String(n||0) }
}
