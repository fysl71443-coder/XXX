import { useEffect, useMemo, useState } from 'react'
import { accounts as apiAccounts, expenses as apiExpenses, settings as apiSettings } from '../services/api'
import { FaHome, FaReceipt, FaChartLine, FaEdit, FaTrash, FaCheck, FaUndo, FaFileExcel, FaFilePdf, FaEye } from 'react-icons/fa'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { printExpensesInvoicesPDF } from '../printing/pdf/autoReports'
import { t } from '../utils/i18n'
import { useAuth } from '../context/AuthContext'

// Fixed imports
function flatten(nodes){ const out=[]; (nodes||[]).forEach(n=>{ out.push(n); out.push(...flatten(n.children||[])) }); return out }
function labelName(acc, lang){ return lang==='ar'?(acc.name||''):(acc.name_en||acc.name||'') }
function fmtMethod(m, lang){ const v = String(m||'').toLowerCase(); if (v==='cash') return lang==='ar'?'نقد':'Cash'; if (v==='bank') return lang==='ar'?'بنك':'Bank'; return m||'-' }

export default function ExpensesInvoices(){
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [tree, setTree] = useState([])
  const [accounts, setAccounts] = useState([])
  const [list, setList] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', account_code: '', category: '' })
  const [toast, setToast] = useState('')
  const { can } = useAuth()

  
  const [filterType, setFilterType] = useState('expense')
  const [selectedIds, setSelectedIds] = useState([])
  const [viewOpen, setViewOpen] = useState(false)
  const [viewInv, setViewInv] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  
  useEffect(()=>{ (async()=>{ try { const t = await apiAccounts.tree(); setTree(t||[]) } catch {} })() },[])
  useEffect(()=>{ const flat = flatten(tree); const allowed = flat.filter(a => String(a.type).toLowerCase()==='expense' && (a.allow_manual_entry !== false)); setAccounts(allowed) },[tree])
  const allAccounts = useMemo(()=> flatten(tree), [tree])
  function getAccountByCode(code){
    const c = String(code||'')
    return allAccounts.find(a => String(a.account_code)===c)
  }
  function accountDisplay(code){
    const c = String(code||'')
    if (!c) return ''
    const acc = getAccountByCode(c)
    if (acc) return String(acc.account_code).padStart(4,'0') + ' • ' + labelName(acc, lang)
    return c
  }
  useEffect(()=>{ (async()=>{ 
    try { 
      const res = await apiExpenses.list(filters); 
      // CRITICAL: apiExpenses.list returns { items: [...] }, not array directly
      const items = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setList(items);
    } catch (e) { 
      console.error('[ExpensesInvoices] Error loading expenses:', e);
      setList([]);
    } 
  })() },[filters])
  useEffect(()=>{ setSelectedIds(prev => prev.filter(id => (list||[]).some(r => r.id === id))) },[list])

  async function handleAction(action, id) {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return
    try {
      if (action === 'delete') await apiExpenses.remove(id)
      if (action === 'post') await apiExpenses.post(id)
      if (action === 'reverse') await apiExpenses.reverse(id)
      
      setToast(lang === 'ar' ? 'تمت العملية بنجاح' : 'Operation successful')
      setTimeout(() => setToast(''), 3000)
      const res = await apiExpenses.list(filters)
      setList(res || [])
    } catch (err) {
      console.error(err)
      const msg = err.response?.data?.error || err.code || err.message || 'unknown_error'
      setToast(lang === 'ar' ? 'فشلت العملية: ' + msg : 'Operation failed: ' + msg)
      setTimeout(() => setToast(''), 3000)
    }
  }

  const rows = useMemo(()=> Array.isArray(list) ? list : [], [list])
  const filteredRows = useMemo(()=> Array.isArray(rows) ? rows : [], [rows])
  const canCreate = can('expenses:create')
  const canPost = can('expenses:post')
  const canEdit = can('expenses:edit')
  const canDelete = can('expenses:delete')
  const canReverse = can('expenses:reverse')

  function typeLabel(){ return lang==='ar'?'مصروف':'Expense' }
  function typeBadgeClass(){ return 'bg-blue-100 text-blue-700' }

  function toggleSelect(id){
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }
  function toggleSelectAll(){
    const ids = filteredRows.map(r=>r.id)
    const allSelected = ids.length>0 && ids.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? selectedIds.filter(id => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])))
  }

  async function openView(id){
    try {
      setViewLoading(true)
      setViewOpen(true)
      const inv = await apiExpenses.get(id)
      setViewInv(inv)
    } catch {}
    finally { setViewLoading(false) }
  }
  function closeView(){ setViewOpen(false); setViewInv(null) }

  function exportExcel(){
    setExportingExcel(true)
    try {
      const header = ['Invoice #','Date','Total','Payment','Status']
      const data = list.map(r => [r.invoice_number||r.id, r.date||'', Number(r.total||0), fmtMethod(r.payment_method, lang), String(r.status||'issued')])
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      ws['!cols'] = [ { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 } ]
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let rr = 1; rr <= range.e.r; rr++) {
        const cell = ws[XLSX.utils.encode_cell({ r: rr, c: 2 })]
        if (cell && cell.v != null) { cell.z = '#,##0.00'; cell.t = 'n' }
      }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Expense Invoices')
      XLSX.writeFile(wb, 'expense_invoices.xlsx')
    } finally {
      setExportingExcel(false)
    }
  }

  async function exportPDF(){ setExportingPDF(true); try { await printExpensesInvoicesPDF({ invoices: list, lang }) } finally { setExportingPDF(false) } }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
              <FaReceipt className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{lang==='ar'?"فواتير المصروفات فقط":"Expense Invoices Only"}</h2>
              <p className="text-sm opacity-90">{lang==='ar'?"هذه الصفحة مخصصة لفواتير المصروفات فقط":"This page lists expense invoices only"}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${location.pathname==='/expenses'?'bg-white text-primary-700 border-white':'bg-white/10 text-white border-white/20'} ${canCreate? 'hover:bg-white/20' : 'opacity-60 cursor-not-allowed'}`}
              onClick={() => { if (canCreate) navigate('/expenses') }}
            >
              <FaChartLine className="text-sm" />
              <span className="text-sm">{lang==='ar'?"إنشاء فاتورة":"Create Invoice"}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${location.pathname==='/expenses/invoices'?'bg-white text-primary-700 border-white':'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
            >
              <FaReceipt className="text-sm" />
              <span className="text-sm">{lang==='ar'?"قائمة الفواتير":"Invoices List"}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 backdrop-blur-sm border border-white/20"
              onClick={() => navigate('/')}
            >
              <FaHome className="text-sm" />
              <span className="text-sm">{lang==='ar'?"الرئيسية":"Home"}</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {(() => {
          const opts = accounts.map(a => ({ value: a.account_code, label: `${String(a.account_code).padStart(4,'0')} • ${labelName(a, lang)}` }))
          const hasCategories = accounts.some(a => !!a.expense_category)
          const catsUnique = Array.from(new Set(accounts.map(a => a.expense_category).filter(Boolean)))
          const cats = catsUnique.length ? catsUnique.map(c => ({ value: c, label: c })) : []
          const AdvancedFilters = require('../components/AdvancedFilters').default
          const fields = [
            { key: 'from', type: 'month', labelAr: 'من', labelEn: 'From' },
            { key: 'to', type: 'month', labelAr: 'إلى', labelEn: 'To' },
            { key: 'account_code', type: 'select', labelAr: 'الحساب', labelEn: 'Account', options: opts },
          ]
          if (hasCategories && cats.length) fields.push({ key: 'category', type: 'select', labelAr: 'التصنيف', labelEn: 'Category', options: cats })
          return (
            <AdvancedFilters value={filters} onChange={setFilters} lang={lang} fields={fields} />
          )
        })()}

        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2"><FaReceipt /> {t('titles.expense_invoices', lang)}</div>
            <div className="flex gap-2">
              <button onClick={exportExcel} className="px-3 py-1 bg-gray-800 text-white rounded text-sm flex items-center gap-2 hover:bg-gray-700 disabled:opacity-50" disabled={exportingExcel}>
                <FaFileExcel /> {exportingExcel ? (lang==='ar'?'جارٍ التصدير...':'Exporting...') : (lang==='ar'?'تصدير Excel':'Export Excel')}
              </button>
              <button onClick={exportPDF} className="px-3 py-1 bg-red-700 text-white rounded text-sm flex items-center gap-2 hover:bg-red-800 disabled:opacity-50" disabled={exportingPDF}>
                <FaFilePdf /> {exportingPDF ? (lang==='ar'?'جارٍ التوليد...':'Generating...') : (lang==='ar'?'تصدير PDF':'Export PDF')}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap gap-2">
              <button className={`px-3 py-1 rounded-full text-sm border bg-primary-600 text-white border-primary-600`} disabled>{lang==='ar'?'مصروف':'Expense'}</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleSelectAll} className="px-3 py-1 rounded text-sm border bg-white hover:bg-gray-50">{lang==='ar'?'تحديد/إلغاء تحديد الكل':'Toggle Select All'}</button>
              <span className="text-xs text-gray-500">{lang==='ar'?'المحدد:':'Selected:'} {selectedIds.length}</span>
            </div>
          </div>
          <table className="w-full text-right border-collapse table-fixed">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 w-10"><input type="checkbox" checked={filteredRows.length>0 && filteredRows.every(r=>selectedIds.includes(r.id))} onChange={toggleSelectAll} /></th>
                <th className="p-2">{lang==='ar'?'رقم الفاتورة':'Invoice #'}</th>
                <th className="p-2">{lang==='ar'?'التاريخ':'Date'}</th>
                <th className="p-2">{lang==='ar'?'النوع':'Type'}</th>
                <th className="p-2">{lang==='ar'?'الإجمالي':'Total'}</th>
                <th className="p-2">{lang==='ar'?'طريقة الدفع':'Payment'}</th>
                <th className="p-2">{lang==='ar'?'الحالة':'Status'}</th>
                <th className="p-2">{lang==='ar'?'الإجراءات':'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(filteredRows) ? filteredRows : []).map(r => (
                <tr key={r.id} className="border-b odd:bg-white even:bg-gray-50 hover:bg-blue-50/50">
                  <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={()=>toggleSelect(r.id)} /></td>
                  <td className="p-2">{r.invoice_number||''}</td>
                  <td className="p-2">{String(r.date||'').slice(0,10)}</td>
                  <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${typeBadgeClass()}`}>{typeLabel()}</span></td>
                  <td className="p-2"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs">{Number(r.total||0).toLocaleString('en-US')}</span></td>
                  <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${fmtMethod(r.payment_method, lang)===(lang==='ar'?'نقد':'Cash')?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{fmtMethod(r.payment_method, lang)}</span></td>
                  <td className="p-2">
                    {(() => {
                      const ds = String(r.derived_status||'draft')
                      const cls = ds==='paid' ? 'bg-green-100 text-green-700' : (ds==='posted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')
                      const label = lang==='ar' ? (ds==='paid' ? 'مدفوعة' : (ds==='posted' ? 'منشورة' : 'مسودة')) : (ds==='paid' ? 'Paid' : (ds==='posted' ? 'Posted' : 'Draft'))
                      return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{label}</span>
                    })()}
                  </td>
                  <td className="p-2 flex items-center gap-2">
                    <button onClick={() => openView(r.id)} className="p-1 rounded text-indigo-600 hover:bg-indigo-50" title={lang==='ar'?'عرض':'View'}><FaEye /></button>
                    {r?.has_posted_journal ? null : (
                      <>
                        <button disabled={!r?.allowed_actions?.post || !canPost} onClick={() => { if (canPost) handleAction('post', r.id) }} className={`p-1 rounded ${r?.allowed_actions?.post && canPost ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 cursor-not-allowed'}`} title={lang==='ar'?'نشر':'Post'}><FaCheck /></button>
                        <button disabled={!r?.allowed_actions?.edit || !canEdit} onClick={() => { if (canEdit) navigate('/expenses', { state: { editId: r.id } }) }} className={`p-1 rounded ${r?.allowed_actions?.edit && canEdit ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 cursor-not-allowed'}`} title={lang==='ar'?'تعديل':'Edit'}><FaEdit /></button>
                        <button disabled={!r?.allowed_actions?.delete || !canDelete} onClick={() => { if (canDelete) handleAction('delete', r.id) }} className={`p-1 rounded ${r?.allowed_actions?.delete && canDelete ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'}`} title={lang==='ar'?'حذف':'Delete'}><FaTrash /></button>
                      </>
                    )}
                    <button disabled={!r?.allowed_actions?.reverse || !canReverse} onClick={() => { if (canReverse) handleAction('reverse', r.id) }} className={`p-1 rounded ${r?.allowed_actions?.reverse && canReverse ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-400 cursor-not-allowed'}`} title={lang==='ar'?'عكس القيد':'Reverse'}><FaUndo /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-start md:items-center justify-center p-4" onClick={closeView}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaReceipt className="text-primary-600" />
                  <div className="font-bold text-gray-800">{t('labels.invoice_view', lang)}</div>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={closeView}>×</button>
              </div>
              <div className="px-6 py-4 space-y-4">
                {viewLoading ? (
                  <div className="text-center py-10 text-gray-500">{t('messages.loading', lang)}</div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-bold text-gray-800">{viewInv?.invoice_number || ''}</div>
                        <div className="text-sm text-gray-600">{String(viewInv?.date||'').slice(0,10)}</div>
                      </div>
                      <div className="text-end">
                        <div className={`inline-block px-2 py-1 rounded text-xs ${typeBadgeClass()}`}>{typeLabel()}</div>
                        <div className="mt-1 text-xs text-gray-600">{fmtMethod(viewInv?.payment_method, lang)}</div>
                      </div>
                    </div>
                    {Array.isArray(viewInv?.items) && viewInv.items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-right">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-2 text-xs">{t('labels.account', lang)}</th>
                              <th className="p-2 text-xs">{t('labels.description', lang)}</th>
                              <th className="p-2 text-xs">{t('labels.amount', lang)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewInv.items.map((it, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2 text-sm">{accountDisplay(it.account_code)}</td>
                                <td className="p-2 text-sm">{it.description||''}</td>
                                <td className="p-2 text-sm">{Number(it.amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-gray-50 rounded border">
                          <div className="text-gray-500">{t('labels.account', lang)}</div>
                          <div className="font-mono">{accountDisplay(viewInv?.expense_account_code)}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border">
                          <div className="text-gray-500">{lang==='ar'?'حساب الدفع':'Payment Account'}</div>
                          <div className="font-mono">{accountDisplay(viewInv?.payment_account_code)}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-lg p-3">
                      <div className="text-gray-600 text-sm">{t('labels.total', lang)}</div>
                      <div className="text-lg font-bold text-primary-700">{Number(viewInv?.total||0).toLocaleString('en-US',{minimumFractionDigits:2})} <span className="text-xs font-normal">SAR</span></div>
                    </div>
                    {viewInv?.description ? (
                      <div className="text-sm text-gray-700 bg-gray-50 border rounded p-3 whitespace-pre-wrap">{viewInv.description}</div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                      <div className="p-3 bg-gray-50 rounded border">
                        <div className="text-gray-500">{lang==='ar'?'نوع العملية':'Operation Type'}</div>
                        <div className="font-semibold">{viewInv?.expense_type === 'expense' ? (lang==='ar'?'مصروف':'Expense') : viewInv?.expense_type === 'payment' ? (lang==='ar'?'دفع':'Payment') : (viewInv?.type || viewInv?.expense_type || '—')}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border">
                        <div className="text-gray-500">{lang==='ar'?'نوع الدفع':'Payment Type'}</div>
                        <div className="font-semibold">{fmtMethod(viewInv?.payment_method, lang)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border">
                        <div className="text-gray-500">{lang==='ar'?'فرع النشاط':'Branch'}</div>
                        <div className="font-semibold">{viewInv?.branch || '—'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border">
                        <div className="text-gray-500">{lang==='ar'?'الحالة':'Status'}</div>
                        <div className="font-semibold">
                          <span className={`px-2 py-1 rounded text-xs ${
                            viewInv?.status === 'posted' ? 'bg-green-100 text-green-700' : 
                            viewInv?.status === 'draft' ? 'bg-gray-100 text-gray-700' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {viewInv?.status === 'posted' ? (lang==='ar'?'منشورة':'Posted') : 
                             viewInv?.status === 'draft' ? (lang==='ar'?'مسودة':'Draft') : 
                             (viewInv?.status || '—')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
                <button onClick={closeView} className="px-4 py-2 rounded bg-white border hover:bg-gray-100 text-sm">{lang==='ar'?'إغلاق':'Close'}</button>
              </div>
            </div>
          </div>
        )}
        {toast && (<div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50">{toast}</div>)}
      </main>
    </div>
  )
}
