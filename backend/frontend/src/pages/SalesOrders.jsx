import { useEffect, useMemo, useState } from 'react'
import { FaHome, FaSearch, FaFileExcel, FaFilePdf, FaTrash } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { t } from '../utils/i18n'
import * as XLSX from 'xlsx'
import { settings as apiSettings, orders as apiOrders } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function SalesOrders(){
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(80)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  
  const [branding, setBranding] = useState(null)
  const [company, setCompany] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)

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
        const items = await apiOrders.list()
        const mapped = (Array.isArray(items) ? items : []).map(it => {
          // Calculate amount from lines if available
          let amount = Number(it.total_amount || it.total || 0);
          if (amount === 0 && it.lines) {
            try {
              const lines = Array.isArray(it.lines) ? it.lines : (typeof it.lines === 'string' ? JSON.parse(it.lines) : []);
              const itemLines = lines.filter(l => l && l.type === 'item');
              amount = itemLines.reduce((sum, l) => sum + (Number(l.qty || l.quantity || 0) * Number(l.price || 0)), 0);
            } catch {}
          }
          return {
            id: it.id, 
            number: it.order_number, 
            date: new Date(it.date||Date.now()).toISOString().replace('T',' ').substring(0,19), 
            customer: it.customer?.name || it.partner?.name || '-', 
            status: String(it.status||'DRAFT'), 
            activity: it.branch === 'china_town' ? 'China Town' : 'Place India', 
            amount: amount
          };
        });
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
    return orders.filter(o => (`${o.number} ${o.customer} ${o.activity}`).toLowerCase().includes(q))
  },[orders, search])

  const paged = useMemo(()=>{
    const start = (page-1)*pageSize
    return filtered.slice(start, start+pageSize)
  },[filtered, page, pageSize])

  async function handleAddOrder(){
    const canWrite = can('sales_orders:write')
    if (!canWrite) return
    const newOrder = await apiOrders.create({ status: 'DRAFT' })
    if (newOrder?.id) navigate(`/orders/${newOrder.id}`)
  }

  function exportExcel(){
    setExportingExcel(true)
    try {
      const header = ['Order No.','Date/Time','Customer','Status','Activity','Amount']
      const lines = filtered.map(o => [o.number, o.date, o.customer, o.status, o.activity, Number(o.amount||0)])
      const ws = XLSX.utils.aoa_to_sheet([header, ...lines])
      ws['!cols'] = [
        { wch: 12 }, { wch: 19 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }
      ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let r = 1; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })]
        if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' }
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Orders')
      XLSX.writeFile(wb, 'sales_orders.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  async function exportPDF(){ const canPrint = can('reports:print'); if (!canPrint) return; setExportingPDF(true); try { const url = `/print/sales-orders.html${search?`?q=${encodeURIComponent(search)}`:''}`; window.open(url, '_blank'); } finally { setExportingPDF(false) } }

  async function handleDelete(id){
    const canDelete = can('sales_orders:delete')
    if (!canDelete) return
    if (!window.confirm(lang==='ar'?'حذف طلب البيع؟':'Delete sales order?')) return
    try {
      await apiOrders.remove(id)
      const items = await apiOrders.list()
      const mapped = (Array.isArray(items) ? items : []).map(it => {
        let amount = Number(it.total_amount || it.total || 0);
        if (amount === 0 && it.lines) {
          try {
            const lines = Array.isArray(it.lines) ? it.lines : (typeof it.lines === 'string' ? JSON.parse(it.lines) : []);
            const itemLines = lines.filter(l => l && l.type === 'item');
            amount = itemLines.reduce((sum, l) => sum + (Number(l.qty || l.quantity || 0) * Number(l.price || 0)), 0);
          } catch {}
        }
        return {
          id: it.id, 
          number: it.order_number, 
          date: new Date(it.date||Date.now()).toISOString().replace('T',' ').substring(0,19), 
          customer: it.customer?.name || it.partner?.name || '-', 
          status: String(it.status||'DRAFT'), 
          activity: it.branch === 'china_town' ? 'China Town' : 'Place India', 
          amount: amount
        };
      });
      setOrders(mapped)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'طلبات البيع':'Sales Orders'}</h2>
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
            {(()=>{ const canWrite = can('sales_orders:write'); return (
            <button className={`px-3 py-2 ${canWrite?'bg-primary-600 hover:bg-primary-700 text-white':'bg-gray-300 text-gray-200 cursor-not-allowed'} rounded-md`} onClick={()=>{ if (!canWrite) return; handleAddOrder() }} disabled={!canWrite}>{lang==='ar'?'إضافة طلب جديد':'Add New Order'}</button>) })()}
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
                <th className="p-2">{lang==='ar'?'التاريخ':'Date/Time'}</th>
                <th className="p-2">{lang==='ar'?'العميل':'Customer'}</th>
                <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                <th className="p-2">{lang==='ar'?'النشاط':'Activity'}</th>
                <th className="p-2">{lang==='ar'?'المبلغ':'Amount (SR)'}</th>
                <th className="p-2">{lang==='ar'?'إجراءات':'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o, idx) => (
                <tr key={`${o.id||o.number}-${idx}`} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>navigate(`/orders/${o.id||idx+1}`)}>
                  <td className="p-2 font-medium">{o.number}</td>
                <td className="p-2 text-gray-600">{o.date}</td>
                <td className="p-2">{o.customer}</td>
                <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${String(o.status).toLowerCase()==='draft'?'bg-yellow-50 text-yellow-700':String(o.status).toLowerCase()==='in_progress'?'bg-blue-50 text-blue-700':String(o.status).toLowerCase()==='ready'?'bg-purple-50 text-purple-700':String(o.status).toLowerCase()==='invoiced'?'bg-green-50 text-green-700':'bg-gray-100 text-gray-700'}`}>{statusLabel(o.status, lang)}</span></td>
                <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${o.activity==='Accounts'?'bg-blue-50 text-blue-700':'bg-purple-50 text-purple-700'}`}>{o.activity}</span></td>
                <td className="p-2">{formatEn(o.amount)}</td>
                <td className="p-2">
                  <button className="px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1" onClick={(e)=>{ e.stopPropagation(); handleDelete(o.id) }}><FaTrash/> {lang==='ar'?'حذف':'Delete'}</button>
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
    </div>
  )
}

function formatEn(n){
  try { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n||0)) } catch { return String(n||0) }
}

 
function statusLabel(v, lang){
  const s = String(v||'DRAFT').toLowerCase()
  if (lang==='ar'){
    if (s==='draft') return 'مسودة'
    if (s==='in_progress') return 'قيد التنفيذ'
    if (s==='ready') return 'جاهز'
    if (s==='invoiced') return 'مفوتر'
    if (s==='cancelled') return 'ملغي'
    return s
  } else {
    if (s==='draft') return 'Draft'
    if (s==='in_progress') return 'In Progress'
    if (s==='ready') return 'Ready'
    if (s==='invoiced') return 'Invoiced'
    if (s==='cancelled') return 'Cancelled'
    return s
  }
}
