/**
 * NetShield AI — System info panel component.
 *
 * Shows capture interface, model version, uptime, and backend connection.
 *
 * @module components/SystemInfo
 */

import { Cpu, Wifi, Clock, ShieldCheck, Terminal } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'

export default function SystemInfo() {
  const {
    captureActive,
    captureInterface,
    modelVersion,
    uptimeSeconds,
    socketConnected,
  } = useDashboard()

  const uptimeStr = formatUptime(uptimeSeconds)

  return (
    <div className="card system-info-card">
      <div className="chart-header">
        <div className="chart-title-wrap">
          <Terminal size={15} className="text-muted" />
          <span className="chart-title">System Status & Environment</span>
        </div>
      </div>
      <div className="info-grid">
        <InfoRow
          icon={<Wifi size={14} />}
          label="Socket connection"
          value={socketConnected ? 'Live socket' : 'Disconnected'}
          color={socketConnected ? 'var(--status-safe)' : 'var(--status-critical)'}
        />
        <InfoRow
          icon={<ShieldCheck size={14} />}
          label="Capture interface"
          value={captureActive ? `Active (${captureInterface || 'Wi-Fi'})` : 'Inactive'}
          color={captureActive ? 'var(--status-safe)' : 'var(--text-muted)'}
        />
        <InfoRow
          icon={<Cpu size={14} />}
          label="ML engine model"
          value={modelVersion || 'xgboost_cicids2017_v3.pkl'}
          color="var(--accent-blue)"
        />
        <InfoRow
          icon={<Clock size={14} />}
          label="Engine uptime"
          value={uptimeStr}
        />
      </div>

      <style>{`
        .system-info-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chart-title-wrap {
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
        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .info-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 500px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function InfoRow({ icon, label, value, color }) {
  return (
    <div className="info-item">
      <div className="info-top">
        <span className="info-icon" style={{ color: color || 'var(--text-muted)' }}>{icon}</span>
        <span className="info-label text-muted">{label}</span>
      </div>
      <span className="info-value mono" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
      <style>{`
        .info-item {
          background: var(--bg-dark);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .info-top {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .info-icon {
          display: flex;
          align-items: center;
        }
        .info-label {
          font-size: 0.72rem;
          font-weight: 500;
        }
        .info-value {
          font-size: 0.78rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
