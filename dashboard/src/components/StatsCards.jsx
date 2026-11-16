/**
 * NetShield AI — Instrument-Grade Metric Telemetry Cards.
 *
 * Four precision metric panels displaying packet count, detected threats,
 * current threat level, and machine learning model precision.
 *
 * @module components/StatsCards
 */

import { useEffect, useRef, useState } from 'react'
import { Activity, ShieldAlert, Radio, Cpu } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { THREAT_COLORS, MODEL_ACCURACY } from '../utils/constants.js'
import { formatNumber } from '../utils/format.js'

function useCountUp(target) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = prevRef.current
    const end = target
    if (start === end) return

    const duration = 400
    const startTime = performance.now()

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = end
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return display
}

function StatCard({ icon, label, value, valueColor, sublabel }) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-card-inner">
        <div className="stat-card-top">
          <span className="stat-icon">{icon}</span>
          <span className="stat-label">{label}</span>
        </div>
        <div className="stat-value mono" style={{ color: valueColor || 'var(--text-primary)' }}>
          {value}
        </div>
        {sublabel && <div className="stat-sublabel text-muted">{sublabel}</div>}
      </div>
    </div>
  )
}

export default function StatsCards() {
  const { totalPackets, attackCount, threatLevel } = useDashboard()

  const animatedTotal = useCountUp(totalPackets)
  const animatedAttacks = useCountUp(attackCount)

  const threatColor = THREAT_COLORS[threatLevel] || THREAT_COLORS.SAFE

  return (
    <>
      <div className="stats-row">
        <StatCard
          icon={<Activity size={15} />}
          label="Total Packets"
          value={formatNumber(animatedTotal)}
          sublabel="Real-time analysed flows"
        />
        <StatCard
          icon={<ShieldAlert size={15} />}
          label="Threats Detected"
          value={formatNumber(animatedAttacks)}
          valueColor={attackCount > 0 ? 'var(--accent-crimson)' : 'var(--text-primary)'}
          sublabel={attackCount > 0 ? `${attackCount} attack events flagged` : 'Zero malicious flows'}
        />
        <StatCard
          icon={<Radio size={15} />}
          label="Threat Status"
          value={threatLevel}
          valueColor={threatColor}
          sublabel="Rolling 60-second window"
        />
        <StatCard
          icon={<Cpu size={15} />}
          label="Model Accuracy"
          value={MODEL_ACCURACY}
          valueColor="var(--accent-cyan)"
          sublabel="XGBoost multiclass v3"
        />
      </div>

      <style>{`
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-card {
          border-radius: var(--radius-md);
        }

        .stat-card-inner {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-icon {
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
        }

        .stat-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .stat-sublabel {
          font-size: 0.72rem;
          color: var(--text-tertiary);
        }

        @media (max-width: 1024px) {
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
          .stat-value {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </>
  )
}
