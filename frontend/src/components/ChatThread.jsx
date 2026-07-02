/**
 * ChatThread — Right panel conversation view.
 * Light enterprise style, no emojis, auto-scrolls, refreshes every 3s.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { getMessages } from '../api'

// Ensure a timestamp string is always parsed as UTC.
// MongoDB ISO strings may come without 'Z' (e.g. "2026-06-22T04:37:00").
// Without Z, JS treats it as LOCAL time — appending Z forces correct UTC parse.
function toUTC(ts) {
  if (!ts) return new Date(NaN)
  const s = String(ts)
  // Already has timezone info (Z or +HH:MM) — parse as-is
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  // No timezone — treat as UTC
  return new Date(s + 'Z')
}

function formatTime(ts) {
  try {
    return toUTC(ts).toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch { return '' }
}

function formatDate(ts) {
  try {
    const d         = toUTC(ts)
    const today     = new Date()
    const isToday   = d.toDateString() === today.toDateString()
    if (isToday) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  } catch { return '' }
}

function UserIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-600">Select a conversation</p>
      <p className="text-xs text-slate-400 mt-1">Click a session from the left panel to view the full chat</p>
    </div>
  )
}

/* ─── Media renderers ───────────────────────────────────────────────────── */
function MediaContent({ msg, isBot, tenantId }) {
  const { text_content, media_url, media_mime_type, media_filename } = msg

  let displayUrl = media_url
  if (media_url?.includes('api.twilio.com')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    displayUrl = `${baseUrl}/api/media/proxy?tenant=${encodeURIComponent(tenantId)}&url=${encodeURIComponent(media_url)}`
  }

  const isImage = media_mime_type?.startsWith('image') ||
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(media_url)
  const isPdf   = media_mime_type === 'application/pdf' ||
                  /\.pdf$/i.test(media_url)

  return (
    <div className="space-y-2">
      {/* Caption text if any */}
      {text_content && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text_content}</p>
      )}

      {isImage && (
        <img
          src={displayUrl}
          alt="media"
          className="rounded-xl max-w-[260px] w-full object-cover border border-white/20"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        />
      )}

      {isPdf && (
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-150
                      ${ isBot
                        ? 'bg-white/15 border-white/25 hover:bg-white/25 text-white'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'}`}
        >
          {/* PDF icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                           ${ isBot ? 'bg-white/20' : 'bg-red-50 border border-red-200'}`}>
            <svg className={`w-4 h-4 ${isBot ? 'text-white' : 'text-red-500'}`}
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {media_filename || 'Document.pdf'}
            </p>
            <p className={`text-[10px] ${isBot ? 'text-white/60' : 'text-slate-400'}`}>
              Tap to open
            </p>
          </div>
          {/* Arrow */}
          <svg className={`w-3.5 h-3.5 ml-auto flex-shrink-0 ${isBot ? 'text-white/60' : 'text-slate-400'}`}
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      )}
    </div>
  )
}

function MessageBubble({ msg, session }) {
  const isBot = msg.direction === 'OUTBOUND'

  return (
    <div className={`flex ${isBot ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`flex flex-col gap-1 max-w-[72%] ${isBot ? 'items-end' : 'items-start'}`}>
        {/* Sender label */}
        <div className={`flex items-center gap-1.5 text-xs text-slate-400 px-1`}>
          {isBot ? <BotIcon /> : <UserIcon />}
          <span>{isBot ? 'AI Agent' : 'Customer'}</span>
        </div>

        {/* Bubble */}
        {isBot ? (
          <div className="bubble-bot">
            <MediaContent msg={msg} isBot={true} tenantId={session?.tenant_id} />
          </div>
        ) : (
          <div className="bubble-user">
            <MediaContent msg={msg} isBot={false} tenantId={session?.tenant_id} />
          </div>
        )}

        {/* Time */}
        <span className="text-xs text-slate-400 px-1">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  )
}

export default function ChatThread({ session }) {
  const [messages, setMessages]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const bottomRef    = useRef(null)
  const scrollRef    = useRef(null)
  const prevCountRef = useRef(0)

  // Returns true if user is within 150px of the bottom
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
    setHasNewMsg(false)
  }, [])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setMessages([])
    prevCountRef.current = 0

    const doFetch = () => {
      getMessages(session.id)
        .then(res => setMessages(res.data))
        .catch(console.error)
        .finally(() => setLoading(false))
    }

    doFetch()
    const iv = setInterval(doFetch, 3000)
    return () => clearInterval(iv)
  }, [session?.id])

  // Smart scroll: only pull down if already near bottom
  useEffect(() => {
    if (messages.length === 0) return
    const isNew = messages.length > prevCountRef.current
    prevCountRef.current = messages.length
    if (!isNew) return
    if (isNearBottom()) {
      scrollToBottom()
    } else {
      setHasNewMsg(true)
    }
  }, [messages, isNearBottom, scrollToBottom])

  // Jump to bottom instantly on first load
  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom('instant')
  }, [loading]) // eslint-disable-line

  if (!session) return <EmptyState />

  const isUrgent = session.status === 'NEEDS_HUMAN'
  const STATUS_LABELS = {
    WAITING_FOR_BOT: 'Bot Responding',
    AGENT_RESPONDING: 'Bot Responding',
    NEEDS_HUMAN: 'Needs Human',
    ACTIVE: 'Active',
    CLOSED: 'Closed',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat header */}
      <div className={`px-6 py-4 border-b flex items-center gap-4 bg-white
                       ${isUrgent ? 'border-danger-border bg-danger-light' : 'border-slate-200'}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                         ${isUrgent ? 'bg-danger-mid text-danger-text' : 'bg-slate-100 text-slate-600'}`}>
          {session.customer_phone?.slice(-2)}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">{session.customer_phone}</p>
          <p className={`text-xs mt-0.5 ${isUrgent ? 'text-danger-text font-medium' : 'text-slate-400'}`}>
            {isUrgent ? '⚠️ Requires human attention' : `Status: ${STATUS_LABELS[session.status] ?? session.status}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">{messages.length} messages</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="dot-live" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 relative"
      >
        {/* Date + message grouping */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1,2,3,4].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                     style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className={`skeleton rounded-2xl ${i % 2 === 0 ? 'w-52 h-12' : 'w-44 h-10'}`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-slate-400">No messages in this session yet</p>
            </div>
          ) : (
            messages.reduce((acc, msg, idx) => {
              if (msg.is_typing_indicator) return acc
              // Insert date divider when date changes
              const dateLabel = formatDate(msg.timestamp)
              const prevMsg = messages.slice(0, idx).filter(m => !m.is_typing_indicator).at(-1)
              const prevDate = prevMsg ? formatDate(prevMsg.timestamp) : null
              if (dateLabel !== prevDate) {
                acc.push(
                  <div key={`date-${msg.id}`} className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium px-2">{dateLabel}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )
              }
              acc.push(<MessageBubble key={msg.id} msg={msg} session={session} />)
              return acc
            }, [])
          )}
        </div>

        {/* Live Typing Metadata Indicator */}
        {session?.status === 'AGENT_RESPONDING' && (
          <div className="flex justify-end mt-4 animate-fade-in">
            <div className="flex flex-col gap-1 items-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
                <BotIcon />
                <span>AI Agent</span>
              </div>
              <div className="bg-brand-600 px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm inline-flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-[10px] text-brand-100 ml-1 italic font-medium">typing...</span>
              </div>
            </div>
          </div>
        )}

        {/* Scroll Anchor */}
        <div ref={bottomRef} className="h-4" />

        {/* ↓ New message badge — shown when user scrolled up and new msg arrives */}
        {hasNewMsg && (
          <button
            onClick={() => scrollToBottom()}
            className="fixed bottom-6 right-8 z-50 flex items-center gap-2 px-4 py-2
                       bg-brand-600 text-white text-xs font-semibold rounded-full
                       shadow-lg hover:bg-brand-700 transition-all duration-150 animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
            New message
          </button>
        )}
      </div>
    </div>
  )
}
