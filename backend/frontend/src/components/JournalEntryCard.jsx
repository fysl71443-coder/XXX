import { motion } from 'framer-motion'
import { Edit, Trash, RotateCcw, CheckCircle, Eye, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../utils/i18n'

export default function JournalEntryCard({ entry, onSelect, onPost, onReverse, onReturn, onEdit, onDelete, selectedId, canPost, canReverse, canReturn, canEdit, canDelete }){
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  
  const statusClass = (function(){
    const s = String(entry.status||'')
    if (s==='posted') return 'bg-blue-600 text-white'
    if (s==='draft') return 'bg-sky-50 text-sky-700'
    if (s==='reversed') return 'bg-gray-100 text-gray-700'
    if (s==='due') return 'bg-red-50 text-red-700'
    return 'bg-gray-50 text-gray-700'
  })()
  const statusText = (function(){
    const s = String(entry.status||'').toLowerCase()
    if (lang==='ar') {
      if (s==='posted') return t('labels.posted', lang)
      if (s==='draft') return t('labels.draft', lang)
      if (s==='reversed') return t('labels.reversed', lang)
      return s
    } else {
      if (s==='posted') return 'Posted'
      if (s==='draft') return 'Draft'
      if (s==='reversed') return 'Reversed'
      return s
    }
  })()
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.01 }} className={`bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow ${selectedId===entry.id?'ring-2 ring-primary-500 bg-primary-50':''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">#{entry.entry_number ?? '—'}</div>
          <div className="text-sm font-medium text-gray-800">{entry.date}</div>
          <div className="text-sm text-gray-600">{entry.description}</div>
          <span className={`text-xs px-2 py-0.5 rounded-md ${statusClass}`}>{statusText}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md" onClick={()=> onSelect(entry)}><Eye size={16}/> {lang==='ar'?'عرض':'View'}</button>
          <button className={`px-2.5 py-1.5 ${canPost?'bg-primary-600 hover:bg-primary-700 text-white':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded-md`} disabled={!canPost} onClick={()=> onPost(entry)}><CheckCircle size={16}/> {lang==='ar'?'نشر':'Post'}</button>
          <button className={`px-2.5 py-1.5 ${canReturn?'bg-yellow-100 hover:bg-yellow-200 text-yellow-800':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded-md`} disabled={!canReturn} onClick={()=> onReturn(entry)}><FileText size={16}/> {lang==='ar'?'إرجاع لمسودة':'Return to Draft'}</button>
          <button className={`px-2.5 py-1.5 ${canReverse?'bg-gray-200 hover:bg-gray-300 text-gray-800':'bg-gray-200 text-gray-500 cursor-not-allowed'} rounded-md`} disabled={!canReverse} onClick={()=> onReverse(entry)}><RotateCcw size={16}/> {lang==='ar'?'عكس':'Reverse'}</button>
          <button className={`px-2.5 py-1.5 ${canEdit?'bg-gray-100 hover:bg-gray-200 text-gray-800':'bg-gray-100 text-gray-500 cursor-not-allowed'} rounded-md`} disabled={!canEdit} onClick={()=> onEdit(entry)}><Edit size={16}/> {lang==='ar'?'تعديل':'Edit'}</button>
          <button className={`px-2.5 py-1.5 ${canDelete?'bg-red-600 hover:bg-red-700 text-white':'bg-red-200 text-red-500 cursor-not-allowed'} rounded-md`} disabled={!canDelete} onClick={()=> onDelete(entry)}><Trash size={16}/> {lang==='ar'?'حذف':'Delete'}</button>
        </div>
      </div>
      <div className="divide-y">
        {(entry.postings||[]).map(p => (
          <div key={p.id} className="py-2 text-sm flex items-center justify-between">
            <div>
              <div>{p.account ? `${p.account.account_code} • ${labelName(p.account, lang)}` : (lang==='ar'?`حساب #${p.account_id}`:`Account #${p.account_id}`)}</div>
              {p.notes && <div className="text-xs text-gray-500">{p.notes}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-700">مدين: {parseFloat(p.debit||0).toFixed(2)}</span>
              <span className="text-red-700">دائن: {parseFloat(p.credit||0).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function labelName(acc, lang){
  const ar = acc?.name || ''
  const en = acc?.name_en || ''
  const isBrokenAr = /^\?+$/.test(ar)
  if (lang === 'ar') return isBrokenAr ? (en || ar) : ar
  return en || (isBrokenAr ? '' : ar)
}
