import React, { useEffect, useMemo, useState } from 'react'
import AccountTree from '../components/AccountTree'
import AccountSummary from '../components/AccountSummary'
import AccountStatement from '../components/AccountStatement'
import TrialBalance from '../components/TrialBalance'
import GeneralLedger from '../components/GeneralLedger'
import VatReturn from '../components/VatReturn'
import { accounts as apiAccounts, journal as apiJournal } from '../services/api'
import { useNavigate, useLocation } from 'react-router-dom'
import { FaHome, FaSearch, FaPlus, FaEdit, FaTrash, FaLock, FaUnlock, FaFileInvoice, FaChartLine } from 'react-icons/fa'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function AccountsScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [view, setView] = useState('account')
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [entries, setEntries] = useState([])
  const [allEntries, setAllEntries] = useState([]) // جميع القيود المنشورة
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', type: '', opening_balance: '' })
  const [createError, setCreateError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fsLoading, setFsLoading] = useState(false)
  const [fsError, setFsError] = useState('')
  const [fsPeriod, setFsPeriod] = useState([])
  const [fsPre, setFsPre] = useState([])
  const [authorized, setAuthorized] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const loadFs = React.useCallback(async (f, t) => {
    setFsLoading(true)
    setFsError('')
    try {
      const prevDay = (d => { try { const x = new Date(d); x.setDate(x.getDate()-1); return x.toISOString().slice(0,10) } catch { return '' } })(f)
      const [periodData, preData] = await Promise.all([
        apiJournal.list({ ...(f?{ from: f }:{}), ...(t?{ to: t }:{}), status: 'posted', pageSize: 1000 }),
        f ? apiJournal.list({ to: prevDay, status: 'posted', pageSize: 1000 }) : Promise.resolve({ items: [] })
      ])
      setFsPeriod(periodData.items||[])
      setFsPre(preData.items||[])
    } catch (e) {
      if (e?.status === 403) {
        setFsError(lang === 'ar' ? 'ليس لديك صلاحية لعرض هذه الشاشة' : 'You do not have permission to view this screen')
      } else {
        setFsError(e.code||'request_failed')
      }
      setFsPeriod([])
      setFsPre([])
    } finally {
      setFsLoading(false)
    }
  }, [lang])

  const [passInput, setPassInput] = useState('')

  useEffect(() => {
    if (view==='income' || view==='balance' || view==='cash') {
      loadFs(from, to)
    }
  }, [from, to, view, loadFs])

  const flatAccounts = useMemo(() => {
    const out = []
    const walk = (nodes) => {
      for (const n of (nodes||[])) { out.push(n); walk(n.children) }
    }
    walk(accounts)
    return out
  }, [accounts])

  useEffect(() => {
    if ((view === 'statement' || view === 'account') && !selectedAccount && flatAccounts.length > 0) {
      setSelectedAccount(flatAccounts[0])
    }
  }, [view, selectedAccount, flatAccounts])

  const periodMap = useMemo(() => {
    const m = {}
    const safeFsPeriod = Array.isArray(fsPeriod) ? fsPeriod : []
    for (const it of safeFsPeriod) {
      for (const p of (it.postings||[])) {
        const id = p.account_id
        if (!m[id]) m[id] = { debit: 0, credit: 0 }
        m[id].debit += parseFloat(p.debit||0)
        m[id].credit += parseFloat(p.credit||0)
      }
    }
    return m
  }, [fsPeriod])

  const preMap = useMemo(() => {
    const m = {}
    const safeFsPre = Array.isArray(fsPre) ? fsPre : []
    for (const it of safeFsPre) {
      for (const p of (it.postings||[])) {
        const id = p.account_id
        if (!m[id]) m[id] = { debit: 0, credit: 0 }
        m[id].debit += parseFloat(p.debit||0)
        m[id].credit += parseFloat(p.credit||0)
      }
    }
    return m
  }, [fsPre])

  const incomeBreakdown = useMemo(() => {
    const revenueItems = []
    const expenseItems = []
    for (const a of flatAccounts) {
      const pm = periodMap[a.id] || { debit: 0, credit: 0 }
      if (String(a.type) === 'revenue') {
        const amount = (pm.credit - pm.debit)
        revenueItems.push({ id: a.id, name: a.name || a.name_en || '', code: a.account_code || a.account_number || '', amount })
      } else if (String(a.type) === 'expense') {
        const amount = (pm.debit - pm.credit)
        expenseItems.push({ id: a.id, name: a.name || a.name_en || '', code: a.account_code || a.account_number || '', amount })
      }
    }
    const r = revenueItems.filter(i => Math.abs(i.amount) > 0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
    const e = expenseItems.filter(i => Math.abs(i.amount) > 0.0001).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount))
    const revenueTotal = r.reduce((s,i)=>s + i.amount, 0)
    const expenseTotal = e.reduce((s,i)=>s + i.amount, 0)
    const net = revenueTotal - expenseTotal
    return { revenueItems: r, expenseItems: e, revenueTotal, expenseTotal, net }
  }, [flatAccounts, periodMap])

  const balance = useMemo(() => {
    let assets = 0
    let liabilities = 0
    let equity = 0
    for (const a of flatAccounts) {
      const pre = preMap[a.id] || { debit: 0, credit: 0 }
      const per = periodMap[a.id] || { debit: 0, credit: 0 }
      const opening = (pre.debit - pre.credit)
      const closing = opening + (per.debit - per.credit)
      if (String(a.type)==='asset') assets += closing
      else if (String(a.type)==='liability') liabilities += (-closing)
      else if (String(a.type)==='equity') equity += (-closing)
    }
    return { assets, liabilities, equity }
  }, [flatAccounts, preMap, periodMap])

  const fsInfo = useMemo(() => {
    const hasPeriod = (fsPeriod||[]).length>0
    const hasPre = (fsPre||[]).length>0
    if (!hasPeriod && !hasPre) return lang==='ar'?'لا توجد قيود منشورة للفترة أو ما قبلها — القيم المعروضة تعتمد على الأرصدة الافتتاحية فقط':'No posted entries for the period or before — values reflect opening balances only'
    if (!hasPeriod) return lang==='ar'?'لا توجد قيود منشورة خلال الفترة المحددة — القيم تعكس رصيد بداية الفترة':'No posted entries in the selected period — values reflect opening at period start'
    return ''
  }, [fsPeriod, fsPre, lang])

  const cash = useMemo(() => {
    const isCash = (a) => {
      const n = ((a.name||'') + ' ' + (a.name_en||'') + ' ' + (a.account_number||a.account_code||''))
      const code = String(a.account_code || a.account_number || '')
      // Check for cash/bank accounts: codes starting with 101, 111, 112, or names containing cash/bank keywords
      return String(a.type)==='asset' && (
        /(cash|bank|نقد|البنوك|الصناديق|صندوق|بنك|خزينة)/i.test(n) || 
        code.startsWith('101') || 
        code.startsWith('111') || 
        code.startsWith('112')
      )
    }
    let opening = 0
    let periodIn = 0
    let periodOut = 0
    for (const a of flatAccounts) {
      if (!isCash(a)) continue
      const pre = preMap[a.id] || { debit: 0, credit: 0 }
      const per = periodMap[a.id] || { debit: 0, credit: 0 }
      const op = parseFloat(a.opening_balance||0) + (pre.debit - pre.credit)
      opening += op
      periodIn += per.debit
      periodOut += per.credit
    }
    const net = periodIn - periodOut
    const closing = opening + net
    return { opening, in: periodIn, out: periodOut, net, closing }
  }, [flatAccounts, preMap, periodMap])

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const data = await apiAccounts.tree()
        if (!data || !Array.isArray(data)) {
          console.warn('[AccountsScreen] Invalid accounts data:', data)
          setAccounts([])
          setLoadError('invalid_data')
          return
        }
        setAccounts(data)
        setLoadError(null)
      } catch (e) {
        console.error('[AccountsScreen] Error fetching accounts:', e)
        if (e?.status === 403) {
          setLoadError(lang === 'ar' ? 'ليس لديك صلاحية لعرض هذه الشاشة' : 'You do not have permission to view this screen')
        } else {
          setLoadError(e.code || 'request_failed')
        }
        setAccounts([])
      }
    }
    fetchAccounts()
  }, [lang])
  useEffect(() => {
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => {
    try {
      const qp = new URLSearchParams(location.search)
      const v = qp.get('view')
      if (v) setView(v)
      
      // CRITICAL: Read filters from URL (from, to, period, branch)
      const fromParam = qp.get('from')
      const toParam = qp.get('to')
      const per = qp.get('period')
      
      if (fromParam) setFrom(fromParam)
      if (toParam) setTo(toParam)
      
      if (per && /^\d{4}-\d{2}$/.test(per) && !fromParam && !toParam){
        const [y,m] = per.split('-')
        const f = `${y}-${m}-01`
        const d = new Date(Number(y), Number(m), 0)
        const mm = String(d.getMonth()+1).padStart(2,'0')
        const dd = String(d.getDate()).padStart(2,'0')
        const t = `${y}-${mm}-${dd}`
        setFrom(f)
        setTo(t)
      }
    } catch {}
  }, [location.search])

  // تحميل جميع القيود المنشورة لحساب الإجماليات
  useEffect(() => {
    async function loadAllEntries(){
      try {
        const result = await apiJournal.list({ status: 'posted', pageSize: 1000 })
        const allRows = Array.isArray(result.items) ? result.items : []
        setAllEntries(allRows)
      } catch (e) {
        console.warn('[AccountsScreen] Could not load all entries:', e)
        setAllEntries([])
      }
    }
    loadAllEntries()
  }, [])

  useEffect(() => {
    async function loadEntries(){
      if (!selectedAccount) { setEntries([]); return }
      try {
        const rows = await apiJournal.byAccount(selectedAccount.id, { pageSize: 500 })
        const clean = rows.filter(r => !(parseFloat(r.debit||0)===0 && parseFloat(r.credit||0)===0))
        setEntries(clean)
      } catch (e) {
        if (e?.status === 403) {
          setLoadError(lang === 'ar' ? 'ليس لديك صلاحية لعرض هذه الشاشة' : 'You do not have permission to view this screen')
        }
        setEntries([])
      }
    }
    loadEntries()
  }, [selectedAccount, lang])

  const filteredAccounts = useMemo(() => {
    function match(a){
      const txt = ((a.name || a.name_en || '') + ' ' + (a.account_number || a.account_code || '')).toLowerCase()
      const okType = typeFilter ? String(a.type||'')===typeFilter : true
      const okText = search ? txt.includes(search.toLowerCase()) : true
      return okType && okText
    }
    function filterTree(nodes){
      return (nodes||[]).map(n => ({...n, children: filterTree(n.children)})).filter(match)
    }
    return filterTree(accounts)
  }, [accounts, search, typeFilter])

  // حساب الإجماليات من جميع القيود المنشورة
  const totals = useMemo(() => {
    // إذا كان هناك حساب محدد، استخدم entries الخاصة به
    // وإلا استخدم جميع القيود المنشورة
    const sourceEntries = selectedAccount ? entries : allEntries
    
    // حساب الإجماليات من جميع الـ postings في القيود
    let totalDebit = 0
    let totalCredit = 0
    
    for (const entry of sourceEntries) {
      if (Array.isArray(entry.postings)) {
        for (const posting of entry.postings) {
          totalDebit += parseFloat(posting.debit || 0)
          totalCredit += parseFloat(posting.credit || 0)
        }
      } else {
        // Fallback: إذا لم تكن postings موجودة، استخدم القيم المباشرة
        totalDebit += parseFloat(entry.debit || entry.total_debit || 0)
        totalCredit += parseFloat(entry.credit || entry.total_credit || 0)
      }
    }
    
    return { debit: totalDebit, credit: totalCredit, net: totalDebit - totalCredit }
  }, [entries, allEntries, selectedAccount])

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <header className="px-6 py-4 bg-white border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary-700">شاشة الحسابات</h1>
              <p className="text-gray-600 text-sm">أدخل كلمة السر للوصول</p>
            </div>
            <div className="flex gap-2 items-center">
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>navigate('/')}>الرئيسية</button>
            </div>
          </div>
        </header>
        <main className="max-w-md mx-auto p-6">
          <div className="bg-white border rounded p-4 shadow-sm">
            <div className="mb-2">كلمة السر</div>
            <input type="password" className="border rounded px-3 py-2 w-full mb-3" value={passInput} onChange={e=>setPassInput(e.target.value)} placeholder="••••" />
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>navigate('/')}>إلغاء</button>
              <button className="px-3 py-2 bg-primary-600 text-white rounded" onClick={()=>{ if (passInput==='1122') setAuthorized(true) }}>دخول</button>
            </div>
          </div>
        </main>
      </div>
    )
  }
  return (
    <div className="space-y-4" dir="rtl">
      <div className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-primary-700">{lang==='ar'?'شاشة المحاسبة':'Accounting Screen'}</div>
          <div className="hidden md:flex items-center gap-2">
            <div className="px-3 py-1 rounded bg-blue-50 text-blue-700">{lang==='ar'?'مدين':'Debit'}: <span className={totals.debit < 0 ? 'text-red-600' : ''}>{fmt(totals.debit)}</span></div>
            <div className="px-3 py-1 rounded bg-green-50 text-green-700">{lang==='ar'?'دائن':'Credit'}: <span className={totals.credit < 0 ? 'text-red-600' : ''}>{fmt(totals.credit)}</span></div>
            <div className="px-3 py-1 rounded bg-gray-100 text-gray-800">{lang==='ar'?'صافي':'Net'}: <span className={totals.net < 0 ? 'text-red-600' : ''}>{fmt(totals.net)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={() => navigate('/')}> 
            <FaHome /> {lang==='ar'?'الرئيسية':'Home'}
          </button>
          <select value={view} onChange={e=>setView(e.target.value)} className="px-3 py-2 border rounded">
            <option value="account">{lang==='ar'?'تفاصيل الحساب':'Account Details'}</option>
            <option value="statement">{lang==='ar'?'كشف حساب':'Account Statement'}</option>
            <option value="trial">{lang==='ar'?'ميزان المراجعة':'Trial Balance'}</option>
            <option value="ledger">{lang==='ar'?'دفتر الأستاذ العام':'General Ledger'}</option>
            <option value="income">{lang==='ar'?'قائمة الدخل':'Income Statement'}</option>
            <option value="balance">{lang==='ar'?'المركز المالي':'Balance Sheet'}</option>
            <option value="cash">{lang==='ar'?'التدفقات النقدية':'Cash Flow'}</option>
            <option value="vat">إقرار ضريبة القيمة المضافة</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 bg-white p-4 rounded shadow space-y-4">
          <div>
            <div className="font-semibold mb-2">{lang==='ar'?'🧾 شجرة الحسابات':'🧾 Chart of Accounts'}</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1">
                <FaSearch className="text-gray-500" />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث':'Search'} className="px-3 py-2 border rounded w-full" />
              </div>
              <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="px-3 py-2 border rounded">
                <option value="">{lang==='ar'?'كل الأنواع':'All'}</option>
                <option value="asset">{lang==='ar'?'أصول':'Assets'}</option>
                <option value="liability">{lang==='ar'?'التزامات':'Liabilities'}</option>
                <option value="equity">{lang==='ar'?'حقوق ملكية':'Equity'}</option>
                <option value="revenue">{lang==='ar'?'إيرادات':'Revenue'}</option>
                <option value="expense">{lang==='ar'?'مصروفات':'Expenses'}</option>
              </select>
            </div>
            {loadError ? (
              <div className="text-red-600 text-sm">{lang==='ar'?'تعذّر تحميل الحسابات. تأكد من اتصال الخادم.':'Failed to load accounts. Ensure server is running.'}</div>
            ) : (
              <AccountTree 
                accounts={filteredAccounts} 
                onSelect={a=>{ setSelectedAccount(a); setView('account') }}
                onEdit={a=>{ setSelectedAccount(a); setForm({ name: a.name||'', name_en: a.name_en||'', type: a.type||'', opening_balance: String(a.opening_balance||0) }); setShowEdit(true) }}
              />
            )}
          </div>
          <div>
            <div className="font-semibold mb-2">{lang==='ar'?'📘 الدفاتر المحاسبية':'📘 Ledgers'}</div>
            <div className="flex flex-col gap-2">
              <button className={`px-3 py-2 rounded border ${view==='ledger'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('ledger')}>{lang==='ar'?'دفتر الأستاذ العام':'General Ledger'}</button>
              <button className={`px-3 py-2 rounded border ${view==='account'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('account')}>{lang==='ar'?'تفاصيل الحساب':'Account Details'}</button>
              <button className={`px-3 py-2 rounded border ${view==='statement'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('statement')}>{lang==='ar'?'كشف حساب':'Account Statement'}</button>
              <button className={`px-3 py-2 rounded border ${view==='trial'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('trial')}>{lang==='ar'?'ميزان المراجعة':'Trial Balance'}</button>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">{lang==='ar'?'📊 القوائم المالية':'📊 Financial Statements'}</div>
            <div className="flex flex-col gap-2">
              <button className={`px-3 py-2 rounded border ${view==='income'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('income')}>{lang==='ar'?'قائمة الدخل':'Income Statement'}</button>
              <button className={`px-3 py-2 rounded border ${view==='balance'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('balance')}>{lang==='ar'?'المركز المالي':'Balance Sheet'}</button>
              <button className={`px-3 py-2 rounded border ${view==='cash'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('cash')}>{lang==='ar'?'التدفقات النقدية':'Cash Flow'}</button>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">📑 الضرائب</div>
            <div className="flex flex-col gap-2">
              <button className={`px-3 py-2 rounded border ${view==='vat'?'bg-primary-600 text-white':'bg-white'}`} onClick={()=>setView('vat')}>إقرار ضريبة القيمة المضافة</button>
            </div>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {view === 'trial' && (
            <TrialBalance />
          )}
          {view === 'vat' && (
            <VatReturn />
          )}
          {view === 'ledger' && (
            <GeneralLedger />
          )}
          {(view === 'income' || view === 'balance' || view === 'cash') && (
            <div className="bg-white p-4 rounded shadow space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex flex-col">
                  <label className="text-sm text-gray-600">{lang==='ar'?'من':'From'}</label>
                  <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="px-3 py-2 border rounded" />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-600">{lang==='ar'?'إلى':'To'}</label>
                  <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="px-3 py-2 border rounded" />
                </div>
                <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>{ const f = from; const t = to; loadFs(f,t) }}>{lang==='ar'?'تحديث':'Refresh'}</button>
                {fsLoading && <div className="text-sm text-gray-500">{lang==='ar'?'جاري التحميل...':'Loading...'}</div>}
                {fsError && <div className="text-sm text-red-600">{lang==='ar'?'فشل التحميل':'Load failed'}: {fsError}</div>}
              </div>
              {fsInfo && (
                <div className="px-3 py-2 bg-amber-50 text-amber-800 rounded border border-amber-200 text-sm">{fsInfo}</div>
              )}
              {view === 'income' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'قائمة الدخل':'Income Statement'}</div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'الحساب':'Account'}</th>
                        <th className="p-2">{lang==='ar'?'القيمة خلال الفترة':'Amount (Period)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-blue-50 border-b"><td className="p-2 font-semibold">{lang==='ar'?'الإيرادات':'Revenue'}</td><td className="p-2 font-semibold">{incomeBreakdown.revenueTotal.toFixed(2)}</td></tr>
                      {(Array.isArray(incomeBreakdown.revenueItems) ? incomeBreakdown.revenueItems : []).map(item => (
                        <tr key={`r-${item.id}`} className="border-b hover:bg-gray-50">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 border-b"><td className="p-2 font-semibold">{lang==='ar'?'المصروفات':'Expenses'}</td><td className="p-2 font-semibold">{incomeBreakdown.expenseTotal.toFixed(2)}</td></tr>
                      {(Array.isArray(incomeBreakdown.expenseItems) ? incomeBreakdown.expenseItems : []).map(item => (
                        <tr key={`e-${item.id}`} className="border-b hover:bg-gray-50">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="p-2 font-semibold">{lang==='ar'?'صافي الربح':'Net Income'}</td>
                        <td className={`p-2 font-semibold ${incomeBreakdown.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{incomeBreakdown.net.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {view === 'balance' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'المركز المالي':'Balance Sheet'}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-blue-50 p-4 rounded border"><div className="text-blue-700">{lang==='ar'?'الأصول':'Assets'}</div><div className="text-xl font-bold text-blue-700">{balance.assets.toFixed(2)}</div></div>
                    <div className="bg-red-50 p-4 rounded border"><div className="text-red-700">{lang==='ar'?'الالتزامات':'Liabilities'}</div><div className="text-xl font-bold text-red-700">{balance.liabilities.toFixed(2)}</div></div>
                    <div className="bg-green-50 p-4 rounded border"><div className="text-green-700">{lang==='ar'?'حقوق الملكية':'Equity'}</div><div className="text-xl font-bold text-green-700">{balance.equity.toFixed(2)}</div></div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">{lang==='ar'?'المعادلة':'Equation'}: {lang==='ar'?'الأصول = الالتزامات + حقوق الملكية':'Assets = Liabilities + Equity'}</div>
                  {fsInfo && (
                    <div className="mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded inline-block">{fsInfo}</div>
                  )}
                </div>
              )}
              {view === 'cash' && (
                <div>
                  <div className="font-semibold mb-2">{lang==='ar'?'قائمة التدفقات النقدية (مباشر)':'Cash Flow (Direct)'}</div>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2">{lang==='ar'?'البند':'Item'}</th>
                        <th className="p-2">{lang==='ar'?'القيمة':'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="p-2">{lang==='ar'?'رصيد نقدي بداية الفترة':'Opening Cash'}</td><td className="p-2">{cash.opening.toFixed(2)}</td></tr>
                      <tr className="border-b"><td className="p-2">{lang==='ar'?'تدفق نقدي داخل':'Cash In'}</td><td className="p-2">{cash.in.toFixed(2)}</td></tr>
                      <tr className="border-b"><td className="p-2">{lang==='ar'?'تدفق نقدي خارج':'Cash Out'}</td><td className="p-2">{cash.out.toFixed(2)}</td></tr>
                      <tr className="border-b"><td className="p-2 font-semibold">{lang==='ar'?'صافي التدفق خلال الفترة':'Net Change'}</td><td className="p-2 font-semibold">{cash.net.toFixed(2)}</td></tr>
                      <tr><td className="p-2 font-semibold">{lang==='ar'?'رصيد نقدي نهاية الفترة':'Closing Cash'}</td><td className="p-2 font-semibold">{cash.closing.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                  {fsInfo && (
                    <div className="mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded inline-block">{fsInfo}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {(view === 'account' || view === 'statement') && (
            <div className="bg-white p-4 rounded shadow space-y-4">
              {selectedAccount ? (
                <>
                  {view==='account' && (
                    <div className="flex items-center justify-between">
                      <AccountSummary account={selectedAccount} />
                      <div className="flex gap-2">
                        <button className="px-3 py-2 bg-gray-100 text-gray-800 rounded flex items-center gap-2" onClick={()=>navigate('/journal')}><FaFileInvoice /> {lang==='ar'?'القيود':'Journal'}</button>
                      </div>
                    </div>
                  )}
                  {!entries.length && (
                    <div className="text-xs px-2 py-1 bg-amber-50 text-amber-800 rounded inline-block">{lang==='ar'?"لا توجد قيود منشورة لهذا الحساب":"No posted entries for this account"}</div>
                  )}
                  {view==='account' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-blue-50 p-4 rounded-lg border shadow flex items-center justify-between">
                          <div className="flex items-center gap-2 text-blue-700"><FaChartLine/> {lang==='ar'?'إجمالي المدين':'Total Debit'}</div>
                          <div className="text-xl font-bold text-blue-700">{totals.debit.toFixed(2)}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border shadow flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-700"><FaChartLine/> {lang==='ar'?'إجمالي الدائن':'Total Credit'}</div>
                          <div className="text-xl font-bold text-green-700">{totals.credit.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border shadow flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-700"><FaChartLine/> {lang==='ar'?'صافي الرصيد':'Net Balance'}</div>
                          <div className={`text-xl font-bold ${totals.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totals.net.toFixed(2)}</div>
                        </div>
                      </div>
                      {Array.isArray(entries) && entries.length > 0 ? (
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
                      ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                          {lang==='ar'?'لا توجد بيانات لعرضها':'No data to display'}
                        </div>
                      )}
                      <AccountStatement account={selectedAccount} />
                    </>
                  )}
                  {view==='statement' && (
                    <AccountStatement account={selectedAccount} />
                  )}
                </>
              ) : (
                <div className="text-gray-500">{lang==='ar'?'اختر حسابًا لعرض التفاصيل':'Select an account to view details'}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {showEdit && selectedAccount && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-xl p-6" dir={lang==='ar'?'rtl':'ltr'}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800">{lang==='ar'?'تعديل الحساب':'Edit Account'}</div>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=>{ setShowEdit(false); setForm({ name: '', name_en: '', type: '', opening_balance: '' }); setCreateError('') }}>{lang==='ar'?'إغلاق':'Close'}</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 mb-1 block">{lang==='ar'?'اسم الحساب':'Account Name'}</label>
                <input 
                  className="w-full px-3 py-2 border rounded" 
                  value={form.name} 
                  onChange={e=>setForm({...form, name: e.target.value})} 
                  placeholder={lang==='ar'?'اسم الحساب':'Account Name'}
                />
              </div>
              <div>
                <label className="text-sm text-gray-700 mb-1 block">{lang==='ar'?'اسم الحساب (إنجليزي)':'Account Name (English)'}</label>
                <input 
                  className="w-full px-3 py-2 border rounded" 
                  value={form.name_en} 
                  onChange={e=>setForm({...form, name_en: e.target.value})} 
                  placeholder={lang==='ar'?'اسم الحساب بالإنجليزية':'Account Name in English'}
                />
              </div>
              <div>
                <label className="text-sm text-gray-700 mb-1 block">{lang==='ar'?'نوع الحساب':'Account Type'}</label>
                <select 
                  className="w-full px-3 py-2 border rounded" 
                  value={form.type} 
                  onChange={e=>setForm({...form, type: e.target.value})}
                >
                  <option value="asset">{lang==='ar'?'أصل':'Asset'}</option>
                  <option value="liability">{lang==='ar'?'التزام':'Liability'}</option>
                  <option value="equity">{lang==='ar'?'حقوق ملكية':'Equity'}</option>
                  <option value="revenue">{lang==='ar'?'إيراد':'Revenue'}</option>
                  <option value="expense">{lang==='ar'?'مصروف':'Expense'}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 mb-1 block">{lang==='ar'?'الرصيد الافتتاحي':'Opening Balance'}</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full px-3 py-2 border rounded" 
                  value={form.opening_balance} 
                  onChange={e=>setForm({...form, opening_balance: e.target.value})} 
                  placeholder={lang==='ar'?'الرصيد الافتتاحي':'Opening Balance'}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {lang==='ar'?'ملاحظة: عند إضافة رصيد افتتاحي، سيتم إنشاء قيد محاسبي':'Note: Adding opening balance will create a journal entry'}
                </div>
              </div>
              {createError && (
                <div className="text-red-600 text-sm">{createError}</div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" 
                  onClick={()=>{ setShowEdit(false); setForm({ name: '', name_en: '', type: '', opening_balance: '' }); setCreateError('') }}
                >
                  {lang==='ar'?'إلغاء':'Cancel'}
                </button>
                <button 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2" 
                  onClick={async ()=>{
                    try {
                      setCreateError('')
                      const payload = { 
                        name: form.name || selectedAccount.name, 
                        name_en: form.name_en || selectedAccount.name_en, 
                        type: form.type || selectedAccount.type 
                      }
                      
                      // Check if opening balance changed
                      const currentBalance = parseFloat(selectedAccount.opening_balance || 0)
                      const newBalance = parseFloat(form.opening_balance || 0)
                      
                      if (Math.abs(newBalance - currentBalance) > 0.01) {
                        // Opening balance changed - need to create journal entry
                        // Show modal for date input instead of prompt
                        const balanceDateInput = window.prompt(
                          lang==='ar' 
                            ? 'يرجى إدخال تاريخ الرصيد الافتتاحي (YYYY-MM-DD):' 
                            : 'Please enter opening balance date (YYYY-MM-DD):',
                          new Date().toISOString().slice(0, 10)
                        )
                        
                        if (!balanceDateInput) {
                          setCreateError(lang==='ar'?'تم إلغاء العملية':'Operation cancelled')
                          return
                        }
                        
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceDateInput)) {
                          setCreateError(lang==='ar'?'تاريخ غير صحيح. يجب أن يكون بصيغة YYYY-MM-DD':'Invalid date. Must be YYYY-MM-DD format')
                          return
                        }
                        
                        // Validate date
                        const dateObj = new Date(balanceDateInput)
                        if (isNaN(dateObj.getTime())) {
                          setCreateError(lang==='ar'?'تاريخ غير صحيح':'Invalid date')
                          return
                        }
                        
                        // Determine debit/credit based on account nature and balance
                        const accountNature = selectedAccount.nature || 'debit'
                        const balanceAmount = Math.abs(newBalance)
                        let accountDebit = 0
                        let accountCredit = 0
                        
                        // For opening balance:
                        // - Debit nature accounts: positive balance = debit, negative = credit
                        // - Credit nature accounts: positive balance = credit, negative = debit
                        if (accountNature === 'debit') {
                          if (newBalance >= 0) {
                            accountDebit = balanceAmount
                            accountCredit = 0
                          } else {
                            accountDebit = 0
                            accountCredit = balanceAmount
                          }
                        } else {
                          // Credit nature
                          if (newBalance >= 0) {
                            accountDebit = 0
                            accountCredit = balanceAmount
                          } else {
                            accountDebit = balanceAmount
                            accountCredit = 0
                          }
                        }
                        
                        // Find equity account for balancing (usually starts with 3000 or equity type)
                        const equityAccount = flatAccounts.find(a => 
                          String(a.type) === 'equity' && 
                          (String(a.account_code || a.account_number || '').startsWith('3000') || 
                           String(a.account_code || a.account_number || '').startsWith('3'))
                        )
                        
                        if (!equityAccount) {
                          setCreateError(lang==='ar'?'لم يتم العثور على حساب حقوق الملكية. يرجى التأكد من وجود حساب حقوق ملكية في النظام':'Equity account not found. Please ensure an equity account exists')
                          return
                        }
                        
                        // Create balanced opening balance journal entry
                        // The equity account gets the opposite entry to balance
                        const journalPayload = {
                          description: lang==='ar' 
                            ? `رصيد افتتاحي - ${selectedAccount.name || selectedAccount.name_en || ''}` 
                            : `Opening Balance - ${selectedAccount.name_en || selectedAccount.name || ''}`,
                          date: balanceDateInput,
                          postings: [
                            {
                              account_id: selectedAccount.id,
                              debit: accountDebit,
                              credit: accountCredit
                            },
                            {
                              account_id: equityAccount.id,
                              debit: accountCredit, // Opposite to balance
                              credit: accountDebit  // Opposite to balance
                            }
                          ],
                          reference_type: 'opening_balance',
                          reference_id: selectedAccount.id
                        }
                        
                        // Validate that entries are balanced
                        const totalDebit = accountDebit + accountCredit
                        const totalCredit = accountCredit + accountDebit
                        if (Math.abs(totalDebit - totalCredit) > 0.01) {
                          setCreateError(lang==='ar'?'القيد غير متوازن':'Entry is not balanced')
                          return
                        }
                        
                        // Create journal entry first
                        const createdEntry = await apiJournal.create(journalPayload)
                        
                        // Post the entry immediately if it was created
                        if (createdEntry && createdEntry.id) {
                          try {
                            await apiJournal.postEntry(createdEntry.id)
                          } catch (postErr) {
                            console.error('[AccountsScreen] Error posting opening balance entry:', postErr)
                            setCreateError(lang==='ar'?'تم إنشاء القيد لكن فشل الترحيل. يمكنك ترحيله يدوياً من شاشة القيود':'Entry created but posting failed. You can post it manually from journal screen')
                            // Continue to update account balance
                          }
                        } else {
                          setCreateError(lang==='ar'?'فشل إنشاء القيد':'Failed to create journal entry')
                          return
                        }
                      }
                      
                      // Update account
                      payload.opening_balance = newBalance
                      await apiAccounts.update(selectedAccount.id, payload)
                      
                      // Reload accounts
                      const data = await apiAccounts.tree()
                      setAccounts(data)
                      setShowEdit(false)
                      setForm({ name: '', name_en: '', type: '', opening_balance: '' })
                      
                    } catch (e) {
                      console.error('[AccountsScreen] Error updating account:', e)
                      setCreateError(lang==='ar'?'فشل تحديث الحساب':'Failed to update account')
                    }
                  }}
                >
                  <FaEdit/> {lang==='ar'?'حفظ':'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(n){
  try {
    const val = Number(n||0)
    const abs = Math.abs(val)
    const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
    return val < 0 ? `(${s})` : s
  } catch { const v = Number(n||0); const s = Math.abs(v).toFixed(2); return v < 0 ? `(${s})` : s }
}
