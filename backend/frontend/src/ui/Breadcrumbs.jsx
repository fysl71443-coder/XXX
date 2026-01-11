import React from 'react'
import { Link } from 'react-router-dom'

export default function Breadcrumbs({ items = [] }){
  if (!Array.isArray(items) || !items.length) return null
  return (
    <nav className="px-6 py-2 bg-white border-b">
      <ol className="flex items-center gap-2 text-sm text-gray-600">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {it.to ? (<Link to={it.to} className="hover:text-primary-600">{it.label}</Link>) : (<span>{it.label}</span>)}
            {idx < items.length - 1 && (<span className="opacity-50">/</span>)}
          </li>
        ))}
      </ol>
    </nav>
  )
}