/**
 * TenantSwitcher — Compact dropdown to switch between tenants.
 * Light enterprise style, no emojis.
 */
import { useState, useEffect, useRef } from 'react'
import { getTenants } from '../api'

function BuildingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
         fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

export default function TenantSwitcher({ activeTenant, onTenantChange }) {
  const [tenants, setTenants] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    getTenants()
      .then(res => {
        setTenants(res.data)
        if (res.data.length > 0 && !activeTenant) onTenantChange(res.data[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        id="tenant-switcher-btn"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2 bg-white border border-slate-200
                   rounded-lg text-sm hover:bg-slate-50 hover:border-slate-300
                   transition-all duration-150 shadow-card"
      >
        <div className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center text-brand-600">
          <BuildingIcon />
        </div>
        <span className="flex-1 text-left font-medium text-slate-700">
          {loading ? 'Loading...' : activeTenant?.name ?? 'Select Tenant'}
        </span>
        <span className="text-slate-400">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[200px] card-md rounded-xl py-1 z-50 animate-slide-up">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tenants</p>
          </div>
          {tenants.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">No tenants found</p>
          ) : (
            tenants.map(t => (
              <button
                key={t.tenant_id}
                id={`tenant-opt-${t.tenant_id}`}
                onClick={() => { onTenantChange(t); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-100
                            ${activeTenant?.tenant_id === t.tenant_id
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center
                                text-slate-500 text-xs font-bold uppercase flex-shrink-0">
                  {t.name?.[0] ?? 'T'}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium leading-tight">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.tenant_id}</p>
                </div>
                {activeTenant?.tenant_id === t.tenant_id && (
                  <svg className="w-3.5 h-3.5 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
