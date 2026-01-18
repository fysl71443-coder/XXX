import { useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../ui/Breadcrumbs'
import Toast from '../ui/Toast'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import { accounts as apiAccounts, journal as apiJournal, auth as apiAuth, settings as apiSettings } from '../services/api'
import { FaLandmark, FaBalanceScale, FaChartLine, FaMoneyBill, FaChartBar, FaTrash, FaEdit, FaPlus, FaList } from 'react-icons/fa'
import { Building2, FileSpreadsheet, TrendingUp, TrendingDown, Plus, Home } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { t } from '../utils/i18n'
import AdvancedFilters from '../components/AdvancedFilters'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer } from 'recharts'
import { createPDF } from '../utils/pdfUtils'
import { print } from '@/printing'

function typeIcon(type) {
  switch (type) {
    case 'asset': return FaLandmark
    case 'liability': return FaBalanceScale
    case 'equity': return FaChartLine
    case 'revenue': return FaChartBar
    case 'expense': return FaMoneyBill
    default: return FaLandmark
  }
}

function TreeNode({ node, onSelect, onAddChild, onEdit, onDelete, onShowEntries, lang, canAccountsWrite }) {
  const [open, setOpen] = useState(true)
  const Icon = typeIcon(node.type)
  const balance = parseFloat(node.balance || 0)
  return (
    <div className="select-none">
      <div className="group flex items-center justify-between pr-2 py-1 rounded hover:bg-gray-100">
        <div className="flex items-center gap-2" onClick={() => onSelect(node)}>
          <button className="w-6 text-gray-500" onClick={() => setOpen(!open)}>{node.children?.length ? (open ? '−' : '+') : ''}</button>
          <Icon className="text-primary-600" />
          <div>
            <div className="text-sm font-semibold text-gray-800">
              {node.account_code || node.account_number} • {lang==='ar'?(node.name||''):(node.name_en||node.name||'')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${balance >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{balance.toFixed(2)}</span>
          <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
            <button className={`text-xs px-2 py-1 ${canAccountsWrite?'bg-primary-50 text-primary-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} disabled={!canAccountsWrite} onClick={() => onEdit(node)}><FaEdit /></button>
            <button className={`text-xs px-2 py-1 ${canAccountsWrite?'bg-green-50 text-green-700':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded`} disabled={!canAccountsWrite} onClick={() => onAddChild(node)}><FaPlus /></button>
            <button className="text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded" onClick={() => onShowEntries(node)}><FaList /></button>
            <button className={`text-xs px-2 py-1 ${canAccountsWrite?'bg-red-50 text-red-700':'bg-red-200 text-red-500 cursor-not-allowed'} rounded`} disabled={!canAccountsWrite} onClick={() => onDelete(node)}><FaTrash /></button>
          </div>
        </div>
      </div>
      {open && node.children?.length ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pl-6">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} onShowEntries={onShowEntries} lang={lang} />
          ))}
        </motion.div>
      ) : null}
    </div>
  )
}

export default function Accounts() {
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')
  const [tree, setTree] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [codeFrom, setCodeFrom] = useState('')
  const [codeTo, setCodeTo] = useState('')
  const [hideZero, setHideZero] = useState(false)
  const [onlyLeaf, setOnlyLeaf] = useState(false)
  const [sort, setSort] = useState('name_asc')
  const [toast, setToast] = useState('')
  const [entries, setEntries] = useState([])
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [activeReport, setActiveReport] = useState('')
  const [reportFilters, setReportFilters] = useState({})
  const { can } = useAuth()
  const [periodStatus, setPeriodStatus] = useState('open')
  const [helpOpen, setHelpOpen] = useState(false)

  async function loadTree() {
    try {
      const data = await apiAccounts.tree()
      setTree(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[Accounts] Error loading tree:', e)
      setTree([])
    }
  }
  useEffect(() => { loadTree() }, [])
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => {
    (async()=>{
      try {
        const d = new Date()
        const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const s = await (await import('../services/api')).periods.get(per)
        setPeriodStatus(String(s?.status||'open'))
      } catch {}
    })()
  }, [])

  // Handle URL parameters for smart report links
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const report = urlParams.get('report')
    const period = urlParams.get('period')
    const branch = urlParams.get('branch')
    const currency = urlParams.get('currency')
    
    if (report) {
      setActiveReport(report)
      setReportFilters({ period, branch, currency })
      
      // Auto-select appropriate account based on report type
      if (report === 'trial-balance') {
        // For trial balance, we might want to show the full tree
        setSearch('')
        setTypeFilter('')
      } else if (report === 'income-statement') {
        // For income statement, focus on revenue and expense accounts
        setSearch('')
        setTypeFilter('revenue,expense')
      } else if (report === 'balance-sheet') {
        // For balance sheet, focus on asset, liability, and equity accounts
        setSearch('')
        setTypeFilter('asset,liability,equity')
      } else if (report === 'cash-flow') {
        // For cash flow, focus on cash-related accounts
        setSearch('نقد|كاش|صندوق|بنك')
        setTypeFilter('')
      }
    }
  }, [])

  const filteredTree = useMemo(() => {
    const types = String(typeFilter||'').split(',').map(s=>s.trim()).filter(Boolean)
    function inRange(code){
      const n = Number(code||0)
      const fromOk = String(codeFrom||'')==='' || n >= Number(codeFrom)
      const toOk = String(codeTo||'')==='' || n <= Number(codeTo)
      return fromOk && toOk
    }
    function filterNode(node) {
      const nameAr = node.name||''
      const nameEn = node.name_en||node.name||''
      const matchSearch = nameAr.includes(search) || nameEn.includes(search) || String(node.account_code || '').includes(search)
      const matchType = !types.length || types.includes(node.type)
      const matchRange = inRange(node.account_code || node.account_number)
      let children = (node.children || []).map(filterNode).filter(Boolean)
      const balance = parseFloat(node.balance || 0)
      const isLeaf = !(node.children?.length)
      if (hideZero && !children.length && Math.abs(balance) < 0.0001) return null
      if (onlyLeaf && !isLeaf && !children.length) return null
      const matches = matchSearch && matchType && matchRange
      if (matches || children.length) {
        return { ...node, children }
      }
      return null
    }
    let out = (Array.isArray(tree) ? tree : []).map(filterNode).filter(Boolean)
    function sortNodes(nodes){
      const cmp = (a,b)=>{
        if (sort==='name_asc') return (a.name||'').localeCompare(b.name||'')
        if (sort==='name_desc') return (b.name||'').localeCompare(a.name||'')
        if (sort==='bal_asc') return parseFloat(a.balance||0) - parseFloat(b.balance||0)
        if (sort==='bal_desc') return parseFloat(b.balance||0) - parseFloat(a.balance||0)
        return 0
      }
      nodes.sort(cmp)
      nodes.forEach(n=>{ if (n.children?.length) sortNodes(n.children) })
    }
    sortNodes(out)
    return out
  }, [tree, search, typeFilter, codeFrom, codeTo, hideZero, onlyLeaf, sort])

  async function addChild(parent) {
    const canWrite = can('accounts:write')
    if (!canWrite) { setToast('ليست لديك صلاحية إضافة حساب فرعي'); return }
    const name = window.prompt('اسم الحساب الفرعي')
    if (!name) return
    await apiAccounts.create({ name, type: parent.type, parent_id: parent.id, opening_balance: 0 })
    await loadTree()
    setToast('تمت إضافة الحساب الفرعي')
  }

  async function editAccount(acc) {
    const canWrite = can('accounts:write')
    if (!canWrite) { setToast('ليست لديك صلاحية تعديل الحساب'); return }
    const nameInput = window.prompt('تعديل اسم الحساب', acc.name)
    const openingDefault = (acc.opening_balance != null)
      ? String(acc.opening_balance)
      : String((parseFloat(acc.opening_debit || 0) - parseFloat(acc.opening_credit || 0)) || 0)
    const openingStr = window.prompt('الرصيد الافتتاحي (استخدم رقم موجب أو سالب)', openingDefault)
    const payload = {}
    if (nameInput && String(nameInput).trim() !== '') payload.name = nameInput
    if (openingStr != null && openingStr !== '') {
      const val = parseFloat(openingStr)
      if (!isNaN(val)) payload.opening_balance = val
    }
    if (!Object.keys(payload).length) return
    await apiAccounts.update(acc.id, payload)
    await loadTree()
    setToast('تم تعديل الحساب')
  }

  async function deleteAccount(acc) {
    const canWrite = can('accounts:write')
    if (!canWrite) { setToast('ليست لديك صلاحية حذف الحساب'); return }
    if (!window.confirm('هل أنت متأكد من الحذف؟ سيتم التحقق من الحركات والرصيد.')) return
    try {
      await apiAccounts.remove(acc.id)
      await loadTree()
      if (selected?.id === acc.id) setSelected(null)
      setToast('تم حذف الحساب')
    } catch (e) {
      setToast('تعذر حذف الحساب: تحقق من الرصيد أو الحركات')
    }
  }

  async function showEntries(acc) {
    setSelected(acc)
    try {
      const data = await apiJournal.byAccount(acc.id)
      setEntries(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[Accounts] Error loading entries:', e)
      setEntries([])
    }
  }

  async function createJournal(acc) {
    const canCreateJournal = can('journal.create');
    if (!canCreateJournal) { setToast('ليست لديك صلاحية إضافة قيد'); return }
    const debitStr = window.prompt('مبلغ مدين (0 إذا لا يوجد)') || '0'
    const creditStr = window.prompt('مبلغ دائن (0 إذا لا يوجد)') || '0'
    const debit = parseFloat(debitStr)
    const credit = parseFloat(creditStr)
    const description = window.prompt('وصف الحركة') || ''
    if (isNaN(debit) || isNaN(credit)) return
    const postings = []
    postings.push({ account_id: acc.id, debit, credit })
    if (debit !== credit) {
      const offsetIdStr = window.prompt('أدخل رقم حساب مقابل لتوازن القيد')
      const offsetId = parseInt(offsetIdStr, 10)
      if (!offsetId) return
      postings.push({ account_id: offsetId, debit: credit, credit: debit })
    }
    try {
      await apiJournal.create({ date: new Date().toISOString().slice(0, 10), description, postings })
      await showEntries(acc)
      await loadTree()
      setToast('تم إضافة القيد وتحديث الرصيد')
    } catch (e) {
      setToast('فشل إضافة القيد: تأكد من توازن المدين والدائن')
    }
  }

  const canAccountsView = can('accounts:view')
  const canAccountsWrite = can('accounts:write')
  const canJournalCreate = can('journal.create')
  if (!canAccountsView) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <header className="px-6 py-4 bg-white border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary-700">شاشة الحسابات</h1>
              <p className="text-gray-600 text-sm">لا تملك صلاحية عرض هذه الشاشة</p>
            </div>
            <div className="flex gap-2 items-center">
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>navigate('/')}>الرئيسية</button>
            </div>
          </div>
        </header>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Breadcrumbs items={[{ label:t('labels.home'), to:'/' }, { label:t('titles.accounts') }]} />
      <PageHeader
        icon={Building2}
        title={t('titles.accounts', lang)}
        subtitle={t('labels.actions', lang)}
        onHomeClick={() => navigate('/')}
        homeLabel={t('labels.home', lang)}
        actions={[
          (<span key="period" className="px-2 py-1 bg-white rounded-lg border"><StatusBadge status={periodStatus} type="period" /></span>),
          (<button key="reload" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={loadTree}>{t('labels.reload', lang)}</button>),
          (<button key="help" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=> setHelpOpen(true)}>{t('labels.help', lang)}</button>)
        ]}
      />
      <div className="px-6 py-4">
        <AdvancedFilters
          value={{ search, typeMulti: String(typeFilter||'').split(',').filter(Boolean), codeFrom, codeTo, sort }}
          onChange={(next)=>{ setSearch(next.search||''); setTypeFilter(Array.isArray(next.typeMulti)? next.typeMulti.join(',') : ''); setCodeFrom(next.codeFrom||''); setCodeTo(next.codeTo||''); setSort(next.sort||'name_asc') }}
          lang={lang}
          fields={[
            { key:'search', type:'text', labelAr:'بحث', labelEn:'Search', placeholderAr:'بحث عن حساب', placeholderEn:'Search account' },
            { key:'typeMulti', type:'multiselect', labelAr:'الأنواع', labelEn:'Types', options:[{value:'asset',label:'أصول'},{value:'liability',label:'التزامات'},{value:'equity',label:'حقوق ملكية'},{value:'revenue',label:'إيرادات'},{value:'expense',label:'مصروفات'}] },
            { key:'codeFrom', type:'text', labelAr:'من رقم', labelEn:'Code from' },
            { key:'codeTo', type:'text', labelAr:'إلى رقم', labelEn:'Code to' },
            { key:'sort', type:'select', labelAr:'ترتيب', labelEn:'Sort', options:[{value:'name_asc',label:'اسم تصاعدي'},{value:'name_desc',label:'اسم تنازلي'},{value:'bal_asc',label:'رصيد تصاعدي'},{value:'bal_desc',label:'رصيد تنازلي'}] },
          ]}
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={hideZero} onChange={e=>setHideZero(e.target.checked)} /> إخفاء رصيد صفر</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyLeaf} onChange={e=>setOnlyLeaf(e.target.checked)} /> أوراق فقط</label>
        </div>
      </div>
      
      {/* Active Report Info Banner */}
      {activeReport && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <FaChartLine className="text-blue-600" size={16} />
              </div>
              <div>
                <h3 className="font-medium text-blue-800">
                  {activeReport === 'trial-balance' ? 'ميزان المراجعة' :
                   activeReport === 'income-statement' ? 'قائمة الدخل' :
                   activeReport === 'balance-sheet' ? 'المركز المالي' :
                   activeReport === 'cash-flow' ? 'التدفقات النقدية' :
                   activeReport === 'account-statement' ? 'كشف حساب' : 'تقرير'}
                </h3>
                <p className="text-sm text-blue-600">
                  {reportFilters.period && `الفترة: ${reportFilters.period} • `}
                  {reportFilters.branch && `الفرع: ${reportFilters.branch} • `}
                  {reportFilters.currency && `العملة: ${reportFilters.currency}`}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveReport('')
                setReportFilters({})
                // Clear URL parameters
                navigate('/accounts')
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕ إغلاق
            </button>
          </div>
        </div>
      )}
      
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-5 border-r p-4 bg-white">
          {(Array.isArray(filteredTree) ? filteredTree : []).map(node => (
            <TreeNode key={node.id} node={node} onSelect={setSelected} onAddChild={addChild} onEdit={editAccount} onDelete={deleteAccount} onShowEntries={showEntries} lang={lang} canAccountsWrite={canAccountsWrite} />
          ))}
        </section>
        <section className="lg:col-span-7 p-6">
          {selected ? (
            <div className="space-y-4">
              <div className="bg-white border rounded p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet size={18}/> {lang==='ar'?(selected.name||''):(selected.name_en||selected.name||'')}</div>
                    <div className="text-sm text-gray-500">رقم: {selected.account_code || selected.account_number} • نوع: {selected.type}</div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className={`px-3 py-2 ${canJournalCreate?'bg-primary-600 text-white':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded flex items-center gap-1`} disabled={!canJournalCreate} onClick={() => createJournal(selected)}><Plus size={16}/> إضافة حركة</motion.button>
                    <button className="px-3 py-2 bg-gray-100 text-gray-800 rounded" onClick={() => editAccount(selected)}>تعديل</button>
                    <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => deleteAccount(selected)}>حذف</button>
                    <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => addChild(selected)}>إضافة حساب فرعي</button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">الرصيد الحالي: {parseFloat(selected.balance || 0).toFixed(2)}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <motion.div whileHover={{ scale: 1.02 }} className="bg-blue-50 p-4 rounded-lg border shadow flex items-center justify-between">
                  <div className="flex items-center gap-2"><TrendingUp className="text-blue-700" size={18}/>إجمالي المدين</div>
                  <div className="text-xl font-bold text-blue-700">{entries.reduce((s,e)=> s + parseFloat(e.debit||0), 0).toFixed(2)}</div>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} className="bg-green-50 p-4 rounded-lg border shadow flex items-center justify-between">
                  <div className="flex items-center gap-2"><TrendingDown className="text-green-700" size={18}/>إجمالي الدائن</div>
                  <div className="text-xl font-bold text-green-700">{entries.reduce((s,e)=> s + parseFloat(e.credit||0), 0).toFixed(2)}</div>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} className="bg-yellow-50 p-4 rounded-lg border shadow flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileSpreadsheet className="text-yellow-700" size={18}/>عدد الحركات</div>
                  <div className="text-xl font-bold text-yellow-700">{entries.length}</div>
                </motion.div>
              </div>

              <div className="bg-white border rounded p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-2">الحركات المحاسبية</h3>
                <div className="divide-y">
                  <AnimatePresence initial={false}>
                    {(Array.isArray(entries) ? entries : []).map((e) => (
                      <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">قيد #{e.journal.entry_number} • {e.journal.date}</div>
                          <div className="text-xs text-gray-500">{e.journal.description}</div>
                        </div>
                        <div className="text-sm">
                          <span className="text-blue-700">مدين: {parseFloat(e.debit || 0).toFixed(2)}</span>
                          <span className="ml-3 text-red-700">دائن: {parseFloat(e.credit || 0).toFixed(2)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!entries.length && <div className="text-sm text-gray-500">لا توجد حركات</div>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50" onClick={async()=>{ setExportingPDF(true); try { await exportAccountPDF(entries) } finally { setExportingPDF(false) } }} disabled={exportingPDF}>
                    {exportingPDF ? (lang==='ar'?'جارٍ التوليد...':'Generating...') : (lang==='ar'?'PDF':'PDF')}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50" onClick={async()=>{ setExportingExcel(true); try { await exportAccountExcel(entries) } finally { setExportingExcel(false) } }} disabled={exportingExcel}>
                    {exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : (lang==='ar'?'Excel':'Excel')}
                  </motion.button>
                </div>
              </div>

              <div className="bg-white border rounded p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-2">تحليل الحساب</h3>
                {Array.isArray(entries) && entries.length > 0 ? (
                  <>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                        <LineChart data={entries.map(e => ({ date: e.journal?.date || '', net: parseFloat(e.debit||0) - parseFloat(e.credit||0) }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="net" stroke="#2563eb" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                        <BarChart data={entries.map(e => ({ date: e.journal?.date || '', debit: parseFloat(e.debit||0), credit: parseFloat(e.credit||0) }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="debit" fill="#22c55e" />
                          <Bar dataKey="credit" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    لا توجد بيانات لعرضها
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">اختر حسابًا من الشجرة لعرض التفاصيل</div>
          )}
        </section>
      </main>
      {toast && (<Toast type="info" message={toast} onClose={()=> setToast('')} />)}
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=> setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{lang==='ar'?'الحسابات':'Accounts'}</div>
      </Modal>
    </div>
  )
}

async function exportAccountPDF(items){
  const lang = localStorage.getItem('lang') || 'ar'
  const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang })
  
  let companyName = ''
  let companyEn = ''
  let companyCR = ''
  let companyVAT = ''
  let logo = ''
  
  try {
    const company = await apiSettings.get('settings_company')
    const branding = await apiSettings.get('settings_branding')
    if (branding?.logo) logo = branding.logo
    companyName = (company?.name_ar || company?.name_en || '').trim()
    companyEn = (company?.name_en || '').trim()
    if (company?.cr_number) companyCR = `CR: ${company.cr_number}`
    if (company?.vat_number) companyVAT = `VAT: ${company.vat_number}`
  } catch {}

  
  
  // Logo removed per request
  
  doc.setFontSize(14)
  const title = lang==='ar'?'كشف حساب':'Account Ledger'
  doc.safeText(title, 40, logo?80:40)
  
  doc.setFontSize(10)
  if (companyName) {
    doc.safeText(lang==='ar'?(companyName||companyEn):companyEn, 550, 40, { align: 'right' })
    let extraY = 55
    if (companyVAT) { doc.safeText(companyVAT, 550, extraY, { align: 'right' }); extraY+=12 }
    if (companyCR) { doc.safeText(companyCR, 550, extraY, { align: 'right' }); }
  }

  let y = 70
  
  doc.setFillColor(245, 247, 250)
  doc.rect(40, y, 515, 20, 'F')
  doc.setTextColor(0)
  doc.setFontSize(10)
  
  if (lang==='ar') {
    doc.safeText('رقم القيد', 50, y+14)
    doc.safeText('التاريخ', 110, y+14)
    doc.safeText('مدين', 200, y+14)
    doc.safeText('دائن', 260, y+14)
    doc.safeText('الوصف', 320, y+14)
  } else {
    doc.safeText('Entry#', 50, y+14)
    doc.safeText('Date', 110, y+14)
    doc.safeText('Debit', 200, y+14)
    doc.safeText('Credit', 260, y+14)
    doc.safeText('Description', 320, y+14)
  }
  
  y += 30
  
  items.slice(0, 300).forEach(e => {
    const j = e.journal || {}
    const desc = (j.description || '').replace(/\n/g, ' ').slice(0, 50)
    
    doc.safeText(String(j.entry_number || '-'), 50, y)
    doc.safeText(String(j.date || ''), 110, y)
    doc.safeText(parseFloat(e.debit || 0).toFixed(2), 200, y)
    doc.safeText(parseFloat(e.credit || 0).toFixed(2), 260, y)
    doc.safeText(desc, 320, y)
    
    y += 18
    if (y > 780) {
      doc.addPage()
      y = 40
    }
  })
  
  print({ type:'pdf', template:'adapter', data:{ adapter: doc } })
}
function exportAccountExcel(items){
  const headers = ['Entry #','Date','Debit','Credit','Description']
  const safeItems = Array.isArray(items) ? items : []
  const data = safeItems.map(e=>({
    [headers[0]]: e.journal.entry_number||'',
    [headers[1]]: e.journal.date||'',
    [headers[2]]: Number(e.debit||0),
    [headers[3]]: Number(e.credit||0),
    [headers[4]]: String((e.journal.description||'').replace(/\n/g,' '))
  }))
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 }
  ]
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 2; c <= 3; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' }
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Account Ledger')
  XLSX.writeFile(wb, 'account_ledger.xlsx')
}
