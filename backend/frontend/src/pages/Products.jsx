import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { products, partners } from '../services/api'
import { FaPlus, FaBox, FaClock, FaCubes } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { printProductsPDF } from '../printing/pdf/autoReports'
import * as XLSX from 'xlsx'
import { settings as apiSettings } from '../services/api'
import PageHeader from '../components/PageHeader'
 
import { useAuth } from '../context/AuthContext'
import { sanitizeDecimal } from '../utils/number'

export default function Products() {
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [disabledIds, setDisabledIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', category: '', sale_price: '', cost_price: '', stock_quantity: '',
    section: 'consumable', invoicing_policy: 'ordered_quantities', uom: 'Units', purchase_uom: 'Units',
    can_be_sold: true, can_be_purchased: true, can_be_expensed: false,
    customer_taxes: '', internal_ref: '', barcode: '', tags: [], property1: '', internal_notes: '',
    images: [], documents: [], binary_file: null
  })
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  
  const [branding, setBranding] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [prodFilters, setProdFilters] = useState({ search: '', category: '', availability: [] })
  const [sectionFilter, setSectionFilter] = useState('all')
  const [openCategory, setOpenCategory] = useState(null)
  const [showDisabled, setShowDisabled] = useState(false)
  const { can, loading: authLoading, isLoggedIn, isAdmin } = useAuth()
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await products.list(showDisabled ? { include_disabled: 1 } : {})
      
      // Handle both array response and object with items property
      let arr = []
      let dis = []
      
      if (Array.isArray(data)) {
        // Direct array response
        arr = data
        dis = []
      } else if (data && typeof data === 'object') {
        // Object with items property
        arr = Array.isArray(data.items) ? data.items : []
        dis = Array.isArray(data.disabled_ids) ? data.disabled_ids.map(n => Number(n)) : []
      }
      
      console.log('[Products] Loaded products:', arr.length, 'items,', dis.length, 'disabled');
      
      setItems(arr)
      setDisabledIds(dis)
    } catch (e) {
      console.error('[Products] Error loading products:', e);
      setItems([])
      setDisabledIds([])
    } finally {
      setLoading(false)
    }
  }

  // CRITICAL: Wait for auth to be ready before making API calls
  useEffect(() => { 
    if (authLoading || !isLoggedIn) {
      console.log('[Products] Waiting for auth before loading data...');
      return;
    }
    load() 
  }, [showDisabled, authLoading, isLoggedIn])
  
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const [company, setCompany] = useState(null)
  useEffect(()=>{
    Promise.all([
      apiSettings.get('settings_branding').catch(()=>null),
      apiSettings.get('settings_footer').catch(()=>null),
      apiSettings.get('settings_company').catch(()=>null),
    ]).then(([b,f,c])=>{ setBranding(b); setFooterCfg(f); setCompany(c) })
  },[])

  async function save() {
    try {
      const canWrite = can('products:write')
      if (!canWrite) return
      const payload = {
        name: form.name,
        category: form.category,
        sale_price: parseFloat(String(form.sale_price||'').replace(/[^0-9.]/g,'')) || 0,
        cost_price: parseFloat(String(form.cost_price||'').replace(/[^0-9.]/g,'')) || 0,
        stock_quantity: parseFloat(String(form.stock_quantity||'').replace(/[^0-9.]/g,'')) || 0,
        is_service: String(form.section)==='service',
        uom: form.uom,
        purchase_uom: form.purchase_uom,
      }
      if (editing) {
        await products.update(editing.id, payload)
      } else {
        await products.create(payload)
      }
      setForm({
        name: '', category: '', sale_price: '', cost_price: '', stock_quantity: '',
        section: 'consumable', invoicing_policy: 'ordered_quantities', uom: 'Units', purchase_uom: 'Units',
        can_be_sold: true, can_be_purchased: true, can_be_expensed: false,
        customer_taxes: '', internal_ref: '', barcode: '', tags: [], property1: '', internal_notes: '',
        images: [], documents: [], binary_file: null
      })
      setEditing(null)
      setModalOpen(false)
      await load()
    } catch (e) {}
  }

  async function remove(id) {
    try {
      // REMOVED: Admin check - can() function already has admin bypass
      // const canDelete = can('products:delete')
      // if (!canDelete) return
      const resp = await products.remove(id)
      if (resp && resp.error==='product_linked') {
        try { alert(lang==='ar'?'لا يمكن حذف منتج مرتبط بفواتير، يمكنك تعطيله فقط':'Cannot delete product linked to invoices; you can disable it') } catch {}
      }
    } catch (e) {
      try { const msg = (e?.message || '').toLowerCase().includes('linked') ? (lang==='ar'?'لا يمكن حذف منتج مرتبط بفواتير':'Cannot delete linked product') : (lang==='ar'?'فشل الحذف':'Delete failed'); alert(msg) } catch {}
    }
    await load()
  }

  async function disable(id) {
    try {
      // REMOVED: Admin check - can() function already has admin bypass
      // const canWrite = can('products:write')
      // if (!canWrite) return
      await products.disable(id)
    } catch (e) {}
    await load()
  }

  async function enable(id) {
    try {
      // REMOVED: Admin check - can() function already has admin bypass
      // const canWrite = can('products:write')
      // if (!canWrite) return
      await products.enable(id)
    } catch (e) {}
    await load()
  }

  

  async function exportPDF() { await printProductsPDF({ items, lang }) }

  function exportExcel(){
    setExportingExcel(true)
    try {
      const header = ['Name','Category','Stock','Sale Price','Cost','UoM','Purchase UoM','Supplier']
      const data = (items||[]).map(x => [
        x.name||'',
        x.category||'',
        Number(x.stock_quantity||0),
        Number(x.sale_price||0),
        Number(x.cost_price||0),
        x.uom||'Units',
        x.purchase_uom||'Units',
        (x.supplier && x.supplier.name) || ''
      ])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let rr = 1; rr <= range.e.r; rr++){
        for (let cc of [2,3,4]){ const cell = ws[XLSX.utils.encode_cell({ r: rr, c: cc })]; if (cell && cell.v != null) { cell.z = cc===2?'0.00':'#,##0.00'; cell.t = 'n' } }
      }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Products')
      XLSX.writeFile(wb, 'products.xlsx')
    } finally { setExportingExcel(false) }
  }

  const viewItems = useMemo(() => {
    const q = String(prodFilters.search||'').trim().toLowerCase()
    const cat = String(prodFilters.category||'').trim()
    const avail = Array.isArray(prodFilters.availability) ? prodFilters.availability : []
    
    return (items||[]).filter(x => {
      // Search filter
      if (q) {
        const nameMatch = String(x.name||'').toLowerCase().includes(q)
        const nameEnMatch = String(x.name_en||'').toLowerCase().includes(q)
        const categoryMatch = String(x.category||'').toLowerCase().includes(q)
        if (!nameMatch && !nameEnMatch && !categoryMatch) return false
      }
      
      // Category filter
      if (cat && String(x.category||'').trim() !== cat) return false
      
      // Section filter
      if (sectionFilter==='service' && !x.is_service) return false
      if (sectionFilter==='consumable' && !!x.is_service) return false
      
      // Disabled filter
      if (!showDisabled && disabledIds.includes(Number(x.id))) return false
      
      // Availability filters
      if (avail.includes('sold') && x.can_be_sold === false) return false
      if (avail.includes('purchased') && x.can_be_purchased === false) return false
      if (avail.includes('expensed') && x.can_be_expensed === false) return false
      
      return true
    })
  }, [items, prodFilters, sectionFilter, showDisabled, disabledIds])

  function onChangeNum(field){
    return e => setForm(f => ({ ...f, [field]: sanitizeDecimal(e.target.value) }))
  }
  function onSectionChange(val){
    setForm(f => ({ ...f, section: val, uom: val==='service'?'Hours':'Units', purchase_uom: val==='service'?'Hours':'Units' }))
  }

  const services = viewItems.filter(x => !!x.is_service)
  const consumables = viewItems.filter(x => !x.is_service)
  const categories = Array.from(new Set(viewItems.map(p => (p.category || 'عام'))))

  const headerActions = [
    (function(){ const canExport = can('reports:export'); return (<button key="excel" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=>{ if (!canExport || exportingExcel) return; exportExcel() }} disabled={!canExport || exportingExcel}>{exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : 'Excel'}</button>) })(),
    (function(){ const canPrint = can('reports:print'); return (<button key="pdf" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=>{ if (!canPrint || exportingPDF) return; setExportingPDF(true); try{ exportPDF() } finally { setExportingPDF(false) } }} disabled={!canPrint || exportingPDF}>{exportingPDF ? (lang==='ar'?'جارٍ التوليد...':'Generating...') : 'PDF'}</button>) })(),
    (function(){ const canWrite = can('products:write'); return (<button key="add" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=>{ if (!canWrite) return; setEditing(null); setModalOpen(true) }} disabled={!canWrite}><FaPlus/> {lang==='ar'?'إضافة منتج':'Add Product'}</button>) })(),
  ]

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <PageHeader
        icon={FaBox}
        title={lang==='ar'?'المنتجات':'Products'}
        subtitle={lang==='ar'?'إدارة المنتجات والفئات والمستندات والصور':'Manage products, categories, documents and images'}
        onHomeClick={() => navigate('/')}
        homeLabel={lang==='ar'?'الرئيسية':'Home'}
        actions={headerActions}
      />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600">{lang==='ar'?'بحث':'Search'}</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder={lang==='ar'?'اسم المنتج':'Product name'} value={prodFilters.search} onChange={e=>setProdFilters({ ...prodFilters, search: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">{lang==='ar'?'القسم':'Section'}</label>
              <select className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)}>
                <option value="all">{lang==='ar'?'الكل':'All'}</option>
                <option value="service">{lang==='ar'?'خدمات':'Services'}</option>
                <option value="consumable">{lang==='ar'?'استهلاك':'Consumables'}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">{lang==='ar'?'الفئة':'Category'}</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder={lang==='ar'?'الفئة':'Category'} value={prodFilters.category} onChange={e=>setProdFilters({ ...prodFilters, category: e.target.value })} />
            </div>
            <div className="flex gap-2 items-center">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setProdFilters({ search: '', category: '', availability: [] })}>{lang==='ar'?'مسح':'Clear'}</button>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={showDisabled} onChange={e=>setShowDisabled(e.target.checked)} /> {lang==='ar'?'إظهار المعطّلة':'Show disabled'}
              </label>
            </div>
          </div>
        </section>
        <section className="bg-white rounded-xl shadow p-4" dir="rtl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">{lang==='ar'?'الأقسام':'Categories'}</div>
            <div className="text-sm text-gray-600">
              {lang==='ar'?'تجميع المنتجات حسب الفئة':'Group products by category'}
              {items.length > 0 && ` (${items.length} ${lang==='ar'?'منتج':'products'})`}
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-gray-600">{lang==='ar'?'جار التحميل...':'Loading...'}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">{lang==='ar'?'لا توجد منتجات في قاعدة البيانات':'No products in database'}</div>
              <div className="text-sm text-gray-400">{lang==='ar'?'استخدم زر "إضافة منتج" لإضافة منتجات جديدة':'Use "Add Product" button to add new products'}</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">{lang==='ar'?'لا توجد فئات':'No categories'}</div>
              <div className="text-sm text-gray-400">{lang==='ar'?'المنتجات موجودة لكن لا توجد فئات':'Products exist but no categories found'}</div>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(cat => (
                <div key={cat} className="border rounded-xl bg-white overflow-hidden" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <button className="w-full px-4 py-3 flex items-center justify-between text-right" onClick={()=>setOpenCategory(openCategory===cat?null:cat)}>
                    {(() => {
                      const s = String(cat||'')
                      function split(lbl){ const v=String(lbl||''); if (v.includes(' - ')) { const [en, ar] = v.split(' - '); return { en: en.trim(), ar: ar.trim() } } if (v.includes(' / ')) { const [en, ar] = v.split(' / '); return { en: en.trim(), ar: ar.trim() } } return { en: v, ar: '' } }
                      function arFromEn(en){ const k=String(en||'').trim().toLowerCase(); if(k==='soups') return 'شوربات'; if(k==='salads') return 'سلطات'; if(k==='rice & biryani') return 'أرز وبرياني'; if(k==='prawns') return 'روبيان'; if(k==='noodles & chopsuey') return 'نودلز وتشوبسوي'; if(k==='indian delicacy(vegetables)') return 'أطباق هندية (خضار)'; if(k==='indian delicacy(fish)') return 'أطباق هندية (سمك)'; if(k==='indian delicacy(chicken)') return 'أطباق هندية (دجاج)'; if(k==='house special') return 'وجبات خاصة'; if(k==='drinks') return 'مشروبات'; if(k==='chinese sizzling') return 'طبق ساخن'; if(k==='chicken') return 'دجاج'; if(k==='charcola grill / kebabs' || k==='charcola grill/kebabs' || k==='charcola grill & kebabs') return 'مشويات'; if(k==='beef & lamb') return 'لحم بقر وخروف'; if(k==='appetizers') return 'مقبلات'; return '' }
                      const parts = split(s)
                      const arClean = parts.ar.replace(/\?/g,'').trim()
                      const arFinal = arClean ? parts.ar : arFromEn(parts.en)
                      return (
                        <div className="text-right">
                          <div className="font-semibold text-gray-800 whitespace-normal break-words leading-tight">{parts.en || (cat||'عام')}</div>
                          {arFinal ? (<div className="text-sm text-gray-600 whitespace-normal break-words leading-tight">{arFinal}</div>) : null}
                        </div>
                      )
                    })()}
                    <span className="text-xs text-gray-600">{viewItems.filter(p => (p.category||'عام')===cat).length} {lang==='ar'?'عنصر':'items'}</span>
                  </button>
                  {openCategory===cat && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {viewItems.filter(p => (p.category||'عام')===cat).map(p => (
                          <div key={p.id} className="border rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between">
                              {(() => {
                                const nm = String(p.name||'')
                                function split(lbl){ const v=String(lbl||''); if (v.includes(' - ')) { const [en, ar] = v.split(' - '); return { en: en.trim(), ar: ar.trim() } } if (v.includes(' / ')) { const [en, ar] = v.split(' / '); return { en: en.trim(), ar: ar.trim() } } return { en: v, ar: '' } }
                                const parts = split(nm)
                                const arClean = parts.ar.replace(/\?/g,'').trim()
                                const arFinal = arClean ? parts.ar : ''
                                return (
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-800 whitespace-normal break-words leading-tight">{parts.en}</div>
                                    {arFinal ? (<div className="text-sm text-gray-600 whitespace-normal break-words leading-tight">{arFinal}</div>) : null}
                                  </div>
                                )
                              })()}
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{p.is_service ? (lang==='ar'?'خدمة':'Service') : (lang==='ar'?'استهلاك':'Consumable')}</span>
                                {disabledIds.includes(Number(p.id)) ? (
                                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{lang==='ar'?'غير متاح':'Disabled'}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-700">{lang==='ar'?'السعر':'Price'}: {(parseFloat(p.sale_price||0)).toFixed(4)}</div>
                            {!p.is_service ? (<div className="text-sm text-gray-700">{lang==='ar'?'الكمية':'Qty'}: {(parseFloat(p.stock_quantity||0)).toFixed(4)}</div>) : null}
                            <div className="text-sm text-gray-700">{lang==='ar'?'التكلفة':'Cost'}: {(parseFloat(p.cost_price||0)).toFixed(4)}</div>
                            <div className="mt-2 flex gap-2">
                              {(()=>{ const canWrite = can('products:write'); return (
                                <button className={`px-2 py-1 ${canWrite?'bg-amber-100 text-amber-800':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} onClick={()=>{ if (!canWrite) return; setEditing(p); setForm({
                                  name: p.name||'', category: p.category||'', sale_price: String(p.sale_price||''), cost_price: String(p.cost_price||''), stock_quantity: String(p.stock_quantity||''),
                                  section: p.is_service?'service':'consumable', uom: p.uom|| (p.is_service?'Hours':'Units'), purchase_uom: p.purchase_uom|| (p.is_service?'Hours':'Units'),
                                  can_be_sold: true, can_be_purchased: true, can_be_expensed: false,
                                  customer_taxes: '', internal_ref: '', barcode: '', tags: [], property1: '', internal_notes: '', images: [], documents: [], binary_file: null
                                }); setModalOpen(true) }} disabled={!canWrite}>{lang==='ar'?'تعديل':'Edit'}</button>) })()}
                              {(()=>{ const canDelete = can('products:delete'); return (
                                <button className={`px-2 py-1 ${canDelete?'bg-red-100 text-red-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} onClick={()=>{ if (!canDelete) return; remove(p.id) }} disabled={!canDelete}>{lang==='ar'?'حذف':'Delete'}</button>) })()}
                              {(()=>{ const canWrite = can('products:write'); const isDisabled = disabledIds.includes(Number(p.id)); return (
                                isDisabled ? (
                                  <button className={`px-2 py-1 ${canWrite?'bg-green-100 text-green-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} onClick={()=>{ if (!canWrite) return; enable(p.id) }} disabled={!canWrite}>{lang==='ar'?'تمكين':'Enable'}</button>
                                ) : (
                                  <button className={`px-2 py-1 ${canWrite?'bg-gray-100 text-gray-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} onClick={()=>{ if (!canWrite) return; disable(p.id) }} disabled={!canWrite}>{lang==='ar'?'تعطيل':'Disable'}</button>
                                )
                              ) })()}
                            </div>
                          </div>
                        ))}
                        {viewItems.filter(p => (p.category||'عام')===cat).length===0 && (
                          <div className="text-sm text-gray-500">{lang==='ar'?'لا توجد منتجات':'No products'}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {categories.length===0 && (<div className="text-sm text-gray-500">{lang==='ar'?'لا توجد أقسام':'No categories'}</div>)}
            </div>
          )}
        </section>
      </div>

  {modalOpen && (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-2xl rounded-2xl border border-gray-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">{editing ? (lang==='ar'?'تعديل منتج':'Edit Product') : (lang==='ar'?'إضافة منتج':'Add Product')}</div>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>setModalOpen(false)}>{lang==='ar'?'إغلاق':'Close'}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-600">{lang==='ar'?'القسم':'Section'}</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2"><input type="radio" checked={form.section==='service'} onChange={()=>onSectionChange('service')} /> {lang==='ar'?'خدمات':'Services'}</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={form.section==='consumable'} onChange={()=>onSectionChange('consumable')} /> {lang==='ar'?'استهلاك':'Consumables'}</label>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'الاسم':'Name'}</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'الفئة':'Category'}</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={form.category} onChange={e=>setForm(f=>({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'وحدة القياس':'UoM'}</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={form.uom} onChange={e=>setForm(f=>({ ...f, uom: e.target.value }))}>
                  <option value="Units">{lang==='ar'?'كميات':'Units'}</option>
                  <option value="Hours">{lang==='ar'?'ساعات':'Hours'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'وحدة الشراء':'Purchase UoM'}</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg" value={form.purchase_uom} onChange={e=>setForm(f=>({ ...f, purchase_uom: e.target.value }))}>
                  <option value="Units">{lang==='ar'?'كميات':'Units'}</option>
                  <option value="Hours">{lang==='ar'?'ساعات':'Hours'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'سعر البيع':'Sale Price'}</label>
                <input inputMode="decimal" lang="en" dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="0.0000" value={form.sale_price} onChange={onChangeNum('sale_price')} />
              </div>
              <div>
                <label className="text-xs text-gray-600">{lang==='ar'?'التكلفة':'Cost Price'}</label>
                <input inputMode="decimal" lang="en" dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="0.0000" value={form.cost_price} onChange={onChangeNum('cost_price')} />
              </div>
              {form.section!=='service' && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-600">{lang==='ar'?'الكمية بالمخزون':'Stock Quantity'}</label>
                  <input inputMode="decimal" lang="en" dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="0.0000" value={form.stock_quantity} onChange={onChangeNum('stock_quantity')} />
                </div>
              )}
              
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-100 rounded" onClick={()=>setModalOpen(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button className="px-4 py-2 bg-primary-600 text-white rounded" onClick={save}>{lang==='ar'?'حفظ':'Save'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
