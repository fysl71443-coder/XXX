import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { partners, settings as apiSettings, periods } from '../services/api'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { FaHome, FaSearch, FaPlus, FaEye, FaTrash, FaPrint, FaFileExcel, FaPhone, FaEnvelope, FaMapMarkerAlt, FaBuilding, FaUser, FaFilter } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { printSuppliersCardsPDF } from '../printing/pdf/autoReports'
import { t } from '../utils/i18n'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'

export default function SuppliersCards(){
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, individual, company
  const [helpOpen, setHelpOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('open')

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await partners.list({ type: 'supplier' }); const arr = Array.isArray(res) ? res : (res?.items||[]); setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' })) } finally { setLoading(false) } })() },[])
  useEffect(()=>{ (async()=>{ try { const d = new Date(); const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const s = await periods.get(per); setPeriodStatus(String(s?.status||'open')) } catch {} })() },[])

  const filtered = useMemo(()=>{
    let list = items
    // Filter by type
    if (filter === 'individual') {
      list = list.filter(x => String(x.supplier_type||'').toLowerCase() === 'individual')
    } else if (filter === 'company') {
      list = list.filter(x => String(x.supplier_type||'').toLowerCase() !== 'individual')
    }
    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(x => (`${x.name||''} ${x.email||''} ${x.phone||''} ${x.tax_id||''}`).toLowerCase().includes(q))
    }
    return list
  }, [items, search, filter])

  // Statistics
  const stats = useMemo(() => {
    const total = items.length
    const individualCount = items.filter(x => String(x.supplier_type||'').toLowerCase() === 'individual').length
    const companyCount = items.filter(x => String(x.supplier_type||'').toLowerCase() !== 'individual').length
    const activeCount = items.filter(x => String(x.status||'active') === 'active').length
    return { total, individualCount, companyCount, activeCount }
  }, [items])

  function exportExcel() {
    const header = [lang==='ar'?'الاسم':'Name', lang==='ar'?'النوع':'Type', lang==='ar'?'البريد':'Email', lang==='ar'?'الهاتف':'Phone', lang==='ar'?'الرقم الضريبي':'VAT', lang==='ar'?'العنوان':'Address', lang==='ar'?'الحالة':'Status']
    const data = filtered.map(x => [
      x.name || '',
      String(x.supplier_type||'').toLowerCase() === 'individual' ? (lang==='ar'?'فرد':'Individual') : (lang==='ar'?'شركة':'Company'),
      x.email || '',
      x.phone || '',
      x.tax_id || '',
      x.addr_description || `${x.addr_city||x.city||''} ${x.addr_country||x.country||''}`,
      String(x.status||'active') === 'active' ? (lang==='ar'?'نشط':'Active') : (lang==='ar'?'غير نشط':'Inactive')
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'الموردون':'Suppliers')
    XLSX.writeFile(wb, 'suppliers_cards.xlsx')
  }

  

  async function exportPDF(){ await printSuppliersCardsPDF({ items: filtered, lang }) }
  async function reload(){
    setLoading(true)
    try {
      const res = await partners.list({ type: 'supplier' })
      const arr = Array.isArray(res) ? res : (res?.items||[])
      setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' }))
    } finally { setLoading(false) }
  }

  async function remove(id){
    if (!window.confirm(lang==='ar'?'حذف المورد؟':'Delete supplier?')) return
    try {
      await partners.remove(id)
      const res = await partners.list({ type: 'supplier' })
      const arr = Array.isArray(res) ? res : (res?.items||[])
      setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='supplier' || x.type==='مورد' }))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'بطاقات الموردين':'Suppliers Cards'}</h2>
            <span className="text-sm text-gray-500">({filtered.length})</span>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={exportExcel}> 
              <FaFileExcel /> {lang==='ar'?'Excel':'Excel'}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={exportPDF}> 
              <FaPrint /> {lang==='ar'?'طباعة':'Print'}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/suppliers')}> 
              <FaHome /> {lang==='ar'?'الموردين':'Suppliers'}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={reload}>{t('labels.reload', lang)}</button>
            <div className="flex items-center gap-2 bg-white border rounded px-2">
              <FaSearch className="text-gray-500" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث بالاسم أو الهاتف أو الضريبي':'Search by name, phone or VAT'} className="px-2 py-1 outline-none w-48" />
            </div>
            {can('suppliers:write') && (
              <button className="px-3 py-2 bg-primary-600 text-white rounded-md flex items-center gap-2" onClick={()=>navigate('/suppliers/create')}>
                <FaPlus /> {lang==='ar'?'إضافة مورد':'Add Supplier'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer ${filter==='all'?'ring-2 ring-primary-500':''}`}
            onClick={() => setFilter('all')}
          >
            <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي الموردين':'Total Suppliers'}</div>
            <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer ${filter==='company'?'ring-2 ring-blue-500':''}`}
            onClick={() => setFilter('company')}
          >
            <div className="flex items-center gap-2 text-sm text-gray-600"><FaBuilding /> {lang==='ar'?'شركات':'Companies'}</div>
            <div className="text-2xl font-bold text-blue-700">{stats.companyCount}</div>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer ${filter==='individual'?'ring-2 ring-green-500':''}`}
            onClick={() => setFilter('individual')}
          >
            <div className="flex items-center gap-2 text-sm text-gray-600"><FaUser /> {lang==='ar'?'أفراد':'Individuals'}</div>
            <div className="text-2xl font-bold text-green-700">{stats.individualCount}</div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-600">{lang==='ar'?'موردين نشطين':'Active Suppliers'}</div>
            <div className="text-2xl font-bold text-emerald-700">{stats.activeCount}</div>
          </motion.div>
        </div>

        {loading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}
        
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            {lang==='ar'?'لا يوجد موردين':'No suppliers found'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <motion.div key={item.id} whileHover={{ scale: 1.02 }} className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  {String(item.supplier_type||'').toLowerCase() === 'individual' ? <FaUser className="text-green-600" /> : <FaBuilding className="text-blue-600" />}
                  {cleanText(item.name)}
                </div>
                <span className={`px-2 py-1 rounded text-xs ${String(item.status||'active')==='active'?'bg-green-50 text-green-700':'bg-gray-100 text-gray-600'}`}>
                  {String(item.status||'active')==='active'?(lang==='ar'?'نشط':'Active'):(lang==='ar'?'غير نشط':'Inactive')}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                {item.email && (
                  <div className="flex items-center gap-2">
                    <FaEnvelope className="text-gray-400" /> {item.email}
                  </div>
                )}
                {item.phone && (
                  <div className="flex items-center gap-2">
                    <FaPhone className="text-gray-400" /> {item.phone}
                  </div>
                )}
                {(item.addr_description || item.addr_city || item.city) && (
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-gray-400" /> 
                    {item.addr_description || `${item.addr_city||item.city||''} ${item.addr_country||item.country||''}`}
                  </div>
                )}
                {item.tax_id && (
                  <div className="text-xs text-gray-500">
                    {lang==='ar'?'الرقم الضريبي':'VAT'}: {item.tax_id}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button className="flex-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center gap-1 transition-colors" onClick={()=>navigate('/suppliers', { state: { openSupplierId: item.id } })}>
                  <FaEye /> {lang==='ar'?'عرض':'View'}
                </button>
                {can('suppliers:delete') && (
                  <button className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded flex items-center gap-1 transition-colors" onClick={()=>remove(item.id)}>
                    <FaTrash /> {lang==='ar'?'حذف':'Delete'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{lang==='ar'?'بطاقات الموردين':'Suppliers Cards'}</div>
      </Modal>
    </div>
  )
}

function cleanText(s){
  const val = String(s||'')
  return /^\?+$/.test(val) ? '' : val
}
