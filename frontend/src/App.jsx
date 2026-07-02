/**
 * App.jsx — Root component with Analytics tab + Left Sidebar Dashboard Layout.
 */
import { useState, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import TenantSwitcher from './components/TenantSwitcher'
import ChatMonitor from './components/ChatMonitor'
import ChatThread from './components/ChatThread'
import BroadcastDrawer from './components/BroadcastDrawer'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import { getStats } from './api'

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
)
const BroadcastIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
)
const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
  </svg>
)
const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)

/* ─── Stat Badge ─────────────────────────────────────────────────────────── */
function StatBadge({ label, value, color }) {
  const colors = {
    slate: 'text-slate-800',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
  }
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</span>
      <span className={`text-2xl font-black tabular-nums leading-none tracking-tight ${colors[color]}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

/* ─── Dashboard Layout ───────────────────────────────────────────────────── */
function Dashboard({ onBackToLanding }) {
  const [activeTenant, setActiveTenant]     = useState(null)
  const [activeSession, setActiveSession]   = useState(null)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)
  const [stats, setStats]                   = useState(null)
  const [activeTab, setActiveTab]           = useState('monitor') // 'monitor' | 'analytics'

  useEffect(() => {
    if (!activeTenant) return
    setActiveSession(null)
    const doFetch = () => {
      getStats(activeTenant.tenant_id)
        .then(res => setStats(res.data))
        .catch(() => {})
    }
    doFetch()
    const iv = setInterval(doFetch, 10000)
    return () => clearInterval(iv)
  }, [activeTenant?.tenant_id])

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden page-enter font-sans text-slate-800 selection:bg-brand-200">

      {/* ── Left Sidebar Navigation ── */}
      <aside className="w-[240px] flex flex-col bg-white border-r border-slate-200 flex-shrink-0 z-20 shadow-sm relative">
        
        {/* Header / Logo */}
        <div className="h-[90px] flex items-center px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center p-1">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="block text-[15px] font-extrabold tracking-tight text-slate-900 leading-tight">Krid.AI</span>
              <span className="block text-[11px] font-semibold text-brand-600 tracking-wider uppercase">Orchestrator</span>
            </div>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">
          
          {/* Workspace */}
          <div>
            <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Workspace</p>
            <div className="px-1">
              <TenantSwitcher
                activeTenant={activeTenant}
                onTenantChange={t => { setActiveTenant(t); setStats(null) }}
              />
            </div>
          </div>

          {/* Main Menu */}
          {activeTenant && (
            <div>
              <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Menu</p>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('monitor')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                    activeTab === 'monitor' 
                      ? 'bg-gradient-to-r from-brand-50 to-brand-100/50 text-brand-700 shadow-sm border border-brand-200/50' 
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`${activeTab === 'monitor' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <ChatIcon />
                  </div>
                  Live Monitor
                  {stats?.needs_human > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      {stats.needs_human}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                    activeTab === 'analytics' 
                      ? 'bg-gradient-to-r from-brand-50 to-brand-100/50 text-brand-700 shadow-sm border border-brand-200/50' 
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`${activeTab === 'analytics' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <AnalyticsIcon />
                  </div>
                  Analytics
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
          {activeTenant && (
            <button 
              onClick={() => setIsBroadcastOpen(true)} 
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <BroadcastIcon /> New Broadcast
            </button>
          )}
          <button 
            onClick={onBackToLanding} 
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-200/50 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <ChevronLeftIcon /> Back to Website
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50">

        {/* Top Header Stats */}
        {activeTenant && (
          <header className="h-[90px] bg-white border-b border-slate-200 px-10 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
                {activeTab === 'monitor' ? 'Live Session Monitor' : 'Performance Analytics'}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1 font-medium">
                {activeTab === 'monitor' ? 'Observe and manage active AI agent conversations.' : 'Insights and metrics across all communication channels.'}
              </p>
            </div>
            
            <div className="flex items-center gap-8">
              <StatBadge label="Total Sessions" value={stats?.total_sessions} color="slate" />
              <div className="w-px h-10 bg-slate-200"></div>
              <StatBadge label="Processing" value={stats?.active_sessions} color="warning" />
              <div className="w-px h-10 bg-slate-200"></div>
              <StatBadge label="Needs Human" value={stats?.needs_human} color="danger" />
              <div className="w-px h-10 bg-slate-200"></div>
              <StatBadge label="Messages" value={stats?.total_messages} color="info" />
              
              <div className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200/50 text-[10px] font-bold text-green-600 tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Auto-refresh
              </div>
            </div>
          </header>
        )}

        {/* Viewport */}
        <div className="flex-1 overflow-hidden flex relative animate-fade-up">
          
          {/* No tenant selected */}
          {!activeTenant && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-400 blur-2xl opacity-20 rounded-full"></div>
                <div className="relative w-24 h-24 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-card-lg">
                  <svg className="w-12 h-12 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">Select a Workspace</p>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  Choose a tenant from the left sidebar to view live conversations, manage AI sessions, and access analytics.
                </p>
              </div>
            </div>
          )}

          {activeTenant && activeTab === 'monitor' && (
            <div className="flex-1 flex w-full h-full">
              {/* Left — Session List */}
              <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                <ChatMonitor
                  tenant={activeTenant}
                  activeSession={activeSession}
                  onSessionSelect={setActiveSession}
                />
              </aside>

              {/* Right — Chat Thread */}
              <section className="flex-1 bg-slate-50/50 flex flex-col relative min-w-0">
                <ChatThread session={activeSession} />
              </section>
            </div>
          )}

          {activeTenant && activeTab === 'analytics' && (
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <div className="max-w-[1200px] mx-auto bg-white rounded-2xl border border-slate-200 shadow-card-sm overflow-hidden h-full flex flex-col">
                <AnalyticsDashboard tenant={activeTenant} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Broadcast Drawer */}
      <BroadcastDrawer
        tenant={activeTenant}
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
      />
    </div>
  )
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView] = useState('landing')
  return view === 'landing'
    ? <LandingPage onEnterDashboard={() => setView('dashboard')} />
    : <Dashboard onBackToLanding={() => setView('landing')} />
}
