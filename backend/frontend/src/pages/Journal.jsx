import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import Breadcrumbs from '../ui/Breadcrumbs'
import Toast from '../ui/Toast'
import StatusBadge from '../ui/StatusBadge'
import ActionButton from '../ui/ActionButton'
import JournalEntryCard from '../components/JournalEntryCard'
import { journal as apiJournal, accounts as apiAccounts, settings as apiSettings, debug as apiDebug, periods as apiPeriods, invoices as apiInvoices, orders as apiOrders, supplierInvoices, expenses as apiExpenses, payments as apiPayments } from '../services/api'
import { useAuth } from '../context/AuthContext'
// Charts removed for simplicity - can be re-added if needed
// import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, FileText, Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../ui/Modal'
import { t } from '../utils/i18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { generateReportPDF } from '../printing/pdf/autoReports'

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

function Filters({ filters, onChange, onCreate, accounts, canCreate }) {
  const lang = localStorage.getItem('lang') || 'ar'
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-sm space-y-3">
      {/* الفلاتر الأساسية - صف واحد */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* نوع العملية */}
        <div>
          <label className="text-xs text-gray-600 font-medium">{lang==='ar'?'نوع العملية':'Operation Type'}</label>
          <select value={filters.type || ''} onChange={e => onChange({ ...filters, type: e.target.value, page: 1 })} className="px-3 py-2 border border-gray-200 rounded-lg min-w-44 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            <option value="">{lang==='ar'?'جميع العمليات':'All Operations'}</option>
            <option value="invoice">{lang==='ar'?'فواتير بيع':'Sales Invoices'}</option>
            <option value="supplier_invoice">{lang==='ar'?'فواتير شراء':'Purchase Invoices'}</option>
            <option value="expense_invoice">{lang==='ar'?'مصروفات':'Expenses'}</option>
            <option value="payroll_run">{lang==='ar'?'رواتب':'Payroll'}</option>
            <option value="opening">{lang==='ar'?'أرصدة افتتاحية':'Opening Balances'}</option>
            <option value="manual">{lang==='ar'?'قيود يدوية':'Manual Entries'}</option>
            <option value="reversal">{lang==='ar'?'قيود عكسية':'Reversals'}</option>
          </select>
        </div>
        
        {/* الربع */}
        <div>
          <label className="text-xs text-gray-600 font-medium">{lang==='ar'?'الربع':'Quarter'}</label>
          <select
            value={filters.quarter || ''}
            onChange={e => { const v = e.target.value; try { if (v) localStorage.setItem('selected_quarter', v); else localStorage.removeItem('selected_quarter') } catch {} ; onChange({ ...filters, quarter: v, page: 1 }) }}
            className="px-3 py-2 border border-gray-200 rounded-lg min-w-36 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{lang==='ar'?'كل الفترات':'All Periods'}</option>
            <option value="Q1">{lang==='ar'?'الربع الأول':'Q1 (Jan-Mar)'}</option>
            <option value="Q2">{lang==='ar'?'الربع الثاني':'Q2 (Apr-Jun)'}</option>
            <option value="Q3">{lang==='ar'?'الربع الثالث':'Q3 (Jul-Sep)'}</option>
            <option value="Q4">{lang==='ar'?'الربع الرابع':'Q4 (Oct-Dec)'}</option>
          </select>
        </div>
        
        {/* الحسابات */}
        <div>
          <label className="text-xs text-gray-600 font-medium">{lang==='ar'?'الحساب':'Account'}</label>
          <select 
            value={(filters.account_ids && filters.account_ids.length === 1) ? filters.account_ids[0] : ''} 
            onChange={e => { const v = e.target.value; onChange({ ...filters, account_ids: v ? [v] : [], account_id: '', page: 1 }) }} 
            className="px-3 py-2 border border-gray-200 rounded-lg min-w-52 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{lang==='ar'?'جميع الحسابات':'All Accounts'}</option>
            {(accounts||[]).slice(0, 100).map(a => (
              <option key={a.id} value={String(a.id)}>{a.account_code || a.account_number} • {lang==='ar'?(a.name||''):(a.name_en||a.name||'')}</option>
            ))}
          </select>
        </div>
        
        {/* الحالة */}
        <div>
          <label className="text-xs text-gray-600 font-medium">{lang==='ar'?'الحالة':'Status'}</label>
          <select value={filters.status || ''} onChange={e => onChange({ ...filters, status: e.target.value, page: 1 })} className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            <option value="">{lang==='ar'?'الكل':'All'}</option>
            <option value="draft">{lang==='ar'?'مسودة':'Draft'}</option>
            <option value="posted">{lang==='ar'?'منشور':'Posted'}</option>
            <option value="reversed">{lang==='ar'?'معكوس':'Reversed'}</option>
          </select>
        </div>
        
        {/* البحث */}
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-600 font-medium">{lang==='ar'?'بحث':'Search'}</label>
          <div className="flex gap-2">
            <input
              value={filters.search || ''}
              onChange={e => onChange({ ...filters, search: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') onChange({ ...filters, page: 1 }) }}
              placeholder={lang==='ar'?'رقم القيد أو الوصف...':'Entry # or description...'}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm"
              onClick={() => onChange({ ...filters, page: 1 })}
            ><Search size={16}/></button>
          </div>
        </div>
        
        {/* أزرار */}
        <div className="flex gap-2">
          <button 
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (lang==='ar'?'إخفاء':'Hide') : (lang==='ar'?'متقدم':'Advanced')}
          </button>
          <button 
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            onClick={() => onChange({ status: 'posted', page: 1, pageSize: 20, type: '', quarter: '', account_ids: [], search: '' })}
          >
            {lang==='ar'?'مسح':'Clear'}
          </button>
          {canCreate && (
            <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm" onClick={onCreate}>
              {lang==='ar'?'+ قيد جديد':'+ New Entry'}
            </button>
          )}
        </div>
      </div>
      
      {/* الفلاتر المتقدمة (مخفية افتراضياً) */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-3 items-end pt-3 border-t border-gray-200">
          <div>
            <label className="text-xs text-gray-600">{lang==='ar'?'من':'From'}</label>
            <input type="date" value={filters.from || ''} onChange={e => onChange({ ...filters, from: e.target.value, preset: '' })} className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-gray-600">{lang==='ar'?'إلى':'To'}</label>
            <input type="date" value={filters.to || ''} onChange={e => onChange({ ...filters, to: e.target.value, preset: '' })} className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-gray-600">{lang==='ar'?'رقم القيد':'Entry #'}</label>
            <input inputMode="numeric" value={filters.entry_number || ''} onChange={e => onChange({ ...filters, entry_number: normalizeDigits(e.target.value).replace(/[^0-9]/g,'') })} className="px-3 py-2 border border-gray-200 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">{lang==='ar'?'غير متوازنة فقط':'Unbalanced Only'}</label>
            <input type="checkbox" checked={!!filters.onlyUnbalanced} onChange={e => onChange({ ...filters, onlyUnbalanced: e.target.checked })} className="rounded" />
          </div>
        </div>
      )}
    </div>
  )
}

 

function DraftModal({ open, onClose, onSubmit, initial, accounts, onPost }) {
  const [rows, setRows] = useState(initial?.postings || [{ account_id: '', debit: '', credit: '', notes: '' }])
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0,10))
  const [description, setDescription] = useState(initial?.description || '')
  const [query, setQuery] = useState('')
  const flatAccounts = (accounts||[])
  const filtered = flatAccounts.filter(a => (a.name||'').toLowerCase().includes(query.toLowerCase()) || String(a.account_code||a.account_number).includes(query))
  const safeRows = Array.isArray(rows) ? rows : []
  const totalDebit = safeRows.reduce((s, r) => s + parseFloat(r.debit || 0), 0)
  const totalCredit = safeRows.reduce((s, r) => s + parseFloat(r.credit || 0), 0)
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-2xl rounded-2xl border border-gray-200 shadow-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">{((localStorage.getItem('lang')||'ar')==='ar')?'إنشاء/تعديل مسودة قيد':'Create/Edit Draft Entry'}</div>
          <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={onClose}>{t('labels.close')}</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-600">{t('labels.date')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-gray-600">{t('labels.description')}</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>
        </div>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
          {(Array.isArray(rows) ? rows : []).map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('labels.account_search')} className="px-3 py-2 border border-gray-200 rounded-lg w-full mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                <select value={r.account_id} onChange={e => { const copy = [...rows]; copy[i] = { ...copy[i], account_id: e.target.value }; setRows(copy) }} className="px-3 py-2 border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">{t('labels.select_account')}</option>
                  {filtered.map(a => (
                    <option key={a.id} value={a.id}>{a.account_code || a.account_number} • {((localStorage.getItem('lang')||'ar')==='ar'?(a.name||''):(a.name_en||a.name||''))}</option>
                  ))}
                </select>
              </div>
              <input inputMode="decimal" lang="en" dir="ltr" placeholder={t('labels.debit')} value={r.debit} onChange={e => { const v = sanitizeDecimal(e.target.value); const copy = [...rows]; copy[i] = { ...copy[i], debit: v }; setRows(copy) }} className="px-3 py-2 border border-gray-200 rounded-lg col-span-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              <input inputMode="decimal" lang="en" dir="ltr" placeholder={t('labels.credit')} value={r.credit} onChange={e => { const v = sanitizeDecimal(e.target.value); const copy = [...rows]; copy[i] = { ...copy[i], credit: v }; setRows(copy) }} className="px-3 py-2 border border-gray-200 rounded-lg col-span-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              <input placeholder={t('labels.notes')} value={r.notes || ''} onChange={e => { const copy = [...rows]; copy[i] = { ...copy[i], notes: e.target.value }; setRows(copy) }} className="px-3 py-2 border border-gray-200 rounded-lg col-span-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </motion.div>
          ))}
          </AnimatePresence>
      <div className="flex gap-2">
        <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={() => setRows([...rows, { account_id: '', debit: '', credit: '', notes: '' }])}>{t('labels.add_row')}</button>
        <div className="text-sm text-gray-700">{t('labels.totals')} — {t('labels.debit')}: {totalDebit.toFixed(2)} • {t('labels.credit')}: {totalCredit.toFixed(2)}</div>
        {Math.abs(totalDebit-totalCredit)>0.0001 && (
          <div className="text-xs px-2 py-1 bg-rose-100 text-rose-800 rounded">{t('labels.unbalanced_diff_prefix')} {Math.abs(totalDebit-totalCredit).toFixed(2)}</div>
        )}
      </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button id="save-draft-btn" className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" onClick={() => onSubmit({ date, description, postings: rows })}>{t('labels.save_draft')}</button>
          {initial?.status==='draft' && totalDebit>0 && Math.abs(totalDebit-totalCredit)<0.0001 && (
            <button className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" onClick={() => onPost(initial)}>{t('labels.post')}</button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function Journal() {
  const navigate = useNavigate()
  const location = useLocation()
  // CRITICAL: Get auth state to prevent API calls before auth is ready
  const { loading: authLoading, isLoggedIn, can } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')
  const [filters, setFilters] = useState({ status: 'posted', page: 1, pageSize: 20, summary: false, quarter: localStorage.getItem('selected_quarter') || '' })
  const [data, setData] = useState({ items: [], total: 0 })
  const [selected, setSelected] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [accounts, setAccounts] = useState([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [periodStatus, setPeriodStatus] = useState('open')
  const [helpOpen, setHelpOpen] = useState(false)
  const [relatedInvoice, setRelatedInvoice] = useState(null)
  const [orderMeta, setOrderMeta] = useState(null)
  const [relatedSupplierInvoice, setRelatedSupplierInvoice] = useState(null)
  const [relatedExpense, setRelatedExpense] = useState(null)
  const [relatedPayment, setRelatedPayment] = useState(null)
  useEffect(() => {
    function onKey(e){
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (modalOpen) document.getElementById('save-draft-btn')?.click() }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); if (selected && selected.status==='draft') postEntry(selected) }
      if (e.key === 'Escape') { if (modalOpen) setModalOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, selected])

  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar'); if (e.key==='selected_quarter') setFilters(prev => ({ ...prev, quarter: e.newValue || '' })) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const [error, setError] = useState('')
  
  async function load() {
    setError('')
    try {
      const params = {
        status: filters.status || '',
        page: filters.page || 1,
        pageSize: filters.pageSize || 20,
        from: filters.preset ? '' : (filters.from || ''),
        to: filters.preset ? '' : (filters.to || ''),
        preset: filters.preset || '',
        type: filters.type || '',
        source: filters.source || '',
        reference_prefix: filters.reference || '',
        search: filters.search || '',
        account_id: (filters.account_ids && filters.account_ids.length) ? '' : (filters.account_id || ''),
        account_ids: (filters.account_ids && filters.account_ids.length) ? String(filters.account_ids.join(',')) : '',
        accounts_scope: filters.accounts_scope || '',
        min_amount: filters.minAmount || '',
        max_amount: filters.maxAmount || '',
        outliersOnly: filters.outliersOnly ? 'true' : '',
        outliers_threshold: filters.outliers_threshold || '',
        unbalancedOnly: filters.onlyUnbalanced ? 'true' : '',
        summary: filters.summary ? 'true' : '',
        period: filters.period || '',
        quarter: filters.quarter || ''
      }
      const res = await apiJournal.list(params)
      setData(res || { items: [], total: 0 })
    } catch (e) {
      if (e?.status === 403) {
        setError(lang === 'ar' ? 'ليس لديك صلاحية لعرض هذه الشاشة' : 'You do not have permission to view this screen')
      } else {
        setError(lang === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data')
      }
      setData({ items: [], total: 0 })
    }
  }
  useEffect(() => { 
    // CRITICAL: Don't make API calls until auth is ready
    if (authLoading || !isLoggedIn) {
      console.log('[Journal] Waiting for auth before loading data...');
      return;
    }
    load() 
  }, [filters, authLoading, isLoggedIn])
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search)
      const eid = q.get('entry')
      if (eid) {
        (async()=>{ try { const one = await apiJournal.get(eid); setSelected(one) } catch {} })()
      }
    } catch {}
  }, [location.search])
  useEffect(() => {
    (async()=>{
      try {
        setRelatedInvoice(null)
        setOrderMeta(null)
        setRelatedSupplierInvoice(null)
        setRelatedExpense(null)
        setRelatedPayment(null)
        
        if (selected && selected.related_id) {
          const relatedType = selected.related_type
          const relatedId = selected.related_id
          
          // Load data based on related_type
          if (relatedType === 'invoice') {
            try {
              const inv = await apiInvoices.get(relatedId)
              const invoiceData = inv?.invoice || inv || null
              setRelatedInvoice(invoiceData)
              // Try to get order data if available
              const ordId = (invoiceData?.order_id || null)
              if (ordId) {
                try {
                  const ord = await apiOrders.get(ordId)
                  const arr = (function(){ try { return JSON.parse(ord?.order?.lines||ord?.lines||'[]')||[] } catch { return [] } })()
                  const meta = arr.find(x => x && x.type==='meta') || null
                  setOrderMeta(meta)
                } catch (orderErr) {
                  console.warn('[Journal] Could not load order data:', orderErr)
                  setOrderMeta(null)
                }
              } else {
                setOrderMeta(null)
              }
            } catch (invErr) {
              console.warn('[Journal] Could not load invoice data:', invErr)
              setRelatedInvoice(null)
            }
          } else if (relatedType === 'supplier_invoice') {
            try {
              const supInv = await supplierInvoices.get(relatedId)
              const supplierInvoiceData = supInv?.invoice || supInv || null
              setRelatedSupplierInvoice(supplierInvoiceData)
            } catch (supInvErr) {
              console.warn('[Journal] Could not load supplier invoice data:', supInvErr)
              setRelatedSupplierInvoice(null)
            }
          } else if (relatedType === 'expense_invoice') {
            try {
              const exp = await apiExpenses.get(relatedId)
              const expenseData = exp?.expense || exp || null
              setRelatedExpense(expenseData)
            } catch (expErr) {
              console.warn('[Journal] Could not load expense data:', expErr)
              setRelatedExpense(null)
            }
          } else if (relatedType === 'payment') {
            try {
              // Payments might be stored as invoices with type='payment'
              const pay = await apiInvoices.get(relatedId).catch(() => null)
              if (pay) {
                setRelatedPayment(pay?.invoice || pay || null)
              }
            } catch (payErr) {
              console.warn('[Journal] Could not load payment data:', payErr)
              setRelatedPayment(null)
            }
          }
        }
      } catch (err) {
        console.warn('[Journal] Error loading related data:', err)
        setRelatedInvoice(null)
        setOrderMeta(null)
        setRelatedSupplierInvoice(null)
        setRelatedExpense(null)
        setRelatedPayment(null)
      }
    })()
  }, [selected])
  useEffect(() => {
    (async()=>{
      try {
        const d = new Date()
        const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const s = await apiPeriods.get(per)
        setPeriodStatus(String(s?.status||'open'))
      } catch {}
    })()
  }, [])
  const [readonlyDays, setReadonlyDays] = useState(0)
  useEffect(() => {
    (async()=>{
      try {
        const v = await apiSettings.get('journal_readonly_days')
        const days = parseInt(String(v?.value||v||'0'), 10) || 0
        setReadonlyDays(days)
      } catch {}
    })()
  }, [])
  function isReadOnly(e){
    try {
      if (!e || String(e.status||'')!=='posted') return false
      const days = readonlyDays
      if (!days) return false
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
      const postedAt = e.posted_at ? new Date(e.posted_at) : (e.date ? new Date(e.date) : null)
      if (!postedAt) return false
      return postedAt < cutoff
    } catch { return false }
  }
  useEffect(() => {
    async function loadAccounts(){
      try {
        const tree = await apiAccounts.tree()
        const list = []
        function flat(nodes){ (nodes||[]).forEach(n=>{ list.push(n); if(n.children?.length) flat(n.children) }) }
        flat(tree)
        setAccounts(list)
      } catch (e) {
        setAccounts([])
      }
    }
    loadAccounts()
  }, [])

  async function createDraft() {
    const canCreate = can('journal.create')
    if (!canCreate) { setToast(lang==='ar'?'ليست لديك صلاحية إنشاء قيد':'No permission to create entry'); return }
    setModalOpen(true)
  }

  async function saveDraft(body) {
    try {
      const canCreate = can('journal.create')
      if (!canCreate) { setToast(lang==='ar'?'ليست لديك صلاحية حفظ المسودة':'No permission to save draft'); return }
      if (selected && selected.status === 'draft') {
        await apiJournal.update(selected.id, body)
      } else {
        await apiJournal.create(body)
      }
      setModalOpen(false)
      await load()
      setToast('تم حفظ المسودة')
    } catch (e) {
      setToast('فشل حفظ المسودة')
    }
  }

  async function postEntry(e) {
    try {
      const canPost = can('journal.post')
      if (!canPost) { setToast(lang==='ar'?'ليست لديك صلاحية النشر':'No permission to post'); return }
      await apiJournal.postEntry(e.id)
      await load()
      setToast('تم نشر القيد')
    } catch (err) {
      setToast('فشل نشر القيد (قد لا يكون متوازن)')
    }
  }

  async function reverseEntry(e) {
    try {
      const canReverse = can('journal.reverse')
      if (!canReverse) { setToast(lang==='ar'?'ليست لديك صلاحية العكس':'No permission to reverse'); return }
      await apiJournal.reverse(e.id)
      await load()
      setToast('تم إنشاء قيد عكسي')
    } catch (err) {
      setToast('فشل عكس القيد')
    }
  }

  async function returnToDraft(e) {
    try {
      const canEdit = can('journal.edit')
      if (!canEdit) { setToast(lang==='ar'?'ليست لديك صلاحية إرجاع كمسودة':'No permission to return to draft'); return }
      await apiJournal.returnToDraft(e.id)
      await load()
      setToast('تم إرجاع القيد كمسودة')
    } catch (err) {
      setToast('فشل إرجاع القيد كمسودة')
    }
  }

  async function deleteEntry(e) {
    setDeleteTarget(e)
    setDeleteOpen(true)
  }

  const visibleItems = (function(){
    const items = Array.isArray(data.items) ? [...data.items] : []
    const en = String(filters.entry_number||'').trim()
    const minA = parseFloat(filters.minAmount||'')
    const maxA = parseFloat(filters.maxAmount||'')
    const onlyUnb = !!filters.onlyUnbalanced
    function amountOf(i){ const d=parseFloat(i.debit||0), c=parseFloat(i.credit||0); return Math.max(d,c) }
    let out = items.filter(i => {
      if (en && String(i.entry_number||'') !== en) return false
      const amt = amountOf(i)
      if (!isNaN(minA) && String(filters.minAmount||'')!=='' && amt < minA) return false
      if (!isNaN(maxA) && String(filters.maxAmount||'')!=='' && amt > maxA) return false
      if (onlyUnb && Math.abs(parseFloat(i.debit||0) - parseFloat(i.credit||0)) < 0.0001) return false
      return true
    })
    const s = String(filters.sort||'date_desc')
    out.sort((a,b)=>{
      if (s==='date_asc') return String(a.date||'').localeCompare(String(b.date||''))
      if (s==='date_desc') return String(b.date||'').localeCompare(String(a.date||''))
      if (s==='amt_asc') return amountOf(a) - amountOf(b)
      if (s==='amt_desc') return amountOf(b) - amountOf(a)
      return 0
    })
    return out
  })()

  const canJournalCreate = can('journal.create')
  const canJournalPost = can('journal.post')
  const canJournalReverse = can('journal.reverse')
  const canJournalDelete = can('journal.delete')
  const canJournalReturn = can('journal.edit')
 
  async function loadMore(){
    try {
      const next = Number(filters.page||1) + 1
      const params = {
        status: filters.status || '',
        page: next,
        pageSize: filters.pageSize || 20,
        from: filters.preset ? '' : (filters.from || ''),
        to: filters.preset ? '' : (filters.to || ''),
        preset: filters.preset || '',
        type: filters.type || '',
        source: filters.source || '',
        reference_prefix: filters.reference || '',
        search: filters.search || '',
        account_id: (filters.account_ids && filters.account_ids.length) ? '' : (filters.account_id || ''),
        account_ids: (filters.account_ids && filters.account_ids.length) ? String(filters.account_ids.join(',')) : '',
        accounts_scope: filters.accounts_scope || '',
        min_amount: filters.minAmount || '',
        max_amount: filters.maxAmount || '',
        outliersOnly: filters.outliersOnly ? 'true' : '',
        outliers_threshold: filters.outliers_threshold || '',
        unbalancedOnly: filters.onlyUnbalanced ? 'true' : '',
        summary: filters.summary ? 'true' : '',
        period: filters.period || '',
        quarter: filters.quarter || ''
      }
      const res = await apiJournal.list(params)
      const merged = Array.isArray(data.items) ? data.items.concat(res.items||[]) : (res.items||[])
      setData({ ...res, items: merged })
      setFilters({ ...filters, page: next })
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white" dir="rtl">
      <Breadcrumbs items={[{ label:t('labels.home'), to:'/' }, { label:t('titles.journal') }]} />
      <PageHeader
        icon={FileText}
        title={t('titles.journal', lang)}
        subtitle={lang === 'ar' ? 'مصدر الحقيقة الوحيد للعمليات المالية' : 'Single Source of Truth for Financial Transactions'}
        onHomeClick={() => navigate('/')}
        homeLabel={t('labels.home', lang)}
        actions={[
          (<button key="reload" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={load}>{lang === 'ar' ? 'تحديث' : 'Refresh'}</button>),
          (<button key="xlsx" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20" onClick={() => exportExcel(visibleItems)}>Excel</button>),
          (<span key="period" className="px-2 py-1 bg-white/10 text-white rounded-lg border border-white/20"><StatusBadge status={periodStatus} type="period" /></span>),
        ]}
      />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-3">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <div className="font-semibold">{error}</div>
          </div>
        ) : null}
        <Filters filters={filters} onChange={setFilters} onCreate={createDraft} accounts={accounts} canCreate={canJournalCreate} />
        
        {/* ملخص سريع */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border">
            <TrendingUp className="text-blue-600" size={16}/>
            <span className="text-gray-600">{lang==='ar'?'مدين:':'Debit:'}</span>
            <span className="font-bold text-blue-700">{sumDebit(visibleItems).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border">
            <TrendingDown className="text-red-600" size={16}/>
            <span className="text-gray-600">{lang==='ar'?'دائن:':'Credit:'}</span>
            <span className="font-bold text-red-700">{sumCredit(visibleItems).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border">
            <FileText className="text-gray-600" size={16}/>
            <span className="text-gray-600">{lang==='ar'?'عدد القيود:':'Entries:'}</span>
            <span className="font-bold text-gray-700">{visibleItems.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 space-y-2">
            <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-3 py-2 text-right">{t('labels.entry_number', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.date', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.description', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.debit', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.credit', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.status', lang)}</th>
                    <th className="px-3 py-2 text-right">{t('labels.actions', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {(filters.summary ? (data.items||[]) : visibleItems).map(e => (
                    <tr key={e.id ?? e.date} className={`${selected?.id===e.id?'bg-primary-50':''} ${(!filters.summary && isUnbalanced(e))?'bg-rose-50':''} border-t`}>
                      {filters.summary ? (
                        <>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">{e.date}</td>
                          <td className="px-3 py-2">{(localStorage.getItem('lang')||'ar')==='ar'?'عدد القيود':'Entries'}: {e.count}</td>
                          <td className="px-3 py-2 text-blue-700">{parseFloat(e.total||0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-red-700">—</td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1 justify-end">
                              <button className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded" onClick={()=> setFilters({ ...filters, summary: false, from: e.date, to: e.date, page: 1 })}>{(localStorage.getItem('lang')||'ar')==='ar'?'عرض التفاصيل':'View Details'}</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">#{e.entry_number ?? '—'}</td>
                          <td className="px-3 py-2">{e.date}</td>
                          <td className="px-3 py-2">{e.description}</td>
                          <td className="px-3 py-2 text-blue-700">{parseFloat(e.total_debit||e.debit||0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-red-700">{parseFloat(e.total_credit||e.credit||0).toFixed(2)}</td>
                          <td className="px-3 py-2"><StatusBadge status={e.status} /></td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end">
                              <select defaultValue="" onChange={(ev)=>{
                                const v = ev.target.value; ev.target.value='';
                                if (v==='view') setSelected(e)
                                else if (v==='post') postEntry(e)
                                else if (v==='draft') returnToDraft(e)
                                else if (v==='reverse') reverseEntry(e)
                                else if (v==='edit') { setSelected(e); setModalOpen(true) }
                                else if (v==='delete') deleteEntry(e)
                              }} className="px-2.5 py-1.5 border rounded bg-white">
                                <option value="" disabled>{(localStorage.getItem('lang')||'ar')==='ar'?'إجراءات':'Actions'}</option>
                                <option value="view">{t('labels.view', lang)}</option>
                                {e.status==='draft' && canJournalPost && !isUnbalanced(e) ? (<option value="post">{t('labels.post', lang)}</option>) : null}
                                {e.status==='posted' && canJournalReturn && !isReadOnly(e) ? (<option value="draft">{lang==='ar'?'إرجاع لمسودة':'Draft'}</option>) : null}
                                {e.status==='posted' && canJournalReverse && !isReadOnly(e) ? (<option value="reverse">{t('labels.reverse', lang)}</option>) : null}
                                {e.status==='draft' && canJournalCreate ? (<option value="edit">{t('labels.edit', lang)}</option>) : null}
                                {e.status==='draft' && (canJournalDelete || canJournalCreate) ? (<option value="delete">{t('labels.delete', lang)}</option>) : null}
                              </select>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!(filters.summary ? (data.items||[]).length : visibleItems.length) && <div className="text-gray-500">{t('labels.no_data', lang)}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button className="px-2 py-1 bg-gray-100 rounded" disabled={filters.page<=1} onClick={()=> setFilters({ ...filters, page: Math.max(1, Number(filters.page||1)-1) })}>{lang==='ar'?'السابق':'Previous'}</button>
              <div className="text-sm text-gray-600">{lang==='ar'?'صفحة':'Page'} {filters.page}</div>
              <button className="px-2 py-1 bg-gray-100 rounded" onClick={()=> setFilters({ ...filters, page: Number(filters.page||1)+1 })}>{lang==='ar'?'التالي':'Next'}</button>
              <select value={filters.pageSize} onChange={e=> setFilters({ ...filters, pageSize: Number(e.target.value) })} className="px-2 py-1 border rounded">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              {!filters.summary && (
                <button className="px-2 py-1 bg-primary-600 text-white rounded" onClick={loadMore}>{(localStorage.getItem('lang')||'ar')==='ar'?'تحميل المزيد':'Load More'}</button>
              )}
            </div>
          </section>
          <section className="lg:col-span-5">
            {selected ? (
              <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-lg font-bold">قيد #{selected.entry_number ?? '—'} • {selected.date}</div>
                    <div className="text-sm text-gray-500">{selected.description}</div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-700">
                    {selected.related_type && selected.related_id ? (
                      <div className="flex items-center gap-2">
                        <span>نوع: {operationTypeOf(selected, relatedInvoice || relatedSupplierInvoice || relatedExpense || relatedPayment)}</span>
                        {(selected.related_type==='invoice' || selected.related_type==='supplier_invoice' || selected.related_type==='expense_invoice') && (
                          <button className="px-2 py-1 border rounded text-primary-700 hover:bg-primary-50" onClick={()=>{ 
                            const url = selected.related_type==='supplier_invoice' 
                              ? `/supplier-invoices/${selected.related_id}` 
                              : selected.related_type==='expense_invoice'
                              ? `/expenses/${selected.related_id}`
                              : `/api/preview/invoice/${selected.related_id}`;
                            window.open(url, '_blank') 
                          }}>
                            {selected.related_type==='supplier_invoice' ? 'معاينة فاتورة المورد' : selected.related_type==='expense_invoice' ? 'معاينة المصروف' : `معاينة الفاتورة #${selected.related_id}`}
                          </button>
                        )}
                        {selected.related_type==='payment' && (
                          <button className="px-2 py-1 border rounded text-primary-700 hover:bg-primary-50" onClick={()=>{ 
                            window.open(`/payments?invoice_id=${selected.related_id}`, '_blank') 
                          }}>
                            معاينة الدفع
                          </button>
                        )}
                      </div>
                    ) : (
                      <span>نوع: يدوي</span>
                    )}
                    {(selected.related_type && selected.related_id) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border">طريقة الدفع: {paymentTypeText(relatedInvoice || relatedSupplierInvoice || relatedExpense || relatedPayment, orderMeta, selected)}</span>
                        {selected.related_type==='invoice' && relatedInvoice && (
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded border">الخصم: {formatAmount(discountAmountOf(selected, relatedInvoice))} {discountPctOf(selected, relatedInvoice, orderMeta)}</span>
                        )}
                        {selected.related_type==='supplier_invoice' && relatedSupplierInvoice && Number(relatedSupplierInvoice.discount_amount || relatedSupplierInvoice.discount_total || 0) > 0 && (
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded border">الخصم: {formatAmount(relatedSupplierInvoice.discount_amount || relatedSupplierInvoice.discount_total || 0)} SAR</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.status==='draft' && (
                      <ActionButton action={'journal.create'} disabledWhenClosed periodStatus={periodStatus} className="px-3 py-1.5 border rounded" onClick={()=> setModalOpen(true)}>
                        {t('labels.edit', lang)}
                      </ActionButton>
                    )}
                    {selected.status==='draft' && (
                      <ActionButton action={'journal.post'} disabledWhenClosed periodStatus={periodStatus} className="px-3 py-1.5 bg-green-600 text-white rounded" onClick={()=> postEntry(selected)}>
                        {t('labels.post', lang)}
                      </ActionButton>
                    )}
                    {selected.status==='posted' && (
                      <ActionButton action={'journal.reverse'} disabledWhenClosed periodStatus={periodStatus} className="px-3 py-1.5 bg-red-600 text-white rounded" onClick={()=> reverseEntry(selected)}>
                        {t('labels.reverse', lang)}
                      </ActionButton>
                    )}
                    {selected.status==='posted' && (
                      <ActionButton action={'journal.edit'} disabledWhenClosed periodStatus={periodStatus} className="px-3 py-1.5 bg-yellow-500 text-white rounded" onClick={()=> { setReturnTarget(selected); setReturnOpen(true) }}>
                        {t('labels.draft', lang)}
                      </ActionButton>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        <th className="px-3 py-2 text-right">{t('labels.account', lang)}</th>
                        <th className="px-3 py-2 text-right">{t('labels.debit', lang)}</th>
                        <th className="px-3 py-2 text-right">{t('labels.credit', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.postings||[]).map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2">{p.account ? `${p.account.account_code} • ${lang==='ar'?(p.account.name||''): (p.account.name_en||p.account.name||'')}` : (lang==='ar'?`حساب #${p.account_id}`:`Account #${p.account_id}`)}</td>
                          <td className="px-3 py-2 text-blue-700">{parseFloat(p.debit||0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-red-700">{parseFloat(p.credit||0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* معلومات مختصرة */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">{operationTypeOf(selected, relatedInvoice || relatedSupplierInvoice || relatedExpense || relatedPayment)}</span>
                  {selected.branch && <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">{selected.branch}</span>}
                  {selected.period && <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">{selected.period}</span>}
                </div>
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-center text-gray-500 py-8">
                  <FileText className="mx-auto text-gray-300 mb-3" size={48}/>
                  <div>{lang==='ar'?'اختر قيداً من الجدول لعرض تفاصيله':'Select an entry from the table to view details'}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <DraftModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={saveDraft} initial={selected?.status==='draft'?selected:null} accounts={accounts} onPost={postEntry} />
      {returnOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-md rounded-2xl border border-gray-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">تأكيد تحويل القيد إلى مسودة</div>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>setReturnOpen(false)}>إغلاق</button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">سيتم إلغاء الأثر المحاسبي وستعود العملية المرتبطة إلى مسودة.</div>
              <div>
                <label className="text-xs text-gray-600">سبب</label>
                <input value={returnReason} onChange={e=> setReturnReason(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 rounded border" onClick={()=>setReturnOpen(false)}>إلغاء</button>
                <button className={`px-3 py-2 ${returnReason.trim()? 'bg-yellow-500 hover:bg-yellow-600 text-white':'bg-yellow-200 text-yellow-600 cursor-not-allowed'} rounded`} disabled={!returnReason.trim()} onClick={async()=>{ try { await apiJournal.returnToDraft(returnTarget.id); await load(); setToast('تم إرجاع القيد كمسودة'); } catch { setToast('فشل إرجاع القيد كمسودة') } finally { setReturnOpen(false) } }}>تأكيد التحويل</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-md rounded-2xl border border-gray-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">{lang==='ar'?'تأكيد الحذف':'Confirm Delete'}</div>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>setDeleteOpen(false)}>{lang==='ar'?'إغلاق':'Close'}</button>
            </div>
            {deleteTarget?.status==='posted' ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-700">{lang==='ar'?'لا يمكن حذف القيد المنشور مباشرة. قم بإرجاعه لمسودة أولاً ثم احذفه.':'Cannot delete a posted entry directly. Return to draft first, then delete.'}</div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 rounded border" onClick={()=>setDeleteOpen(false)}>{lang==='ar'?'حسناً':'OK'}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-700">{lang==='ar'?'سيتم حذف المسودة':'Draft will be deleted'}</div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 rounded border" onClick={()=>setDeleteOpen(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
                  <button className={`px-3 py-2 ${((canJournalDelete||canJournalCreate)?'bg-rose-600 hover:bg-rose-700 text-white':'bg-rose-200 text-rose-500 cursor-not-allowed')} rounded`} disabled={!(canJournalDelete||canJournalCreate)} onClick={async()=>{ if (!(canJournalDelete||canJournalCreate)) { setToast(lang==='ar'?'ليست لديك صلاحية حذف المسودات':'No permission to delete drafts'); return } try { await apiJournal.remove(deleteTarget.id, { reason: 'user_delete' }); await load(); setToast(lang==='ar'?'تم حذف المسودة':'Draft deleted'); } catch { setToast(lang==='ar'?'الحذف مسموح للمسودات فقط':'Delete allowed for drafts only') } finally { setDeleteOpen(false) } }}>{lang==='ar'?'حذف':'Delete'}</button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
      {toast && (<Toast type="info" message={toast} onClose={()=> setToast('')} />)}
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{t('titles.journal', lang)}</div>
      </Modal>
    </div>
  )
}

function sumDebit(items){ return items.reduce((s,x)=> s + parseFloat(x.total_debit||x.debit||0), 0) }
function sumCredit(items){ return items.reduce((s,x)=> s + parseFloat(x.total_credit||x.credit||0), 0) }
function countStatus(items, status){ return items.filter(i=> i.status===status).length }

function formatDiscount(entry){
  try {
    const invDisc = parseFloat(entry?.discount_total||0)
    const postingsDisc = (entry?.postings||[])
      .filter(p=> String(p?.account?.account_code||'')==='4190')
      .reduce((s,p)=> s + parseFloat(p.debit||0), 0)
    const val = Math.max(invDisc, postingsDisc)
    return isFinite(val) ? val.toFixed(2) : '—'
  } catch { return '—' }
}

function formatAmount(v){ const n = parseFloat(v||0); return isFinite(n) ? n.toFixed(2) : '0.00' }
function netSalesOf(inv){ try { const t=parseFloat(inv?.total||0), tax=parseFloat(inv?.tax||0), disc=parseFloat(inv?.discount_total||0); const n=Math.max(0, t - tax - disc); return n } catch { return 0 } }

function netSalesOfEntry(entry){ try { const revCodes=new Set(['4100','4130','4140']); return (entry?.postings||[]).filter(p=> revCodes.has(String(p?.account?.account_code||''))).reduce((s,p)=> s + parseFloat(p.credit||0), 0) } catch { return 0 } }
function vatOfEntry(entry, inv){ try { 
  // Try to get VAT from invoice/expense/supplier invoice
  const fromInv = parseFloat(inv?.tax_amount||inv?.tax||inv?.vat_amount||0); 
  if (fromInv>0) return fromInv; 
  // Try to get from postings (VAT accounts: 2141, 2150)
  return (entry?.postings||[]).filter(p=> ['2141','2150'].includes(String(p?.account?.account_code||''))).reduce((s,p)=> s + parseFloat(p.credit||0), 0) 
} catch { return 0 } }
function discountAmountOf(entry, inv){ try { 
  // Try to get discount from invoice/expense/supplier invoice
  const invD = parseFloat(inv?.discount_total||inv?.discount_amount||0); 
  // Try to get from postings (discount account: 4190)
  const postD = (entry?.postings||[]).filter(p=> String(p?.account?.account_code||'')==='4190').reduce((s,p)=> s + parseFloat(p.debit||0), 0); 
  return Math.max(invD, postD) 
} catch { return 0 } }
function branchNameOf(entry, inv, meta){ try { 
  const map={ china_town:'China Town', place_india:'Place India' }; 
  // Try entry.branch first (most reliable)
  const entryBranch = String(entry?.branch||'').toLowerCase();
  if (map[entryBranch]) return map[entryBranch];
  // Try invoice/expense/supplier invoice branch
  const b1=String(inv?.branch||'').toLowerCase(); if (map[b1]) return map[b1]; 
  // Try order meta branch
  const b2=String(meta?.branch||'').toLowerCase(); if (map[b2]) return map[b2]; 
  // Try to infer from account codes in postings
  const rev = (entry?.postings||[]).find(p=> ['4130','4140'].includes(String(p?.account?.account_code||''))); 
  if (rev) return String(rev?.account?.name_en||rev?.account?.name||'').replace(/^.*?\s+/,'').trim() || (rev.account.account_code==='4140'?'China Town':'Place India'); 
  return '—' 
} catch { return '—' } }
function paymentMethodOf(entry, inv){ try { const pm = String(inv?.payment_method||'').toLowerCase(); if (pm==='cash') return 'نقد'; if (pm==='card') return 'بطاقة'; if (pm==='bank' || pm==='transfer') return 'تحويل بنكي'; const hasAR = (entry?.postings||[]).some(p=> String(p?.account?.account_code||'')==='1210' && parseFloat(p.debit||0)>0); const hasCash = (entry?.postings||[]).some(p=> String(p?.account?.account_code||'')==='1110' && parseFloat(p.debit||0)>0); const hasBank = (entry?.postings||[]).some(p=> String(p?.account?.account_code||'')==='1010' && parseFloat(p.debit||0)>0); if (hasAR) return 'أجل'; if (hasCash) return 'نقد'; if (hasBank) return 'بنك'; return '—' } catch { return '—' } }
function discountPctOf(entry, inv, meta){ try { const fromInv = Number(inv?.discount_rate ?? inv?.discount_pct ?? inv?.discountPercent ?? 0); if (fromInv>0) return `(${fromInv.toFixed(0)}%)`; const pct = Number(meta?.discountPct||0); if (pct>0) return `(${pct.toFixed(0)}%)`; const disc = discountAmountOf(entry, inv); const net = netSalesOfEntry(entry); if (net>0 && disc>0) return `(${(disc/net*100).toFixed(0)}%)`; return '' } catch { return '' } }

function paymentTypeText(inv, meta, entry){ try { 
  const lines = (Array.isArray(meta?.payLines)?meta.payLines:(Array.isArray(inv?.pay_lines)?inv.pay_lines:(Array.isArray(inv?.payLines)?inv.payLines:[]))); 
  if (lines.length>0) { 
    const set = new Set(lines.map(l=> String(l.method||'').toLowerCase())); 
    const parts = []; 
    if (set.has('card')) parts.push('بطاقة'); 
    if (set.has('cash')) parts.push('نقدًا'); 
    if (parts.length) return parts.join(' + '); 
  } 
  const pmRaw = String(inv?.payment_method||inv?.payment_type||'').toLowerCase(); 
  if (pmRaw==='credit' || pmRaw==='deferred' || pmRaw==='ar') return 'ذمم مدينة'; 
  if (pmRaw==='cash') return 'نقدًا'; 
  if (pmRaw==='card') return 'بطاقة'; 
  if (pmRaw==='bank') return 'بنك'; 
  // Check postings for payment method indicators
  const hasAR = (entry?.postings||[]).some(p=> String(p?.account?.account_code||'')==='1210' && parseFloat(p.debit||0)>0); 
  const hasAP = (entry?.postings||[]).some(p=> String(p?.account?.account_code||'')==='2410' && parseFloat(p.debit||0)>0); 
  if (hasAR) return 'ذمم مدينة'; 
  if (hasAP) return 'ذمم دائنة'; 
  return '—' 
} catch { return '—' } }

function exportCSV(items){
  const lang = localStorage.getItem('lang') || 'ar'
  const header = [
    lang==='ar'?'رقم القيد':'Entry #',
    lang==='ar'?'التاريخ':'Date',
    lang==='ar'?'الحالة':'Status',
    lang==='ar'?'مدين':'Debit',
    lang==='ar'?'دائن':'Credit',
    lang==='ar'?'الوصف':'Description'
  ]
  const rows = items.map(i => [
    i.entry_number||'',
    i.date||'',
    i.status||'',
    parseFloat(i.debit||0),
    parseFloat(i.credit||0),
    (i.description||'').replace(/\n/g,' ')
  ])
  
  const csvContent = [
    header.join(','),
    ...(Array.isArray(rows) ? rows : []).map(r => (Array.isArray(r) ? r : []).map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', 'journal.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportExcel(items){
  const lang = localStorage.getItem('lang') || 'ar'
  const rows = items.map(i=>({
    [lang==='ar'?'رقم القيد':'Entry #']: i.entry_number||'',
    [lang==='ar'?'التاريخ':'Date']: i.date||'',
    [lang==='ar'?'الحالة':'Status']: i.status||'',
    [lang==='ar'?'مدين':'Debit']: parseFloat(i.debit||0),
    [lang==='ar'?'دائن':'Credit']: parseFloat(i.credit||0),
    [lang==='ar'?'الوصف':'Description']: (i.description||'').replace(/\n/g,' ')
  }))
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws1, lang==='ar'?'القيود':'Entries')
  
  const postingRows = []
  items.forEach(i=>{
    (i.postings||[]).forEach(p=>{
      postingRows.push({
         [lang==='ar'?'رقم القيد':'Entry #']: i.entry_number||'',
         [lang==='ar'?'معرف الحساب':'Account ID']: p.account_id,
         [lang==='ar'?'اسم الحساب':'Account Name']: p.account ? (lang==='ar' ? (p.account.name||'') : (p.account.name_en||p.account.name||'')) : '',
         [lang==='ar'?'مدين':'Debit']: parseFloat(p.debit||0),
         [lang==='ar'?'دائن':'Credit']: parseFloat(p.credit||0),
         [lang==='ar'?'ملاحظات':'Notes']: p.notes||''
      })
    })
  })
  if (postingRows.length) {
    const ws2 = XLSX.utils.json_to_sheet(postingRows)
    XLSX.utils.book_append_sheet(wb, ws2, lang==='ar'?'التفاصيل':'Postings')
  }
  XLSX.writeFile(wb, 'journal.xlsx')
}
function operationTypeOf(entry, inv){
  try {
    const rt = String(entry?.related_type||'')
    if (rt==='invoice') return 'بيع'
    if (rt==='supplier_invoice') return 'مورد'
    if (rt==='expense_invoice') {
      const et = String(inv?.expense_type||'expense')
      if (et==='withdraw') return 'سحب'
      if (et==='deposit') return 'إيداع'
      if (et==='payment') return 'سداد'
      const posts = entry?.postings||[]
      const isBankDebit = posts.some(p=> String(p?.account?.account_code||'')==='1010' && parseFloat(p.debit||0)>0)
      const isBankCredit = posts.some(p=> String(p?.account?.account_code||'')==='1010' && parseFloat(p.credit||0)>0)
      const isCashDebit = posts.some(p=> String(p?.account?.account_code||'')==='1110' && parseFloat(p.debit||0)>0)
      const isCashCredit = posts.some(p=> String(p?.account?.account_code||'')==='1110' && parseFloat(p.credit||0)>0)
      if (isBankDebit && isCashCredit) return 'إيداع'
      if (isCashDebit && isBankCredit) return 'سحب'
      return 'مصروف'
    }
    const posts = entry?.postings||[]
    const cashCodes = new Set(['1110','1010'])
    const isCashDebit = posts.some(p=> (cashCodes.has(String(p?.account?.account_code||'')) || String(p?.account?.type||'')==='asset') && parseFloat(p.debit||0)>0)
    const isCashCredit = posts.some(p=> (cashCodes.has(String(p?.account?.account_code||'')) || String(p?.account?.type||'')==='asset') && parseFloat(p.credit||0)>0)
    const hasARCredit = posts.some(p=> String(p?.account?.account_code||'')==='1210' || String(p?.account?.type||'')==='asset' ? parseFloat(p.credit||0)>0 : false)
    const hasAPDebit = posts.some(p=> String(p?.account?.account_code||'')==='2410' || String(p?.account?.type||'')==='liability' ? parseFloat(p.debit||0)>0 : false)
    const hasRevenueCredit = posts.some(p=> String(p?.account?.type||'')==='revenue' && parseFloat(p.credit||0)>0)
    const hasExpenseDebit = posts.some(p=> String(p?.account?.type||'')==='expense' && parseFloat(p.debit||0)>0)
    if (hasRevenueCredit && (isCashDebit || posts.some(p=> String(p?.account?.account_code||'')==='1210' && parseFloat(p.debit||0)>0))) return 'بيع'
    if (hasExpenseDebit && !isCashDebit && !isCashCredit) return 'مصروف'
    if (rt==='payment') {
      if (hasARCredit && isCashDebit) return 'تحصيل'
      if ((hasAPDebit || hasExpenseDebit) && isCashCredit) return 'سداد'
      if (isCashDebit && !isCashCredit) return 'تحصيل'
      if (isCashCredit && !isCashDebit) return 'سداد'
      const invType = String(inv?.type||'').toLowerCase()
      if (invType==='sale') return 'تحصيل'
      if (invType==='purchase') return 'سداد'
    }
    return 'يدوي'
  } catch { return 'يدوي' }
}
function aggregateByAccount(entries){
  const map = new Map()
  entries.forEach(e=>{
    (e.postings||[]).forEach(p=>{
      const key = p.account_id
      const labelAr = p.account ? `${p.account.account_code} • ${p.account.name||''}` : `حساب ${key}`
      const labelEn = p.account ? `${p.account.account_code} • ${p.account.name_en||p.account.name||''}` : `Account ${key}`
      const label = (localStorage.getItem('lang')||'ar')==='ar' ? labelAr : labelEn
      const prev = map.get(key) || { name: label, debit: 0, credit: 0 }
      prev.debit += parseFloat(p.debit||0)
      prev.credit += parseFloat(p.credit||0)
      prev.name = label
      map.set(key, prev)
    })
  })
  return Array.from(map.values())
}
  function isUnbalanced(e){ try { return Math.abs(parseFloat(e.total_debit||e.debit||0) - parseFloat(e.total_credit||e.credit||0)) > 0.0001 } catch { return false } }
 
