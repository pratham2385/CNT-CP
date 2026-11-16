/**
 * NetShield AI — AI Chatbot panel component.
 *
 * Instrument-Grade SOC Security Assistant featuring:
 * - Frosted Glassmorphism with backdrop-blur and soft specular lighting
 * - Floating Command FAB with live pulse badge & keyboard shortcut hint (Ctrl+K)
 * - Systematic chat bubbles with role-differentiated styling & avatar halos
 * - Markdown rendering for code snippets, lists, and threat intelligence
 * - Security Quick-Prompt chips with hover elevation
 * - Real-time thinking animation with glowing cyan pulse wave
 * - Clean header with AI Model badge and one-click clear session
 *
 * @module components/Chatbot
 */

import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Shield,
  Sparkles,
  RotateCcw,
  Terminal,
  Activity,
  Zap,
  Check,
  Copy,
  ChevronRight,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { sendChatbotQuery, getChatbotStatus } from '../api/client.js'

const QUICK_ACTIONS = [
  { label: 'Today\'s Attack Summary', query: 'What attacks happened today?' },
  { label: 'Real-Time Posture', query: 'Is my network safe right now?' },
  { label: 'Explain DDoS Vector', query: 'What is a DDoS attack and how does NetShield AI detect it?' },
  { label: 'Hostile Adversary IPs', query: 'Show top attacker IPs and their impact' },
]

/**
 * Enhanced Markdown code block with one-click copy button
 */
function CodeBlock({ children, inline, className }) {
  const [copied, setCopied] = useState(false)
  const text = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inline) {
    return <code className="md-code-inline mono">{children}</code>
  }

  return (
    <div className="md-code-block-wrap">
      <div className="md-code-header">
        <span className="mono text-xs text-muted">
          <Terminal size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          console
        </span>
        <button className="code-copy-btn mono" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={11} className="text-safe" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="md-pre-custom mono">
        <code>{text}</code>
      </pre>
    </div>
  )
}

/**
 * Lightweight Markdown renderer for bot messages.
 */
function BotMessage({ content }) {
  return (
    <div className="bot-md">
      <ReactMarkdown
        components={{
          strong: ({ children }) => <strong className="md-bold">{children}</strong>,
          h1: ({ children }) => <h1 className="md-h md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h md-h3">{children}</h3>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          p: ({ children }) => <p className="md-p">{children}</p>,
          code: CodeBlock,
          a: ({ href, children }) => (
            <a className="md-link" href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="md-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default function Chatbot({ externalOpen = false, onExternalClose }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (externalOpen) {
      setOpen(true)
    }
  }, [externalOpen])

  const handleClose = () => {
    setOpen(false)
    if (onExternalClose) onExternalClose()
  }

  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Hello, Operator. I am the **NetShield AI** security copilot.\n\nI can analyze real-time packet telemetry, provide MITRE ATT&CK mitigation playbooks, or summarize hostile adversary patterns.',
      time: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [botStatus, setBotStatus] = useState({ available: true, model: '' })
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typing])

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Fetch chatbot status on open
  useEffect(() => {
    if (!open) return
    getChatbotStatus()
      .then((data) => setBotStatus(data))
      .catch(() => setBotStatus({ available: false, model: '' }))
  }, [open])

  // Keyboard shortcut: Ctrl+K toggles the chat panel
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const send = async (text) => {
    const query = text || input.trim()
    if (!query) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: query, time: new Date() }])
    setTyping(true)

    try {
      const response = await sendChatbotQuery(query)
      setMessages((prev) => [...prev, { role: 'bot', text: response, time: new Date() }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: 'Unable to reach the NetShield inference gateway. Verify that the Python engine on port 8000 is active.',
          time: new Date(),
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const handleClearSession = () => {
    setMessages([
      {
        role: 'bot',
        text: 'Session history refreshed. What would you like to investigate next?',
        time: new Date(),
      },
    ])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const formatMsgTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <>
      {/* 1. Floating Glassmorphic FAB with Glow Badge */}
      <button
        className={`chat-glass-fab ${open ? 'chat-glass-fab-hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Open NetShield Assistant (Ctrl+K)"
        title="Open NetShield Assistant (Ctrl+K)"
      >
        <div className="fab-icon-box">
          <Sparkles size={16} className="text-cyan" />
        </div>
        <div className="fab-text-wrap">
          <span className="fab-title">AI Copilot</span>
          <span className="fab-keychip mono">Ctrl+K</span>
        </div>
        <span className="fab-pulse-dot" />
      </button>

      {/* 2. Glassmorphic Slide-Out Panel */}
      <div className={`chat-glass-panel ${open ? 'chat-glass-panel-open' : ''}`}>
        {/* Panel Header */}
        <div className="chat-glass-header">
          <div className="header-branding">
            <div className="bot-avatar-frame">
              <Bot size={18} className="text-cyan" />
              <span className="avatar-online-dot" />
            </div>
            <div className="header-titles">
              <div className="title-row">
                <span className="copilot-name">NetShield Assistant</span>
                <span className="copilot-badge mono">SOC COPILOT</span>
              </div>
              <div className="status-row text-muted text-xs mono">
                <span>{botStatus.model ? botStatus.model.replace('models/', '') : 'Gemini Engine'}</span>
                <span className="meta-sep">•</span>
                <span className="text-safe">Online</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="chat-icon-btn"
              onClick={handleClearSession}
              title="Clear conversation"
            >
              <RotateCcw size={14} />
            </button>
            <button
              className="chat-icon-btn chat-close-btn"
              onClick={handleClose}
              title="Close panel (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="chat-messages-container" ref={scrollRef}>
          {messages.map((msg, i) => {
            const isBot = msg.role === 'bot'
            return (
              <div key={i} className={`message-group ${isBot ? 'group-bot' : 'group-user'}`}>
                <div className="message-sender-avatar">
                  {isBot ? <Bot size={13} className="text-cyan" /> : <User size={13} className="text-primary" />}
                </div>

                <div className="message-content-wrap">
                  <div className={`message-bubble ${isBot ? 'bubble-bot-glass' : 'bubble-user-glass'}`}>
                    {isBot ? <BotMessage content={msg.text} /> : <span className="user-plain-text">{msg.text}</span>}
                  </div>
                  <span className="message-timestamp mono text-muted text-xs">
                    {formatMsgTime(msg.time)}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Typing Indicator */}
          {typing && (
            <div className="message-group group-bot">
              <div className="message-sender-avatar">
                <Bot size={13} className="text-cyan" />
              </div>
              <div className="message-content-wrap">
                <div className="bubble-bot-glass typing-bubble">
                  <span className="thinking-text mono text-xs text-cyan">Analyzing telemetry</span>
                  <div className="wave-container">
                    <span className="wave-dot" style={{ animationDelay: '0s' }} />
                    <span className="wave-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="wave-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="chat-quick-section">
          <div className="quick-header mono text-muted">
            <Zap size={11} className="text-amber" />
            <span>INVESTIGATE QUICKLY</span>
          </div>
          <div className="quick-chips-grid">
            {QUICK_ACTIONS.map((item, idx) => (
              <button
                key={idx}
                className="quick-chip-glass mono"
                onClick={() => send(item.query)}
                disabled={typing}
              >
                <ChevronRight size={11} className="text-muted" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="chat-input-container">
          <div className="input-glass-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="chat-glass-input"
              placeholder="Ask about active vectors, MITRE TTPs, or attacker IPs…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={typing}
            />
            <button
              className="chat-glass-send-btn"
              onClick={() => send()}
              disabled={typing || !input.trim()}
              title="Send message (Enter)"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="input-shortcut-hint mono text-muted text-xs">
            <span>Press <strong>Enter</strong> to send • <strong>Shift+Enter</strong> for newline</span>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {open && <div className="chat-glass-backdrop" onClick={handleClose} />}

      {/* Instrument-Grade Styling */}
      <style>{`
        /* ── 1. Floating Glass FAB ── */
        .chat-glass-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          height: 44px;
          padding: 0 16px 0 10px;
          border-radius: var(--radius-md);
          background: rgba(19, 23, 34, 0.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: var(--text-primary);
          border: 1px solid rgba(255, 255, 255, 0.12);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          z-index: 200;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45), 0 0 12px rgba(56, 189, 248, 0.15);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-glass-fab:hover {
          background: rgba(28, 34, 51, 0.95);
          border-color: rgba(56, 189, 248, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5), 0 0 18px rgba(56, 189, 248, 0.25);
        }

        .chat-glass-fab-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px);
        }

        .fab-icon-box {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fab-text-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fab-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .fab-keychip {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-xs);
          padding: 1px 6px;
          font-size: 0.65rem;
          color: var(--text-secondary);
        }

        .fab-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--status-safe);
          box-shadow: 0 0 8px var(--status-safe);
          animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }

        /* ── 2. Glass Backdrop ── */
        .chat-glass-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(8, 10, 15, 0.65);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          z-index: 290;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ── 3. Slide-Out Panel ── */
        .chat-glass-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 460px;
          max-width: 100vw;
          height: 100vh;
          background: rgba(14, 17, 26, 0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          z-index: 300;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-glass-panel-open {
          transform: translateX(0);
        }

        /* ── Panel Header ── */
        .chat-glass-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(19, 23, 34, 0.6);
          flex-shrink: 0;
        }

        .header-branding {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bot-avatar-frame {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-online-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--status-safe);
          border: 2px solid var(--bg-card);
        }

        .header-titles {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .copilot-name {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .copilot-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 6px;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.25);
          color: var(--accent-cyan);
          border-radius: var(--radius-xs);
          letter-spacing: 0.5px;
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .meta-sep {
          opacity: 0.4;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chat-icon-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          cursor: pointer;
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }

        .chat-icon-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .chat-close-btn:hover {
          border-color: rgba(248, 113, 113, 0.3);
          color: var(--status-critical);
        }

        /* ── Messages Stream ── */
        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-group {
          display: flex;
          gap: 10px;
          max-width: 90%;
        }

        .group-bot {
          align-self: flex-start;
        }

        .group-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message-sender-avatar {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-xs);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .message-content-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .group-user .message-content-wrap {
          align-items: flex-end;
        }

        .message-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.82rem;
          line-height: 1.55;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
        }

        .bubble-bot-glass {
          background: rgba(28, 34, 51, 0.65);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          border-top-left-radius: var(--radius-xs);
        }

        .bubble-user-glass {
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: var(--text-primary);
          border-top-right-radius: var(--radius-xs);
        }

        .user-plain-text {
          font-weight: 400;
        }

        .message-timestamp {
          font-size: 0.64rem;
          padding: 0 4px;
        }

        /* ── Typing Animation ── */
        .typing-bubble {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
        }

        .wave-container {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .wave-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-cyan);
          box-shadow: 0 0 6px var(--accent-cyan);
          animation: wave-pulse 1.3s infinite ease-in-out;
        }

        @keyframes wave-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.15); opacity: 1; }
        }

        /* ── Markdown Bot Formatting ── */
        .bot-md {
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .md-bold {
          color: var(--accent-cyan);
          font-weight: 600;
        }

        .md-h {
          color: var(--text-primary);
          font-weight: 600;
          margin: 10px 0 6px 0;
          line-height: 1.3;
        }

        .md-h1 { font-size: 0.95rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 4px; }
        .md-h2 { font-size: 0.88rem; }
        .md-h3 { font-size: 0.82rem; }

        .md-p {
          margin: 6px 0;
          line-height: 1.55;
        }
        .md-p:first-child { margin-top: 0; }
        .md-p:last-child { margin-bottom: 0; }

        .md-ul {
          margin: 6px 0;
          padding-left: 18px;
          list-style: disc;
        }

        .md-ol {
          margin: 6px 0;
          padding-left: 18px;
          list-style: decimal;
        }

        .md-li {
          margin: 3px 0;
          line-height: 1.5;
        }

        .md-code-inline {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: var(--radius-xs);
          padding: 1px 5px;
          font-size: 0.74rem;
          color: var(--accent-cyan);
        }

        .md-code-block-wrap {
          margin: 8px 0;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: rgba(11, 13, 20, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .md-code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .code-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.65rem;
          cursor: pointer;
          padding: 2px 4px;
        }

        .code-copy-btn:hover {
          color: var(--text-primary);
        }

        .md-pre-custom {
          padding: 10px 12px;
          margin: 0;
          overflow-x: auto;
          font-size: 0.75rem;
          line-height: 1.45;
          color: var(--text-primary);
        }

        .md-link {
          color: var(--accent-cyan);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .md-hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin: 10px 0;
        }

        /* ── Quick Chips ── */
        .chat-quick-section {
          padding: 12px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(14, 17, 26, 0.5);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quick-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.4px;
        }

        .quick-chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .quick-chip-glass {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xs);
          padding: 4px 8px;
          color: var(--text-secondary);
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.14s ease;
          white-space: nowrap;
        }

        .quick-chip-glass:hover:not(:disabled) {
          background: rgba(56, 189, 248, 0.1);
          border-color: rgba(56, 189, 248, 0.3);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .quick-chip-glass:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ── Input Row ── */
        .chat-input-container {
          padding: 14px 20px 18px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(19, 23, 34, 0.7);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-glass-wrapper {
          display: flex;
          align-items: center;
          background: rgba(11, 13, 20, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-sm);
          padding: 4px 6px 4px 12px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .input-glass-wrapper:focus-within {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
        }

        .chat-glass-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.82rem;
          outline: none;
          padding: 6px 0;
        }

        .chat-glass-input::placeholder {
          color: var(--text-tertiary);
        }

        .chat-glass-send-btn {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-xs);
          background: var(--accent-cyan);
          border: none;
          color: #0b0d14;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.14s ease;
          flex-shrink: 0;
        }

        .chat-glass-send-btn:hover:not(:disabled) {
          background: #7dd3fc;
          transform: scale(1.04);
        }

        .chat-glass-send-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
        }

        .input-shortcut-hint {
          display: flex;
          justify-content: center;
          font-size: 0.62rem;
          opacity: 0.7;
        }

        @media (max-width: 480px) {
          .chat-glass-panel {
            width: 100vw;
          }
        }
      `}</style>
    </>
  )
}
