/**
 * NetShield AI — Security Analytics Workspace Page.
 *
 * Dedicated analytics workspace featuring real-time Attack Distribution,
 * Top Attacker IPs, Category Breakdown Metrics, and Historical Telemetry.
 *
 * @module pages/Analytics
 */

import { useEffect, useState, useMemo } from 'react'
import {
  PieChart as PieIcon,
  ShieldAlert,
  BarChart3,
  Globe,
  RefreshCw,
  AlertTriangle,
  Activity,
  Layers,
  Radio,
} from 'lucide-react'
import AttackPieChart from '../components/AttackPieChart.jsx'
import AttackHistory from '../components/AttackHistory.jsx'
import { useDashboard } from '../context/DashboardContext.jsx'
import { ATTACK_COLORS, FALLBACK_COLOR, THREAT_COLORS, THREAT_BG_COLORS } from '../utils/constants.js'
import { formatNumber } from '../utils/format.js'

export default function Analytics() {
  const {
    attackDistribution,
    attackCount,
    topAttackers,
    totalPackets,
    threatLevel,
    lastAttack,
    refreshStats,
    socketConnected,
  } = useDashboard()

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Immediately refresh on mount & on lastAttack update
  useEffect(() => {
    refreshStats()
    const id = setInterval(refreshStats, 5000)
    return () => clearInterval(id)
  }, [refreshStats, lastAttack])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await refreshStats()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  // Calculate dominant attack vector
  const dominantVector = useMemo(() => {
    if (!attackDistribution || attackDistribution.length === 0) return null
    return [...attackDistribution].sort((a, b) => b.count - a.count)[0]
  }, [attackDistribution])

  const threatColor = THREAT_COLORS[threatLevel] || THREAT_COLORS.SAFE
  const threatBg = THREAT_BG_COLORS[threatLevel] || THREAT_BG_COLORS.SAFE
  const attackRatio = totalPackets > 0 ? ((attackCount / totalPackets) * 100).toFixed(1) : '0.0'
  const maxAttackerCount = (topAttackers || []).reduce((max, a) => Math.max(max, a.count), 1)

  return (
    <div className="analytics-page flex-col gap-lg">
      {/* Workspace Header */}
      <div className="analytics-header glass-card">
        <div className="header-text-group">
          <div className="header-badge-row">
            <span className="live-pill">
              <span className={`live-dot ${socketConnected ? 'pulse-cyan' : 'offline-dot'}`} />
              {socketConnected ? 'Live Telemetry Active' : 'Connecting Engine…'}
            </span>
            <span
              className="threat-pill mono"
              style={{ color: threatColor, background: threatBg, borderColor: `${threatColor}40` }}
            >
              THREAT LEVEL: {threatLevel}
            </span>
          </div>
          <h1 className="analytics-title">Attack Analytics & Threat Intelligence</h1>
          <p className="analytics-subtitle text-muted">
            Vector distribution, malicious IP geolocation telemetry, and real-time attack event analytics.
          </p>
        </div>

        <button
          className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleManualRefresh}
          title="Force refresh statistics"
        >
          <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="stats-row">
        <div className="glass-card stat-card">
          <div className="stat-accent-bar" style={{ background: 'linear-gradient(90deg, #ff2a5f, transparent)' }} />
          <div className="stat-card-inner">
            <div className="stat-card-top">
              <div className="stat-icon-wrap" style={{ color: 'var(--accent-crimson)', background: 'rgba(255,42,95,0.12)', borderColor: 'rgba(255,42,95,0.3)' }}>
                <ShieldAlert size={20} />
              </div>
              <span className="stat-label">Total Attacks</span>
            </div>
            <div className="stat-value mono text-crimson">{formatNumber(attackCount)}</div>
            <div className="stat-sublabel text-muted">{attackRatio}% of all network traffic</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-accent-bar" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
          <div className="stat-card-inner">
            <div className="stat-card-top">
              <div className="stat-icon-wrap" style={{ color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' }}>
                <AlertTriangle size={20} />
              </div>
              <span className="stat-label">Dominant Vector</span>
            </div>
            <div className="stat-value mono" style={{ color: dominantVector ? (ATTACK_COLORS[dominantVector.attack_type] || 'var(--accent-amber)') : 'var(--text-secondary)', fontSize: '1.65rem' }}>
              {dominantVector ? dominantVector.attack_type : 'None (Safe)'}
            </div>
            <div className="stat-sublabel text-muted">
              {dominantVector && attackCount > 0
                ? `${dominantVector.count} events (${((dominantVector.count / attackCount) * 100).toFixed(1)}%)`
                : 'No malicious flows detected'}
            </div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-accent-bar" style={{ background: 'linear-gradient(90deg, #00f0ff, transparent)' }} />
          <div className="stat-card-inner">
            <div className="stat-card-top">
              <div className="stat-icon-wrap" style={{ color: 'var(--accent-cyan)', background: 'rgba(0,240,255,0.12)', borderColor: 'rgba(0,240,255,0.3)' }}>
                <Globe size={20} />
              </div>
              <span className="stat-label">Unique Attackers</span>
            </div>
            <div className="stat-value mono text-cyan">{(topAttackers || []).length}</div>
            <div className="stat-sublabel text-muted">Distinct source IPs identified</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-accent-bar" style={{ background: `linear-gradient(90deg, ${threatColor}, transparent)` }} />
          <div className="stat-card-inner">
            <div className="stat-card-top">
              <div className="stat-icon-wrap" style={{ color: threatColor, background: threatBg, borderColor: `${threatColor}40` }}>
                <Activity size={20} />
              </div>
              <span className="stat-label">System Threat</span>
            </div>
            <div className="stat-value mono" style={{ color: threatColor }}>{threatLevel}</div>
            <div className="stat-sublabel text-muted">Rolling 60-second window</div>
          </div>
        </div>
      </div>

      {/* Row 1: Distribution Donut + Attack Vector Breakdown */}
      <div className="dashboard-grid">
        <div className="grid-col-1">
          <AttackPieChart />
        </div>

        <div className="grid-col-span-2">
          <div className="glass-card analytics-summary-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <BarChart3 size={18} className="text-cyan" />
                <span className="chart-title">Attack Vector Breakdown</span>
              </div>
              <span className="chart-subtitle text-muted mono">
                Total Malicious Events: <strong className="text-crimson">{attackCount}</strong>
              </span>
            </div>

            <div className="type-breakdown-list">
              {(attackDistribution || []).length === 0 ? (
                <div className="empty-analytics text-muted">
                  <ShieldAlert size={36} className="empty-icon text-green" />
                  <p>All network traffic is currently benign. No attacks logged in this session.</p>
                  <span className="text-faint text-xs">Simulate an attack via CLI or live capture to see breakdown.</span>
                </div>
              ) : (
                attackDistribution.map((item, idx) => {
                  const color = ATTACK_COLORS[item.attack_type] || FALLBACK_COLOR
                  const pct = attackCount > 0 ? ((item.count / attackCount) * 100).toFixed(1) : 0
                  return (
                    <div key={idx} className="type-bar-row">
                      <div className="type-row-header">
                        <div className="type-badge-name">
                          <span className="type-color-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                          <span className="type-name" style={{ color }}>{item.attack_type}</span>
                        </div>
                        <span className="type-count mono">
                          <strong>{item.count}</strong> attacks <span className="text-muted">({pct}%)</span>
                        </span>
                      </div>
                      <div className="type-bar-bg">
                        <div
                          className="type-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${color}aa, ${color})`,
                            boxShadow: `0 0 12px ${color}80`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Top Attacker IPs & Attack Vectors Matrix */}
      <div className="dashboard-grid">
        <div className="grid-col-span-2">
          <div className="glass-card top-attackers-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <Globe size={18} className="text-amber" />
                <span className="chart-title">Top Malicious Attacker IPs</span>
              </div>
              <span className="chart-subtitle text-muted mono">
                Ranked by incident frequency
              </span>
            </div>

            <div className="attackers-table-wrap">
              {(topAttackers || []).length === 0 ? (
                <div className="empty-analytics text-muted py-6">
                  <p>No external attack sources registered yet.</p>
                </div>
              ) : (
                <table className="attackers-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Rank</th>
                      <th>Attacker Source IP</th>
                      <th style={{ width: '130px' }}>Attack Count</th>
                      <th style={{ width: '40%' }}>Volume Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAttackers.map((attacker, idx) => {
                      const pctOfMax = ((attacker.count / maxAttackerCount) * 100).toFixed(1)
                      return (
                        <tr key={attacker.src_ip || idx}>
                          <td className="mono text-faint">#{idx + 1}</td>
                          <td>
                            <div className="ip-cell">
                              <span className="mono attacker-ip-text">{attacker.src_ip}</span>
                              <span className="ip-badge-flag">MALICIOUS</span>
                            </div>
                          </td>
                          <td className="mono font-semibold text-crimson">
                            {attacker.count} flows
                          </td>
                          <td>
                            <div className="impact-bar-bg">
                              <div
                                className="impact-bar-fill"
                                style={{ width: `${pctOfMax}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="grid-col-1">
          <div className="glass-card intel-summary-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <Layers size={18} className="text-green" />
                <span className="chart-title">Detection Matrix</span>
              </div>
              <span className="chart-subtitle text-muted">AI Model v3</span>
            </div>

            <div className="matrix-list">
              {[
                { name: 'DDoS (SYN Flood)', severity: 'CRITICAL', color: '#ef4444' },
                { name: 'DoS (High Volume)', severity: 'HIGH', color: '#f97316' },
                { name: 'PortScan (SYN Sweep)', severity: 'MEDIUM', color: '#f59e0b' },
                { name: 'BruteForce (SSH/Auth)', severity: 'HIGH', color: '#eab308' },
                { name: 'Botnet Infiltration', severity: 'HIGH', color: '#a855f7' },
                { name: 'Web Exploit / Injection', severity: 'CRITICAL', color: '#ec4899' },
              ].map((m, idx) => (
                <div key={idx} className="matrix-item">
                  <div className="matrix-item-left">
                    <span className="matrix-dot" style={{ background: m.color }} />
                    <span className="matrix-name">{m.name}</span>
                  </div>
                  <span
                    className="matrix-badge mono"
                    style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}15` }}
                  >
                    {m.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Full Filterable Attack Logs with Local Real-Time Timestamps */}
      <AttackHistory showFilters />

      <style>{`
        .analytics-page {
          max-width: 1600px;
          margin: 0 auto;
        }

        .analytics-header {
          padding: 22px 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          border-left: 3px solid var(--accent-cyan);
        }

        .header-badge-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.08);
          border: 1px solid rgba(0, 240, 255, 0.25);
          padding: 3px 9px;
          border-radius: 999px;
        }

        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .pulse-cyan {
          background: var(--accent-cyan);
          box-shadow: 0 0 8px var(--accent-cyan);
          animation: pulse-ring 1.8s infinite;
        }

        .threat-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px solid;
          letter-spacing: 0.5px;
        }

        .analytics-title {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .analytics-subtitle {
          font-size: 0.85rem;
          margin-top: 4px;
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 240, 255, 0.1);
          color: var(--accent-cyan);
          border: 1px solid rgba(0, 240, 255, 0.3);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .refresh-btn:hover {
          background: rgba(0, 240, 255, 0.2);
          border-color: var(--accent-cyan);
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
        }

        .spin-icon {
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .analytics-summary-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .type-breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 14px;
        }

        .type-bar-row {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .type-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
          font-weight: 600;
        }

        .type-badge-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .type-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .type-bar-bg {
          height: 9px;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 5px;
          overflow: hidden;
        }

        .type-bar-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .empty-analytics {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 36px 20px;
          gap: 10px;
        }

        .empty-icon {
          opacity: 0.8;
          margin-bottom: 4px;
        }

        .top-attackers-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .attackers-table-wrap {
          overflow-x: auto;
          margin-top: 12px;
        }

        .attackers-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }

        .attackers-table th {
          text-align: left;
          padding: 10px 12px;
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .attackers-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .ip-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .attacker-ip-text {
          font-size: 0.86rem;
          color: var(--text-primary);
        }

        .ip-badge-flag {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--accent-crimson);
          background: rgba(255, 42, 95, 0.12);
          border: 1px solid rgba(255, 42, 95, 0.3);
          border-radius: 4px;
          padding: 2px 5px;
          letter-spacing: 0.5px;
        }

        .impact-bar-bg {
          height: 7px;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 4px;
          overflow: hidden;
          width: 100%;
          max-width: 220px;
        }

        .impact-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff2a5f, #f59e0b);
          border-radius: 4px;
        }

        .intel-summary-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .matrix-list {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 14px;
        }

        .matrix-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
        }

        .matrix-item-left {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .matrix-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .matrix-name {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .matrix-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.4px;
        }

        @media (max-width: 900px) {
          .analytics-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
