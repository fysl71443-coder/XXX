import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { employees as apiEmployees, auth as apiAuth, settings as apiSettings, periods } from '../services/api'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { printEmployeesCardsPDF } from '../printing/pdf/autoReports'
import { useNavigate } from 'react-router-dom'
import { FaHome, FaSearch, FaEdit, FaEye, FaPrint } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { t } from '../utils/i18n'
export default function EmployeesCards(){
  const navigate = useNavigate()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [branding, setBranding] = useState(null)
  const [company, setCompany] = useState(null)
  const [footerCfg, setFooterCfg] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('open')

  useEffect(()=>{
    (async()=>{
      try {
        const c = await apiSettings.get('settings_company'); setCompany(c)
        const b = await apiSettings.get('settings_branding'); setBranding(b)
        const f = await apiSettings.get('settings_footer'); setFooterCfg(f)
      } catch {}
    })()
  },[])

  const [toast, setToast] = useState('')
  const { can } = useAuth()

  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=>window.removeEventListener('storage', onStorage) },[])
  useEffect(()=>{ (async()=>{ setLoading(true); try { const res = await apiEmployees.list(); setItems(Array.isArray(res)?res:[]) } catch { setItems([]) } finally { setLoading(false) } })() },[])
  useEffect(()=>{ (async()=>{ try { const d = new Date(); const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const s = await periods.get(per); setPeriodStatus(String(s?.status||'open')) } catch {} })() },[])
  const canWrite = can('employees:write')

  const filtered = useMemo(()=>{
    const q = String(search||'').trim().toLowerCase()
    if (!q) return items
    return items.filter(e => (`${e.employee_number||''} ${e.full_name||''} ${e.department||''} ${e.nationality||''}`).toLowerCase().includes(q))
  }, [items, search])

  async function toggleEmp(e){
    const msg = String(e.status||'')==='active' ? t('messages.confirm_disable_employee', lang) : t('messages.confirm_enable_employee', lang)
    if (!window.confirm(msg)) return
    try {
      const next = String(e.status||'active') === 'active' ? 'disabled' : 'active'
      await apiEmployees.update(e.id, { status: next })
      const res = await apiEmployees.list(); setItems(Array.isArray(res)?res:[])
      setToast(t('messages.status_updated', lang))
    } catch (er) { setToast(er.code||'failed') }
  }

  async function exportPDF(){ await printEmployeesCardsPDF({ items: filtered, lang }) }
  async function reload(){
    setLoading(true)
    try { const res = await apiEmployees.list(); setItems(Array.isArray(res)?res:[]) } catch { setItems([]) } finally { setLoading(false) }
  }

  async function terminateEmp(e){
    if (!window.confirm(t('messages.confirm_terminate_employee', lang))) return
    try {
      await apiEmployees.delete(e.id)
      const res = await apiEmployees.list(); setItems(Array.isArray(res)?res:[])
      setToast(t('messages.employee_terminated', lang))
    } catch (er) { setToast(er.code||'failed') }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-primary-700">{t('titles.employees_cards', lang)}</h2>
          </div>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={exportPDF}>
              <FaPrint /> {t('labels.print', lang)}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2" onClick={()=>navigate('/employees')}>
              <FaHome /> {t('labels.employees', lang)}
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={reload}>{t('labels.reload', lang)}</button>
            <span className="px-2 py-1 bg-gray-100 rounded-md border"><StatusBadge status={periodStatus} type="period" /></span>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md" onClick={()=> setHelpOpen(true)}>{t('labels.help', lang)}</button>
            <div className="flex items-center gap-2 bg-white border rounded px-2">
              <FaSearch className="text-gray-500" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('labels.search', lang)} className="px-2 py-1 outline-none" />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (<div className="text-sm text-gray-600">{t('messages.loading', lang)}</div>) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <motion.div key={e.id} whileHover={{ scale: 1.02 }} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-gray-800">{e.full_name||''}</div>
                <span className={`px-2 py-1 rounded text-xs ${String(e.status||'active')==='active'?'bg-green-100 text-green-700':(String(e.status||'')==='disabled'?'bg-yellow-100 text-yellow-700':'bg-rose-100 text-rose-700')}`}>{t('labels.' + String(e.status||'active'), lang)}</span>
              </div>
              <div className="text-sm text-gray-600">{e.department||'—'} • {e.nationality||'—'}</div>
              <div className="text-xs text-gray-500 mt-1">{t('labels.emp_no', lang)}: {e.employee_number||'—'}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div className="border rounded p-2">
                  <div>{t('labels.basic', lang)}: {fmt(e.basic_salary||0)}</div>
                  <div>{t('labels.housing', lang)}: {fmt(e.housing_allowance||0)}</div>
                  <div>{t('labels.transport', lang)}: {fmt(e.transport_allowance||0)}</div>
                </div>
                <div className="border rounded p-2">
                  <div>{t('labels.other', lang)}: {fmt(e.other_allowances||0)}</div>
                  <div>{t('labels.gosi', lang)}: {e.gosi_enrolled? '✓':'—'}</div>
                  <div>{t('labels.pay_type', lang)}: {String(e.pay_type||'monthly')}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button className={`px-2 py-1 ${canWrite?'bg-gray-100':'bg-gray-200 cursor-not-allowed'} rounded flex items-center gap-1`} disabled={!canWrite} onClick={()=>navigate(`/employees/${e.id}/edit`)}><FaEdit /> {t('labels.edit', lang)}</button>
                <button className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1" onClick={()=>navigate('/payroll/dues?employee_id='+e.id)}><FaEye /> {t('labels.dues', lang)}</button>
                <button className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${canWrite ? (String(e.status||'')==='active'?'bg-yellow-100 text-yellow-800':'bg-green-100 text-green-800') : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`} disabled={!canWrite} onClick={()=>toggleEmp(e)}>{String(e.status||'')==='active' ? t('labels.disable', lang) : t('labels.enable', lang)}</button>
                <button className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${canWrite?'bg-red-600':'bg-gray-300 cursor-not-allowed'} text-white`} disabled={!canWrite} onClick={()=>terminateEmp(e)}>{t('labels.terminate', lang)}</button>
              </div>
            </motion.div>
          ))}
          {!filtered.length && (
            <div className="text-sm text-gray-600">{t('labels.no_data', lang)}</div>
          )}
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded" onAnimationEnd={()=>setToast('')}>{toast}</div>
      )}
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{t('titles.employees_cards', lang)}</div>
      </Modal>
    </div>
  )
}

function fmt(n){ try { return parseFloat(n||0).toFixed(2) } catch { return '0.00' } }
