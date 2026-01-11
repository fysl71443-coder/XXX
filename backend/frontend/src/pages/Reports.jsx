import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FaChartPie, FaBalanceScale, FaChartLine, FaMoneyBill, 
  FaUserTie, FaBox, FaExternalLinkAlt,
  FaFileExcel, FaPrint, FaFilter, FaFileAlt
} from 'react-icons/fa'
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart 
} from 'lucide-react'
import { reports as apiReports, settings as apiSettings } from '../services/api'
import * as XLSX from 'xlsx'
 
import { print } from '@/printing'
import { useAuth } from '../context/AuthContext'
import Breadcrumbs from '../ui/Breadcrumbs'
import Modal from '../ui/Modal'
import { t } from '../utils/i18n'

const accountingReports = [
  { id: 'trial-balance', titleAr: 'ميزان المراجعة', titleEn: 'Trial Balance', icon: FaBalanceScale, target: '/accounts?report=trial-balance' },
  { id: 'income-statement', titleAr: 'قائمة الدخل', titleEn: 'Income Statement', icon: FaChartLine, target: '/accounts?report=income-statement' },
  { id: 'balance-sheet', titleAr: 'المركز المالي', titleEn: 'Balance Sheet', icon: FaMoneyBill, target: '/accounts?report=balance-sheet' },
  { id: 'cash-flow', titleAr: 'التدفقات النقدية', titleEn: 'Cash Flow', icon: FaMoneyBill, target: '/accounting?view=cash' },
  { id: 'account-statement', titleAr: 'كشف حساب', titleEn: 'Account Statement', icon: FaFileAlt, target: '/accounting?view=statement' },
  { id: 'ledger', titleAr: 'دفتر الأستاذ', titleEn: 'General Ledger', icon: FaFileAlt, target: '/accounts?report=ledger' }
]

const crossModuleReports = [
  { id: 'sales-expenses', titleAr: 'المبيعات مقابل المشتريات', titleEn: 'Sales vs Purchases', icon: PieChart, modules: ['sales', 'expenses'], descriptionAr: 'تحليل العلاقة بين المبيعات والمشتريات', descriptionEn: 'Analyze relationship between sales and purchases' },
  { id: 'sales-by-branch', titleAr: 'المبيعات حسب الفروع', titleEn: 'Sales by Branch', icon: BarChart3, modules: ['sales'], descriptionAr: 'تفصيل المبيعات لكل فرع', descriptionEn: 'Sales breakdown per branch' },
  { id: 'expenses-by-branch', titleAr: 'المصروفات حسب الفروع', titleEn: 'Expenses by Branch', icon: BarChart3, modules: ['expenses'], descriptionAr: 'تفصيل المصروفات المختارة لكل فرع', descriptionEn: 'Selected expenses breakdown per branch' }
]

export default function Reports() {
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')
  const [selectedPeriod, setSelectedPeriod] = useState('كل الفترات')
  const [selectedBranch, setSelectedBranch] = useState('كل الفروع')
  const [selectedCurrency, setSelectedCurrency] = useState('SAR')
  const [crossModuleData, setCrossModuleData] = useState(null)
  const [company, setCompany] = useState(null)
  const [branding, setBranding] = useState(null)
  const { canScreen, loading, isLoggedIn } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const fmt = (v) => { try { return Number(v||0).toLocaleString(lang==='ar'?'ar-EG':'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } catch { return String(Number(v||0).toFixed(2)) } }
  const [error, setError] = useState('')
  function computeChecksum(obj){
    try {
      const normalize = (v) => {
        if (v == null) return null
        if (Array.isArray(v)) return v.map(x => normalize(x))
        if (typeof v === 'object') {
          const keys = Object.keys(v).sort()
          const out = {}
          for (const k of keys) out[k] = normalize(v[k])
          return out
        }
        if (typeof v === 'number') return Number(v.toFixed ? v.toFixed(6) : v)
        return v
      }
      const s = JSON.stringify(normalize(obj))
      let h = 0
      for (let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0 }
      return h.toString(16).padStart(8,'0')
    } catch { return '00000000' }
  }
  
  

  useEffect(() => {
    function onStorage(e) { 
      if (e.key === 'lang') setLang(e.newValue || 'ar') 
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  

  useEffect(() => {
    (async()=>{
      try {
        const c = await apiSettings.get('settings_company')
        setCompany(c)
        const b = await apiSettings.get('settings_branding')
        setBranding(b)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const type = params.get('type')
      const id = params.get('id')
      const p = params.get('period')
      const br = params.get('branch')
      const cur = params.get('currency')
      if (p) setSelectedPeriod(decodeURIComponent(p))
      if (br) setSelectedBranch(decodeURIComponent(br))
      if (cur) setSelectedCurrency(decodeURIComponent(cur))
      if (!loading && isLoggedIn && type === 'cross' && id) {
        const rep = crossModuleReports.find(r => r.id === id)
        if (rep) { handleCrossModuleReport(rep) }
      }
    } catch {}
  }, [loading, isLoggedIn])

  const handleAccountingReport = (report) => {
    const canView = canScreen('accounting','read');
    if(!canView){
      alert("You don't have permission to view reports")
      return
    }
    const params = new URLSearchParams()
    if (selectedPeriod && selectedPeriod !== 'كل الفترات') params.append('period', selectedPeriod)
    if (selectedBranch && selectedBranch !== 'كل الفروع') params.append('branch', selectedBranch)
    if (selectedCurrency) params.append('currency', selectedCurrency)
    
    navigate(`${report.target}${params.toString() ? '&' + params.toString() : ''}`)
  }


  const handleCrossModuleReport = async (report) => {
    const canViewReports = canScreen('reports','read')
    if (!canViewReports) return null
    if (report.id === 'sales-expenses') {
      const p = String(selectedPeriod)
      let from = null
      let to = null
      if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)) {
        const [y, m] = p.split('-')
        from = `${y}-${m}-01`
        const d = new Date(Number(y), Number(m), 0)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        to = `${y}-${mm}-${dd}`
      }
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (!from && !to && p && p !== 'كل الفترات') params.period = p
      try {
        const res = await apiReports.salesVsExpenses(params)
        setCrossModuleData({ reportId: report.id, data: res, filters: { period: selectedPeriod, branch: selectedBranch, currency: selectedCurrency } })
        setError('')
        return res
      } catch {
        setError(lang==='ar'?'تعذّر تحميل بيانات التقرير':'Failed to load report data')
        setCrossModuleData(null)
        return null
      }
    }
    if (report.id === 'sales-by-branch') {
      const p = String(selectedPeriod)
      let from = null
      let to = null
      if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)) {
        const [y, m] = p.split('-')
        from = `${y}-${m}-01`
        const d = new Date(Number(y), Number(m), 0)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        to = `${y}-${mm}-${dd}`
      }
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (!from && !to && p && p !== 'كل الفترات') params.period = p
      if (selectedBranch && selectedBranch !== 'كل الفروع') params.branch = selectedBranch
      try {
        const res = await apiReports.salesByBranch(params)
        setCrossModuleData({ reportId: report.id, data: res, filters: { period: selectedPeriod, branch: selectedBranch, currency: selectedCurrency } })
        setError('')
        return res
      } catch {
        setError(lang==='ar'?'تعذّر تحميل بيانات التقرير':'Failed to load report data')
        setCrossModuleData(null)
        return null
      }
    }
    if (report.id === 'expenses-by-branch') {
      const p = String(selectedPeriod)
      let from = null
      let to = null
      if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)) {
        const [y, m] = p.split('-')
        from = `${y}-${m}-01`
        const d = new Date(Number(y), Number(m), 0)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        to = `${y}-${mm}-${dd}`
      }
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (!from && !to && p && p !== 'كل الفترات') params.period = p
      if (selectedBranch && selectedBranch !== 'كل الفروع') params.branch = selectedBranch
      try {
        const res = await apiReports.expensesByBranch(params)
        setCrossModuleData({ reportId: report.id, data: res, filters: { period: selectedPeriod, branch: selectedBranch, currency: selectedCurrency } })
        setError('')
        return res
      } catch {
        setError(lang==='ar'?'تعذّر تحميل بيانات التقرير':'Failed to load report data')
        setCrossModuleData(null)
      return null
    }
    
    }
    navigate(`/reports?type=cross&id=${encodeURIComponent(report.id)}&period=${encodeURIComponent(selectedPeriod)}&branch=${encodeURIComponent(selectedBranch)}&currency=${encodeURIComponent(selectedCurrency)}`)
    return null
  }

  const handleExport = async (report, type) => {
    const canExportReports = canScreen('reports','read');
    if (!canExportReports) return
    if (type === 'cross-module' && report.id === 'sales-expenses') {
      const d = await handleCrossModuleReport(report)
      if (!d) return
      if (!d) return
      const rows = [
        { Metric: 'Sales', Amount: (d && d.sales) || 0 },
        { Metric: 'Expenses', Amount: (d && d.expenses) || 0 },
        { Metric: 'Net', Amount: (d && d.net) || 0 }
      ]
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Sales vs Expenses')
      XLSX.writeFile(wb, 'sales-vs-expenses.xlsx')
      return
    }
    if (type === 'cross-module' && report.id === 'sales-by-branch') {
      const d = await handleCrossModuleReport(report)
      if (!d) return
      if (!d) return
      const rows = ((d && d.items) || []).map(r => ({ Branch: String(r.branch||''), Gross: Number(r.gross_total||0), Net: Number(r.net_total||0), Tax: Number(r.tax_total||0), Discount: Number(r.discount_total||0) }))
      rows.push({ Branch: 'Grand Total', Gross: Number((d && d.totals && d.totals.gross_total) || 0), Net: Number((d && d.totals && d.totals.net_total) || 0), Tax: Number((d && d.totals && d.totals.tax_total) || 0), Discount: Number((d && d.totals && d.totals.discount_total) || 0) })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Sales by Branch')
      XLSX.writeFile(wb, 'sales-by-branch.xlsx')
      return
    }
    if (type === 'cross-module' && report.id === 'expenses-by-branch') {
      const d = await handleCrossModuleReport(report)
      if (!d) return
      if (!d) return
      const rows = ((d && d.items) || []).map(r => ({ Branch: String(r.branch||''), Total: Number(r.total||0) }))
      rows.push({ Branch: 'Grand Total', Total: Number((d && d.total) || 0) })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses by Branch')
      XLSX.writeFile(wb, 'expenses-by-branch.xlsx')
      return
    }
    
  }

  const handlePrint = async (report, type) => {
    const canPrintReports = canScreen('reports','read')
    if (!canPrintReports) return
    try {
      if (type === 'accounting') {
        const id = String(report.id)
        const p = String(selectedPeriod)
        let from = null
        let to = null
        if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)) {
          const [y, m] = p.split('-')
          from = `${y}-${m}-01`
          const d = new Date(Number(y), Number(m), 0)
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          to = `${y}-${mm}-${dd}`
        }
        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        if (id === 'trial-balance') { const url = `/print/trial-balance.html${params.toString()?`?${params.toString()}`:''}`; window.open(url, '_blank'); return }
        if (id === 'income-statement') { const url = `/print/income-statement.html${params.toString()?`?${params.toString()}`:''}`; window.open(url, '_blank'); return }
        if (id === 'balance-sheet') { const url = `/print/balance-sheet.html${params.toString()?`?${params.toString()}`:''}`; window.open(url, '_blank'); return }
        if (id === 'ledger') { const url = `/print/ledger.html${params.toString()?`?${params.toString()}`:''}`; window.open(url, '_blank'); return }
        if (id === 'cash-flow') { const url = `/print/cash-flow.html${params.toString()?`?${params.toString()}`:''}`; window.open(url, '_blank'); return }
        return
      }
      if (type === 'cross-module') {
        const id = String(report.id)
        const p = String(selectedPeriod)
        let from = null
        let to = null
        if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)){
          const [y,m]=p.split('-')
          from = `${y}-${m}-01`
          const d = new Date(Number(y), Number(m), 0)
          const mm = String(d.getMonth()+1).padStart(2,'0')
          const dd = String(d.getDate()).padStart(2,'0')
          to = `${y}-${mm}-${dd}`
        }
        
        await handleCrossModuleReport(report)
        return
      }
    } catch (error) {
      console.error('Print open failed:', error);
      setError('Failed to open print page.');
    }
  }

  const handleThermalPrint = async (report, type) => {
    const canPrintReports = canScreen('reports','read')
    if (!canPrintReports) return
    try {
      if (type === 'accounting') {
        const id = String(report.id)
        const p = String(selectedPeriod)
        let from = null
        let to = null
        if (p && p !== 'كل الفترات' && /^\d{4}-\d{2}$/.test(p)) {
          const [y, m] = p.split('-')
          from = `${y}-${m}-01`
          const d = new Date(Number(y), Number(m), 0)
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          to = `${y}-${mm}-${dd}`
        }
        if (id === 'income-statement') {
          const res = await apiReports.incomeStatement({ from: from||undefined, to: to||undefined }).catch(()=>null)
          if (!res) return
          const net = Number(res?.net_income||0)
          const checksum = computeChecksum(res)
          const data = {
            companyAr: company?.name || '',
            companyEn: company?.name_en || '',
            period: p,
            netIncome: net,
            checksum,
            paperWidthMm: 80,
            lang
          }
          await print({ type:'thermal', template:'incomeSummary', data, autoPrint: false })
          return
        }
        if (id === 'trial-balance') {
          const rep = await apiReports.trialBalance({ from: from||undefined, to: to||undefined }).catch(()=>null)
          if (!rep) return
          const checksum = computeChecksum(rep)
          const data = {
            companyAr: company?.name || '',
            companyEn: company?.name_en || '',
            period: p,
            totals: { debit: Number(rep?.totals?.debit||0), credit: Number(rep?.totals?.credit||0) },
            balanced: !!rep?.balanced,
            checksum,
            paperWidthMm: 80,
            lang
          }
          await print({ type:'thermal', template:'trialBalanceSummary', data, autoPrint: false })
          return
        }
        if (id === 'ledger') {
          const rep = await apiReports.ledgerSummary({ from: from||undefined, to: to||undefined, period: (!from&&!to&&p!=='كل الفترات')?p:undefined }).catch(()=>null)
          if (!rep) return
          const checksum = computeChecksum(rep)
          const data = {
            companyAr: company?.name || '',
            companyEn: company?.name_en || '',
            period: p,
            totals: { debit: Number(rep?.totals?.debit||0), credit: Number(rep?.totals?.credit||0) },
            balanced: !!rep?.balanced,
            checksum,
            paperWidthMm: 80,
            lang
          }
          await print({ type:'thermal', template:'ledgerSummary', data })
          return
        }
      }
    } catch (error) {
      console.error('Error printing thermal:', error)
      setError('Failed to print thermal receipt.')
    }
  }

  const handleApplyFilters = async () => {
    try {
      const params = new URLSearchParams(window.location.search)
      const idParam = params.get('id')
      const first = crossModuleReports.find(r => r.id===idParam) || crossModuleReports.find(r => r.id==='sales-by-branch')
      if (first) await handleCrossModuleReport(first)
    } catch {}
  }

  
  const renderReportCard = (report, type = 'accounting') => (
    <div key={report.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <report.icon className="text-primary-600 text-lg" />
        <h3 className="font-semibold text-gray-800">
          {lang === 'ar' ? report.titleAr : report.titleEn}
        </h3>
      </div>
      
      {report.descriptionAr && (
        <p className="text-sm text-gray-600 mb-4">
          {lang === 'ar' ? report.descriptionAr : report.descriptionEn}
        </p>
      )}

      {type === 'cross-module' && report.modules && (
        <div className="mb-3">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {lang === 'ar' ? 'وحدات: ' : 'Modules: '}
            {report.modules.join(' + ')}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button 
          onClick={() => {
            if (type === 'accounting') handleAccountingReport(report)
            else if (type === 'cross-module') handleCrossModuleReport(report)
          }}
          className="flex-1 bg-primary-600 text-white py-2 px-3 rounded text-sm hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={!(type==='accounting' ? canScreen('accounting','read') : canScreen('reports','read'))}
          data-testid={type==='cross-module' ? `apply-${report.id}` : undefined}
        >
          {type === 'accounting' ? <FaExternalLinkAlt size={12} /> : <FaFilter size={12} />}
          {type === 'accounting' ? (report.target.startsWith('/accounting') ? (lang==='ar'?'فتح في المحاسبة':'Open in Accounting') : (lang === 'ar' ? 'فتح في الحسابات' : 'Open in Accounts')) : (lang === 'ar' ? 'تطبيق' : 'Apply')}
        </button>
        <button onClick={() => handleExport(report, type)} className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={!canScreen('reports','read')}>
          <FaFileExcel />
        </button>
        <button onClick={() => handlePrint(report, type)} className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={!canScreen('reports','read')} title={lang==='ar'?'طباعة PDF':'Print PDF'}>
          <FaPrint />
        </button>
        
      </div>
      <div className="mt-2">
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded" title={lang==='ar'? 'الطباعة = نفس بيانات التقرير بدون أي تعديل' : 'Printing equals report data; no modifications'}>
          {lang==='ar' ? '✅ محسوب من قيود منشورة' : '✅ Computed from Posted Journal Entries'}
        </span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Breadcrumbs items={[{ label:t('labels.home'), to:'/' }, { label: lang==='ar' ? 'التقارير' : 'Reports' }]} />
      {/* Header with Advanced Filters */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary-700 flex items-center gap-3">
              <FaChartPie className="text-primary-600" />
              {lang === 'ar' ? 'مركز التقارير' : 'Reports Hub'}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {lang === 'ar' ? 'بوابة التقارير الذكية والتحليلات المتقدمة' : 'Smart reports gateway and advanced analytics'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2"
            >
              {t('labels.home', lang)}
            </button>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
              {(localStorage.getItem('lang')||'ar')==='ar'?'الربع':'Quarter'}: {localStorage.getItem('selected_quarter') || '—'}
            </span>
            <button
              onClick={() => { try { localStorage.removeItem('selected_quarter') } catch {}; window.location.reload() }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              {(localStorage.getItem('lang')||'ar')==='ar'?'إلغاء الربع':'Clear Quarter'}
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2"
            >
              {t('labels.reload', lang)}
            </button>
            <button 
              onClick={() => setHelpOpen(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2"
            >
              {t('labels.help', lang)}
            </button>
            
            <button
              onClick={() => navigate('/reports/business-day-sales')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center gap-2"
            >
              {lang==='ar' ? 'تقرير المبيعات اليومية' : 'Business Day Sales'}
            </button>
          </div>
        </div>

        {/* Advanced Filter Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-4 mb-3">
            <FaFilter className="text-blue-600 text-lg" />
            <h3 className="font-semibold text-blue-800">
              {lang === 'ar' ? 'فلاتر التقارير' : 'Report Filters'}
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                {lang === 'ar' ? 'الفترة' : 'Period'}
              </label>
              <select 
                className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-white text-sm"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="كل الفترات">{lang === 'ar' ? 'كل الفترات' : 'All Periods'}</option>
                <option value="2024-01">2024-01</option>
                <option value="2024-02">2024-02</option>
                <option value="2024-03">2024-03</option>
                <option value="2024-04">2024-04</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                {lang === 'ar' ? 'الفرع' : 'Branch'}
              </label>
              <select 
                className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-white text-sm"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="كل الفروع">{lang === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                <option value="china_town">China Town</option>
                <option value="place_india">Place India</option>
                <option value="palace_india">Palace India</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                {lang === 'ar' ? 'العملة' : 'Currency'}
              </label>
              <select 
                className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-white text-sm"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
              >
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button onClick={handleApplyFilters} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                {lang === 'ar' ? 'تطبيق الفلاتر' : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Accounting Reports Section */}
        <section className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-full">
              <FaBalanceScale className="text-blue-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {lang === 'ar' ? 'التقارير المحاسبية' : 'Accounting Reports'}
              </h2>
              <p className="text-sm text-gray-500">
                {lang === 'ar' ? 'روابط ذكية للتقارير الأساسية في شاشة الحسابات' : 'Smart links to basic reports in Accounts screen'}
              </p>
            </div>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              {lang === 'ar' ? 'روابط ذكية' : 'Smart Links'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {accountingReports.map(report => renderReportCard(report, 'accounting'))}
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <FaExternalLinkAlt size={14} className="text-blue-500" />
              {lang === 'ar' 
                ? 'هذه الروابط تفتح التقارير مباشرة في شاشة الحسابات مع تطبيق الفلاتر المحددة' 
                : 'These links open reports directly in Accounts screen with applied filters'
              }
            </p>
          </div>
        </section>

        {/* Cross-Module Reports Section */}
        <section className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 rounded-full">
              <PieChart className="text-purple-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {lang === 'ar' ? 'تقارير عابرة للوحدات' : 'Cross-Module Reports'}
              </h2>
              <p className="text-sm text-gray-500">
                {lang === 'ar' ? 'تقارير تربط بين بيانات وحدات مختلفة في النظام' : 'Reports linking data across different system modules'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {crossModuleReports.map(report => renderReportCard(report, 'cross-module'))}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-rose-50 text-rose-700 border rounded">
              {error}
            </div>
          )}
      {crossModuleData && crossModuleData.reportId==='sales-by-branch' && (
        <div className="mt-6 p-4 border rounded-lg bg-green-50">
          <h3 className="font-semibold mb-2">{lang==='ar'?'ملخص: المبيعات حسب الفروع':'Summary: Sales by Branch'}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 border">{lang==='ar'?'الفرع':'Branch'}</th>
                  <th className="px-3 py-2 border">{lang==='ar'?'الإجمالي (شامل الضريبة)':'Gross (Tax-Inclusive)'}</th>
                  <th className="px-3 py-2 border">{lang==='ar'?'الصافي (بعد الضريبة)':'Net (Tax-Exclusive)'}</th>
                  <th className="px-3 py-2 border">{lang==='ar'?'الضريبة':'Tax'}</th>
                  <th className="px-3 py-2 border">{lang==='ar'?'الخصم':'Discount'}</th>
                </tr>
              </thead>
              <tbody>
                {((crossModuleData?.data?.items)||[]).map((row,i)=> (
                  <tr key={i}>
                    <td className="px-3 py-2 border">{String(row.branch||'')}</td>
                    <td className="px-3 py-2 border">{fmt(row.gross_total)} {selectedCurrency}</td>
                    <td className="px-3 py-2 border">{fmt(row.net_total)} {selectedCurrency}</td>
                    <td className="px-3 py-2 border">{fmt(row.tax_total)} {selectedCurrency}</td>
                    <td className="px-3 py-2 border">{fmt(row.discount_total)} {selectedCurrency}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2 border">{lang==='ar'?'الإجمالي الكلي':'Grand Total'}</td>
                  <td className="px-3 py-2 border">{fmt((crossModuleData?.data?.totals||{}).gross_total)} {selectedCurrency}</td>
                  <td className="px-3 py-2 border">{fmt((crossModuleData?.data?.totals||{}).net_total)} {selectedCurrency}</td>
                  <td className="px-3 py-2 border">{fmt((crossModuleData?.data?.totals||{}).tax_total)} {selectedCurrency}</td>
                  <td className="px-3 py-2 border">{fmt((crossModuleData?.data?.totals||{}).discount_total)} {selectedCurrency}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {(!(((crossModuleData?.data?.items)||[]).length)) && (
            <div className="mt-3 text-xs text-gray-700">{lang==='ar'?"لا توجد قيود منشورة للفترة المحددة":"No posted entries for selected period"}</div>
          )}
        </div>
      )}
      {crossModuleData && crossModuleData.reportId==='expenses-by-branch' && (
        <div className="mt-6 p-4 border rounded-lg bg-red-50">
          <h3 className="font-semibold mb-2">{lang==='ar'?'ملخص: المصروفات حسب الفروع':'Summary: Expenses by Branch'}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 border">{lang==='ar'?'الفرع':'Branch'}</th>
                  <th className="px-3 py-2 border">{lang==='ar'?'الإجمالي':'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {((crossModuleData?.data?.items)||[]).map((row,i)=> (
                  <tr key={i}>
                    <td className="px-3 py-2 border">{String(row.branch||'')}</td>
                    <td className="px-3 py-2 border">{fmt(row.total)} {selectedCurrency}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2 border">{lang==='ar'?'الإجمالي الكلي':'Grand Total'}</td>
                  <td className="px-3 py-2 border">{fmt(crossModuleData?.data?.total)} {selectedCurrency}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {(!(((crossModuleData?.data?.items)||[]).length)) && (
            <div className="mt-3 text-xs text-gray-700">{lang==='ar'?"لا توجد قيود منشورة للفترة المحددة":"No posted entries for selected period"}</div>
          )}
        </div>
      )}
      {crossModuleData && crossModuleData.reportId==='sales-expenses' && (
            <div className="mt-6 p-4 border rounded-lg bg-purple-50">
              <h3 className="font-semibold mb-2">{lang==='ar'?'ملخص: المبيعات مقابل المشتريات':'Summary: Sales vs Purchases'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'المبيعات (صافي)':'Sales (Net)'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.sales_net ?? crossModuleData.data?.sales)} {selectedCurrency}</div></div>
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'المبيعات (شامل الضريبة)':'Sales (Gross)'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.sales_gross ?? (Number(crossModuleData.data?.sales||0)+Number(crossModuleData.data?.vat_total||0)))} {selectedCurrency}</div></div>
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'الضريبة':'Tax'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.vat_total)} {selectedCurrency}</div></div>
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'الخصم':'Discount'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.discount_total)} {selectedCurrency}</div></div>
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'المصروفات':'Expenses'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.expenses)} {selectedCurrency}</div></div>
              </div>
              <div className="mt-3 text-xs text-gray-700">{lang==='ar'? (crossModuleData.data?.tax_inclusive? 'الأرقام شاملة الضريبة':'الأرقام صافية بعد الضريبة') : (crossModuleData.data?.tax_inclusive? 'Amounts include tax':'Amounts are net of tax')}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white rounded border"><div className="text-gray-500">{lang==='ar'?'الصافي':'Net'}</div><div className="text-lg font-bold">{fmt(crossModuleData.data?.net)} {selectedCurrency}</div></div>
              </div>
                {(Number(crossModuleData?.data?.sales||0)===0 && Number(crossModuleData?.data?.expenses||0)===0) && (
                <div className="mt-3 text-xs text-gray-700">{lang==='ar'?"لا توجد قيود منشورة للفترة المحددة":"No posted entries for selected period"}</div>
              )}
            </div>
          )}
        </section>

      </main>

      
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{lang==='ar'?'التقارير':'Reports'}</div>
      </Modal>
    </div>
  )
}
