/**
 * ChatMonitor — Left panel session list.
 * Light enterprise style with status badges, search, and live indicator.
 */
import { useState, useEffect } from 'react'
import { getSessions } from '../api'
import { formatDistanceToNow } from 'date-fns'

const STATUS_CONFIG = {
  ACTIVE:         { label: 'Active',        cls: 'badge-info' },
  WAITING_FOR_BOT:{ label: 'Processing',    cls: 'badge-warning' },
  NEEDS_HUMAN:    { label: 'Needs Human',   cls: 'badge-danger' },
  CLOSED:         { label: 'Closed',        cls: 'badge-neutral' },
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
    </svg>
  )
}

function toUTC(ts) {
  if (!ts) return new Date(NaN)
  const s = String(ts)
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  return new Date(s + 'Z')   // treat bare ISO strings as UTC
}

function timeAgo(ts) {
  if (!ts) return ''
  try { return formatDistanceToNow(toUTC(ts), { addSuffix: true }) }
  catch { return '' }
}

function SessionRow({ session, isActive, onClick }) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.ACTIVE
  const isUrgent = session.status === 'NEEDS_HUMAN'

  return (
    <button
      id={`session-row-${session.id}`}
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 transition-all duration-100 border-b border-slate-100
                  ${isActive
                    ? 'bg-brand-50 border-l-2 border-l-brand-600'
                    : isUrgent
                      ? 'bg-danger-light hover:bg-red-50'
                      : 'hover:bg-slate-50'
                  }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                         flex-shrink-0 mt-0.5
                         ${isUrgent ? 'bg-danger-mid text-danger-text' : 'bg-slate-100 text-slate-600'}`}>
          {session.customer_phone?.slice(-2)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-slate-800 truncate">
              {session.customer_phone}
            </span>
            <span className="text-xs text-slate-400 flex-shrink-0">
              {timeAgo(session.updated_at)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge text-xs ${cfg.cls}`}>
              {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-danger-dot animate-pulse" />}
              {cfg.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function ChatMonitor({ tenant, activeSession, onSessionSelect }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    setSessions([])

    const fetch = () => {
      getSessions(tenant.tenant_id)
        .then(res => setSessions(res.data))
        .catch(console.error)
        .finally(() => setLoading(false))
    }

    fetch()
    const iv = setInterval(fetch, 5000)
    return () => clearInterval(iv)
  }, [tenant?.tenant_id])

  // Sync activeSession with fresh data so ChatThread gets live status updates
  useEffect(() => {
    if (activeSession) {
      const updated = sessions.find(s => s.id === activeSession.id)
      // We check for deeper updates like status or updated_at to push fresh state
      if (updated && (updated.status !== activeSession.status || updated.updated_at !== activeSession.updated_at)) {
        onSessionSelect(updated)
      }
    }
  }, [sessions, activeSession, onSessionSelect])

  const filtered = sessions.filter(s =>
    s.customer_phone?.toLowerCase().includes(search.toLowerCase())
  )

  const urgentCount = sessions.filter(s => s.status === 'NEEDS_HUMAN').length

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Sessions</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {sessions.length} total
              {urgentCount > 0 && <span className="ml-2 text-danger-text font-medium">{urgentCount} urgent</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="dot-live" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </div>
          <input
            id="session-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by phone..."
            className="input pl-9 py-2 text-xs"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {!tenant ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">No tenant selected</p>
            <p className="text-xs text-slate-400 mt-1">Select a tenant to view sessions</p>
          </div>
        ) : loading ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-4 py-3.5 border-b border-slate-100"
                   style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex gap-3">
                  <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-2.5 w-1/3 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 p-6 text-center">
            <p className="text-sm text-slate-400">No sessions found</p>
          </div>
        ) : (
          filtered.map((s, i) => (
            <div key={s.id}
                 className="animate-fade-up"
                 style={{ animationDelay: `${i * 0.04}s` }}>
              <SessionRow
                session={s}
                isActive={activeSession?.id === s.id}
                onClick={() => onSessionSelect(s)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
