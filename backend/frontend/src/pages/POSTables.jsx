import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { orders as apiOrders, pos } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { t, getLang } from '../utils/i18n'
export default function POSTables(){
  const navigate = useNavigate()
  const { branch } = useParams()
  const authCtx = useAuth()
  const canScreen = authCtx && typeof authCtx.canScreen==='function' ? authCtx.canScreen : (()=>true)
  const [lang, setLang] = useState(getLang())
  useEffect(()=>{
    setLang(getLang())
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  const toggleLang = ()=>{ const next = (lang==='ar'?'en':'ar'); try { localStorage.setItem('lang', next) } catch {} ; setLang(next) }
  const [busy, setBusy] = useState(new Set())
  useEffect(()=>{ const g = (pos && typeof pos.tableState==='function') ? pos.tableState(branch) : Promise.resolve({ busy: [] }); Promise.resolve(g).then(r=>{ const arr = Array.isArray(r?.busy)?r.busy:[]; setBusy(new Set(arr.map(x=> String(x))) ) }).catch(()=> setBusy(new Set())) },[branch])
  useEffect(()=>{ try { const norm = (v)=> String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); const p1 = `pos_order_${branch}_`; const p2 = `pos_order_${norm(branch)}_`; const next = new Set(busy); for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i)||''; if (k.startsWith(p1) || k.startsWith(p2)) { const t = k.split('_').pop(); if (t) next.add(String(t)) } } setBusy(next) } catch {} },[branch])
  const [layout, setLayout] = useState({ rows: [] })
  useEffect(()=>{ const g = (pos && pos.tablesLayout && typeof pos.tablesLayout.get==='function') ? pos.tablesLayout.get(branch) : Promise.resolve({ rows: [] }); Promise.resolve(g).then(d=> setLayout(d||{ rows: [] })).catch(()=> setLayout({ rows: [] })) },[branch])
  const tables = useMemo(()=>{
    const arr = []
    if (Array.isArray(layout?.sections)) {
      for (const s of layout.sections) {
        for (const r of (s.rows||[])) {
          const src = Array.isArray(r.tables) ? r.tables.map(t=> t.name) : (Array.isArray(r.numbers)?r.numbers:[])
          for (const n of (src||[])) { arr.push({ number: isNaN(Number(n))? String(n) : Number(n), row: String(r.name||'') }) }
        }
      }
    } else if (Array.isArray(layout?.rows)) {
      let num = 1
      for (const r of (layout.rows||[])) {
        for (let i=0;i<Math.max(0, Number(r.tables||0)); i++) { arr.push({ number: num++, row: String(r.name||'')||'Row' }) }
      }
    }
    if (arr.length===0) return Array.from({ length: 12 }).map((_,i)=> ({ number: i+1, row: '' }))
    return arr
  }, [layout])
  useEffect(()=>{
    function onBusy(e){
      const d = e.detail || {}
      const b1 = String(d.branch||'').trim().toLowerCase().replace(/\s+/g,'_')
      const b2 = String(branch||'').trim().toLowerCase().replace(/\s+/g,'_')
      if (b1!==b2) return
      const t = String(d.table||'')
      setBusy(prev=>{ const next = new Set(prev); next.add(String(t)); return next })
    }
    window.addEventListener('pos:table-busy', onBusy)
    return ()=> window.removeEventListener('pos:table-busy', onBusy)
  },[branch])
  useEffect(()=>{ const s = String(branch||'').trim().toLowerCase(); if (!canScreen('sales','read', s)) { try { alert('لا تملك صلاحية الفرع') } catch {} ; navigate('/pos') } },[branch, canScreen, navigate])
  function isOccupied(t){ return busy.has(String(t)) }
  async function openTable(t){
    try {
      const p = (apiOrders && typeof apiOrders.list==='function') ? apiOrders.list({ branch, table: t, status: 'DRAFT,OPEN' }) : Promise.resolve([])
      const list = await Promise.resolve(p).catch(()=>[])
      const found = (Array.isArray(list)?list:[]).find(o=>{ try { const arr = JSON.parse(o.lines||'[]')||[]; const meta = arr.find(x=> x && x.type==='meta'); const items = arr.filter(x=> x && x.type==='item'); const norm = (v)=>{ const s = String(v||'').trim().toLowerCase().replace(/\s+/g,'_'); if (s==='palace_india' || s==='palce_india') return 'place_india'; return s }; const st = String(o.status||'').toUpperCase(); const bnorm = norm(branch); const branchOk = bnorm ? (meta && norm(meta.branch)===bnorm) : true; return meta && branchOk && Number(meta.table||0)===Number(t) && (st==='DRAFT' || st==='OPEN') && items.length>0 } catch { return false } })
      if (found && found.id) navigate(`/pos/${branch}/tables/${t}?order=${found.id}`)
      else navigate(`/pos/${branch}/tables/${t}`)
    } catch {
      navigate(`/pos/${branch}/tables/${t}`)
    }
  }
  return (
    <div className="min-h-screen bg-gray-50" dir={lang==='ar'?'rtl':'ltr'}>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-primary-700">{t('labels.branch', lang)}: {branch}</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> navigate('/pos')}>{t('labels.change_branch', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> navigate(-1)}>{t('labels.back', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> navigate('/')}>{t('labels.home', lang)}</button>
            <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={toggleLang}>{lang==='ar'?'English':'العربية'}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {tables.map(tbl => {
            const occupied = isOccupied(Number(tbl.number))
            const colorCls = occupied ? 'bg-red-800' : 'bg-green-800'
            return (
              <button
                key={tbl.number}
                onClick={()=> openTable(tbl.number)}
                className={`h-20 w-full rounded-lg flex items-center justify-center text-white text-xl font-bold ${colorCls}`}
              >
                {tbl.number}
              </button>
            )
          })}
        </div>
        <div className="mt-4"><button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition" onClick={()=> navigate(`/pos/${branch}/manage`)}>{t('labels.manage_tables', lang)}</button></div>
      </main>
    </div>
  )
}