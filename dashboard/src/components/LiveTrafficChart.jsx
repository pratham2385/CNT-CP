/**
 * NetShield AI — Live traffic telemetry chart.
 *
 * Real-time area chart showing packets per second, split into normal (cyan)
 * and attack (crimson) stacked areas over a rolling 60-second window.
 *
 * Provides both Relative (-60s → Now) and Local Clock (HH:mm:ss) timeline views.
 *
 * @module components/LiveTrafficChart
 */

import { useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Activity, Clock, Gauge } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { MAX_CHART_POINTS } from '../utils/constants.js'

function formatClockTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function TrafficTooltip({ active, payload, timeMode }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  const clockStr = formatClockTime(data.time)
  const relStr = data.secondsAgo === 0 ? 'Now' : `${Math.abs(data.secondsAgo)}s ago`

  return (
    <div className="chart-tooltip-glass">
      <div className="tooltip-time mono">
        <strong>{clockStr}</strong> <span className="text-muted">({relStr})</span>
      </div>
      <div className="tooltip-row text-cyan">
        <span className="tooltip-dot" style={{ background: 'var(--accent-cyan)' }} />
        Normal: <strong className="mono">{data.normal || 0}</strong> pkts/s
      </div>
      <div className="tooltip-row text-crimson">
        <span className="tooltip-dot" style={{ background: 'var(--accent-crimson)' }} />
        Attack: <strong className="mono">{data.attack || 0}</strong> pkts/s
      </div>
    </div>
  )
}

export default function LiveTrafficChart() {
  const { lastPacket } = useDashboard()
  const [timeMode, setTimeMode] = useState('relative') // 'relative' | 'clock'

  const [chartData, setChartData] = useState(() => {
    const now = Math.floor(Date.now() / 1000)
    return Array.from({ length: MAX_CHART_POINTS }, (_, i) => ({
      time: now - (MAX_CHART_POINTS - 1 - i),
      secondsAgo: -(MAX_CHART_POINTS - 1 - i),
      normal: 0,
      attack: 0,
    }))
  })
  const bufferRef = useRef({ normal: 0, attack: 0 })

  useEffect(() => {
    if (!lastPacket) return
    if (lastPacket.is_attack) {
      bufferRef.current.attack += 1
    } else {
      bufferRef.current.normal += 1
    }
  }, [lastPacket])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      setChartData(prev => {
        const next = [
          ...prev.slice(1),
          {
            time: now,
            secondsAgo: 0,
            normal: bufferRef.current.normal,
            attack: bufferRef.current.attack,
          },
        ]
        // Re-index secondsAgo so left-most is -59 and right-most is 0
        for (let i = 0; i < next.length; i++) {
          next[i].secondsAgo = -(next.length - 1 - i)
        }
        bufferRef.current = { normal: 0, attack: 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="glass-card chart-card">
      <div className="chart-header">
        <div className="chart-title-wrap">
          <Activity size={18} className="text-cyan" />
          <span className="chart-title">Live Traffic Telemetry</span>
          <span className="live-pill">
            <span className="live-dot" /> LIVE
          </span>
        </div>

        <div className="chart-controls">
          <span className="chart-subtitle text-muted desktop-only">Packets / sec (60s rolling)</span>
          <div className="timeline-toggle-group">
            <button
              type="button"
              className={`timeline-toggle-btn ${timeMode === 'relative' ? 'active' : ''}`}
              onClick={() => setTimeMode('relative')}
              title="Show relative seconds (-60s to Now)"
            >
              <Gauge size={12} /> -60s..Now
            </button>
            <button
              type="button"
              className={`timeline-toggle-btn ${timeMode === 'clock' ? 'active' : ''}`}
              onClick={() => setTimeMode('clock')}
              title="Show local clock time (HH:mm:ss)"
            >
              <Clock size={12} /> Clock
            </button>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={245}>
        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="attackGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff2a5f" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#ff2a5f" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.08)" />

          {timeMode === 'relative' ? (
            <XAxis
              dataKey="secondsAgo"
              ticks={[-60, -50, -40, -30, -20, -10, 0]}
              tickFormatter={(val) => (val === 0 ? 'Now' : `${val}s`)}
              stroke="#64748b"
              fontSize={11}
            />
          ) : (
            <XAxis
              dataKey="time"
              tickFormatter={formatClockTime}
              stroke="#64748b"
              fontSize={11}
              interval="preserveStartEnd"
              tickCount={6}
            />
          )}

          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
          <Tooltip content={<TrafficTooltip timeMode={timeMode} />} />
          <Area
            type="monotone"
            dataKey="normal"
            stroke="#00f0ff"
            strokeWidth={2}
            fill="url(#normalGrad)"
            name="Normal"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="attack"
            stroke="#ff2a5f"
            strokeWidth={2}
            fill="url(#attackGrad)"
            name="Attack"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <style>{`
        .chart-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .chart-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chart-title {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          border: 1px solid rgba(34, 197, 94, 0.3);
          letter-spacing: 0.5px;
        }
        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse-live 1.5s infinite;
        }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .chart-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chart-subtitle {
          font-size: 0.75rem;
        }
        .timeline-toggle-group {
          display: flex;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 2px;
          gap: 2px;
        }
        .timeline-toggle-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .timeline-toggle-btn:hover {
          color: var(--text-primary);
        }
        .timeline-toggle-btn.active {
          background: rgba(56, 189, 248, 0.15);
          color: var(--accent-cyan);
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .chart-tooltip-glass {
          background: rgba(10, 16, 32, 0.94);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          font-size: 0.78rem;
        }
        .tooltip-time {
          color: var(--text-primary);
          margin-bottom: 5px;
          font-size: 0.74rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 4px;
        }
        .tooltip-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 3px;
        }
        .tooltip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        @media (max-width: 640px) {
          .desktop-only {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
