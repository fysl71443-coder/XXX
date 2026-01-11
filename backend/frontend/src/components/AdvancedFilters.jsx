import { useMemo } from 'react'
import { motion } from 'framer-motion'

export default function AdvancedFilters({ value, onChange, fields = [], lang = 'ar', showChips = true }) {
  const activeKeys = useMemo(() => Object.keys(value || {}).filter(k => {
    const v = value[k]
    if (Array.isArray(v)) return v.length > 0
    return String(v || '').trim() !== ''
  }), [value])

  function set(k, v) {
    onChange({ ...(value || {}), [k]: v })
  }
  function clear(k) {
    const next = { ...(value || {}) }
    delete next[k]
    onChange(next)
  }
  function clearAll() {
    onChange({})
  }

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {fields.map(f => {
          const label = lang==='ar' ? (f.labelAr || '') : (f.labelEn || f.labelAr || '')
          const ph = lang==='ar' ? (f.placeholderAr || '') : (f.placeholderEn || f.placeholderAr || '')
          const val = (value || {})[f.key]
          if (f.type === 'text') return (
            <div key={f.key}>
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <input value={val || ''} onChange={e => set(f.key, e.target.value)} placeholder={ph} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-primary-200" />
            </div>
          )
          if (f.type === 'date') return (
            <div key={f.key}>
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <input type="date" value={val || ''} onChange={e => set(f.key, e.target.value)} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-primary-200" />
            </div>
          )
          if (f.type === 'month') return (
            <div key={f.key}>
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <input type="month" value={String(val||'').slice(0,7)} onChange={e => set(f.key, e.target.value ? `${e.target.value}-01` : '')} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-primary-200" />
            </div>
          )
          if (f.type === 'select') return (
            <div key={f.key}>
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <select value={val || ''} onChange={e => set(f.key, e.target.value)} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-primary-200">
                <option value="">{lang==='ar'?'الكل':'All'}</option>
                {(f.options || []).map(opt => (
                  <option key={String(opt.value ?? opt)} value={String(opt.value ?? opt)}>{String(opt.label ?? opt)}</option>
                ))}
              </select>
            </div>
          )
          if (f.type === 'multiselect') {
            const current = Array.isArray(val) ? val : []
            function toggle(v) {
              const s = String(v)
              const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s]
              set(f.key, next)
            }
            return (
              <div key={f.key}>
                <div className="text-xs text-gray-600 mb-1">{label}</div>
                <div className="flex flex-wrap gap-2">
                  {(f.options || []).map(opt => {
                    const valStr = String(opt.value ?? opt)
                    const isActive = current.includes(valStr)
                    return (
                      <motion.button
                        key={valStr}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`px-3 py-1 rounded-full text-xs border ${isActive ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                        onClick={() => toggle(valStr)}
                      >
                        {String(opt.label ?? opt)}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
      {showChips && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeKeys.map(k => {
            const v = value[k]
            const disp = Array.isArray(v) ? v.join(', ') : String(v)
            return (
              <span key={k} className="inline-flex items-center gap-2 px-2 py-1 rounded bg-primary-50 text-primary-700 text-xs">
                <span>{disp}</span>
                <button className="text-primary-700" onClick={() => clear(k)}>✕</button>
              </span>
            )
          })}
          {!!activeKeys.length && (
            <button className="ml-auto px-3 py-1 rounded bg-gray-100" onClick={clearAll}>{lang==='ar'?'مسح الكل':'Clear all'}</button>
          )}
        </div>
      )}
    </div>
  )
}
