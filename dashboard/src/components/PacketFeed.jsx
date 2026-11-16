/**
 * NetShield AI — Live packet feed component.
 *
 * Live scrolling feed of recent packet predictions with animated badges,
 * glowing attack indicators, and smart scroll controls.
 *
 * @module components/PacketFeed
 */

import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { formatTime, formatDateTime, formatEndpoint, formatConfidence, protocolName } from '../utils/format.js'
import { ATTACK_COLORS } from '../utils/constants.js'

export default function PacketFeed() {
  const { packets } = useDashboard()
  const listRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0
      setPendingCount(0)
    } else {
      setPendingCount(prev => prev + 1)
    }
  }, [packets])

  const handleScroll = () => {
    if (!listRef.current) return
    const atTop = listRef.current.scrollTop === 0
    setAutoScroll(atTop)
    if (atTop) setPendingCount(0)
  }

  const resumeScroll = () => {
    setAutoScroll(true)
    if (listRef.current) listRef.current.scrollTop = 0
    setPendingCount(0)
  }

  return (
    <div className="card feed-card">
      <div className="feed-header">
        <div className="feed-title-wrap">
          <Radio size={15} className="text-muted" />
          <span className="chart-title">Live Packet Feed</span>
        </div>
        <span className="feed-count text-muted mono">{packets.length}</span>
      </div>

      <div ref={listRef} className="feed-list" onScroll={handleScroll}>
        {packets.length === 0 ? (
          <div className="feed-empty text-muted">Listening for live packet flows…</div>
        ) : (
          packets.map((pkt, i) => {
            const isAttack = pkt.is_attack
            const color = isAttack
              ? (ATTACK_COLORS[pkt.label] || 'var(--status-critical)')
              : 'var(--status-safe)'
            const ctx = pkt.context || {}
            return (
              <div
                key={`${pkt.timestamp_utc}-${i}`}
                className={`feed-item ${isAttack ? 'feed-item-attack' : ''}`}
              >
                <span className="feed-dot" style={{ background: color }} />
                <span className="feed-label mono" style={{ color, borderColor: `${color}35`, background: `${color}10` }}>
                  {pkt.label}
                </span>
                <span className="feed-ip mono">
                  {formatEndpoint(ctx.src_ip, ctx.src_port)}
                  <span className="arrow"> → </span>
                  {formatEndpoint(ctx.dst_ip, ctx.dst_port)}
                </span>
                <span className="feed-proto text-muted mono">{protocolName(ctx.protocol)}</span>
                <span className="feed-conf mono text-muted">
                  {formatConfidence(pkt.confidence)}
                </span>
                <span className="feed-time mono text-faint" title={formatDateTime(pkt.timestamp_utc)}>
                  {formatTime(pkt.timestamp_utc)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {pendingCount > 0 && (
        <div className="feed-new-packets" onClick={resumeScroll}>
          ↓ {pendingCount} new packet{pendingCount !== 1 ? 's' : ''}
        </div>
      )}

      <style>{`
        .feed-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          height: 425px;
        }
        .feed-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .feed-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chart-title {
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .feed-count {
          font-size: 0.7rem;
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          padding: 1px 7px;
          border-radius: var(--radius-sm);
        }
        .feed-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .feed-empty {
          text-align: center;
          padding: 60px 0;
          font-size: 0.82rem;
        }
        .feed-item {
          display: grid;
          grid-template-columns: 6px 82px 1fr 40px 55px 65px;
          align-items: center;
          gap: 8px;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.73rem;
          background: transparent;
          border-left: 2px solid transparent;
          transition: background-color var(--transition-fast);
        }
        .feed-item:hover {
          background: var(--bg-raised);
        }
        .feed-item-attack {
          background: rgba(248, 113, 113, 0.05);
          border-left: 2px solid var(--status-critical);
        }
        .feed-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .feed-label {
          font-weight: 600;
          font-size: 0.65rem;
          text-align: center;
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .feed-ip {
          font-size: 0.72rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-primary);
        }
        .arrow {
          color: var(--text-muted);
        }
        .feed-proto {
          font-size: 0.68rem;
          text-align: center;
        }
        .feed-conf {
          font-size: 0.68rem;
          text-align: right;
        }
        .feed-time {
          font-size: 0.68rem;
          text-align: right;
          white-space: nowrap;
        }
        .feed-new-packets {
          text-align: center;
          padding: 5px;
          background: var(--bg-raised);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.72rem;
          font-family: var(--font-mono);
          font-weight: 500;
          cursor: pointer;
          margin-top: 6px;
          transition: background-color var(--transition-fast);
        }
        .feed-new-packets:hover {
          background: var(--bg-card);
        }
        @media (max-width: 768px) {
          .feed-item {
            grid-template-columns: 6px 70px 1fr 50px;
          }
          .feed-proto, .feed-conf { display: none; }
        }
      `}</style>
    </div>
  )
}
