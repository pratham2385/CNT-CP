/**
 * NetShield AI — Security Incident Alert Banner.
 *
 * Fixed notification banner displayed when an attack flow is detected.
 * Auto-dismisses after 10 seconds or on manual click.
 *
 * @module components/AlertBanner
 */

import { useEffect, useState, useRef } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { formatConfidence, formatEndpoint } from '../utils/format.js'
import { ALERT_DISMISS_MS } from '../utils/constants.js'

export default function AlertBanner() {
  const { lastAttack } = useDashboard()
  const [queue, setQueue] = useState([])
  const [current, setCurrent] = useState(null)
  const seenRef = useRef(new Set())
  const timerRef = useRef(null)

  // Add new attacks to the queue
  useEffect(() => {
    if (!lastAttack || !lastAttack.is_attack) return
    const id = lastAttack.timestamp_utc + '_' + (lastAttack.context?.flow_id || '')
    if (seenRef.current.has(id)) return
    seenRef.current.add(id)
    if (seenRef.current.size > 200) {
      const arr = Array.from(seenRef.current)
      seenRef.current = new Set(arr.slice(-100))
    }
    setQueue(prev => [...prev, { ...lastAttack, _alertId: id }])
  }, [lastAttack])

  // Promote next from queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue(prev => prev.slice(1))
    }
  }, [current, queue])

  // Auto-dismiss
  useEffect(() => {
    if (!current) return
    timerRef.current = setTimeout(() => setCurrent(null), ALERT_DISMISS_MS)
    return () => clearTimeout(timerRef.current)
  }, [current])

  const dismiss = () => {
    clearTimeout(timerRef.current)
    setCurrent(null)
  }

  if (!current) return null

  const ctx = current.context || {}
  const src = formatEndpoint(ctx.src_ip, ctx.src_port)
  const dst = formatEndpoint(ctx.dst_ip, ctx.dst_port)

  return (
    <div className="incident-alert-banner" role="alert" onClick={dismiss}>
      <div className="alert-content">
        <ShieldAlert size={16} className="alert-symbol" />
        <span className="alert-type-badge mono">{current.label}</span>
        <span className="alert-message">
          Incident detected from <span className="mono alert-endpoint">{src}</span>
          <span className="alert-arrow"> → </span>
          <span className="mono alert-endpoint">{dst}</span>
          <span className="alert-separator">·</span>
          Confidence <span className="mono alert-conf">{formatConfidence(current.confidence)}</span>
        </span>
      </div>

      <div className="alert-actions">
        <span className="alert-hint">Dismiss</span>
        <button className="alert-close-btn" aria-label="Dismiss alert">
          <X size={14} />
        </button>
      </div>

      <style>{`
        .incident-alert-banner {
          position: fixed;
          top: calc(var(--header-height) + 12px);
          right: 24px;
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 14px;
          background: #191419;
          border: 1px solid rgba(248, 113, 113, 0.35);
          border-left: 3px solid var(--accent-crimson);
          border-radius: var(--radius-sm);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          color: var(--text-primary);
          cursor: pointer;
          max-width: 680px;
          animation: slide-in 180ms cubic-bezier(0.2, 0, 0, 1);
        }

        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
        }

        .alert-symbol {
          color: var(--accent-crimson);
          flex-shrink: 0;
        }

        .alert-type-badge {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--accent-crimson);
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.25);
          padding: 2px 6px;
          border-radius: var(--radius-xs);
        }

        .alert-message {
          color: var(--text-secondary);
        }

        .alert-endpoint {
          color: var(--text-primary);
        }

        .alert-arrow {
          color: var(--text-tertiary);
          margin: 0 2px;
        }

        .alert-separator {
          margin: 0 6px;
          color: var(--text-tertiary);
        }

        .alert-conf {
          color: var(--text-primary);
          font-weight: 500;
        }

        .alert-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alert-hint {
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .alert-close-btn {
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .alert-close-btn:hover {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}
