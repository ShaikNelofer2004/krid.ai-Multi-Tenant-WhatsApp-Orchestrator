/**
 * AnalyticsDashboard — Full analytics view with charts, KPIs, and insights.
 * Uses pure SVG + CSS for charts (no external chart library needed).
 */
import { useState, useEffect } from 'react'
import { getSessions, getMessages } from '../api'

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function toUTC(ts) {
  if (!ts) return new Date(NaN)
  const s = String(ts)
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  return new Date(s + 'Z')
}

function hourLabel(h) {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${suffix}`
}

/* ─── Mini bar chart (CSS Flexbox) ───────────────────────────────────────── */
function BarChart({ data, color = '#4550e8', height = 120 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end w-full pb-6" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        const showLabel = i % 4 === 0 || i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full px-[1px]">
            {/* Value Label */}
            <div className={`text-[9px] font-semibold mb-1 ${d.value > 0 ? 'text-slate-600' : 'opacity-0'}`}>
              {d.value}
            </div>
            {/* Bar */}
            <div 
              className="w-full max-w-[12px] md:max-w-[16px] rounded-t-lg transition-all duration-500 ease-out hover:opacity-100 cursor-pointer"
              style={{ 
                height: d.value === 0 ? '4px' : `calc(${pct}% - 16px)`, 
                backgroundColor: color,
                opacity: d.value === 0 ? 0.05 : 0.75
              }}
            />
            {/* Hover Tooltip */}
            <div className="absolute -top-6 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
              {d.label}: {d.value} msgs
            </div>
            {/* X-Axis Label perfectly aligned under the bar */}
            {showLabel && (
              <div className="absolute top-full mt-2 text-[9px] font-medium text-slate-400">
                {i === data.length - 1 ? 'Now' : d.label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Donut chart (SVG with proper scaling) ──────────────────────────────── */
function DonutChart({ segments, size = 110 }) {
  const r = 40
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1

  let offset = 0
  return (
    <div style={{ width: size, height: size }} className="relative flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference
          const gap = circumference - dash
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth="12"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500 ease-out"
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="text-center z-10 flex flex-col items-center justify-center">
        <p className="text-xl font-bold text-slate-800 leading-none tabular-nums">{total}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider">Sessions</p>
      </div>
    </div>
  )
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color = 'brand', icon }) {
  const colors = {
    brand:   { bg: 'bg-blue-50',   text: 'text-blue-600',  border: 'border-blue-100' },
    green:   { bg: 'bg-green-50',  text: 'text-green-600', border: 'border-green-100' },
    amber:   { bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-amber-100' },
    red:     { bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-red-100' },
    purple:  { bg: 'bg-purple-50', text: 'text-purple-600',border: 'border-purple-100' },
    slate:   { bg: 'bg-slate-50',  text: 'text-slate-600', border: 'border-slate-200' },
  }
  const c = colors[color] || colors.brand
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-xs ${c.text}`}>{icon}</span>
      </div>
      <span className={`text-2xl font-bold tabular-nums ${c.text}`}>{value ?? '—'}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}

/* ─── Section Title ──────────────────────────────────────────────────────── */
function SectionTitle({ children, sub }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AnalyticsDashboard({ tenant }) {
  const [sessions, setSessions] = useState([])
  const [allMessages, setAllMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    getSessions(tenant.tenant_id).then(async res => {
      const sess = res.data
      setSessions(sess)
      // Fetch messages for ALL sessions (cap at 8 to avoid too many requests)
      const sample = sess.slice(0, 8)
      const msgArrays = await Promise.all(
        sample.map(s => getMessages(s.id).then(r => r.data).catch(() => []))
      )
      setAllMessages(msgArrays.flat())
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [tenant?.tenant_id])

  if (!tenant) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
      Select a tenant to view analytics
    </div>
  )

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading analytics...</span>
      </div>
    </div>
  )

  /* ── Derived stats ── */
  const total        = sessions.length
  const active       = sessions.filter(s => s.status === 'ACTIVE').length
  const processing   = sessions.filter(s => s.status === 'WAITING_FOR_BOT').length
  const needsHuman   = sessions.filter(s => s.status === 'NEEDS_HUMAN').length
  const closed       = sessions.filter(s => s.status === 'CLOSED').length

  const inbound  = allMessages.filter(m => m.direction === 'INBOUND').length
  const outbound = allMessages.filter(m => m.direction === 'OUTBOUND').length
  const withMedia = allMessages.filter(m => m.media_url).length
  const withPdf   = allMessages.filter(m => m.media_mime_type === 'application/pdf' || (m.media_url && /\.pdf/i.test(m.media_url))).length

  // Messages chronologically over the last 24 hours (ending at current hour)
  const now = new Date()
  const currentHour = now.getHours()
  const hourBuckets = Array.from({ length: 24 }, (_, i) => {
    const h = (currentHour - 23 + i + 24) % 24
    return { label: hourLabel(h), hour: h, value: 0 }
  })

  allMessages.forEach(m => {
    const d = toUTC(m.timestamp)
    if (isNaN(d)) return
    const diffH = (now - d) / 3600000
    if (diffH <= 24) {
      const bucket = hourBuckets.find(b => b.hour === d.getHours())
      if (bucket) bucket.value++
    }
  })

  // Sessions by status for donut
  const donutSegments = [
    { label: 'Processing', value: processing, color: '#f59e0b' },
    { label: 'Needs Human', value: needsHuman, color: '#ef4444' },
    { label: 'Active', value: active, color: '#2563eb' },
    { label: 'Closed', value: closed, color: '#94a3b8' },
  ].filter(s => s.value > 0)

  // Response rate
  const responseRate = inbound > 0 ? Math.round((outbound / inbound) * 100) : 0

  // Top active sessions (most messages)
  const sessionMessageCounts = {}
  allMessages.forEach(m => {
    // We can't easily match session_id here without extra data, skip
  })

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50">

      {/* ── KPI Row ── */}
      <div>
        <SectionTitle sub="Live data from all sessions">Key Metrics</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Sessions" value={total} color="brand"
            icon="💬" sub={`${active} active right now`} />
          <KpiCard label="Total Messages" value={allMessages.length} color="purple"
            icon="📨" sub={`${inbound} in · ${outbound} out`} />
          <KpiCard label="Needs Human" value={needsHuman} color={needsHuman > 0 ? 'red' : 'green'}
            icon={needsHuman > 0 ? '🚨' : '✅'}
            sub={needsHuman > 0 ? 'Require attention' : 'All clear'} />
          <KpiCard label="Response Rate" value={`${responseRate}%`} color="green"
            icon="⚡" sub="Bot replied / messages received" />
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Session Status Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <SectionTitle sub="Current distribution">Session Status</SectionTitle>
          <div className="flex items-center gap-4">
            <DonutChart segments={donutSegments.length ? donutSegments : [{ value: 1, color: '#e2e8f0' }]} />
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: 'Processing', value: processing, color: 'bg-amber-400' },
                { label: 'Needs Human', value: needsHuman, color: 'bg-red-500' },
                { label: 'Active', value: active, color: 'bg-blue-500' },
                { label: 'Closed', value: closed, color: 'bg-slate-300' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                  <span className="text-xs text-slate-600 flex-1">{item.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message Volume (24h) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm lg:col-span-2">
          <SectionTitle sub="Messages per hour in the last 24 hours">Message Volume (24h)</SectionTitle>
          {allMessages.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-xs text-slate-400">
              No messages yet
            </div>
          ) : (
            <>
              <BarChart data={hourBuckets} color="#2563eb" height={100} />
            </>
          )}
        </div>
      </div>

      {/* ── Media & Content Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Images Sent</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">{withMedia - withPdf}</p>
          <p className="text-xs text-slate-400 mt-1">via media library</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">PDFs Sent</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">{withPdf}</p>
          <p className="text-xs text-slate-400 mt-1">catalogs & invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Avg Messages/Session</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">
            {total > 0 ? (allMessages.length / total).toFixed(1) : '0'}
          </p>
          <p className="text-xs text-slate-400 mt-1">per conversation</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Escalation Rate</p>
          <p className={`text-2xl font-bold tabular-nums ${needsHuman > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {total > 0 ? `${Math.round((needsHuman / total) * 100)}%` : '0%'}
          </p>
          <p className="text-xs text-slate-400 mt-1">sessions escalated</p>
        </div>
      </div>

      {/* ── Recent Sessions Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <SectionTitle>Recent Sessions</SectionTitle>
        </div>
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">No sessions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 bg-slate-50">
                <th className="text-left px-4 py-2 font-medium">Phone</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Last Active</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map((s, i) => {
                const STATUS = {
                  WAITING_FOR_BOT: { label: 'Processing', cls: 'bg-amber-100 text-amber-700' },
                  NEEDS_HUMAN:     { label: 'Needs Human', cls: 'bg-red-100 text-red-700' },
                  ACTIVE:          { label: 'Active', cls: 'bg-blue-100 text-blue-700' },
                  CLOSED:          { label: 'Closed', cls: 'bg-slate-100 text-slate-500' },
                }
                const cfg = STATUS[s.status] || STATUS.ACTIVE
                return (
                  <tr key={s.id} className={`border-t border-slate-50 hover:bg-slate-50 transition-colors
                    ${s.status === 'NEEDS_HUMAN' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.customer_phone}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                        {s.status === 'NEEDS_HUMAN' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {s.updated_at ? toUTC(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {s.created_at ? toUTC(s.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
