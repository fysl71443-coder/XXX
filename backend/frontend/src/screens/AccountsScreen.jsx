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
      setFsError(e.code||'request_failed')
      setFsPeriod([])
      setFsPre([])
    } finally {
      setFsLoading(false)
    }
  }, [])

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
    for (const it of fsPeriod) {
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
    for (const it of fsPre) {
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
      return String(a.type)==='asset' && (/(cash|bank|نقد|البنوك|الصناديق)/i.test(n) || String(a.account_code||'').startsWith('101'))
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
        setAccounts(data)
        setLoadError(null)
      } catch (e) {
        setLoadError(e.code || 'request_failed')
        setAccounts([])
      }
    }
    fetchAccounts()
  }, [])
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
      const per = qp.get('period')
      if (per && /^\d{4}-\d{2}$/.test(per)){
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
  }, [])

  useEffect(() => {
    async function loadEntries(){
      if (!selectedAccount) { setEntries([]); return }
      try {
        const rows = await apiJournal.byAccount(selectedAccount.id, { pageSize: 500 })
        const clean = rows.filter(r => !(parseFloat(r.debit||0)===0 && parseFloat(r.credit||0)===0))
        setEntries(clean)
      } catch {
        setEntries([])
      }
    }
    loadEntries()
  }, [selectedAccount])

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

  const totals = useMemo(() => {
    const debit = entries.reduce((s, e) => s + parseFloat(e.debit||0), 0)
    const credit = entries.reduce((s, e) => s + parseFloat(e.credit||0), 0)
    return { debit, credit, net: debit - credit }
  }, [entries])

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
              <AccountTree accounts={filteredAccounts} onSelect={a=>{ setSelectedAccount(a); setView('account') }} />
            )}
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-2 bg-primary-600 text-white rounded flex items-center gap-2" onClick={()=>{ setForm({ name: '', name_en: '', type: '', opening_balance: '' }); setShowCreate(true) }}><FaPlus /> {lang==='ar'?'إضافة حساب':'Add Account'}</button>
              <button className="px-3 py-2 bg-green-600 text-white rounded" disabled={!selectedAccount} onClick={()=>{ setForm({ name: '', name_en: '', type: selectedAccount?.type||'', opening_balance: '' }); setShowCreate(true) }}>{lang==='ar'?'إضافة فرعي':'Add Child'}</button>
              <button className="px-3 py-2 bg-gray-800 text-white rounded disabled:opacity-50" disabled={seeding} onClick={async()=>{
                try { setSeeding(true); await apiAccounts.seedDefault(); const data = await apiAccounts.tree(); setAccounts(data) } catch {} finally { setSeeding(false) }
              }}>{seeding ? (lang==='ar'?'جارٍ البذر...':'Seeding...') : (lang==='ar'?'بذر الشجرة الافتراضية':'Seed Default Tree')}</button>
            </div>
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
                      {incomeBreakdown.revenueItems.map(item => (
                        <tr key={`r-${item.id}`} className="border-b hover:bg-gray-50">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 border-b"><td className="p-2 font-semibold">{lang==='ar'?'المصروفات':'Expenses'}</td><td className="p-2 font-semibold">{incomeBreakdown.expenseTotal.toFixed(2)}</td></tr>
                      {incomeBreakdown.expenseItems.map(item => (
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
                        <button className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2" onClick={()=>setShowEdit(true)} disabled={!selectedAccount}><FaEdit /> {lang==='ar'?'تعديل':'Edit'}</button>
              <button className="px-3 py-2 bg-red-600 text-white rounded flex items-center gap-2" onClick={()=>setShowDelete(true)} disabled={!selectedAccount}><FaTrash /> {lang==='ar'?'حذف':'Delete'}</button>
                        <button className="px-3 py-2 bg-gray-100 text-gray-800 rounded" disabled><FaLock /> {lang==='ar'?'قفل':'Lock'}</button>
                        <button className="px-3 py-2 bg-gray-100 text-gray-800 rounded" disabled><FaUnlock /> {lang==='ar'?'فتح':'Unlock'}</button>
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
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={entries.map(e => ({ date: e.journal.date, net: parseFloat(e.debit||0) - parseFloat(e.credit||0) }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="net" stroke="#2563eb" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
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
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-md">
            <div className="text-lg font-bold mb-2">{lang==='ar'?'إضافة حساب':'Add Account'}</div>
            <div className="space-y-2">
              <input className="w-full px-3 py-2 border rounded" placeholder={lang==='ar'?'الاسم بالعربية':'Arabic name'} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
              <input className="w-full px-3 py-2 border rounded" placeholder={lang==='ar'?'الاسم بالإنجليزية':'English name'} value={form.name_en} onChange={e=>setForm({...form, name_en: e.target.value})} />
              <select className="w-full px-3 py-2 border rounded" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
                <option value="">{lang==='ar'?'اختر النوع':'Select type'}</option>
                <option value="asset">{lang==='ar'?'أصول':'Assets'}</option>
                <option value="liability">{lang==='ar'?'التزامات':'Liabilities'}</option>
                <option value="equity">{lang==='ar'?'حقوق ملكية':'Equity'}</option>
                <option value="revenue">{lang==='ar'?'إيرادات':'Revenue'}</option>
                <option value="expense">{lang==='ar'?'مصروفات':'Expenses'}</option>
              </select>
              <input className="w-full px-3 py-2 border rounded" placeholder={lang==='ar'?'الرصيد الافتتاحي (اختياري)':'Opening balance (optional)'} value={form.opening_balance} onChange={e=>setForm({...form, opening_balance: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setShowCreate(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button className="px-3 py-2 bg-primary-600 text-white rounded flex items-center gap-2" onClick={async ()=>{
                setCreateError('')
                try {
                  const payload = { ...form }
                  if (selectedAccount) payload.parent_code = (selectedAccount.account_code || selectedAccount.account_number || '')
                  if (payload.type) payload.type = String(payload.type).toLowerCase()
                  await apiAccounts.create(payload)
                  const data = await apiAccounts.tree(); setAccounts(data); setShowCreate(false)
                } catch (e) {
                  setCreateError(e.code || 'request_failed')
                }
              }}><FaPlus/> {lang==='ar'?'حفظ':'Save'}</button>
            </div>
            {createError && <div className="mt-2 text-sm text-red-600">{lang==='ar'?'فشل الإنشاء:':'Create failed:'} {createError}</div>}
          </div>
        </div>
      )}
      {showEdit && selectedAccount && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-md">
            <div className="text-lg font-bold mb-2">{lang==='ar'?'تعديل الحساب':'Edit Account'}</div>
            <div className="space-y-2">
              <input className="w-full px-3 py-2 border rounded" value={form.name || selectedAccount.name || ''} onChange={e=>setForm({...form, name: e.target.value})} />
              <input className="w-full px-3 py-2 border rounded" value={form.name_en || selectedAccount.name_en || ''} onChange={e=>setForm({...form, name_en: e.target.value})} />
              <select className="w-full px-3 py-2 border rounded" value={form.type || selectedAccount.type || ''} onChange={e=>setForm({...form, type: e.target.value})}>
                <option value="asset">{lang==='ar'?'أصول':'Assets'}</option>
                <option value="liability">{lang==='ar'?'التزامات':'Liabilities'}</option>
                <option value="equity">{lang==='ar'?'حقوق ملكية':'Equity'}</option>
                <option value="revenue">{lang==='ar'?'إيرادات':'Revenue'}</option>
                <option value="expense">{lang==='ar'?'مصروفات':'Expenses'}</option>
              </select>

              {/* Prevent VAT Claim Checkbox (Only for Expense accounts) */}
              {(form.type === 'expense' || selectedAccount.type === 'expense') && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="prevent_vat_claim"
                      checked={form.prevent_vat_claim ?? selectedAccount.prevent_vat_claim ?? false} 
                      onChange={e => setForm({...form, prevent_vat_claim: e.target.checked})} 
                    />
                    <label htmlFor="prevent_vat_claim" className="text-sm text-gray-700">
                      {lang === 'ar' ? 'ضريبة غير مستردة (توجيه الضريبة إلى 2140)' : 'Non-recoverable VAT (Route VAT to 2140)'}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="zakat_deductible"
                      checked={form.zakat_deductible ?? selectedAccount.zakat_deductible ?? true} 
                      onChange={e => setForm({...form, zakat_deductible: e.target.checked})} 
                    />
                    <label htmlFor="zakat_deductible" className="text-sm text-gray-700">
                      {lang === 'ar' ? 'قابل للخصم الزكوي/الضريبي' : 'Deductible for Zakat/Tax'}
                    </label>
                  </div>
                </div>
              )}
              
              {(()=>{ const defOpen = (selectedAccount.opening_balance!=null)
                ? String(selectedAccount.opening_balance)
                : String((parseFloat(selectedAccount.opening_debit||0) - parseFloat(selectedAccount.opening_credit||0))||0);
                return (
                  <input className="w-full px-3 py-2 border rounded" placeholder={lang==='ar'?'الرصيد الافتتاحي':'Opening balance'} value={(form.opening_balance ?? defOpen)} onChange={e=>setForm({...form, opening_balance: e.target.value})} />
                ) })()}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>{ setShowEdit(false); setForm({ name:'', name_en:'', type:'', opening_balance:'' }) }}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2" onClick={async ()=>{
                const payload = { name: form.name || selectedAccount.name, name_en: form.name_en || selectedAccount.name_en, type: form.type || selectedAccount.type }
                if (form.opening_balance != null && String(form.opening_balance).trim() !== '') {
                  const val = parseFloat(form.opening_balance)
                  if (!isNaN(val)) {
                    const abs = Math.abs(val)
                    if (val >= 0) { payload.opening_debit = abs; payload.opening_credit = 0 }
                    else { payload.opening_debit = 0; payload.opening_credit = abs }
                  }
                }
                await apiAccounts.update(selectedAccount.id, payload)
                const data = await apiAccounts.tree(); setAccounts(data); setShowEdit(false)
              }}><FaEdit/> {lang==='ar'?'حفظ':'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {showDelete && selectedAccount && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-md">
            <div className="text-lg font-bold mb-2">{lang==='ar'?'حذف الحساب':'Delete Account'}</div>
            <div className="text-sm">{lang==='ar'?'هل أنت متأكد من حذف الحساب؟':'Are you sure to delete this account?'}</div>
            {deleteError && <div className="mt-2 text-sm text-red-600">{lang==='ar'?'لا يمكن الحذف:':'Cannot delete:'} {deleteError}</div>}
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" onChange={e=>setForm({...form, force_delete: e.target.checked})} />
              {lang==='ar'?'حذف شامل للحركات والفواتير المرتبطة':'Cascade delete journal entries and related documents'}
            </label>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 bg-gray-100 rounded" onClick={()=>setShowDelete(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button className="px-3 py-2 bg-red-600 text-white rounded flex items-center gap-2" onClick={async ()=>{
                setDeleteError('')
                try {
                  const params = form.force_delete ? { force: 1 } : {}
                  await apiAccounts.remove(selectedAccount.id, params)
                  const data = await apiAccounts.tree(); setAccounts(data); setSelectedAccount(null); setShowDelete(false)
                } catch (e) {
                  setDeleteError(e.code || 'request_failed')
                }
              }}><FaTrash/> {lang==='ar'?'حذف':'Delete'}</button>
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
