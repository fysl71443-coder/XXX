import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { partners, settings as apiSettings } from '../services/api'
import { FaHome, FaSearch, FaPlus, FaEdit, FaTrash, FaEye, FaPrint } from 'react-icons/fa'
import { printClientsCardsPDF } from '../printing/pdf/autoReports'
import { t } from '../utils/i18n'
import { useNavigate } from 'react-router-dom'

export default function ClientsCards(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  

  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await partners.list({ type: 'customer' }); const arr = Array.isArray(res) ? res : (res?.items||[]); setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='customer' || x.type==='عميل' })) } finally { setLoading(false) } })() },[])

  const filtered = useMemo(()=>{
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(x => (`${x.name||''} ${x.email||''} ${x.phone||''}`).toLowerCase().includes(q))
  }, [items, search])

  

  async function exportPDF(){ await printClientsCardsPDF({ items: filtered, lang }) }

  async function remove(id){ if (!window.confirm(lang==='ar'?'حذف العميل؟':'Delete customer?')) return; try { await partners.remove(id); const res = await partners.list({ type: 'customer' }); const arr = Array.isArray(res) ? res : (res?.items||[]); setItems(arr.filter(x=>{ const t=String(x.type||'').toLowerCase(); return t==='customer' || x.type==='عميل' })) } catch {} }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{lang==='ar'?'بطاقات العملاء':'Client Cards'}</h2>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={exportPDF}> 
              <FaPrint /> {lang==='ar'?'طباعة':'Print'}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/clients')}> 
              <FaHome /> {lang==='ar'?'العملاء':'Clients'}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border rounded px-2">
                <FaSearch className="text-gray-500" />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث':'Search'} className="px-2 py-1 outline-none" />
              </div>
              <button className="px-3 py-2 bg-primary-600 text-white rounded-md flex items-center gap-2" onClick={()=>navigate('/clients/create')}>
                <FaPlus /> {lang==='ar'?'إضافة عميل':'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (<div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <motion.div key={item.id} whileHover={{ scale: 1.02 }} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-800">{cleanText(item.name)}</div>
                <span className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">{item.customer_type||'—'}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{item.email||'-'} • {item.phone||'-'}</div>
              <div className="text-xs text-gray-500 mt-1">{item.addr_city||item.city||''} {item.addr_country||item.country||''}</div>
              <div className="flex gap-2 mt-3">
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>navigate('/clients', { state: { openCustomerId: item.id } })}><FaEye /> {lang==='ar'?'عرض':'View'}</button>
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>navigate('/clients', { state: { openCustomerId: item.id } })}><FaEdit /> {lang==='ar'?'تعديل':'Edit'}</button>
                <button className="px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1" onClick={()=>remove(item.id)}><FaTrash /> {lang==='ar'?'حذف':'Delete'}</button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}

function cleanText(s){
  const val = String(s||'')
  return /^\?+$/.test(val) ? '' : val
}
