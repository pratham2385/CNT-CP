/**
 * NetShield AI — Attack distribution pie chart component.
 *
 * Instrument-grade Glassmorphic Donut Chart featuring:
 * - Frosted backdrop blur & subtle gradient depth
 * - Active hover slice expansion & glowing accent halo
 * - Centered telemetry counter with animated status badge
 * - Systematic legend chips with interactive indicator pills
 * - Glassmorphic high-precision tooltip
 *
 * @module components/AttackPieChart
 */

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts'
import { PieChart as PieIcon, ShieldCheck } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { ATTACK_COLORS, FALLBACK_COLOR } from '../utils/constants.js'

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0].payload
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0

  return (
    <div className="chart-glass-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-swatch" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}80` }} />
        <span className="tooltip-title">{item.name}</span>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-metric">
          <span className="text-secondary">Incident Count:</span>
          <strong className="mono text-primary">{item.value.toLocaleString()}</strong>
        </div>
        <div className="tooltip-metric">
          <span className="text-secondary">Distribution Share:</span>
          <strong className="mono" style={{ color: item.color }}>{pct}%</strong>
        </div>
      </div>
    </div>
  )
}

// Active slice highlighting on hover
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 8px ${fill}60)` }}
      />
    </g>
  )
}

export default function AttackPieChart() {
  const { attackDistribution } = useDashboard()
  const [activeIndex, setActiveIndex] = useState(null)

  const data = (attackDistribution || []).map((item) => ({
    name: item.attack_type,
    value: item.count,
    color: ATTACK_COLORS[item.attack_type] || FALLBACK_COLOR,
  }))

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const onPieEnter = (_, index) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  return (
    <div className="glass-card pie-glass-card">
      {/* Top Header */}
      <div className="chart-header">
        <div className="chart-title-wrap">
          <div className="chart-icon-box">
            <PieIcon size={15} className="text-cyan" />
          </div>
          <div>
            <h3 className="chart-title">Attack Distribution</h3>
            <span className="chart-subtitle text-muted mono">Signature telemetry breakdown</span>
          </div>
        </div>
        <span className="glass-tag mono">
          {data.length} {data.length === 1 ? 'VECTOR' : 'VECTORS'}
        </span>
      </div>

      {/* Donut Chart Visualization */}
      <div className="pie-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.length > 0 ? data : [{ name: 'Safe', value: 1, color: 'rgba(255,255,255,0.06)' }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={data.length > 1 ? 3 : 0}
              activeIndex={activeIndex}
              activeShape={data.length > 0 ? renderActiveShape : null}
              onMouseEnter={data.length > 0 ? onPieEnter : null}
              onMouseLeave={data.length > 0 ? onPieLeave : null}
              isAnimationActive={true}
              stroke="transparent"
            >
              {(data.length > 0 ? data : [{ color: 'rgba(255,255,255,0.08)' }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            {data.length > 0 && <Tooltip content={<PieTooltip total={total} />} />}
          </PieChart>
        </ResponsiveContainer>

        {/* Center Telemetry Display */}
        <div className="pie-center">
          {total === 0 ? (
            <div className="pie-center-content">
              <ShieldCheck size={22} className="text-safe" style={{ margin: '0 auto 2px' }} />
              <span className="pie-center-value text-safe">SECURE</span>
              <span className="pie-center-sub text-muted mono">0 Attacks</span>
            </div>
          ) : (
            <div className="pie-center-content">
              <span className="pie-center-value text-critical mono">
                {total.toLocaleString()}
              </span>
              <span className="pie-center-sub text-muted mono">Hostile Events</span>
            </div>
          )}
        </div>
      </div>

      {/* Systematic Glassmorphic Legend */}
      <div className="pie-legend-grid">
        {data.length === 0 ? (
          <div className="empty-legend text-muted mono text-xs">
            No malicious threats detected in stream
          </div>
        ) : (
          data.map((item, i) => {
            const isHovered = activeIndex === i
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0
            return (
              <div
                key={i}
                className={`legend-pill ${isHovered ? 'legend-pill-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className="legend-glow-dot"
                  style={{
                    background: item.color,
                    boxShadow: isHovered ? `0 0 8px ${item.color}` : 'none',
                  }}
                />
                <span className="legend-label">{item.name}</span>
                <span className="legend-count mono font-semibold">{item.value}</span>
                <span className="legend-pct mono text-muted">({pct}%)</span>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .pie-glass-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          min-height: 440px;
          position: relative;
          overflow: hidden;
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .chart-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chart-icon-box {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chart-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .chart-subtitle {
          font-size: 0.7rem;
        }

        .glass-tag {
          font-size: 0.65rem;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-default);
          padding: 2px 7px;
          border-radius: var(--radius-xs);
          letter-spacing: 0.4px;
        }

        .pie-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 6px 0;
        }

        .pie-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }

        .pie-center-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .pie-center-value {
          font-size: 1.45rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .pie-center-sub {
          font-size: 0.66rem;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        /* Glass Legend Container */
        .pie-legend-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: auto;
          padding: 10px 12px;
          background: rgba(14, 17, 26, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: var(--radius-sm);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }

        .legend-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-xs);
          cursor: pointer;
          transition: all 0.14s ease;
        }

        .legend-pill:hover,
        .legend-pill-active {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .legend-glow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: box-shadow 0.15s ease;
        }

        .legend-label {
          color: var(--text-secondary);
        }

        .legend-count {
          color: var(--text-primary);
        }

        .legend-pct {
          font-size: 0.66rem;
        }

        .empty-legend {
          width: 100%;
          text-align: center;
          padding: 6px;
        }

        /* Glassmorphic Chart Tooltip */
        .chart-glass-tooltip {
          background: rgba(19, 23, 34, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: var(--radius-sm);
          padding: 9px 13px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
          min-width: 155px;
        }

        .tooltip-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 6px;
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .tooltip-swatch {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .tooltip-title {
          font-weight: 600;
          font-size: 0.8rem;
          color: var(--text-primary);
        }

        .tooltip-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 0.72rem;
        }

        .tooltip-metric {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
      `}</style>
    </div>
  )
}
