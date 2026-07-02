/**
 * LandingPage — Premium enterprise SaaS landing page (Gold & White Theme).
 * Redesigned with Asymmetric Hero & Premium Bento Box Grid.
 */
import { useEffect, useRef, useState } from 'react'

/* ─── Data ──────────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Features',     href: '#features'      },
  { label: 'Architecture', href: '#architecture'  },
  { label: 'API Docs',     href: '/docs'           },
]

const STATS = [
  { value: '< 200ms', label: 'Median response latency',  numeric: false },
  { value: '99.9%',   label: 'Uptime SLA',               numeric: false },
  { value: '4',       label: 'LangGraph pipeline nodes',  numeric: true  },
  { value: '3s',      label: 'Meta webhook deadline',     numeric: false },
]

const TERMINAL_LINES = [
  { color: 'text-brand-600',  text: 'INFO      Initializing Krid.Ai Orchestrator...' },
  { color: 'text-slate-500',  text: 'INFO      Connected to Premium AI Network' },
  { color: 'text-brand-500',  text: 'INFO      Loaded Tenant: The Grand Emporium' },
  { color: 'text-brand-500',  text: 'INFO      Loaded Tenant: Speedy Fix Auto' },
  { color: 'text-green-600',  text: 'WEBHOOK   POST /api/whatsapp — 200 OK' },
  { color: 'text-slate-500',  text: 'AGENT     [The Grand Emporium] Processing incoming request' },
  { color: 'text-slate-400',  text: 'NODE      [1/4] Acknowledge — Read receipt sent' },
  { color: 'text-slate-400',  text: 'NODE      [2/4] Context — Loaded customer profile & history' },
  { color: 'text-brand-600',  text: 'NODE      [3/4] LLM — Generating context-aware response' },
  { color: 'text-green-600',  text: 'NODE      [4/4] Dispatcher — Premium response dispatched' },
  { color: 'text-brand-600 font-bold',  text: 'SUCCESS   Conversation handled seamlessly in 1.42s' },
]

const FEATURES = [
  {
    title: 'Multi-Brand Architecture',
    description: 'Manage multiple storefronts or service centers from a single platform. Each brand gets isolated system prompts, unique media libraries, and dedicated conversation histories seamlessly.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />,
  },
  {
    title: 'Advanced AI Reasoning',
    description: 'Powered by industry-leading LLMs, our agents deeply understand context, subtle intent, and brand tone.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />,
  },
  {
    title: 'Intelligent Workflows',
    description: 'Beyond simple chatbots, our platform uses directed agentic graphs.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />,
  },
  {
    title: 'Native Integration',
    description: 'Connect flawlessly to the WhatsApp Business API.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />,
  },
  {
    title: 'Centralized Command',
    description: 'Monitor every conversation globally in real-time. Review live chat threads, track AI resolution rates, and take over manually with a single click.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-9.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V3.375zm-9.75 9a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" />,
  },
  {
    title: 'Enterprise Security',
    description: 'Your customer data is fiercely protected and validated.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
  },
  {
    title: 'Smart Broadcasts',
    description: 'Automatically generate context-rich marketing campaigns.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />,
  },
  {
    title: 'Deep Performance Insights & Analytics',
    description: 'Measure the exact ROI of your AI agents. Track engagement rates, peak interaction times, and automated resolution success in a beautifully crafted dashboard designed specifically for executive oversight.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-9.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V3.375zm-9.75 9a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" />,
  },
]

const PIPELINE = [
  { n: '01', title: 'Acknowledge', desc: 'Marks message as read. Activates typing indicator.' },
  { n: '02', title: 'Context',     desc: 'Loads tenant config and last 5 messages from MongoDB.' },
  { n: '03', title: 'LLM Engine',  desc: 'Gemini 3.1 generates reply and selects response tools.' },
  { n: '04', title: 'Dispatcher',  desc: 'Routes text, image, or document perfectly to WhatsApp API.' },
]

/* ─── Hooks ─────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function useTypewriter(lines, startDelay = 600, lineDelay = 700) {
  const [shown, setShown] = useState([])
  useEffect(() => {
    setShown([])
    let t
    const showNext = (i) => {
      if (i >= lines.length) return
      t = setTimeout(() => { setShown(p => [...p, lines[i]]); showNext(i + 1) }, i === 0 ? startDelay : lineDelay)
    }
    showNext(0)
    return () => clearTimeout(t)
  }, [lines])
  return shown
}

/* ─── Logo ───────────────────────────────────────────────────────────────── */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
      </div>
      <span className="text-sm font-bold text-slate-900 tracking-tight">Krid.AI Orchestrator</span>
    </div>
  )
}

/* ─── Navbar ─────────────────────────────────────────────────────────────── */
function Navbar({ onEnterDashboard }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
                        ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/50'
                                   : 'bg-transparent'}`}>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-[72px] flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href}
               className="text-[13px] text-slate-600 hover:text-brand-600 transition-colors font-bold uppercase tracking-wider">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button onClick={onEnterDashboard} className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
            Sign In
          </button>
          <button onClick={onEnterDashboard} className="btn-primary btn-sm px-5 py-2.5 rounded-full text-sm font-semibold shadow-glow-sm hover:shadow-glow-md">
            Dashboard
          </button>
        </div>
      </div>
    </header>
  )
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */
function TypewriterTerminal() {
  const lines = useTypewriter(TERMINAL_LINES, 800, 550)
  return (
    <div className="w-full overflow-hidden text-left bg-white border border-slate-200 rounded-3xl shadow-card-xl relative group">
      {/* Light glow behind terminal */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      
      {/* Window chrome - Light Theme */}
      <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 border-b border-slate-100 relative z-10">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400 shadow-sm" />
          <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm" />
          <div className="w-3 h-3 rounded-full bg-green-400 shadow-sm" />
        </div>
        <span className="ml-4 text-[11px] text-slate-400 font-mono font-medium tracking-wide">~ ./start-orchestrator.sh</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Live</span>
        </div>
      </div>
      
      {/* Log lines - Light Theme */}
      <div className="p-6 min-h-[320px] space-y-3 font-mono text-[13px] bg-white relative z-10">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-4 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="text-slate-300 select-none flex-shrink-0 font-bold">➜</span>
            <span className={line.color}>{line.text}</span>
          </div>
        ))}
        {lines.length < TERMINAL_LINES.length && (
          <div className="flex gap-4">
            <span className="text-slate-300 font-bold">➜</span>
            <span className="w-2.5 h-4 bg-slate-300 animate-typing-cursor" />
          </div>
        )}
      </div>
    </div>
  )
}

function Hero({ onEnterDashboard }) {
  return (
    <section className="relative pt-32 lg:pt-48 pb-24 px-6 overflow-hidden">
      {/* Decorative Light Background Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.4] bg-brand-100 blur-[120px] animate-float" />
        <div className="absolute top-[20%] -right-[5%] w-[800px] h-[800px] rounded-full opacity-[0.3] bg-amber-100 blur-[100px] animate-float-slow" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLCAwLCAwLCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
      </div>

      <div className="relative max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* Left: Copy */}
          <div className="text-left animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white border border-brand-200 rounded-full text-[11px] font-bold uppercase tracking-widest text-brand-700 mb-8 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              Enterprise AI Architecture
            </div>

            <h1 className="text-5xl md:text-[64px] lg:text-[76px] font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
              Elevate your <br/>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-amber-500">Business Logic.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mb-12 font-medium">
              Deploy sophisticated, context-aware WhatsApp assistants tailored for your brand. 
              Built for premium customer experiences at absolute scale.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button onClick={onEnterDashboard} className="btn-primary btn-lg w-full sm:w-auto px-10 py-4 rounded-full text-base shadow-glow-md hover:shadow-glow-lg transition-all transform hover:-translate-y-1">
                Open Dashboard
              </button>
              <a href="#architecture" className="w-full sm:w-auto px-10 py-4 rounded-full text-base font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-center">
                View Architecture
              </a>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-12 flex items-center gap-6 text-slate-400 text-sm font-semibold">
              <div className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> 99.9% Uptime</div>
              <div className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> SOC2 Compliant</div>
            </div>
          </div>

          {/* Right: Terminal */}
          <div className="relative animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="absolute -inset-4 bg-gradient-to-tr from-brand-100 to-amber-50 rounded-[2.5rem] blur-xl opacity-60"></div>
            <TypewriterTerminal />
          </div>

        </div>
      </div>
    </section>
  )
}

/* ─── Features (Bento Box) ───────────────────────────────────────────────── */
function Features() {
  const [ref, inView] = useInView(0.1)
  
  // Bento Box Layout Mapping
  const bentoClasses = [
    'md:col-span-2 md:row-span-2 flex-col justify-between p-10 bg-gradient-to-br from-white to-slate-50', // 0: Large Block
    'md:col-span-2 md:row-span-1 flex-col justify-center p-8', // 1: Wide
    'md:col-span-1 md:row-span-1 flex-col justify-center p-8', // 2: Square
    'md:col-span-1 md:row-span-1 flex-col justify-center p-8', // 3: Square
    'md:col-span-2 md:row-span-1 flex-col justify-center p-8', // 4: Wide
    'md:col-span-1 md:row-span-1 flex-col justify-center p-8', // 5: Square
    'md:col-span-1 md:row-span-1 flex-col justify-center p-8', // 6: Square
    'md:col-span-4 md:row-span-1 flex-col md:flex-row items-center gap-8 p-10 bg-brand-50/30 border-brand-200/50', // 7: Full Width
  ]

  return (
    <section id="features" className="py-32 px-6 relative bg-white" ref={ref}>
      <div className="max-w-[1400px] mx-auto relative z-10">
        
        <div className={`mb-20 transition-all duration-700 max-w-3xl
                         ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-500 mb-4">Unmatched Capabilities</p>
          <h2 className="text-4xl md:text-[56px] font-black text-slate-900 mb-6 tracking-tight leading-[1.1]">
            Everything you need <br/>to scale perfectly.
          </h2>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[240px] gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title}
                 className={`group relative bg-white border border-slate-200/80 rounded-[32px] 
                             hover:shadow-card-xl hover:-translate-y-1 hover:border-brand-300
                             transition-all duration-500 flex overflow-hidden
                             ${bentoClasses[i]}
                             ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                 style={{ transitionDelay: `${0.1 + i * 0.05}s` }}>
              
              {/* Gold Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className={`relative flex items-center justify-center rounded-2xl mb-6 shadow-sm border border-slate-100 bg-white group-hover:scale-110 group-hover:shadow-glow-sm transition-all duration-500
                              ${i === 0 || i === 7 ? 'w-16 h-16' : 'w-12 h-12'}`}>
                <svg className={`${i === 0 || i === 7 ? 'w-8 h-8' : 'w-6 h-6'} text-brand-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {f.icon}
                </svg>
              </div>
              
              <div className={i === 7 ? 'flex-1' : ''}>
                <h3 className={`relative font-bold text-slate-900 group-hover:text-brand-700 transition-colors duration-300
                                ${i === 0 ? 'text-3xl mb-4' : i === 7 ? 'text-2xl mb-2' : 'text-xl mb-2'}`}>
                  {f.title}
                </h3>
                <p className={`relative text-slate-500 leading-relaxed font-medium
                                ${i === 0 ? 'text-lg' : 'text-sm'}`}>
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Architecture ───────────────────────────────────────────────────────── */
function Architecture() {
  const [ref, inView] = useInView(0.1)
  return (
    <section id="architecture" className="py-32 px-6 bg-slate-50 border-y border-slate-200 overflow-hidden" ref={ref}>
      <div className="max-w-[1400px] mx-auto">
        
        <div className={`text-center mb-24 transition-all duration-500
                         ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-600 mb-4">The Pipeline</p>
          <h2 className="text-4xl md:text-[56px] font-black text-slate-900 mb-6 tracking-tight">Agentic Architecture</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            Every inbound message traverses a sophisticated directed state graph, processing AI logic entirely in the background.
          </p>
        </div>

        {/* Pipeline steps - Redesigned as large interlocking blocks */}
        <div className="flex flex-col md:flex-row items-stretch gap-4 mb-20 relative z-10">
          {PIPELINE.map((s, i) => (
            <div key={s.n} className={`flex-1 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm relative group
                                       hover:shadow-card-lg hover:border-brand-300 hover:-translate-y-2 transition-all duration-500
                                       ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                 style={{ transitionDelay: `${0.1 + i * 0.1}s` }}>
              
              <div className="text-6xl font-black text-slate-100 group-hover:text-brand-50 absolute top-4 right-6 transition-colors duration-500">
                {s.n}
              </div>
              
              <div className="relative z-10 mt-12">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tech row */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { label: 'AI Engine',      value: 'Google Gemini 3.1', sub: 'Multimodal · Tool-use' },
            { label: 'Orchestration',  value: 'LangGraph + FastAPI',     sub: 'Async background tasks' },
            { label: 'Data Layer',     value: 'MongoDB Atlas',           sub: 'Motor async · Indexed' },
          ].map((t, i) => (
            <div key={t.label}
                 className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm
                              hover:border-brand-200 transition-all duration-200 flex items-center justify-between
                              ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                 style={{ transitionDelay: `${0.4 + i * 0.08}s` }}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t.label}</p>
                <p className="text-lg font-extrabold text-slate-900 leading-none">{t.value}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-semibold">{t.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ────────────────────────────────────────────────────────────────── */
function CTASection({ onEnterDashboard }) {
  const [ref, inView] = useInView(0.2)
  return (
    <section className="py-32 px-6 bg-white" ref={ref}>
      <div className={`max-w-[1200px] mx-auto transition-all duration-700
                       ${inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="relative rounded-[40px] overflow-hidden border border-brand-200 p-16 md:p-24 text-center bg-brand-50/50">
          
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Ready to see it in action?</h2>
            <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto font-medium">
              Open the dashboard to monitor live sessions, view realtime AI reasoning,
              and explore the multi-tenant architecture.
            </p>
            <button onClick={onEnterDashboard}
                    className="btn-primary btn-lg mx-auto px-12 py-5 rounded-full text-lg shadow-glow-md hover:shadow-glow-lg transform hover:-translate-y-1 transition-all">
              Launch Dashboard
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12 px-6">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <Logo />
        <p className="text-sm text-slate-400 font-medium">
          Built with FastAPI, LangGraph, Gemini 3.1 & React
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          All systems operational
        </div>
      </div>
    </footer>
  )
}

/* ─── Export ─────────────────────────────────────────────────────────────── */
export default function LandingPage({ onEnterDashboard }) {
  return (
    <div className="min-h-screen bg-white page-enter font-sans text-slate-900 selection:bg-brand-200">
      <Navbar onEnterDashboard={onEnterDashboard} />
      <Hero onEnterDashboard={onEnterDashboard} />
      <Features />
      <Architecture />
      <CTASection onEnterDashboard={onEnterDashboard} />
      <Footer />
    </div>
  )
}
