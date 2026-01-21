import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { partners, settings as apiSettings } from '../services/api'
import { FaHome, FaSearch, FaPlus, FaEdit, FaTrash, FaEye, FaPrint, FaPhone, FaEnvelope, FaMapMarkerAlt, FaPercent, FaFileExcel } from 'react-icons/fa'
import { printClientsCardsPDF } from '../printing/pdf/autoReports'
import { t } from '../utils/i18n'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'

export default function ClientsCards(){
  const navigate = useNavigate()
  const { can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, cash, credit
  

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await partners.list({ type: 'customer' }); const arr = Array.isArray(res) ? res : (res?.items||[]); setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='customer' || x.type==='عميل' })) } finally { setLoading(false) } })() },[])

  const filtered = useMemo(()=>{
    let list = items
    // Apply search filter
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(x => (`${x.name||''} ${x.email||''} ${x.phone||''}`).toLowerCase().includes(q))
    }
    // Apply type filter
    if (filter === 'cash') {
      list = list.filter(x => {
        const term = String(x.payment_term||'').toLowerCase()
        const ctype = String(x.customer_type||'').toLowerCase()
        return term === 'immediate' || ctype === 'cash' || ctype === 'نقدي' || ctype === 'cash_registered'
      })
    } else if (filter === 'credit') {
      list = list.filter(x => {
        const term = String(x.payment_term||'').toLowerCase()
        const ctype = String(x.customer_type||'').toLowerCase()
        return term !== 'immediate' && ctype !== 'cash' && ctype !== 'نقدي' && ctype !== 'cash_registered'
      })
    }
    return list
  }, [items, search, filter])

  // Statistics
  const stats = useMemo(() => {
    const total = items.length
    const cashCount = items.filter(x => {
      const term = String(x.payment_term||'').toLowerCase()
      const ctype = String(x.customer_type||'').toLowerCase()
      return term === 'immediate' || ctype === 'cash' || ctype === 'نقدي' || ctype === 'cash_registered'
    }).length
    const creditCount = total - cashCount
    return { total, cashCount, creditCount }
  }, [items])

  async function exportPDF(){ await printClientsCardsPDF({ items: filtered, lang }) }

  function exportExcel() {
    const header = [lang==='ar'?'الاسم':'Name', lang==='ar'?'الهاتف':'Phone', lang==='ar'?'البريد':'Email', lang==='ar'?'النوع':'Type', lang==='ar'?'المدينة':'City']
    const data = filtered.map(r => [r.name||'', r.phone||'', r.email||'', r.customer_type||'-', r.addr_city||r.city||''])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = [ { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 14 } ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'العملاء':'Customers')
    XLSX.writeFile(wb, 'customers-cards.xlsx')
  }

  async function remove(id){ if (!window.confirm(lang==='ar'?'حذف العميل؟':'Delete customer?')) return; try { await partners.remove(id); const res = await partners.list({ type: 'customer' }); const arr = Array.isArray(res) ? res : (res?.items||[]); setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='customer' || x.type==='عميل' })) } catch {} }

  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      <header className="px-6 py-4 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'بطاقات العملاء':'Customer Cards'}</h2>
            <span className="text-sm text-gray-500">({filtered.length} {lang==='ar'?'عميل':'customers'})</span>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 transition-colors" onClick={exportPDF}> 
              <FaPrint /> {lang==='ar'?'طباعة':'Print'}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 transition-colors" onClick={exportExcel}> 
              <FaFileExcel /> Excel
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 transition-colors" onClick={() => navigate('/clients')}> 
              <FaHome /> {lang==='ar'?'العملاء':'Customers'}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border rounded-lg px-3">
                <FaSearch className="text-gray-400" />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث بالاسم أو الهاتف...':'Search by name or phone...'} className="px-2 py-2 outline-none w-40" />
              </div>
              {can('clients:write') && (
                <button className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center gap-2 transition-colors" onClick={()=>navigate('/clients/create')}>
                  <FaPlus /> {lang==='ar'?'إضافة عميل':'Add Customer'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 cursor-pointer transition-all ${filter==='all'?'bg-primary-50 border-primary-300 shadow-md':'bg-white hover:bg-gray-50'}`} onClick={()=>setFilter('all')}>
            <div className="text-sm text-gray-600">{lang==='ar'?'إجمالي العملاء':'Total Customers'}</div>
            <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
          </div>
          <div className={`rounded-xl border p-4 cursor-pointer transition-all ${filter==='cash'?'bg-amber-50 border-amber-300 shadow-md':'bg-white hover:bg-gray-50'}`} onClick={()=>setFilter('cash')}>
            <div className="text-sm text-gray-600">{lang==='ar'?'عملاء نقدي':'Cash Customers'}</div>
            <div className="text-2xl font-bold text-amber-700">{stats.cashCount}</div>
          </div>
          <div className={`rounded-xl border p-4 cursor-pointer transition-all ${filter==='credit'?'bg-blue-50 border-blue-300 shadow-md':'bg-white hover:bg-gray-50'}`} onClick={()=>setFilter('credit')}>
            <div className="text-sm text-gray-600">{lang==='ar'?'عملاء آجل':'Credit Customers'}</div>
            <div className="text-2xl font-bold text-blue-700">{stats.creditCount}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <div className="text-gray-400 text-lg">{lang==='ar'?'لا يوجد عملاء':'No customers found'}</div>
            <p className="text-sm text-gray-500 mt-2">{lang==='ar'?'قم بإضافة عميل جديد للبدء':'Add a new customer to get started'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const isCash = String(item.payment_term||'').toLowerCase() === 'immediate' || 
                             String(item.customer_type||'').toLowerCase() === 'cash' || 
                             String(item.customer_type||'').toLowerCase() === 'نقدي' ||
                             String(item.customer_type||'').toLowerCase() === 'cash_registered'
              let discountPct = ''
              try { const info = item && item.contact_info ? (typeof item.contact_info === 'string' ? JSON.parse(item.contact_info) : item.contact_info) : null; if (info && typeof info.discount_pct!=='undefined') discountPct = String(info.discount_pct) } catch{}
              
              return (
                <motion.div key={item.id} whileHover={{ scale: 1.02, y: -2 }} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-gray-800 text-lg">{cleanText(item.name)}</div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isCash ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isCash ? (lang==='ar'?'نقدي':'Cash') : (lang==='ar'?'آجل':'Credit')}
                    </span>
                  </div>
                  
                  <div className="mt-3 space-y-1.5">
                    {item.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FaPhone className="text-gray-400" /> {item.phone}
                      </div>
                    )}
                    {item.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FaEnvelope className="text-gray-400" /> {item.email}
                      </div>
                    )}
                    {(item.addr_city || item.city || item.addr_country || item.country) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FaMapMarkerAlt className="text-gray-400" /> {item.addr_city||item.city||''} {item.addr_country||item.country||''}
                      </div>
                    )}
                    {discountPct && Number(discountPct) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <FaPercent className="text-green-400" /> {lang==='ar'?'خصم':'Discount'}: {discountPct}%
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <button className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors" onClick={()=>navigate('/clients', { state: { openCustomerId: item.id } })}>
                      <FaEye /> {lang==='ar'?'عرض':'View'}
                    </button>
                    {can('clients:write') && (
                      <button className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors" onClick={()=>navigate('/clients', { state: { openCustomerId: item.id } })}>
                        <FaEdit /> {lang==='ar'?'تعديل':'Edit'}
                      </button>
                    )}
                    {can('clients:delete') && (
                      <button className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors" onClick={()=>remove(item.id)}>
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function cleanText(s){
  const val = String(s||'')
  return /^\?+$/.test(val) ? '' : val
}
