import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Toast from '../ui/Toast'
import StatusBadge from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { useNavigate, useParams } from 'react-router-dom'
import { pos, settings as apiSettings, periods } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { t, getLang } from '../utils/i18n'
export default function POSManage(){
  const navigate = useNavigate()
  const { branch } = useParams()
  const { user } = useAuth()
  const [lang, setLang] = useState(getLang())
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [branding, setBranding] = useState({ logo: '', companyName: '' })
  const [helpOpen, setHelpOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('open')
  useEffect(()=>{ (async()=>{ try{ const c = await apiSettings.get('settings_company'); const key = String(branch||'')==='palace_india' ? 'settings_branch_place_india' : `settings_branch_${branch}`; const b = await apiSettings.get(key); setBranding({ logo: String(b?.logo_base64||b?.logo||''), companyName: (c?.name_en || c?.name_ar || '') }); try { if (b?.logo_base64) localStorage.setItem(`branch_logo_${branch}`, String(b.logo_base64)) } catch {} } catch{} })() },[branch])
  useEffect(()=>{ setLoading(true); pos.tablesLayout.get(branch).then(d=>{ if (Array.isArray(d?.sections)) setSections(d.sections); else setSections([{ name:'Main Hall', rows: (Array.isArray(d?.rows)?d.rows.map((r,i)=>({ name: r.name||`row_${i+1}`, numbers: Array.from({ length: Math.max(0, Number(r.tables||0)) }).map((_,k)=> k+1) })):[]) }]) }).catch(()=> setSections([{ name:'Main Hall', rows: [] }])).finally(()=> setLoading(false)) },[branch])
  useEffect(()=>{ (async()=>{ try { const d = new Date(); const per = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const s = await periods.get(per); setPeriodStatus(String(s?.status||'open')) } catch {} })() },[])
  useEffect(()=>{ function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') } window.addEventListener('storage', onStorage); return ()=> window.removeEventListener('storage', onStorage) },[])
  async function reload(){
    setLoading(true)
    try {
      const d = await pos.tablesLayout.get(branch)
      if (Array.isArray(d?.sections)) setSections(d.sections)
      else setSections([{ name:'Main Hall', rows: (Array.isArray(d?.rows)?d.rows.map((r,i)=>({ name: r.name||`row_${i+1}`, numbers: Array.from({ length: Math.max(0, Number(r.tables||0)) }).map((_,k)=> k+1) })):[]) }])
    } catch {
      setSections([{ name:'Main Hall', rows: [] }])
    } finally {
      setLoading(false)
    }
  }
  function addSection(){ setSections(prev=> [...prev, { name: `Section ${prev.length+1}`, rows: [] }]) }
  function updateSection(si, patch){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, ...(typeof patch==='function'?patch(s):patch) } : s )) }
  function addRow(si){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: [...(s.rows||[]), { name: `row_${(s.rows||[]).length+1}`, numbers: [] }] } : s )) }
  function updateRow(si, ri, patch){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: (Array.isArray(s.rows)?s.rows:[]).map((r,j)=> j===ri ? { ...r, ...(typeof patch==='function'?patch(r):patch) } : r ) } : s )) }
  function removeRow(si, ri){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: (Array.isArray(s.rows)?s.rows:[]).filter((_,j)=> j!==ri) } : s )) }
  function addTable(si, ri){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: (Array.isArray(s.rows)?s.rows:[]).map((r,j)=> j===ri ? { ...r, tables: [...(r.tables||[]), { id: `tbl_${Date.now()}`, name: '', status: 'available' }] } : r ) } : s )) }
  function updateTable(si, ri, ti, patch){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: (Array.isArray(s.rows)?s.rows:[]).map((r,j)=> j===ri ? { ...r, tables: (Array.isArray(r.tables)?r.tables:[]).map((t,k)=> k===ti ? { ...t, ...(typeof patch==='function' ? patch(t) : patch) } : t ) } : r ) } : s )) }
  function removeTable(si, ri, ti){ setSections(prev=> prev.map((s,i)=> i===si ? { ...s, rows: (Array.isArray(s.rows)?s.rows:[]).map((r,j)=> j===ri ? { ...r, tables: (Array.isArray(r.tables)?r.tables:[]).filter((_,k)=> k!==ti) } : r ) } : s )) }
  function onDragOver(e){ e.preventDefault() }
  async function save(){
    try {
      const hasRows = (sections||[]).some(sec => Array.isArray(sec.rows) && sec.rows.length>0)
      const hasTables = (sections||[]).some(sec => (sec.rows||[]).some(r => Array.isArray(r.tables) && r.tables.length>0))
      if (!hasRows || !hasTables){ setToast('أدخل صفًا واحدًا على الأقل مع طاولات'); return }
      const cleaned = (sections||[]).map(sec => ({ name: String(sec.name||''), rows: (sec.rows||[]).map(r => ({ name: String(r.name||''), tables: (r.tables||[]).map(t => ({ id: String(t.id||''), name: String(t.name||''), status: String(t.status||'available') })) })) }))
      await pos.tablesLayout.save(branch, { sections: cleaned })
      setToast('تم حفظ التغييرات')
      navigate(`/pos/${branch}/tables`)
    } catch (e) {
      const code = e?.code || e?.status || 'failed'
      if (code==='rows_required') setToast('أدخل صفًا واحدًا على الأقل مع أرقام الطاولات')
      else setToast('فشل حفظ التغييرات (400)')
    }
  }
  // شعار الفرع يُدار من شاشة الإعدادات فقط
  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            {branding.logo ? (<img src={branding.logo} alt="logo" className="h-8" />) : (<div className="h-8 w-8 bg-gray-200 rounded" />)}
            <div className="font-semibold text-gray-800">{branding.companyName||''}</div>
          </div>
          <div className="text-sm text-gray-600">{t('labels.welcome', lang)} {user?.name||'admin'}</div>
        </div>
        {toast && (<Toast type="warning" message={toast} onClose={()=> setToast('')} />)}
        <div>
          <div className="text-2xl font-bold">{String(branch||'').replace(/_/g,' ').toUpperCase()} — {t('labels.table_manager', lang)}</div>
          <div className="text-gray-600">{t('labels.manage_sections_help', lang)}</div>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="primary" onClick={addSection}>{t('labels.add_section', lang)}</Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={()=> navigate(`/pos/${branch}/tables`)}>{t('labels.back', lang)}</Button>
              <Button variant="secondary" onClick={()=> navigate('/')}>{t('labels.home', lang)}</Button>
              <Button variant="ghost" disabled={loading} onClick={reload}>{t('labels.reload', lang)}</Button>
              <span className="px-2 py-1 bg-white rounded border"><StatusBadge status={periodStatus} type="period" /></span>
              <Button variant="ghost" onClick={()=> setHelpOpen(true)}>{t('labels.help', lang)}</Button>
              <Button variant="ghost" onClick={()=>{ const next = (lang==='ar'?'en':'ar'); try { localStorage.setItem('lang', next) } catch {} ; setLang(next) }}>{lang==='ar'?'English':'العربية'}</Button>
              <div className="px-3 py-2 border rounded bg-white text-sm text-gray-600">{t('labels.logo_settings_tip', lang)}</div>
            </div>
        </div>
        <div className="space-y-4">
          {sections.map((sec, si)=> (
            <div key={si} className="bg-white border rounded p-3 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Section</label>
                <input className="border rounded px-2 py-1" value={sec.name} onChange={e=> updateSection(si, { name: e.target.value })} />
                <Button variant="secondary" className="px-2 py-1" onClick={()=> addRow(si)}>➕ Add Row</Button>
              </div>
              {(sec.rows||[]).map((r, ri)=> (
                <div key={ri} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Row {r.name}</label>
                    <input className="border rounded px-2 py-1" value={r.name} onChange={e=> updateRow(si, ri, { name: e.target.value })} />
                    <Button variant="danger" className="px-2 py-1" onClick={()=> removeRow(si, ri)}>− Remove Row</Button>
                  </div>
                  <div className="grid grid-cols-6 gap-2 border rounded p-2">
                    {(r.tables||[]).map((tbl, ti)=> (
                      <div key={tbl.id||ti} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-2">
                        <input className="border rounded px-2 py-1 w-24" placeholder={lang==='ar'?'رقم/اسم الطاولة':'Table number or name'} value={tbl.name||''} onChange={e=> updateTable(si, ri, ti, { name: e.target.value })} />
                        <button className="text-red-600" onClick={()=> removeTable(si, ri, ti)}>×</button>
                      </div>
                    ))}
                    <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={()=> addTable(si, ri)}>➕ {lang==='ar'?'إضافة طاولة':'Add Table'}</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end">
          <Button variant="primary" onClick={save}>{t('labels.save_changes', lang)}</Button>
        </div>
      </main>
      <Modal open={helpOpen} title={t('labels.help', lang)} onClose={()=>setHelpOpen(false)}>
        <div className="text-sm text-gray-700">{t('labels.manage_sections_help', lang)}</div>
      </Modal>
    </div>
  )
}
