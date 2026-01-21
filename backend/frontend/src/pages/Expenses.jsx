import { useEffect, useMemo, useState } from 'react'
import { accounts as apiAccounts, expenses as apiExpenses, partners as apiPartners, payroll as apiPayroll, supplierInvoices as apiSupplierInvoices, invoices as apiInvoices, employees as apiEmployees, journal as apiJournal, payments as apiPayments, periods as apiPeriods } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { sanitizeDecimal } from '../utils/number'
import { FaHome, FaPlus, FaReceipt, FaWallet, FaCalendarAlt, FaTags, FaBuilding, FaCreditCard, FaChartLine, FaMoneyBillWave, FaList } from 'react-icons/fa'
import { motion } from 'framer-motion'
import AdvancedFilters from '../components/AdvancedFilters'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { t } from '../utils/i18n'
import { useNavigate, useLocation } from 'react-router-dom'

function flatten(nodes){
  const out=[]; (nodes||[]).forEach(n=>{ out.push(n); out.push(...flatten(n.children||[])) }); return out
}

function labelName(acc, lang){ return lang==='ar'?(acc.name||''):(acc.name_en||acc.name||'') }

export default function Expenses(){
  const navigate = useNavigate()
  const location = useLocation()
  const { loading: authLoading, isLoggedIn, can, isAdmin } = useAuth() // CRITICAL: Check auth state before API calls
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [tree, setTree] = useState([])
  const [accounts, setAccounts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [unpaidInvoices, setUnpaidInvoices] = useState([])
  const [payrollRuns, setPayrollRuns] = useState([])
  const [list, setList] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', account_code: '', category: '' })
  
  const [form, setForm] = useState({ 
    date: '', 
    document_number: '', 
    amount: '', 
    description: '', 
    payment_method: 'cash', 
    account_code: '', 
    payment_account_code: '', 
    expense_type: 'expense', 
    branch: '', 
    cost_center: '', 
    items: [{id: Date.now(), amount: '', account_code: '', description: '', include_tax: false}],
    payment_details: {
      payment_type: '', // supplier, utility, salary, vat, gov, other
      supplier_id: '',
      invoice_ids: [],
      payroll_run_id: '',
      service_type: '', // water, electricity, telecom
      account_number: '',
      period_type: 'quarter', // month, quarter
      period_year: new Date().getFullYear(),
      period_value: '1',
      declaration_number: '',
      gov_entity: '',
      reference_number: '',
      is_partial: false
    }
  })

  const [selectedAcc, setSelectedAcc] = useState(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [arType, setArType] = useState('')
  const [arEntities, setArEntities] = useState([])
  const [arEntityId, setArEntityId] = useState('')
  const [arBalances, setArBalances] = useState([])
  const [arAmounts, setArAmounts] = useState({})
  const [arPayments, setArPayments] = useState([{ method: '', amount: '' }])
  const [arError, setArError] = useState('')
  const [arReference, setArReference] = useState('')
  const [periodStatus, setPeriodStatus] = useState('open')
  const [helpOpen, setHelpOpen] = useState(false)


  const expensesTotals = useMemo(() => {
    if (form.expense_type !== 'expense') return { total: 0, tax: 0 }
    return (form.items || []).reduce((acc, item) => {
      const amt = parseFloat(item.amount || 0)
      let tax = 0
      if (item.include_tax) {
        const net = amt / 1.15
        tax = amt - net
      }
      return { total: acc.total + amt, tax: acc.tax + tax }
    }, { total: 0, tax: 0 })
  }, [form.items, form.expense_type])

  function addItem() {
    setForm(prev => ({ ...prev, items: [...(prev.items||[]), { id: Date.now(), amount: '', account_code: '', description: '', include_tax: false }] }))
  }
  function removeItem(id) {
    setForm(prev => {
      const newItems = (prev.items||[]).filter(it => it.id !== id)
      if (newItems.length === 0) return { ...prev, items: [{ id: Date.now(), amount: '', account_code: '', description: '', include_tax: false }] }
      return { ...prev, items: newItems }
    })
  }
  function updateItem(id, field, value) {
    setForm(prev => ({
      ...prev,
      items: (prev.items||[]).map(it => it.id === id ? { ...it, [field]: value } : it)
    }))
  }

  // CRITICAL: Wait for auth to be ready before making API calls
  useEffect(()=>{ 
    if (authLoading || !isLoggedIn) {
      console.log('[Expenses] Waiting for auth before loading accounts tree...');
      return;
    }
    (async()=>{ 
      try { 
        const t = await apiAccounts.tree(); 
        setTree(Array.isArray(t) ? t : []) 
      } catch (e) { 
        console.error('[Expenses] Error loading accounts tree:', e); 
        setTree([]) 
      } 
    })() 
  },[authLoading, isLoggedIn])
  
  useEffect(()=>{ 
    try { 
      const flat = flatten(tree); 
      const allowedTypes = ['expense', 'cash', 'bank', 'equity', 'liability', 'income']; 
      const allowed = flat.filter(a => allowedTypes.includes(String(a.type||'').toLowerCase()) && (a.allow_manual_entry !== false)); 
      setAccounts(allowed) 
    } catch (e) { 
      console.error('[Expenses] Error processing accounts:', e); 
      setAccounts([]) 
    } 
  },[tree])
  
  useEffect(()=>{ 
    if (authLoading || !isLoggedIn) {
      console.log('[Expenses] Waiting for auth before loading expenses...');
      return;
    }
    (async()=>{ 
      try { 
        const res = await apiExpenses.list(filters); 
        if (!res) { 
          console.warn('[Expenses] No data returned from API'); 
          setList([]); 
          setError(''); 
          return; 
        } 
        setList(Array.isArray(res) ? res : (res?.items || [])); 
        setError('') 
      } catch (e) { 
        console.error('[Expenses] Error loading expenses:', e); 
        if (e?.status===403) { 
          setError('ليس لديك صلاحية لعرض هذه الشاشة') 
        } else { 
          setError('تعذر تحميل البيانات') 
        } 
        setList([]) 
      } 
    })() 
  },[filters, authLoading, isLoggedIn])
  
  useEffect(()=>{ 
    if (authLoading || !isLoggedIn) {
      return;
    }
    (async()=>{ 
      try { 
        const d = new Date(); 
        const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
        const s = await apiPeriods.get(per); 
        setPeriodStatus(String(s?.status||'open')) 
      } catch {} 
    })() 
  },[authLoading, isLoggedIn])

  // Smart Linking Data Fetching
  useEffect(() => {
    if (form.expense_type === 'payment' && form.payment_details.payment_type === 'supplier') {
      apiPartners.list().then(res => setSuppliers((res||[]).filter(p => String(p.type).toLowerCase() === 'supplier')))
    }
  }, [form.expense_type, form.payment_details.payment_type])

  useEffect(() => {
    if (form.payment_details.supplier_id) {
      apiSupplierInvoices.list({ supplier_id: form.payment_details.supplier_id, status: 'unpaid' })
        .then(res => {
          const rows = (res?.items||res||[])
          const filtered = (Array.isArray(rows)?rows:[]).filter(inv => {
            const total = parseFloat(inv.total||0)||0
            const paid = parseFloat(inv.paid_amount||0)||0
            const remaining = parseFloat(inv.outstanding_amount|| (total - paid))||0
            return remaining > 0
          })
          setUnpaidInvoices(filtered)
        })
    } else {
      setUnpaidInvoices([])
    }
  }, [form.payment_details.supplier_id])

  useEffect(() => {
    if (form.expense_type === 'payment' && form.payment_details.payment_type === 'salary') {
      apiPayroll.runs().then(res => setPayrollRuns((res||[]).filter(r => r.status === 'posted' && r.payment_status !== 'paid')))
    }
  }, [form.expense_type, form.payment_details.payment_type])
  
  // VAT Balance Fetching
  useEffect(() => {
    if (form.expense_type === 'payment' && form.payment_details.payment_type === 'vat') {
      // Try to find VAT Payable account balance (Priority: 2130 Settlement -> 2110 Output)
      const vatSettlement = accounts.find(a => String(a.account_code) === '2130')
      const vatOutput = accounts.find(a => String(a.account_code) === '2110')
      
      let bal = 0
      if (vatSettlement) bal = parseFloat(vatSettlement.current_balance || 0)
      else if (vatOutput) bal = parseFloat(vatOutput.current_balance || 0)
      
      // Liability balance is typically Credit side, so balance (Dr-Cr) will be negative. We want the positive amount to pay.
      const toPay = bal < 0 ? Math.abs(bal) : 0 // If balance is negative (Credit), we owe money.
      
      if (toPay > 0 && !form.amount && !form.payment_details.is_partial) {
         setForm(prev => ({ ...prev, amount: toPay.toFixed(2) }))
      }
    }
  }, [form.expense_type, form.payment_details.payment_type, accounts, form.payment_details.is_partial])
  
  useEffect(() => {
    if (location.state && location.state.editId) {
      const id = location.state.editId
      setEditingId(id)
      apiExpenses.get(id).then(inv => {
        if (inv) {
          setForm(prev => ({
            ...prev,
            date: String(inv.date||'').slice(0,10),
            document_number: inv.invoice_number,
            amount: inv.total,
            description: inv.description || '',
            payment_method: inv.payment_method || 'cash',
            account_code: inv.expense_account_code,
            payment_account_code: inv.payment_account_code || '',
            expense_type: inv.type === 'expense' ? (inv.expense_type || 'expense') : 'expense',
            items: (inv.items && inv.items.length > 0) 
              ? inv.items.map((it, idx) => ({ id: Date.now() + idx, amount: it.amount||'', account_code: it.account_code||'', description: it.description||'', include_tax: !!it.include_tax })) 
              : (inv.type === 'expense' && (inv.expense_type === 'expense' || !inv.expense_type)
                  ? [{id: Date.now(), amount: inv.total, account_code: inv.expense_account_code, description: inv.description || '', include_tax: false}] 
                  : [{id: Date.now(), amount: '', account_code: '', description: '', include_tax: false}]),
            payment_details: inv.payment_details || prev.payment_details
          }))
          onSelectAccount(inv.expense_account_code)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }).catch(err => {
        console.error(err)
        setError(lang==='ar'?'فشل تحميل الفاتورة':'Failed to load invoice')
      })
    }
  }, [location.state])

  useEffect(() => {
    if (form.account_code && accounts.length > 0) {
      const acc = accounts.find(a => String(a.account_code)===String(form.account_code));
      if (acc) setSelectedAcc(acc)
    }
  }, [accounts, form.account_code])

  const cashAccounts = useMemo(() => accounts.filter(a => String(a.type||'').toLowerCase()==='cash'), [accounts])
  const bankAccounts = useMemo(() => accounts.filter(a => String(a.type||'').toLowerCase()==='bank'), [accounts])
  const allBankAccounts = useMemo(() => flatten(tree).filter(a => String(a.type||'').toLowerCase()==='bank'), [tree])
  const bankDropdownOptions = useMemo(() => {
    const flat = flatten(tree)
    const candidates = allBankAccounts.length ? allBankAccounts : flat
    const codes = new Set(['1111','1122','1123','1124','1120'])
    return candidates.filter(a => String(a.type||'').toLowerCase()==='bank' || codes.has(String(a.account_code)))
  }, [tree, allBankAccounts])
  
  const withdrawOptions = useMemo(() => {
    const flat = flatten(tree)
    const mapByCode = new Map(flat.map(a => [String(a.account_code), a]))
    const preferred = ['1111','1122','1123','1124','1120'].map(c => mapByCode.get(c)).filter(Boolean)
    const rest = flat.filter(a => {
      const t = String(a.type||'').toLowerCase()
      const isCashOrBank = t==='cash' || t==='bank' || t==='equity'
      const isPreferred = preferred.some(p => String(p.account_code)===String(a.account_code))
      return isCashOrBank && !isPreferred
    })
    return [...preferred, ...rest]
  }, [tree])

  function getAccountByCode(code){
    const c = String(code||'')
    return accounts.find(a => String(a.account_code)===c) || flatten(tree).find(a => String(a.account_code)===c)
  }

  const debitCredit = useMemo(()=>{
    const t = String(form.expense_type||'expense')
    if (t==='expense'){
      const firstItemAcc = form.items && form.items[0] ? form.items[0].account_code : ''
      const dr = getAccountByCode(form.account_code || firstItemAcc)
      const cr = getAccountByCode(form.payment_account_code)
      return { dr, cr }
    } else if (t==='withdraw'){
      const cashCode = form.account_code
      const bankCode = form.payment_account_code
      return { dr: getAccountByCode(cashCode), cr: getAccountByCode(bankCode) }
    } else if (t==='deposit'){
      const bankCode = form.account_code
      const cashCode = form.payment_account_code
      return { dr: getAccountByCode(bankCode), cr: getAccountByCode(cashCode) }
    } else if (t==='payment'){
       // Smart Linking Preview
       let drCode = null
       const pt = form.payment_details?.payment_type
       if (pt === 'supplier') drCode = '2111' // موردون
       else if (pt === 'salary') drCode = '2121' // رواتب مستحقة
       else if (pt === 'vat') drCode = '2141' // ضريبة القيمة المضافة – مستحقة
       else if (pt === 'gov') {
          if (form.payment_details.gov_entity === 'GOSI') drCode = '2131' // التأمينات الاجتماعية (GOSI)
          else drCode = '2130' // مستحقات حكومية
       }
       else if (pt === 'utility') drCode = '2130' // مستحقات حكومية (للخدمات الحكومية)
       else drCode = form.account_code // Fallback
       
       const dr = getAccountByCode(drCode) || { name: lang==='ar'?'حساب الالتزام':'Liability Account', account_code: drCode || '????' }
       const cr = getAccountByCode(form.payment_account_code)
       return { dr, cr }
    }
    return { dr: null, cr: null }
  }, [form.expense_type, form.account_code, form.payment_account_code, form.payment_details, accounts, lang])

  const requiredPerm = useMemo(()=>{
    const t = String(form.expense_type||'expense')
    if (t==='withdraw') return 'cash.withdraw'
    if (t==='deposit') return 'cash.deposit'
    if (t==='payment') return 'expenses:create' 
    if (t==='ar_settlement') return 'journal.create'
    return 'expenses:create'
  }, [form.expense_type])
  const canSubmit = can(requiredPerm) && !submitting

  // Auto-set Payment Method for special types
  useEffect(() => {
    if (editingId) return
    if (form.expense_type==='withdraw') {
      const cash = cashAccounts[0]
      const bank = bankAccounts[0]
      setForm(prev => ({ ...prev, payment_method: 'bank', account_code: cash ? cash.account_code : (prev.account_code||'1110'), payment_account_code: bank ? bank.account_code : (prev.payment_account_code||'1010') }))
    } else if (form.expense_type==='deposit') {
      const bank = bankAccounts[0]
      const cash = cashAccounts[0]
      setForm(prev => ({ ...prev, payment_method: 'bank', account_code: bank ? bank.account_code : (prev.account_code||'1121'), payment_account_code: cash ? cash.account_code : (prev.payment_account_code||'1111') }))
    } else if (form.expense_type==='payment') {
      // Default for payment
      setForm(prev => ({ ...prev, payment_method: 'bank' }))
    } else if (form.expense_type==='expense') {
      const cash = cashAccounts[0]
      setForm(prev => ({ ...prev, payment_account_code: cash ? cash.account_code : (prev.payment_account_code||'1110') }))
    }
  }, [form.expense_type, cashAccounts, bankAccounts, editingId])

  useEffect(() => {
    if (editingId) return
    if (form.expense_type!=='expense' && form.expense_type!=='payment') return
    const method = String(form.payment_method||'cash').toLowerCase()
    if (method==='cash') {
      const cash = cashAccounts[0]
      setForm(prev => ({ ...prev, payment_account_code: cash ? cash.account_code : '1111' }))
    } else if (method==='bank') {
      setForm(prev => ({ ...prev, payment_account_code: '' }))
    }
  }, [form.payment_method, form.expense_type, cashAccounts, editingId])

  function onSelectAccount(code){
    const acc = getAccountByCode(code)
    if (!acc) { setSelectedAcc(null); return }
    const t = String(form.expense_type||'expense')
    if (t==='withdraw'){
      const isBank = String(acc.type||'').toLowerCase()==='bank'
      const cashDefault = (accounts.find(a => String(a.type||'').toLowerCase()==='cash')?.account_code) || '1110'
      const bankDefault = (accounts.find(a => String(a.type||'').toLowerCase()==='bank')?.account_code) || '1010'
      if (isBank){ setForm({ ...form, account_code: cashDefault, payment_account_code: acc.account_code }) }
      else { setForm({ ...form, account_code: acc.account_code, payment_account_code: bankDefault }) }
    } else if (t==='deposit'){
      const cashDefault = (accounts.find(a => String(a.type||'').toLowerCase()==='cash')?.account_code) || '1111'
      setForm({ ...form, account_code: acc.account_code, payment_account_code: cashDefault })
    } else {
      // expense: keep selected debit account in form and sync first item
      const nextItems = (form.items||[]).map((it, idx) => idx===0 ? { ...it, account_code: acc.account_code } : it)
      setForm({ ...form, account_code: acc.account_code, items: nextItems })
    }
    setSelectedAcc(acc||null)
  }

  // Payment Logic Handlers
  function toggleInvoiceSelection(invId) {
    const currentIds = form.payment_details.invoice_ids || []
    const isSelected = currentIds.includes(invId)
    let newIds = []
    if (isSelected) newIds = currentIds.filter(id => id !== invId)
    else newIds = [...currentIds, invId]

    setForm(prev => {
        // Calculate total due for selected invoices
        const total = unpaidInvoices.filter(inv => newIds.includes(inv.id)).reduce((sum, inv) => sum + parseFloat(inv.total||0) - parseFloat(inv.paid_amount||0), 0)
        return {
            ...prev,
            // If partial is NOT selected, update amount to match total. If partial, keep user input (or set to total if empty?)
            // Ideally, if switching selection, we might want to guide the user, but for now let's respect manual entry if partial.
            amount: !prev.payment_details.is_partial ? total.toFixed(2) : prev.amount,
            payment_details: { ...prev.payment_details, invoice_ids: newIds }
        }
    })
  }

  function handlePayrollSelect(runId, total) {
      setForm(prev => ({
          ...prev,
          amount: !prev.payment_details.is_partial ? (total ? parseFloat(total).toFixed(2) : '') : prev.amount,
          payment_details: { ...prev.payment_details, payroll_run_id: runId }
      }))
  }

  // Effect to reset amount to full when unchecking "Partial"
  useEffect(() => {
    if (form.expense_type === 'payment' && !form.payment_details.is_partial) {
        let total = 0
        if (form.payment_details.payment_type === 'supplier') {
            total = unpaidInvoices.filter(inv => (form.payment_details.invoice_ids||[]).includes(inv.id))
                                  .reduce((sum, inv) => sum + parseFloat(inv.total||0) - parseFloat(inv.paid_amount||0), 0)
        } else if (form.payment_details.payment_type === 'salary') {
            const run = payrollRuns.find(r => r.id === form.payment_details.payroll_run_id)
            if (run) total = parseFloat(run.total_net_salary)
        } else if (form.payment_details.payment_type === 'vat') {
            // Re-trigger VAT balance check if needed, or just leave it. 
            // The existing VAT effect will run if we depend on is_partial, but it doesn't currently.
            // Let's manually trigger logic or let the user handle it. 
            // Actually the VAT effect runs on type change. 
        }
        if (total > 0) setForm(prev => ({ ...prev, amount: total.toFixed(2) }))
    }
  }, [form.payment_details.is_partial, form.expense_type, form.payment_details.payment_type])

  async function submit(){
    if (submitting) return
    setError(''); setToast('')
    setSubmitting(true)
    try {
      if (!form.expense_type) { setError(lang==='ar'?'يرجى اختيار نوع العملية':'Please select transaction type'); return }
      if (!form.date) { setError(lang==='ar'?'يرجى اختيار التاريخ':'Please select a date'); return }
      
      let payloadAmount = 0
      let itemsPayload = []

      if (form.payment_method === 'bank' && !form.payment_account_code) {
          setError(lang==='ar'?'يرجى اختيار حساب البنك':'Please select bank account'); return
      }

      if (form.expense_type === 'expense') {
        const validItems = (form.items||[]).filter(it => it.amount && it.account_code)
        if (validItems.length === 0) { setError(lang==='ar'?'يرجى إضافة بند واحد على الأقل':'Add at least one valid item'); return }
        
        itemsPayload = form.items.map(it => ({
            ...it,
            amount: parseFloat(it.amount||0),
            account_code: it.account_code,
            description: it.description,
            include_tax: it.include_tax
        }))
        
        for (const it of itemsPayload) {
             if (!it.account_code) { setError(lang==='ar'?'يرجى اختيار الحساب لكل البنود':'Select account for all items'); return }
             if (isNaN(it.amount) || it.amount <= 0) { setError(lang==='ar'?'يرجى إدخال مبلغ صحيح لكل البنود':'Enter valid amount for all items'); return }
             
             const acc = getAccountByCode(it.account_code)
             if (acc) {
                if (String(acc.account_code)==='5210' || String(acc.account_code)==='5120') { setError(lang==='ar'?`الحساب ${acc.account_code} محجوب من الإدخال اليدوي`:`Account ${acc.account_code} is restricted`); return }
                if (acc.allow_manual_entry===false) { setError(lang==='ar'?`الحساب ${acc.account_code} محجوب`:`Account ${acc.account_code} is restricted`); return }
             }
        }
        payloadAmount = expensesTotals.total
      } else {
        const amtNum = parseFloat(form.amount||0)
        // For payment, account_code might be auto-determined or generic, so check strictly only if not payment or if payment requires manual acc
        if (form.expense_type !== 'payment' && !form.account_code) { setError(lang==='ar'?'يرجى اختيار الحساب':'Please select an account'); return }
        if (isNaN(amtNum) || amtNum<=0) { setError(lang==='ar'?'يرجى إدخال مبلغ صحيح':'Enter a valid amount'); return }
        payloadAmount = amtNum
      }
      
      // Validate Payment Amounts and Required Fields
      if (form.expense_type === 'payment') {
          if (form.payment_details.payment_type === 'supplier') {
              if (!form.payment_details.supplier_id) { setError(lang==='ar'?'يرجى اختيار المورد':'Please select supplier'); return }
              if (form.payment_details.is_partial) {
                 const totalDue = unpaidInvoices.filter(inv => (form.payment_details.invoice_ids||[]).includes(inv.id))
                                       .reduce((sum, inv) => sum + parseFloat(inv.total||0) - parseFloat(inv.paid_amount||0), 0)
                 const currentAmt = parseFloat(form.amount || 0)
                 // Allow small floating point difference
                 if (currentAmt > totalDue + 0.1) {
                     setError(lang==='ar' ? `المبلغ المدخل (${currentAmt}) أكبر من المستحق (${totalDue.toFixed(2)})` : `Amount (${currentAmt}) exceeds due amount (${totalDue.toFixed(2)})`)
                     return
                 }
              }
          } else if (form.payment_details.payment_type === 'salary') {
              if (!form.payment_details.payroll_run_id) { setError(lang==='ar'?'يرجى اختيار مسير الرواتب':'Please select payroll run'); return }
          } else if (form.payment_details.payment_type === 'utility') {
              if (!form.payment_details.service_type) { setError(lang==='ar'?'يرجى اختيار نوع الخدمة':'Please select service type'); return }
          } else if (form.payment_details.payment_type === 'gov') {
              if (!form.payment_details.gov_entity) { setError(lang==='ar'?'يرجى اختيار الجهة الحكومية':'Please select government entity'); return }
          }
      }
      
      const autoCC = form.cost_center || 'CC-001'
      if (form.expense_type==='expense' && !autoCC) { setError(lang==='ar'?'يرجى إدخال مركز تكلفة':'Please enter cost center'); return }
      if (!canSubmit) { setError(lang==='ar'?`غير مصرح: تحتاج صلاحية ${requiredPerm}`:`Forbidden: Requires ${requiredPerm}`); return }
      
      if (form.expense_type !== 'expense' && form.expense_type !== 'payment') {
        const acc = selectedAcc
        if (acc && (String(acc.account_code)==='5210' || String(acc.account_code)==='5120')) { setError(lang==='ar'?'هذا الحساب محجوب من الإدخال اليدوي':'This account is restricted from manual entry'); return }
        if (acc && acc.allow_manual_entry===false) { setError(lang==='ar'?'محجوب: الإدخال اليدوي غير مسموح':'Restricted: manual entry not allowed'); return }
      }

      const attachments = { 
          branch: form.branch || undefined, 
          cost_center: form.expense_type==='expense' ? autoCC : undefined,
          payment_details: form.expense_type==='payment' ? form.payment_details : undefined
      }
      
      const pm = (form.expense_type==='expense' || form.expense_type==='payment') ? form.payment_method : 'bank'
      
      // Determine account code for payment
      let finalAccountCode = form.account_code
      if (form.expense_type === 'payment') {
          // Helper to find account by code or name
          const findAcc = (code, keywords) => {
             const exact = accounts.find(a => String(a.account_code) === code)
             if (exact) return exact.account_code
             if (keywords && keywords.length) {
                 const match = accounts.find(a => keywords.some(k => (a.name||'').includes(k) || (a.name_en||'').toLowerCase().includes(k.toLowerCase())))
                 if (match) return match.account_code
             }
             return code // Return code anyway, backend might find it if frontend list is incomplete
          }

          if (form.payment_details.payment_type === 'supplier') finalAccountCode = findAcc('2111', ['مورد', 'Supplier', 'Trade Payable'])
          else if (form.payment_details.payment_type === 'salary') finalAccountCode = findAcc('2121', ['رواتب', 'Payroll', 'Salaries', 'Accrued'])
          else if (form.payment_details.payment_type === 'vat') finalAccountCode = findAcc('2141', ['ضريبة', 'VAT', 'Settlement'])
          else if (form.payment_details.payment_type === 'gov') {
             if (form.payment_details.gov_entity === 'GOSI') finalAccountCode = findAcc('2131', ['تأمينات', 'GOSI', 'Social'])
             else finalAccountCode = findAcc('2130', ['مستحقة', 'Accrued', 'حكومية'])
          }
          else if (form.payment_details.payment_type === 'utility') finalAccountCode = findAcc('2130', ['مستحقة', 'Accrued', 'حكومية'])
          else finalAccountCode = form.account_code || '2000' 
      } else if (form.expense_type === 'expense') {
          finalAccountCode = itemsPayload[0]?.account_code
      }

      if (form.expense_type === 'payment' && !finalAccountCode) {
          setError(lang==='ar'?'لم يتم العثور على حساب محاسبي مناسب لهذا النوع من السداد':'No suitable accounting account found for this payment type'); return
      }

      const payload = { 
          date: form.date, 
          invoice_number: form.document_number, 
          amount: payloadAmount, 
          description: form.description, 
          payment_method: pm, 
          account_code: finalAccountCode, 
          payment_account_code: form.payment_account_code, 
          expense_type: form.expense_type, 
          attachments, 
          items: form.expense_type==='expense' ? itemsPayload : undefined,
          payment_details: form.expense_type==='payment' ? form.payment_details : undefined
          // ✅ Backend will create as draft, then post automatically, and delete if posting fails
      }
      
      if (editingId) {
        await apiExpenses.update(editingId, payload)
        setToast(lang==='ar'?'تم تعديل الفاتورة':'Invoice updated')
        setEditingId(null)
      } else {
        // ✅ Backend handles: create as draft → post automatically → delete if posting fails
        try {
          const createdExpense = await apiExpenses.create(payload)
          
          if (!createdExpense || !createdExpense.id) {
            setError(lang==='ar'?'فشل إنشاء المصروف':'Failed to create expense')
            return
          }
          
          // ✅ Backend already posted the expense automatically
          // If posting failed, backend deleted the expense and returned error
          if (createdExpense.status === 'posted') {
            setToast(lang==='ar'?'تم إنشاء وترحيل المصروف بنجاح':'Expense created and posted successfully')
          } else {
            setError(lang==='ar'?'لم يتم ترحيل المصروف':'Expense was not posted') // Should not happen
          }
        } catch (createError) {
          // Backend already deleted expense if posting failed
          const errorDetails = createError?.response?.data?.details || createError?.response?.data?.error || createError?.message || 'unknown'
          setError(lang==='ar'?`فشل إنشاء/ترحيل المصروف: ${errorDetails}`:`Failed to create/post expense: ${errorDetails}`)
          return
        }
      }
      const resetPaymentDetails = {
        payment_type: '',
        supplier_id: '',
        invoice_ids: [],
        payroll_run_id: '',
        service_type: '',
        account_number: '',
        period_type: 'quarter',
        period_year: new Date().getFullYear(),
        period_value: '1',
        declaration_number: '',
        gov_entity: '',
        reference_number: '',
        is_partial: false
      }
      setSelectedAcc(null)
      setForm(prev => ({
        ...prev,
        document_number: '',
        amount: '',
        description: '',
        payment_account_code: '',
        items: [{ id: Date.now(), amount: '', account_code: '', description: '', include_tax: false }],
        payment_details: prev.expense_type==='payment' ? resetPaymentDetails : prev.payment_details
      }))
      const ls = await apiExpenses.list(filters); setList(ls||[])
      setTimeout(()=>{ setToast('') }, 1500)
    } catch (e) {
      console.error(e)
      const code = String(e?.code||'')
      const msg = e?.response?.data?.error || e?.message || code
      setError(lang==='ar'?'فشل في تنفيذ العملية: ' + msg : 'Failed: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  const rows = useMemo(()=> list, [list])
  const title = form.expense_type==='withdraw' ? (lang==='ar'?'عملية سحب نقدي':'Cash Withdrawal') : 
                form.expense_type==='deposit' ? (lang==='ar'?'عملية إيداع نقدي':'Cash Deposit') : 
                form.expense_type==='payment' ? (lang==='ar'?'تسوية سداد':'Payment Settlement') :
                form.expense_type==='ar_settlement' ? (lang==='ar'?'تسوية الذمم المدينة':'Accounts Receivable Settlement') :
                (lang==='ar'?'إضافة فاتورة مصروف':'Add Expense Invoice')
  const nonExpenseNote = form.expense_type!=='expense'

  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      <header className="px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
              <FaReceipt className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{lang==='ar'?"المصروفات":"Expenses"}</h2>
              <p className="text-sm opacity-90">{lang==='ar'?'إدارة المصروفات والسداد':'Manage Expenses & Payments'}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${location.pathname==='/expenses'?'bg-white text-primary-700 border-white':'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}>
              <FaPlus className="text-sm" />
              <span className="text-sm">{lang==='ar'?'إنشاء فاتورة':'Create Invoice'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${location.pathname==='/expenses/invoices'?'bg-white text-primary-700 border-white':'bg-white/10 text-white border-white/20 hover:bg-white/20'}`} onClick={() => navigate('/expenses/invoices')}>
              <FaList className="text-sm" />
              <span className="text-sm">{lang==='ar'?'قائمة الفواتير':'Invoices List'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 backdrop-blur-sm border border-white/20" onClick={() => navigate('/')}>
              <FaHome className="text-sm" />
              <span className="text-sm">{lang==='ar'?'الرئيسية':'Home'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 backdrop-blur-sm border border-white/20" onClick={() => setHelpOpen(true)}>
              <span className="text-sm">{lang==='ar'?'المساعدة':'Help'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 backdrop-blur-sm border border-white/20" onClick={async()=>{ try { const res = await apiExpenses.list(filters); setList(res||[]) } catch {} }}>
              <span className="text-sm">{lang==='ar'?'تحديث':'Reload'}</span>
            </motion.button>
            <button className="px-3 py-1 rounded-md border border-white/30 text-sm hover:bg-white/10" onClick={()=>{ const next = lang==='ar'?'en':'ar'; setLang(next); localStorage.setItem('lang', next) }}>{lang==='ar'?'EN':'عربي'}</button>
            <span className="px-2 py-1 bg-white/10 rounded-lg border border-white/20"><StatusBadge status={periodStatus} type="period" /></span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="lg:col-span-8 bg-white border rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
              {form.expense_type === 'payment' ? <FaMoneyBillWave /> : <FaPlus />}
            </div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3 mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'نوع العملية':'Transaction Type'}</label>
              <div className="flex gap-2 flex-wrap">
                {['expense','withdraw','deposit','payment','ar_settlement'].map(t => (
                  <button key={t} onClick={()=>{ if (!editingId) setForm({...form, expense_type: t}) }} disabled={!!editingId}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${form.expense_type===t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${editingId ? 'opacity-60 cursor-not-allowed' : ''} ${t==='payment'?'ring-2 ring-purple-100':''}`}>
                    {t==='expense' ? (lang==='ar'?'مصروف':'Expense') : 
                     t==='withdraw' ? (lang==='ar'?'سحب نقدي':'Withdrawal') : 
                     t==='deposit' ? (lang==='ar'?'إيداع نقدي':'Deposit') : 
                     t==='payment' ? (lang==='ar'?'سداد (تسوية)':'Payment') :
                     (lang==='ar'?'تسوية الذمم المدينة':'AR Settlement')}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'التاريخ':'Date'}</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'رقم المرجع / الفاتورة':'Reference No.'}</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600" placeholder={form.document_number || 'Auto'} value={form.document_number} onChange={e=>setForm({...form, document_number: e.target.value})} />
            </div>

            {/* PAYMENT SETTLEMENT SECTION */}
            {form.expense_type === 'payment' && (
                <div className="col-span-3 bg-purple-50 p-4 rounded-xl border border-purple-200 mb-4 animate-fadeIn">
                    <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2"><FaMoneyBillWave /> {lang==='ar'?'قسم السداد (Smart Settlement)':'Payment Settlement'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'نوع السداد':'Payment Type'} ⭐</label>
                            <select className="w-full border-purple-300 rounded-lg p-2 focus:ring-purple-500" 
                                value={form.payment_details.payment_type} 
                                onChange={e=>setForm({...form, payment_details: { ...form.payment_details, payment_type: e.target.value, supplier_id: '', invoice_ids: [], payroll_run_id: '' }, amount: '' })}>
                                <option value="">{lang==='ar'?'-- اختر نوع السداد --':'-- Select Payment Type --'}</option>
                                <option value="supplier">{lang==='ar'?'سداد مورد (دائن)':'Supplier Payment'}</option>
                                <option value="utility">{lang==='ar'?'سداد فاتورة خدمات':'Utility Payment'}</option>
                                <option value="salary">{lang==='ar'?'سداد رواتب':'Salary Payment'}</option>
                                <option value="vat">{lang==='ar'?'سداد ضريبة القيمة المضافة':'VAT Payment'}</option>
                                <option value="gov">{lang==='ar'?'سداد حكومي (GOSI, مقيم...)':'Gov Payment'}</option>
                                <option value="other">{lang==='ar'?'أخرى':'Other'}</option>
                            </select>
                        </div>

                        {/* Supplier Payment */}
                        {form.payment_details.payment_type === 'supplier' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'المورد':'Supplier'}</label>
                                    <select className="w-full border-purple-300 rounded-lg p-2" 
                                        value={form.payment_details.supplier_id} 
                                        onChange={e=>setForm({...form, payment_details: { ...form.payment_details, supplier_id: e.target.value, invoice_ids: [] }})}>
                                        <option value="">{lang==='ar'?'اختر المورد':'Select Supplier'}</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{labelName(s, lang)}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'الفواتير المستحقة':'Unpaid Invoices'}</label>
                                    <div className="max-h-40 overflow-y-auto border rounded bg-white p-2">
                                        {unpaidInvoices.length === 0 ? <div className="text-gray-400 text-sm text-center p-2">{lang==='ar'?'لا توجد فواتير مستحقة':'No unpaid invoices'}</div> : 
                                            unpaidInvoices.map(inv => (
                                                <div key={inv.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-0">
                                                    <label className="flex items-center gap-2 cursor-pointer w-full">
                                                        <input type="checkbox" 
                                                            checked={(form.payment_details.invoice_ids||[]).includes(inv.id)} 
                                                            onChange={()=>toggleInvoiceSelection(inv.id)}
                                                            className="text-purple-600 rounded" />
                                                        <span className="text-sm">#{inv.invoice_number} - {String(inv.date).slice(0,10)}</span>
                                                    </label>
                                                    <span className="font-bold text-sm">{(() => { const total=parseFloat(inv.total||0)||0; const paid=parseFloat(inv.paid_amount||0)||0; const remaining=parseFloat(inv.outstanding_amount|| (total - paid))||0; return remaining.toFixed(2) })()} SAR</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Salary Payment */}
                        {form.payment_details.payment_type === 'salary' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'مسيرات الرواتب المرحلة':'Posted Payroll Runs'}</label>
                                <div className="space-y-2">
                                    {payrollRuns.length === 0 ? <div className="text-gray-500 italic">{t('labels.no_data', lang)}</div> :
                                     payrollRuns.map(run => (
                                        <label key={run.id} className={`block border p-3 rounded cursor-pointer ${form.payment_details.payroll_run_id===run.id ? 'bg-purple-100 border-purple-400' : 'bg-white'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" name="payroll" 
                                                    checked={form.payment_details.payroll_run_id===run.id}
                                                    onChange={()=>handlePayrollSelect(run.id, run.total_net_salary)} 
                                                    className="text-purple-600" />
                                                <div>
                                                    <div className="font-bold">{run.month} / {run.year}</div>
                                                    <div className="text-sm text-gray-600">{lang==='ar'?'صافي الرواتب:':'Net Salaries:'} {(parseFloat(String(run.total_net_salary||'0').replace(/[^0-9.-]/g,''))||0).toFixed(2)} SAR</div>
                                                </div>
                                            </div>
                                        </label>
                                     ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Utility Payment */}
                        {form.payment_details.payment_type === 'utility' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'نوع الخدمة':'Service Type'}</label>
                                    <select className="w-full border-purple-300 rounded p-2" value={form.payment_details.service_type} onChange={e=>setForm({...form, payment_details: {...form.payment_details, service_type: e.target.value}})}>
                                        <option value="electricity">{lang==='ar'?'كهرباء':'Electricity'}</option>
                                        <option value="water">{lang==='ar'?'مياه':'Water'}</option>
                                        <option value="telecom">{lang==='ar'?'اتصالات':'Telecom'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'رقم الحساب / الاشتراك':'Account No.'}</label>
                                    <input type="text" className="w-full border-purple-300 rounded p-2" value={form.payment_details.account_number} onChange={e=>setForm({...form, payment_details: {...form.payment_details, account_number: e.target.value}})} />
                                </div>
                            </>
                        )}

                        {/* VAT Payment */}
                        {form.payment_details.payment_type === 'vat' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'الفترة الضريبية':'Tax Period'}</label>
                                    <div className="flex gap-2">
                                        <select className="w-1/3 border-purple-300 rounded p-2 text-sm" value={form.payment_details.period_type} onChange={e=>setForm({...form, payment_details: {...form.payment_details, period_type: e.target.value}})}>
                                            <option value="quarter">{lang==='ar'?'ربع سنوي':'Quarterly'}</option>
                                            <option value="month">{lang==='ar'?'شهري':'Monthly'}</option>
                                        </select>
                                        <select className="w-1/3 border-purple-300 rounded p-2 text-sm" value={form.payment_details.period_value} onChange={e=>setForm({...form, payment_details: {...form.payment_details, period_value: e.target.value}})}>
                                            {form.payment_details.period_type==='quarter' 
                                                ? [1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)
                                                : Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}</option>)
                                            }
                                        </select>
                                        <input type="number" className="w-1/3 border-purple-300 rounded p-2 text-sm" value={form.payment_details.period_year} onChange={e=>setForm({...form, payment_details: {...form.payment_details, period_year: e.target.value}})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'رقم الإقرار (اختياري)':'Declaration No (Optional)'}</label>
                                    <input type="text" className="w-full border-purple-300 rounded p-2" value={form.payment_details.declaration_number} onChange={e=>setForm({...form, payment_details: {...form.payment_details, declaration_number: e.target.value}})} />
                                </div>
                            </>
                        )}

                        {/* Government Payment */}
                        {form.payment_details.payment_type === 'gov' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'الجهة':'Entity'}</label>
                                    <select className="w-full border-purple-300 rounded p-2" value={form.payment_details.gov_entity} onChange={e=>setForm({...form, payment_details: {...form.payment_details, gov_entity: e.target.value}})}>
                                        <option value="">{lang==='ar'?'اختر الجهة':'Select Entity'}</option>
                                        <option value="GOSI">{lang==='ar'?'التأمينات الاجتماعية (GOSI)':'GOSI'}</option>
                                        <option value="Zakat">{lang==='ar'?'الزكاة والدخل':'Zakat & Tax'}</option>
                                        <option value="Labor">{lang==='ar'?'مكتب العمل (قوى)':'Labor Office (Qiwa)'}</option>
                                        <option value="Muqeem">{lang==='ar'?'مقيم':'Muqeem'}</option>
                                        <option value="Other">{lang==='ar'?'أخرى':'Other'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-purple-900 mb-1">{lang==='ar'?'رقم مرجعي (اختياري)':'Reference No (Optional)'}</label>
                                    <input type="text" className="w-full border-purple-300 rounded p-2" value={form.payment_details.reference_number} onChange={e=>setForm({...form, payment_details: {...form.payment_details, reference_number: e.target.value}})} />
                                </div>
                            </>
                        )}

                        {/* Partial Payment Toggle */}
                        {form.payment_details.payment_type && (
                            <div className="md:col-span-2 pt-2 border-t mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" 
                                        checked={form.payment_details.is_partial} 
                                        onChange={e=>setForm({...form, payment_details: {...form.payment_details, is_partial: e.target.checked}})}
                                        className="rounded text-purple-600 focus:ring-purple-500 w-5 h-5" />
                                    <span className="font-bold text-purple-900">{lang==='ar'?'سداد جزئي (تعديل المبلغ يدوياً)':'Partial Payment (Edit Amount Manually)'}</span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {form.expense_type === 'ar_settlement' && (
              <div className="col-span-3 bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
                <div className="font-bold text-blue-800 mb-3">{lang==='ar'?'تسوية الذمم المدينة':'Accounts Receivable Settlement'}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-blue-900 mb-1">{lang==='ar'?'نوع الذمم':'Receivable Type'}</label>
                    <select className="w-full border-blue-300 rounded-lg p-2" value={arType} onChange={async e=>{ const v=e.target.value; setArType(v); setArEntities([]); setArEntityId(''); setArBalances([]); setArAmounts({}); if (v==='customers'){ try{ const ps=await apiPartners.list({ type: 'customer', include_disabled: 1 }); setArEntities(Array.isArray(ps)?ps:[]) }catch{} } else if (v==='advances'){ try{ const es=await apiEmployees.list(); setArEntities(es||[]) }catch{} } }}>
                      <option value="">{lang==='ar'?'اختر النوع':'Select type'}</option>
                      <option value="customers">{lang==='ar'?'العملاء (1210)':'Customers (1210)'}</option>
                      <option value="advances">{lang==='ar'?'السلف والأمانات (1220)':'Advances & Deposits (1220)'}</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-blue-900 mb-1">{lang==='ar'?'الجهة':'Entity'}</label>
                    <select className="w-full border-blue-300 rounded-lg p-2" value={arEntityId} onChange={async e=>{ const id=e.target.value; setArEntityId(id); setArBalances([]); setArAmounts({}); if (!id) return; if (arType==='customers'){ try{ const invs=await apiInvoices.list({ partner_id: id, type: 'sale' }); const rows=(invs?.items||invs||[]); const mapped=rows.map(r=>{ const total = parseFloat(r.total||0)||0; const paid = parseFloat(r.paid_amount||0)||0; const outstanding = Math.max(0, parseFloat(r.outstanding_amount|| (total - paid))||0); return { id:r.id, ref:r.invoice_number, date:String(r.date||'').slice(0,10), original: total, paid, outstanding } }).filter(x=> (x.outstanding||0) > 0); setArBalances(mapped) }catch{} } else if (arType==='advances'){ try{ const emp = (arEntities||[]).find(e=>String(e.id)===String(id)); const bal = parseFloat(emp?.advance_balance||0); const ref = emp?.employee_number || String(emp?.id||''); const dt = emp?.advance_due_month || ''; const rows = bal>0 ? [{ id: String(id)+'-adv', ref: ref, date: dt || '', original: bal, paid: 0, outstanding: bal }] : []; setArBalances(rows) }catch{} } }}>
                      <option value="">{lang==='ar'?'اختر الجهة':'Select entity'}</option>
                      {arEntities.map(e => <option key={e.id} value={e.id}>{labelName(e, lang)}{e.phone?` • ${e.phone}`:''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="border rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 bg-blue-100 text-blue-900 text-sm font-semibold p-2">
                      <div className="col-span-3">{lang==='ar'?'المرجع':'Reference'}</div>
                      <div className="col-span-2">{lang==='ar'?'التاريخ':'Date'}</div>
                      <div className="col-span-2">{lang==='ar'?'المبلغ الأصلي':'Original'}</div>
                      <div className="col-span-2">{lang==='ar'?'المدفوع':'Paid'}</div>
                      <div className="col-span-3">{lang==='ar'?'الرصيد القائم':'Outstanding'}</div>
                    </div>
                    {arBalances.length===0 ? <div className="p-3 text-center text-gray-500 text-sm">{lang==='ar'?'لا توجد أرصدة مفتوحة':'No open balances'}</div> : arBalances.map(row => (
                      <div key={row.id} className="grid grid-cols-12 p-2 border-t">
                        <div className="col-span-3 text-sm">{row.ref}</div>
                        <div className="col-span-2 text-sm">{row.date}</div>
                        <div className="col-span-2 font-bold text-sm">{(Number(row.original)||0).toFixed(2)} SAR</div>
                        <div className="col-span-2 font-bold text-sm">{(Number(row.paid)||0).toFixed(2)} SAR</div>
                        <div className="col-span-3 font-bold text-sm">{(Number(row.outstanding)||0).toFixed(2)} SAR</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-semibold mb-2">{lang==='ar'?'مصدر التسوية':'Settlement Source'}</div>
                  <div className="space-y-2">
                    {arPayments.map((p, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <select className="w-full border rounded p-2" value={p.method} onChange={e=>{ const m=e.target.value; setArPayments(prev=> prev.map((x,i)=> i===idx? { ...x, method: m } : x)) }}>
                            <option value="">{lang==='ar'?'اختر الطريقة':'Select method'}</option>
                            <option value="cash">{lang==='ar'?'نقد':'Cash'}</option>
                            <option value="bank">{lang==='ar'?'بنك':'Bank'}</option>
                          </select>
                        </div>
                        <div className="col-span-5">
                          <label className="block text-xs text-gray-600 mb-1">{lang==='ar'?'مبلغ الدفع':'Payment Amount'}</label>
                          <input className="w-full border rounded p-2" placeholder={lang==='ar'?'قيمة الدفع':'Payment value'} value={p.amount} onChange={e=>{ const v=e.target.value; let s=v; s=s.replace(/[^0-9.]/g,''); setArPayments(prev=> prev.map((x,i)=> i===idx? { ...x, amount: s } : x)) }} />
                        </div>
                        <div className="col-span-3 flex gap-2">
                          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={()=> setArPayments(prev=> [...prev, { method:'', amount:'' }])}>{lang==='ar'?'إضافة طريقة':'Add Method'}</button>
                          {arPayments.length>1 && <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={()=> setArPayments(prev=> prev.filter((_,i)=> i!==idx))}>{lang==='ar'?'حذف':'Remove'}</button>}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-12 gap-2 mt-2">
                      <div className="col-span-6">
                        <label className="block text-sm font-medium text-blue-900 mb-1">{lang==='ar'?'رقم المرجع (اختياري)':'Reference Number (optional)'}</label>
                        <input className="w-full border rounded p-2" placeholder={lang==='ar'?'إن وُجد':'If available'} value={arReference} onChange={e=> setArReference(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-gray-700">{lang==='ar'?'إجمالي التسوية':'Total Settlement'}: {arPayments.reduce((s,x)=> s + (parseFloat(x.amount||0)||0), 0).toFixed(2)} SAR</div>
                </div>
                {arError && <div className="mt-2 text-red-600 text-sm">{arError}</div>}
                <div className="mt-4 border rounded-xl">
                  <div className="p-2 bg-gray-100 text-gray-800 font-semibold text-sm">{lang==='ar'?'المعاينة المحاسبية':'Accounting Preview'}</div>
                  <div className="p-3 text-sm">
                    <div className="font-semibold mb-1">{lang==='ar'?'مدين':'Debit'}</div>
                    <div className="space-y-1">
                      {arPayments.map((p,idx)=>{ const n = parseFloat(p.amount||0)||0; if (!(n>0)) return null; const code = p.method==='cash'?'1110': p.method==='bank'?'1120':''; const acc = accounts.find(a=> String(a.account_code)===code); return <div key={idx}>{code} • {labelName(acc||{name:'',name_en:''}, lang)} • {n.toFixed(2)} SAR</div> })}
                    </div>
                    <div className="font-semibold mt-3 mb-1">{lang==='ar'?'دائن':'Credit'}</div>
                    <div>{arType==='customers'?'1210':'1220'} • {(labelName(accounts.find(a=> String(a.account_code)===(arType==='customers'?'1210':'1220'))||{name:'',name_en:''}, lang))} • {arPayments.reduce((s,x)=> s + (parseFloat(x.amount||0)||0), 0).toFixed(2)} SAR</div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={async ()=>{
                    setArError('')
                    const tPay = arPayments.reduce((s,x)=> s + (parseFloat(x.amount||0)||0), 0)
                    if (!(tPay>0)) { setArError(lang==='ar'?'أدخل مبلغ الدفع':'Enter payment amount'); return }
                    if (!arType) { setArError(lang==='ar'?'اختر نوع الذمم':'Select receivable type'); return }
                    if (!arEntityId) { setArError(lang==='ar'?'اختر الجهة':'Select entity'); return }
                    try {
                      if (arType === 'customers') {
                        const wanted = {}
                        for (const row of arBalances) { const n = parseFloat(row.outstanding||0)||0; if (n>0) wanted[row.id] = n }
                        const order = arBalances.map(r=> r.id).filter(id => wanted[id]>0)
                        for (const p of arPayments) {
                          let amt = parseFloat(p.amount||0)||0
                          const type = p.method==='cash' ? 'cash' : 'bank'
                          for (const id of order) {
                            const need = wanted[id]||0
                            if (need<=0) continue
                            const take = Math.min(amt, need)
                            if (take>0) {
                              await apiPayments.create({ partner_id: Number(arEntityId), invoice_id: Number(id), amount: take, type, date: form.date || new Date().toISOString().slice(0,10), reference: arReference || undefined })
                              wanted[id] = Number((need - take).toFixed(4))
                              amt = Number((amt - take).toFixed(4))
                            }
                            if (amt<=0) break
                          }
                          if (amt>1e-6) { throw new Error(lang==='ar'?'مبلغ الدفع أكبر من الرصيد القائم':'Payment exceeds outstanding') }
                        }
                        setToast(lang==='ar'?'تم تسجيل التسوية':'Settlement recorded')
                        try { localStorage.setItem('invoices_refresh', JSON.stringify({ partner_id: Number(arEntityId), at: Date.now() })) } catch {}
                        // Reload balances
                        try {
                          const invs = await apiInvoices.list({ partner_id: arEntityId, type: 'sale' })
                          const rows = (invs?.items||invs||[])
                          const mapped = rows.map(r=>{ const total = parseFloat(r.total||0)||0; const paid = parseFloat(r.paid_amount||0)||0; const outstanding = Math.max(0, parseFloat(r.outstanding_amount|| (total - paid))||0); return { id:r.id, ref:r.invoice_number, date:String(r.date||'').slice(0,10), original: total, paid, outstanding } }).filter(x=> (x.outstanding||0) > 0)
                          setArBalances(mapped)
                        } catch {}
                      } else {
                        const flat = flatten(tree)
                        const accCash = flat.find(a=> String(a.account_code)==='1110')
                        const accBank = flat.find(a=> String(a.account_code)==='1120')
                        const accCr = flat.find(a=> String(a.account_code)===(arType==='customers'?'1210':'1220'))
                        const postings = []
                        for (const p of arPayments){ const n = parseFloat(p.amount||0)||0; if (!(n>0)) continue; if (p.method==='cash' && accCash) postings.push({ account_id: accCash.id, debit: n, credit: 0 })
                          else if (p.method==='bank' && accBank) postings.push({ account_id: accBank.id, debit: n, credit: 0 }) }
                        if (accCr) postings.push({ account_id: accCr.id, debit: 0, credit: tPay })
                        const entry = await apiJournal.create({ date: form.date || new Date().toISOString().slice(0,10), description: 'تسوية سلف وأمانات', postings, reference_type: 'advance_settlement', reference_id: Number(arEntityId) })
                        await apiJournal.postEntry(entry.id)
                        setToast(lang==='ar'?'تم ترحيل التسوية':'Settlement posted')
                      }
                      setArType(''); setArEntities([]); setArEntityId(''); setArBalances([]); setArAmounts({}); setArPayments([{ method:'', amount:'' }])
                      setArReference('')
                    } catch(e){ setArError(e?.response?.data?.error || e.message || 'failed') }
                  }}>{lang==='ar'?'تأكيد التسوية':'Confirm Settlement'}</button>
                </div>
              </div>
            )}

            {form.expense_type === 'expense' ? (
              <div className="col-span-3 space-y-4">
                 {/* ... Expense Items Logic (Existing) ... */}
                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{lang==='ar'?'بنود المصروف':'Expense Items'}</label>
                    {(form.items||[]).map((item, idx) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="md:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'الحساب':'Account'}</label>
                            <select className="w-full text-sm border rounded p-1" value={item.account_code} onChange={e=>updateItem(item.id, 'account_code', e.target.value)}>
                              <option value="">{lang==='ar'?'اختر الحساب':'Select Account'}</option>
                              {accounts.filter(a => String(a.type||'').toLowerCase()==='expense' || ['2130', '2140'].includes(String(a.account_code))).map(a => (
                                <option key={a.id} value={a.account_code}>{String(a.account_code).padStart(4,'0')} • {labelName(a, lang)}</option>
                              ))}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'الوصف':'Description'}</label>
                            <input type="text" className="w-full text-sm border rounded p-1" placeholder={lang==='ar'?'وصف البند':'Item Description'} value={item.description} onChange={e=>updateItem(item.id, 'description', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">{lang==='ar'?'المبلغ':'Amount'}</label>
                            <input inputMode="decimal" className="w-full text-sm border rounded p-1" placeholder="0.00" value={item.amount} onChange={e=>updateItem(item.id, 'amount', sanitizeDecimal(e.target.value))} />
                        </div>
                        <div className="md:col-span-2 flex items-center pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={item.include_tax} onChange={e=>updateItem(item.id, 'include_tax', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500" />
                              <span className="text-xs text-gray-600">{lang==='ar'?'شامل الضريبة':'Inc. VAT'}</span>
                            </label>
                        </div>
                        <div className="md:col-span-2 pt-5 text-end">
                            <button onClick={()=>removeItem(item.id)} className="text-red-600 hover:text-red-800 text-sm px-2 py-1"><FaTags className="inline mb-1" /> {lang==='ar'?'حذف':'Remove'}</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={addItem} className="text-primary-600 text-sm font-medium hover:text-primary-800 flex items-center gap-1"><FaPlus /> {lang==='ar'?'إضافة بند جديد':'Add New Item'}</button>
                 </div>
                 
                 <div className="flex justify-end gap-4 p-3 bg-primary-50 rounded-lg border border-primary-100">
                    <div className="text-end">
                       <div className="text-xs text-gray-600">{lang==='ar'?'الإجمالي':'Total'}</div>
                       <div className="font-bold text-lg">{expensesTotals.total.toLocaleString(undefined, {minimumFractionDigits:2})} <span className="text-xs font-normal">SAR</span></div>
                    </div>
                    {expensesTotals.tax > 0 && (
                        <div className="text-end border-s border-primary-200 ps-4">
                           <div className="text-xs text-gray-600">{lang==='ar'?'الضريبة (من الإجمالي)':'VAT (Included)'}</div>
                           <div className="font-bold text-lg text-amber-700">{expensesTotals.tax.toLocaleString(undefined, {minimumFractionDigits:2})} <span className="text-xs font-normal">SAR</span></div>
                        </div>
                    )}
                 </div>
              </div>
            ) : (
              <>
                {form.expense_type !== 'ar_settlement' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'المبلغ':'Amount'}</label>
                  <div className="flex items-center gap-2">
                    <input inputMode="decimal" lang="en" dir="ltr" 
                        readOnly={form.expense_type==='payment' && !form.payment_details.is_partial && (form.payment_details.payroll_run_id || (form.payment_details.invoice_ids||[]).length > 0 || form.payment_details.payment_type==='vat')}
                        className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${form.expense_type==='payment' && !form.payment_details.is_partial && (form.payment_details.payroll_run_id || (form.payment_details.invoice_ids||[]).length > 0 || form.payment_details.payment_type==='vat') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="0.0000" value={form.amount} onChange={e=>setForm({...form, amount: sanitizeDecimal(e.target.value)})} />
                    <span className="px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium">SAR</span>
                  </div>
                </div>
                )}
                {form.expense_type !== 'ar_settlement' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'الفرع':'Branch'}</label>
                  <div className="flex items-center gap-2">
                    <input type="text" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" placeholder={lang==='ar'?'الفرع الرئيسي':'Main Branch'} value={form.branch} onChange={e=>setForm({...form, branch: e.target.value})} />
                    <span className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm"><FaBuilding /></span>
                  </div>
                </div>
                )}
                
                {form.expense_type !== 'payment' && form.expense_type !== 'ar_settlement' && (
                    <select className="border rounded p-2 col-span-3" value={form.account_code} onChange={e=>onSelectAccount(e.target.value)}>
                    <option value="">{lang==='ar'?'اختر الحساب':'Select Account'}</option>
                    {(form.expense_type==='expense' 
                        ? accounts.filter(a => String(a.type||'').toLowerCase()==='expense') 
                        : (form.expense_type==='withdraw' ? withdrawOptions : bankDropdownOptions)).map(a => (
                        <option key={a.id} value={a.account_code}>{String(a.account_code).padStart(4,'0')} • {labelName(a, lang)}</option>
                    ))}
                    </select>
                )}
                
                {selectedAcc && form.expense_type !== 'ar_settlement' ? (
                  <>
                    <div className="col-span-3 flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 rounded bg-primary-50 text-primary-700 text-xs">{String(selectedAcc.account_code).padStart(4,'0')}</span>
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">{labelName(selectedAcc, lang)}</span>
                    </div>
                    <input type="text" className="border rounded p-2 col-span-3 focus:ring-2 focus:ring-primary-200" placeholder={lang==='ar'?'ملاحظات الفاتورة':'Invoice notes'} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                  </>
                ) : null}
              </>
            )}

            {form.expense_type !== 'ar_settlement' && (
            <div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'طريقة الدفع':'Payment Method'}</label>
                    <div className="grid grid-cols-2 gap-2">
                        <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className={`px-3 py-2 rounded-lg border-2 transition-all ${String(form.payment_method)==='cash'?'bg-amber-500 border-amber-500 text-white shadow-md':'bg-white border-gray-300 text-gray-700 hover:border-amber-300'}`} 
                        onClick={()=>setForm({...form, payment_method:'cash'})}
                        >
                        {lang==='ar'?'نقد':'Cash'}
                        </motion.button>
                        <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className={`px-3 py-2 rounded-lg border-2 transition-all ${String(form.payment_method)==='bank'?'bg-blue-500 border-blue-500 text-white shadow-md':'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}`} 
                        onClick={()=>setForm({...form, payment_method:'bank'})}
                        >
                        {lang==='ar'?'بنك':'Bank'}
                        </motion.button>
                    </div>
                    {String(form.payment_method)==='bank' && (
                        <div className="mt-2">
                            <select className="w-full border rounded p-2 text-sm" value={form.payment_account_code} onChange={e=>setForm({...form, payment_account_code: e.target.value})}>
                            <option value="">{lang==='ar'?'اختر حساب البنك':'Select Bank Account'}</option>
                            {bankDropdownOptions.map(a => (<option key={a.id} value={a.account_code}>{String(a.account_code).padStart(4,'0')} • {labelName(a, lang)}</option>))}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="col-span-3 md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">{lang==='ar'?'ملاحظات عامة':'General Notes'}</label>
                   <input type="text" className="w-full border rounded p-2" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                </div>
            </div>
            )}
            
          </div>
          
          {form.expense_type !== 'ar_settlement' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <h5 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">{lang==='ar'?'المعاينة المحاسبية (القيود)':'Accounting Preview (Entries)'}</h5>
            <div className="flex items-center gap-4 text-sm">
                <div className="flex-1 p-2 bg-white border rounded shadow-sm">
                    <span className="block text-xs text-green-600 font-bold mb-1">{lang==='ar'?'مدين (من)':'Debit (Dr)'}</span>
                    <div className="font-mono text-gray-800">{debitCredit.dr ? `${String(debitCredit.dr.account_code).padStart(4,'0')} - ${labelName(debitCredit.dr, lang)}` : '---'}</div>
                </div>
                <div className="text-gray-400">⬅️</div>
                <div className="flex-1 p-2 bg-white border rounded shadow-sm">
                    <span className="block text-xs text-red-600 font-bold mb-1">{lang==='ar'?'دائن (إلى)':'Credit (Cr)'}</span>
                    <div className="font-mono text-gray-800">{debitCredit.cr ? `${String(debitCredit.cr.account_code).padStart(4,'0')} - ${labelName(debitCredit.cr, lang)}` : '---'}</div>
                </div>
            </div>
          </div>
          )}

          {form.expense_type !== 'ar_settlement' && (
          <div className="mt-6 flex items-center gap-2">
              <motion.button whileHover={{ scale: canSubmit ? 1.02 : 1 }} whileTap={{ scale: canSubmit ? 0.98 : 1 }} disabled={!canSubmit} className={`px-6 py-2 ${canSubmit?'bg-primary-600 hover:bg-primary-700':'bg-gray-300 cursor-not-allowed'} text-white rounded-lg flex items-center gap-2 shadow-md transition-colors`} onClick={submit}>
                <FaPlus /> 
                <span className="font-bold">{editingId ? (lang==='ar'?'حفظ التعديلات':'Update Transaction') : (lang==='ar'?'إتمام العملية':'Complete Transaction')}</span>
              </motion.button>
              {toast && (<div className="px-4 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-medium animate-fadeIn">{toast}</div>)}
              {error && (<div className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium animate-fadeIn">{error}</div>)}
          </div>
          )}
        </motion.section>
        
        <section className="lg:col-span-4 space-y-4">
           {/* Quick Stats */}
           <div className="grid grid-cols-2 gap-3">
             <div className="bg-white border rounded-xl shadow-sm p-4">
               <div className="text-xs text-gray-500 mb-1">{lang==='ar'?'إجمالي المصروفات':'Total Expenses'}</div>
               <div className="text-xl font-bold text-red-600">{rows.filter(r=>r.expense_type==='expense').reduce((s,r)=>s+parseFloat(r.total||0),0).toLocaleString('en-US',{minimumFractionDigits:2})} <span className="text-xs font-normal">SAR</span></div>
             </div>
             <div className="bg-white border rounded-xl shadow-sm p-4">
               <div className="text-xs text-gray-500 mb-1">{lang==='ar'?'عدد الفواتير':'Invoices Count'}</div>
               <div className="text-xl font-bold text-primary-600">{rows.length}</div>
             </div>
           </div>
           
           <div className="bg-white border rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">{lang==='ar'?'تعليمات':'Instructions'}</h3>
              </div>
              <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                <p><strong>1.</strong> {lang==='ar'?'اختر نوع العملية (مصروف، سحب، إيداع، سداد).':'Select transaction type (expense, withdraw, deposit, payment).'}</p>
                <p><strong>2.</strong> {lang==='ar'?'في حال السداد، اختر النوع الفرعي (مورد، رواتب...) لربط العملية آلياً.':'For payments, select subtype for smart linking.'}</p>
                <p><strong>3.</strong> {lang==='ar'?'تأكد من اختيار الحساب البنكي الصحيح عند الدفع البنكي.':'Ensure correct bank account selection for bank payments.'}</p>
                <p><strong>4.</strong> {lang==='ar'?'راجع القيد المحاسبي في الأسفل قبل الحفظ.':'Review accounting entry below before saving.'}</p>
              </div>
           </div>
           
           <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-bold text-blue-800 mb-2 text-sm">{lang==='ar'?'معلومات محاسبية':'Accounting Info'}</h4>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                 <li>{lang==='ar'?'المصروفات تؤثر على قائمة الدخل.':'Expenses affect Income Statement.'}</li>
                 <li>{lang==='ar'?'السداد يغلق الالتزامات ولا يعتبر مصروفاً جديداً.':'Payments settle liabilities, not new expenses.'}</li>
                 <li>{lang==='ar'?'السحب والإيداع يؤثران فقط على النقدية.':'Withdraw/Deposit affect cash only.'}</li>
              </ul>
           </div>
           
           {/* Recent Transactions */}
           <div className="bg-white border rounded-xl shadow-sm p-4">
             <h4 className="font-semibold text-gray-800 mb-3">{lang==='ar'?'آخر العمليات':'Recent Transactions'}</h4>
             <div className="space-y-2 max-h-[200px] overflow-y-auto">
               {rows.slice(0, 5).map(r => (
                 <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                   <div>
                     <div className="text-sm font-medium">{r.invoice_number || `#${r.id}`}</div>
                     <div className="text-xs text-gray-500">{String(r.date||'').slice(0,10)}</div>
                   </div>
                   <div className="text-sm font-bold text-red-600">{parseFloat(r.total||0).toLocaleString('en-US')} SAR</div>
                 </div>
               ))}
               {rows.length === 0 && <div className="text-center text-gray-500 text-sm py-4">{lang==='ar'?'لا توجد عمليات':'No transactions'}</div>}
             </div>
           </div>
        </section>
      </main>
      <Modal open={helpOpen} title={lang==='ar'?'المساعدة':'Help'} onClose={()=>setHelpOpen(false)}>
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-gray-800 mb-2">{lang==='ar'?'أنواع العمليات':'Transaction Types'}</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li><strong>{lang==='ar'?'مصروف':'Expense'}:</strong> {lang==='ar'?'تسجيل فاتورة مصروف مع إنشاء قيد محاسبي':'Record expense invoice with accounting entry'}</li>
              <li><strong>{lang==='ar'?'سحب نقدي':'Withdrawal'}:</strong> {lang==='ar'?'سحب من البنك إلى الصندوق':'Withdraw from bank to cash'}</li>
              <li><strong>{lang==='ar'?'إيداع نقدي':'Deposit'}:</strong> {lang==='ar'?'إيداع من الصندوق إلى البنك':'Deposit from cash to bank'}</li>
              <li><strong>{lang==='ar'?'سداد':'Payment'}:</strong> {lang==='ar'?'سداد التزام قائم (مورد، رواتب، ضريبة...)':'Settle existing liability (supplier, payroll, VAT...)'}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-2">{lang==='ar'?'الربط الذكي':'Smart Linking'}</h4>
            <p className="text-sm text-gray-600">{lang==='ar'?'عند اختيار "سداد"، يمكنك ربط الدفعة بفواتير موردين أو مسيرات رواتب محددة لتسوية الذمم آلياً.':'When selecting "Payment", you can link to specific supplier invoices or payroll runs for automatic settlement.'}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
