/**
 * NetShield AI — Precision Threat Level Instrument Gauge.
 *
 * Calibrated system threat indicator displaying current status tier,
 * incident frequency, and inspection diagnostics.
 *
 * @module components/ThreatIndicator
 */

import { Shield, ShieldAlert, ShieldX } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { THREAT_COLORS, THREAT_BG_COLORS } from '../utils/constants.js'

export default function ThreatIndicator() {
  const { threatLevel, attackCount } = useDashboard()
  const color = THREAT_COLORS[threatLevel] || THREAT_COLORS.SAFE
  const bg = THREAT_BG_COLORS[threatLevel] || THREAT_BG_COLORS.SAFE

  const Icon =
    threatLevel === 'SAFE' ? Shield :
    threatLevel === 'ELEVATED' ? ShieldAlert :
    ShieldX

  const description =
    threatLevel === 'SAFE' ? 'Zero malicious flows detected in last 60s' :
    threatLevel === 'ELEVATED' ? `${attackCount} attack flow(s) flagged in last 60s` :
    `High alert: ${attackCount}+ attack events detected`

  // Status meter segments: Safe (0), Elevated (1), Critical (2)
  const tierIndex = threatLevel === 'CRITICAL' ? 2 : threatLevel === 'ELEVATED' ? 1 : 0

  return (
    <div className="glass-card threat-card">
      <div className="threat-header">
        <div className="threat-title-wrap">
          <Shield size={15} className="text-muted" />
          <span className="threat-title">Threat Status</span>
        </div>
        <span className="threat-window mono text-faint">60s Window</span>
      </div>

      <div className="threat-body">
        {/* Calibrated Gauge Dial */}
        <div className="threat-dial" style={{ borderColor: `${color}44`, background: bg }}>
          <div className="threat-dial-inner">
            <Icon size={32} style={{ color }} />
            <span className="threat-dial-text mono" style={{ color }}>{threatLevel}</span>
          </div>
        </div>

        {/* Segmented Status Bar */}
        <div className="threat-segments">
          <div className={`segment ${tierIndex >= 0 ? 'seg-active' : ''}`} style={{ '--seg-color': 'var(--accent-green)' }}>
            <span>NORMAL</span>
          </div>
          <div className={`segment ${tierIndex >= 1 ? 'seg-active' : ''}`} style={{ '--seg-color': 'var(--accent-amber)' }}>
            <span>ELEVATED</span>
          </div>
          <div className={`segment ${tierIndex >= 2 ? 'seg-active' : ''}`} style={{ '--seg-color': 'var(--accent-crimson)' }}>
            <span>CRITICAL</span>
          </div>
        </div>

        <p className="threat-desc text-muted">{description}</p>
      </div>

      <style>{`
        .threat-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          min-height: 290px;
        }

        .threat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 12px;
        }

        .threat-title-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .threat-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .threat-window {
          font-size: 0.7rem;
        }

        .threat-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 10px 0 4px 0;
        }

        .threat-dial {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color var(--transition-fast), background var(--transition-fast);
        }

        .threat-dial-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .threat-dial-text {
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .threat-segments {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          width: 100%;
          max-width: 260px;
        }

        .segment {
          height: 22px;
          background: var(--bg-raised);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xs);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 500;
          color: var(--text-tertiary);
          transition: all var(--transition-fast);
        }

        .segment.seg-active {
          background: var(--seg-color);
          color: #0b0d14;
          border-color: var(--seg-color);
          font-weight: 700;
        }

        .threat-desc {
          font-size: 0.76rem;
          text-align: center;
          line-height: 1.4;
          max-width: 240px;
        }
      `}</style>
    </div>
  )
}
