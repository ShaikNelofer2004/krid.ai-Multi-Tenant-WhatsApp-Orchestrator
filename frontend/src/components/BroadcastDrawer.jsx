/**
 * BroadcastDrawer — Enhanced slide-in broadcast panel.
 * Features: tenant-specific templates, media via URL OR file upload,
 * live preview, chip-style phone number input, campaign result summary.
 */
import { useState, useRef, useEffect } from 'react'
import { sendBroadcast, getSessions, generateBroadcast } from '../api'

/* ─── Per-tenant templates ───────────────────────────────────────────────── */
const TENANT_TEMPLATES = {
  tenant_a: [
    {
      id: 'new_catalog',
      label: '🛋️ New Catalog Drop',
      badge: 'Popular',
      text: '✨ Our 2026 The Grand Emporium catalog is now live! Explore over 50 handcrafted pieces — from the Imperial King Bed (₹1,95,000) to our signature Sovereign Sofa Set (₹2,85,000).\n\nReply *CATALOG* and we\'ll send you the full digital catalog instantly.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'showroom_invite',
      label: '🏛️ Showroom Invite',
      badge: 'Exclusive',
      text: '🎟️ You\'re invited to our *Private Showroom Preview* — exclusively for our valued customers.\n\nExperience our latest luxury collection in person. Complimentary tea & consultation included.\n\nReply *VISIT* to schedule your private appointment.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'seasonal_sale',
      label: '🏷️ Seasonal Promotion',
      badge: 'Sale',
      text: '🌟 *The Grand Emporium Summer Sale* — Up to 25% off on selected bedroom and dining collections.\n\nThis exclusive offer is available only to our existing customers until 30th June.\n\nReply *OFFER* to receive your personalised discount code.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'customisation',
      label: '🎨 Bespoke Orders Open',
      badge: 'New',
      text: '🛠️ Our *Bespoke Furniture Programme* is now accepting new orders.\n\nChoose your wood finish, fabric, and dimensions. Every piece crafted to your exact specifications.\n\nLead time: 4–8 weeks. Reply *CUSTOM* to begin your consultation.',
      mediaUrl: '',
      mediaType: 'none',
    },
  ],
  tenant_b: [
    {
      id: 'service_reminder',
      label: '🔧 Service Due Reminder',
      badge: 'Important',
      text: '⚙️ *Speedy Fix Auto — Service Reminder*\n\nYour vehicle is approaching its scheduled service interval. Regular maintenance ensures peak performance and prevents costly repairs.\n\nReply *BOOK* to schedule your service appointment. We offer same-week slots.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'monsoon_check',
      label: '🌧️ Monsoon Check Package',
      badge: 'Seasonal',
      text: '🌧️ *Monsoon Car Care Package — ₹1,499*\n\nGet your vehicle monsoon-ready with our comprehensive check:\n✅ Wiper replacement\n✅ Tyre tread check\n✅ Brake inspection\n✅ AC filter service\n\nReply *MONSOON* to book your slot this week.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'invoice_ready',
      label: '📄 Invoice Ready',
      badge: 'Billing',
      text: '📋 *Your Service Invoice is Ready*\n\nYour vehicle has been serviced and the invoice is now available.\n\nReply *INVOICE* and we\'ll send your itemised invoice directly on WhatsApp. Payment can be made via UPI, card, or cash.',
      mediaUrl: '',
      mediaType: 'none',
    },
    {
      id: 'offer_oil',
      label: '🛢️ Oil Change Offer',
      badge: 'Deal',
      text: '🛢️ *Flash Deal — Engine Oil Change at ₹2,499*\n\nFor this week only, get a full synthetic engine oil change (5W-30, 4L) including filter replacement at a special price.\n\nValid until Sunday. Reply *OIL* to confirm your slot.',
      mediaUrl: '',
      mediaType: 'none',
    },
  ],
  default: [
    {
      id: 'general_promo',
      label: '📢 General Announcement',
      badge: '',
      text: 'We have exciting news to share with you. Stay tuned for our latest updates and exclusive offers. Reply to this message to learn more.',
      mediaUrl: '',
      mediaType: 'none',
    },
  ],
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
)
const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
)
const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
)
const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)
const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.75 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)
const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
)

/* ─── Phone chip input ───────────────────────────────────────────────────── */
function PhoneChipInput({ phones, setPhones, onLoadAll }) {
  const [input, setInput] = useState('')

  const addPhone = (val) => {
    const cleaned = val.trim().replace(/\s/g, '')
    if (cleaned && !phones.includes(cleaned)) {
      setPhones(prev => [...prev, cleaned])
    }
    setInput('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addPhone(input)
    } else if (e.key === 'Backspace' && !input && phones.length) {
      setPhones(prev => prev.slice(0, -1))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="section-label">Recipients</label>
        <button onClick={onLoadAll}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors">
          <UserIcon /> Load all sessions
        </button>
      </div>
      <div className="min-h-[60px] border border-slate-200 rounded-lg p-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all bg-white">
        {phones.map((p, i) => (
          <span key={i}
            className="inline-flex items-center gap-1 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-mono px-2 py-0.5 rounded-full">
            {p}
            <button onClick={() => setPhones(prev => prev.filter((_, j) => j !== i))}
              className="hover:text-red-500 transition-colors ml-0.5">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => input && addPhone(input)}
          placeholder={phones.length === 0 ? '+919876543210 (press Enter after each)' : ''}
          className="flex-1 min-w-[180px] text-xs outline-none bg-transparent placeholder:text-slate-400 font-mono"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">{phones.length} recipient{phones.length !== 1 ? 's' : ''} · Enter or comma to add · Backspace to remove</p>
    </div>
  )
}

/* ─── Media attachment section ───────────────────────────────────────────── */
function MediaAttachment({ mediaUrl, setMediaUrl, mediaType, setMediaType }) {
  const [tab, setTab] = useState('url') // 'url' | 'file'
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    // For demo: create object URL. In production, upload to a CDN first.
    const objectUrl = URL.createObjectURL(file)
    setMediaUrl(objectUrl)
    if (file.type.startsWith('image/')) setMediaType('image')
    else if (file.type === 'application/pdf') setMediaType('document')
    else setMediaType('image')
  }

  const isPdf = mediaType === 'document' || (mediaUrl && /\.pdf$/i.test(mediaUrl))
  const isImage = mediaType === 'image' && !isPdf

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="section-label">Attach Media (optional)</label>
        {mediaUrl && (
          <button onClick={() => { setMediaUrl(''); setMediaType('none') }}
            className="text-xs text-red-500 hover:text-red-700 transition-colors">
            Remove
          </button>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 mb-3 gap-0.5">
        {[['url', <LinkIcon />, 'Paste URL'], ['file', <UploadIcon />, 'Upload File']].map(([t, icon, lab]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150
              ${tab === t ? 'bg-white shadow-sm text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            {icon} {lab}
          </button>
        ))}
      </div>

      {tab === 'url' && (
        <div>
          <input
            id="broadcast-media-url"
            type="url"
            value={mediaUrl}
            onChange={e => {
              setMediaUrl(e.target.value)
              const v = e.target.value.toLowerCase()
              if (v.endsWith('.pdf')) setMediaType('document')
              else if (v) setMediaType('image')
              else setMediaType('none')
            }}
            placeholder="https://example.com/image.jpg or file.pdf"
            className="input text-sm font-mono"
          />
          <div className="flex gap-2 mt-2">
            {['image', 'document'].map(t => (
              <button key={t} onClick={() => setMediaType(t)}
                className={`text-xs px-3 py-1 rounded-full border transition-all
                  ${mediaType === t ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {t === 'image' ? '🖼️ Image' : '📄 PDF/Document'}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'file' && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150
            ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
          <UploadIcon />
          <p className="text-xs font-medium text-slate-600">Click or drag & drop</p>
          <p className="text-[10px] text-slate-400">Images (JPG, PNG, WEBP) or PDF documents</p>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Preview */}
      {mediaUrl && isImage && (
        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img src={mediaUrl} alt="preview" className="w-full object-cover max-h-32"
            onError={e => e.target.style.display = 'none'} />
          <p className="text-[10px] text-slate-400 px-3 py-1.5 bg-slate-50">Image preview · will be sent as WhatsApp image</p>
        </div>
      )}
      {mediaUrl && isPdf && (
        <div className="mt-3 flex items-center gap-3 border border-red-100 bg-red-50 rounded-xl px-3 py-2.5">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileIcon />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">
              {mediaUrl.startsWith('blob:') ? 'Uploaded PDF' : mediaUrl.split('/').pop()}
            </p>
            <p className="text-[10px] text-slate-400">Will be sent as WhatsApp document</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function BroadcastDrawer({ tenant, isOpen, onClose }) {
  const [step, setStep] = useState(1) // 1=compose, 2=confirm
  const [message, setMessage] = useState('')
  const [phones, setPhones] = useState([])
  const [targetMode, setTargetMode] = useState('all') // 'all' | 'custom'
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState('none')
  
  // AI State
  const [aiKeywords, setAiKeywords] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAiInput, setShowAiInput] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1); setMessage(''); setPhones([]); setResult(null)
      setSelectedTemplate(null); setMediaUrl(''); setMediaType('none')
      setTargetMode('all')
      setAiKeywords(''); setShowAiInput(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const templates = TENANT_TEMPLATES[tenant?.tenant_id] || TENANT_TEMPLATES.default

  const applyTemplate = (t) => {
    setSelectedTemplate(t.id)
    setMessage(t.text)
    if (t.mediaUrl) { setMediaUrl(t.mediaUrl); setMediaType(t.mediaType) }
  }

  const handleGenerate = async () => {
    if (!aiKeywords.trim() || !tenant) return
    setIsGenerating(true)
    try {
      const res = await generateBroadcast({ tenant_id: tenant.tenant_id, keywords: aiKeywords })
      setMessage(res.data.message)
      setSelectedTemplate(null)
    } catch (err) {
      alert("AI Generation failed. Check backend logs.")
    } finally {
      setIsGenerating(false)
    }
  }

  const loadAllSessions = async () => {
    if (!tenant) return
    try {
      const { data } = await getSessions(tenant.tenant_id)
      const nums = data.map(s => s.customer_phone).filter(Boolean)
      setPhones(nums)
      setTargetMode('custom')
    } catch {}
  }

  const handleSend = async () => {
    if (!message.trim() || !tenant) return
    setSending(true)
    setResult(null)
    try {
      const phoneList = targetMode === 'custom' ? phones : null
      const res = await sendBroadcast({
        tenant_id: tenant.tenant_id,
        message: message.trim(),
        phone_numbers: phoneList,
        media_url: mediaUrl.trim() || null,
        media_type: mediaUrl.trim() ? mediaType : null,
      })
      setResult({ success: true, data: res.data })
      setStep(1)
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.detail || 'Broadcast failed.' })
    } finally {
      setSending(false)
    }
  }

  const charCount = message.length
  const recipientLabel = targetMode === 'all' ? 'All active sessions' : `${phones.length} selected`
  const canSend = message.trim() && tenant && (targetMode === 'all' || phones.length > 0)

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white border-l border-slate-200
                      z-50 flex flex-col shadow-2xl animate-slide-in-r">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-brand-600 to-brand-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Broadcast Campaign</h2>
            <p className="text-xs text-white/70 mt-0.5">
              {tenant ? `${tenant.name}` : 'No tenant selected'} · {recipientLabel}
            </p>
          </div>
          <button id="broadcast-close-btn" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
            <XIcon />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Result banner */}
          {result && (
            <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {result.success
                ? `✅ Sent to ${result.data.sent} · Failed: ${result.data.failed} of ${result.data.total_targets}`
                : `❌ ${result.error}`}
            </div>
          )}

          <div className="px-6 py-5 space-y-6">

            {/* ── Templates ── */}
            <div>
              <p className="section-label mb-3">
                {tenant ? `${tenant.name} Templates` : 'Templates'}
                <span className="ml-2 text-[10px] text-slate-400 font-normal normal-case">click to load</span>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {templates.map(t => (
                  <button key={t.id} id={`template-${t.id}`}
                    onClick={() => applyTemplate(t)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 group
                      ${selectedTemplate === t.id
                        ? 'border-brand-400 bg-brand-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-semibold ${selectedTemplate === t.id ? 'text-brand-700' : 'text-slate-700'}`}>
                        {t.label}
                      </p>
                      {t.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide
                          ${selectedTemplate === t.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{t.text}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Message ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="section-label">Message</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowAiInput(!showAiInput)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                    <SparklesIcon /> AI Magic
                  </button>
                  <span className={`text-[10px] tabular-nums ${charCount > 1000 ? 'text-red-500' : 'text-slate-400'}`}>
                    {charCount} / 1600
                  </span>
                </div>
              </div>

              {/* AI Generator Input */}
              {showAiInput && (
                <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-100 animate-fade-in">
                  <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    Generate with AI
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={aiKeywords}
                      onChange={e => setAiKeywords(e.target.value)}
                      placeholder="e.g. Summer sale, 20% off, expires friday"
                      className="input text-xs flex-1 bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-200"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && aiKeywords.trim() && !isGenerating) {
                          handleGenerate()
                        }
                      }}
                    />
                    <button
                      onClick={() => handleGenerate()}
                      disabled={isGenerating || !aiKeywords.trim()}
                      className="btn bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 px-3 py-1.5 text-xs">
                      {isGenerating ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Generate'}
                    </button>
                  </div>
                  <p className="text-[9px] text-purple-500 mt-1.5">Give 2-3 keywords and let AI write the perfect broadcast message.</p>
                </div>
              )}

              <textarea
                id="broadcast-message-input"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                placeholder="Compose your broadcast message... (supports *bold*, _italic_)"
                className="input text-sm resize-none"
              />
              {message && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Preview</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{message}</p>
                </div>
              )}
            </div>

            {/* ── Media ── */}
            <MediaAttachment
              mediaUrl={mediaUrl} setMediaUrl={setMediaUrl}
              mediaType={mediaType} setMediaType={setMediaType}
            />

            {/* ── Recipients ── */}
            <div>
              <div className="flex gap-2 mb-3">
                {[['all', '🌐 All Sessions'], ['custom', '🎯 Custom']].map(([val, lab]) => (
                  <button key={val} id={`target-${val}-btn`}
                    onClick={() => setTargetMode(val)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all duration-150
                      ${targetMode === val
                        ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                    {lab}
                  </button>
                ))}
              </div>
              {targetMode === 'custom' && (
                <PhoneChipInput phones={phones} setPhones={setPhones} onLoadAll={loadAllSessions} />
              )}
              {targetMode === 'all' && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  Will send to all active sessions for <strong>{tenant?.name}</strong>
                </p>
              )}
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          {/* Summary row */}
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              {mediaUrl
                ? <span className="text-green-600 font-medium">📎 {mediaType === 'document' ? 'PDF' : 'Image'} attached</span>
                : <span className="text-slate-400">No attachment</span>}
            </span>
            <span className="text-slate-300">·</span>
            <span>{recipientLabel}</span>
            <span className="text-slate-300">·</span>
            <span>{charCount} chars</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">
              Cancel
            </button>
            <button
              id="broadcast-send-btn"
              onClick={handleSend}
              disabled={!canSend || sending}
              className="btn-primary flex-1 justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              {sending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                : <><SendIcon /> Send Broadcast</>}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
