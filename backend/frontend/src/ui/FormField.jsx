import React, { useState } from 'react'

export default function FormField({ label = '', required = false, value, onChange, type = 'text', placeholder = '', validate, name, children }){
  const [touched, setTouched] = useState(false)
  const error = touched && typeof validate === 'function' ? (validate(value) || '') : ''
  const baseCls = `w-full px-3 py-2 border rounded-lg ${error ? 'border-danger' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500`
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">
        <span>{label}</span>
        {required && (<span className="text-danger ml-1">*</span>)}
      </label>
      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onBlur={()=> setTouched(true)}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className={baseCls}
        />
      ) : type === 'select' ? (
        <select
          name={name}
          value={value}
          onBlur={()=> setTouched(true)}
          onChange={onChange}
          className={baseCls}
        >
          {children}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onBlur={()=> setTouched(true)}
          onChange={onChange}
          placeholder={placeholder}
          className={baseCls}
        />
      )}
      {error && (<div className="mt-1 text-xs text-danger">{error}</div>)}
    </div>
  )
}