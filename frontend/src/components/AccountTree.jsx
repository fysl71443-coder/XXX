import React, { useEffect, useMemo, useState } from 'react'

export default function AccountTree({ accounts = [], onSelect }) {
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  const [expanded, setExpanded] = useState(() => new Set())
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  const sorted = useMemo(() => {
    function flatten(nodes){ const out=[]; (nodes||[]).forEach(n=>{ out.push(n); out.push(...flatten(n.children)) }); return out }
    const all = flatten(accounts)
    const byId = new Map()
    all.forEach(a => byId.set(a.id, { ...a, children: [] }))
    const rootsCodes = { asset: '0001', liability: '0002', equity: '0003', revenue: '4000', expense: '5000' }
    const roots = new Map()
    byId.forEach(a => { const code = String(a.account_code||a.account_number||a.id).padStart(4,'0'); if (Object.values(rootsCodes).includes(code)) roots.set(code, a) })
    byId.forEach(a => {
      const pid = a.parent_id
      if (pid) { const p = byId.get(pid); if (p) p.children.push(a); return }
      const code = String(a.account_code||a.account_number||a.id).padStart(4,'0')
      if (!Object.values(rootsCodes).includes(code)) {
        const root = roots.get(rootsCodes[String(a.type)||''])
        if (root && a.id !== root.id) { root.children.push(a); return }
      }
    })
    const rootList = []
    byId.forEach(a => { const code = String(a.account_code||a.account_number||a.id).padStart(4,'0'); if (!a.parent_id && Object.values(rootsCodes).includes(code)) rootList.push(a) })
    function groupChildren(root){
      const type = String(root.type||'')
      const children = (root.children||[]).slice()
      function codeOf(x){ return String(x.account_code||x.account_number||x.id).padStart(4,'0') }
      const out = []
      if (type==='asset'){
        const g1set = new Set(['1100','1200','1300','1400'])
        const g2set = new Set(['1500','1600'])
        const g1kids = children.filter(ch => g1set.has(codeOf(ch)))
        const g2kids = children.filter(ch => g2set.has(codeOf(ch)))
        const rest = children.filter(ch => !g1set.has(codeOf(ch)) && !g2set.has(codeOf(ch)))
        if (g1kids.length){ out.push({ id: `group-${root.id}-current`, account_code: '0000', name: 'أصول متداولة', name_en: 'Current Assets', type: 'asset', parent_id: root.id, children: g1kids, __group: true }) }
        if (g2kids.length){ out.push({ id: `group-${root.id}-noncurrent`, account_code: '0000', name: 'أصول غير متداولة', name_en: 'Non-current Assets', type: 'asset', parent_id: root.id, children: g2kids, __group: true }) }
        out.push(...rest)
        return { ...root, children: out }
      }
      if (type==='liability'){
        const g1set = new Set(['2100','2200'])
        const g2set = new Set(['2300'])
        const g1kids = children.filter(ch => g1set.has(codeOf(ch)))
        const g2kids = children.filter(ch => g2set.has(codeOf(ch)))
        const rest = children.filter(ch => !g1set.has(codeOf(ch)) && !g2set.has(codeOf(ch)))
        if (g1kids.length){ out.push({ id: `group-${root.id}-current`, account_code: '0000', name: 'التزامات متداولة', name_en: 'Current Liabilities', type: 'liability', parent_id: root.id, children: g1kids, __group: true }) }
        if (g2kids.length){ out.push({ id: `group-${root.id}-noncurrent`, account_code: '0000', name: 'التزامات غير متداولة', name_en: 'Non-current Liabilities', type: 'liability', parent_id: root.id, children: g2kids, __group: true }) }
        out.push(...rest)
        return { ...root, children: out }
      }
      if (type==='revenue'){
        const g1set = new Set(['4100'])
        const g2set = new Set(['4200'])
        const salesParents = children.filter(ch => g1set.has(codeOf(ch)))
        const otherRevParents = children.filter(ch => g2set.has(codeOf(ch)))
        const rest = children.filter(ch => !g1set.has(codeOf(ch)) && !g2set.has(codeOf(ch)))
        if (salesParents.length){
          const salesChildren = []
          for (const sp of salesParents){
            const spChildren = (sp.children||[])
            const local = spChildren.filter(c => codeOf(c)==='4110')
            const online = spChildren.filter(c => codeOf(c)==='4120')
            const spRest = spChildren.filter(c => !['4110','4120'].includes(codeOf(c)))
            if (local.length) salesChildren.push({ id: `group-${root.id}-sales-local`, account_code: '0000', name: 'مبيعات محلية', name_en: 'Local Sales', type: 'revenue', parent_id: sp.id, children: local, __group: true })
            if (online.length) salesChildren.push({ id: `group-${root.id}-sales-online`, account_code: '0000', name: 'مبيعات أونلاين', name_en: 'Online Sales', type: 'revenue', parent_id: sp.id, children: online, __group: true })
            salesChildren.push(...spRest)
          }
          out.push({ id: `group-${root.id}-sales`, account_code: '0000', name: 'مبيعات', name_en: 'Sales', type: 'revenue', parent_id: root.id, children: salesChildren, __group: true })
        }
        if (otherRevParents.length){
          out.push({ id: `group-${root.id}-otherrev`, account_code: '0000', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', parent_id: root.id, children: otherRevParents, __group: true })
        }
        out.push(...rest)
        return { ...root, children: out }
      }
      if (type==='expense'){
        const g1set = new Set(['5100'])
        const g2set = new Set(['5200'])
        const g3set = new Set(['5300'])
        const operatingParents = children.filter(ch => g1set.has(codeOf(ch)))
        const gaParents = children.filter(ch => g2set.has(codeOf(ch)))
        const financialParents = children.filter(ch => g3set.has(codeOf(ch)))
        const rest = children.filter(ch => !g1set.has(codeOf(ch)) && !g2set.has(codeOf(ch)) && !g3set.has(codeOf(ch)))
        if (operatingParents.length){
          const opChildren = []
          for (const op of operatingParents){ opChildren.push(...(op.children||[])) }
          out.push({ id: `group-${root.id}-operating`, account_code: '0000', name: 'تشغيلية', name_en: 'Operating', type: 'expense', parent_id: root.id, children: opChildren, __group: true })
        }
        if (gaParents.length){
          const gaChildren = []
          for (const gp of gaParents){ gaChildren.push(...(gp.children||[])) }
          out.push({ id: `group-${root.id}-ga`, account_code: '0000', name: 'إدارية وعمومية', name_en: 'General & Admin', type: 'expense', parent_id: root.id, children: gaChildren, __group: true })
        }
        if (financialParents.length){
          const finChildren = []
          for (const fp of financialParents){
            const fpChildren = (fp.children||[])
            const bankFees = fpChildren.filter(c => codeOf(c)==='5310')
            const interest = fpChildren.filter(c => codeOf(c)==='5320')
            const fpRest = fpChildren.filter(c => !['5310','5320'].includes(codeOf(c)))
            if (bankFees.length) finChildren.push({ id: `group-${root.id}-financial-bankfees`, account_code: '0000', name: 'رسوم بنكية', name_en: 'Bank Fees', type: 'expense', parent_id: fp.id, children: bankFees, __group: true })
            if (interest.length) finChildren.push({ id: `group-${root.id}-financial-interest`, account_code: '0000', name: 'فوائد', name_en: 'Interest', type: 'expense', parent_id: fp.id, children: interest, __group: true })
            finChildren.push(...fpRest)
          }
          out.push({ id: `group-${root.id}-financial`, account_code: '0000', name: 'مالية', name_en: 'Financial', type: 'expense', parent_id: root.id, children: finChildren, __group: true })
        }
        out.push(...rest)
        return { ...root, children: out }
      }
      return root
    }
    const groupedRoots = rootList.map(groupChildren)
    function codeNum(a){ return parseInt(String(a.account_code||a.account_number||a.id).padStart(4,'0'),10) }
    function sortNodes(nodes){ return (nodes||[]).slice().sort((x,y)=>codeNum(x)-codeNum(y)).map(n=>({ ...n, children: sortNodes(n.children) })) }
    return sortNodes(groupedRoots)
  }, [accounts])

  useEffect(()=>{
    const initial = new Set()
    sorted.forEach(r=>initial.add(r.id))
    setExpanded(initial)
  }, [sorted])
  function toggle(id){ const s = new Set(expanded); if (s.has(id)) s.delete(id); else s.add(id); setExpanded(s) }
  function renderNode(node, level=0){
    const hasChildren = (node.children||[]).length>0
    const isOpen = expanded.has(node.id)
    return (
      <div key={node.id} className={level?`ml-4`:''}>
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button onClick={()=>toggle(node.id)} className="w-6 h-6 flex items-center justify-center text-gray-600">{isOpen?'▾':'▸'}</button>
          ) : (
            <span className="w-6 h-6"></span>
          )}
          {node.__group ? (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded w-full text-left font-semibold">
              <span className="w-3 h-3 rounded-full bg-gray-500"></span>
              {labelName(node)}
            </div>
          ) : (
            <button onClick={() => onSelect(node)} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded w-full text-left">
              <span className={`w-3 h-3 rounded-full ${getColor(node.type)}`}></span>
              {pad(node) + ' • ' + labelName(node)}
            </button>
          )}
        </div>
        {hasChildren && isOpen ? (node.children||[]).map(ch => renderNode(ch, level+1)) : null}
      </div>
    )
  }

  function labelName(a) {
    const ar = a.name || ''
    const en = a.name_en || ''
    const isBrokenAr = /^\?+$/.test(ar)
    if (lang === 'ar') return isBrokenAr ? (en || ar) : ar
    return en || (isBrokenAr ? '' : ar)
  }

  function getColor(type) {
    switch (type) {
      case 'asset': return 'bg-green-500'
      case 'liability': return 'bg-blue-500'
      case 'equity': return 'bg-orange-500'
      case 'revenue': return 'bg-purple-500'
      case 'expense': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

return <div>{(sorted||[]).map(a=>renderNode(a,0))}</div>
}

function pad(a){ return String(a.account_code || a.account_number || a.id).padStart(4,'0') }
