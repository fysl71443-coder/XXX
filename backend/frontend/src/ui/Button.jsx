import React from 'react'

export default function Button({ variant = 'secondary', disabled = false, loading = false, className = '', children, ...props }){
  const base = 'inline-flex items-center justify-center rounded-lg h-9 px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary-600 text-white hover:opacity-90 focus:ring-primary-300',
    secondary: 'bg-secondary text-white hover:opacity-90 focus:ring-gray-300',
    danger: 'bg-danger text-white hover:opacity-90 focus:ring-red-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 border border-transparent focus:ring-gray-300'
  }
  const cls = `${base} ${variants[variant]||variants.secondary} ${className}`
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && (
        <span className="mr-2 inline-block h-4 w-4 border-2 border-white/70 border-r-transparent rounded-full animate-spin" />
      )}
      <span>{children}</span>
    </button>
  )
}