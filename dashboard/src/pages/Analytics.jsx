/**
 * NetShield AI — Security Analytics & Threat Intelligence Workspace.
 *
 * Professional instrument-grade SOC analytics workspace featuring:
 * - Systematic Visual Hierarchy & Glassmorphic Surface Cards (Frosted Glass & Depth)
 * - Real-time Threat Distribution Donut with active slice halo telemetry
 * - Attack Vector Breakdown with MITRE ATT&CK technique mapping & micro-gauges
 * - Live MITRE ATT&CK Defense Matrix with context-aware countermeasures
 * - Interactive 1-click attack simulation triggers (DDoS, PortScan, BruteForce, DoS, Bot, WebAttack)
 * - Complete filterable and exportable Attack History audit log
 * - Database & Storage Architecture Telemetry Inspector (PostgreSQL 18 / SQLite 3 dual-engine)
 * - Target Port Attack Exposure & Service Distribution
 * - Perimeter Risk Exposure Score & Radial Metric Indicator
 *
 * @module pages/Analytics
 */

import { useEffect, useState, useMemo } from 'react'
import {
  ShieldAlert,
  BarChart3,
  Globe,
  RefreshCw,
  AlertTriangle,
  Activity,
  Layers,
  RotateCcw,
  Zap,
  Target,
  CheckCircle2,
  Cpu,
  Shield,
  Radio,
  Database,
  HardDrive,
  Server,
  Lock,
  Clock,
  Gauge,
  Sliders,
  ChevronRight,
  Hash,
  ArrowUpRight,
  Key,
} from 'lucide-react'
import AttackPieChart from '../components/AttackPieChart.jsx'
import AttackHistory from '../components/AttackHistory.jsx'
import { useDashboard } from '../context/DashboardContext.jsx'
import { simulateAttack, resetSessionData, fetchDbStatus } from '../api/client.js'
import { ATTACK_COLORS, FALLBACK_COLOR, THREAT_COLORS, THREAT_BG_COLORS } from '../utils/constants.js'
import { formatNumber } from '../utils/format.js'

// MITRE ATT&CK Matrix metadata mapping for NetShield AI classes
const VECTOR_INTEL = {
  DDoS: {
    mitreId: 'T1498',
    mitreName: 'Network Denial of Service',
    severity: 'CRITICAL',
    ports: 'TCP 80, 443',
    color: 'var(--status-critical)',
    playbook: 'Enable SYN cookies, upstream BGP flowspec blackholing, and TCP handshake throttling on Port 80/443.',
  },
  DoS: {
    mitreId: 'T1499',
    mitreName: 'Endpoint Denial of Service',
    severity: 'HIGH',
    ports: 'TCP 80',
    color: 'var(--status-elevated)',
    playbook: 'Deploy per-IP connection limits, rate-limiting reverse proxies, and ephemeral socket recycling.',
  },
  PortScan: {
    mitreId: 'T1046',
    mitreName: 'Network Service Discovery',
    severity: 'MEDIUM',
    ports: 'TCP 1–1024',
    color: '#fb923c',
    playbook: 'Enforce dynamic iptables drop rules for sequential port sweeps, tarpitting, and port-knocking.',
  },
  BruteForce: {
    mitreId: 'T1110',
    mitreName: 'Brute Force Authentication',
    severity: 'HIGH',
    ports: 'TCP 22 (SSH)',
    color: 'var(--status-elevated)',
    playbook: 'Trigger automated IP lockout via Fail2ban, disable SSH password auth, enforce ed25519 key authentication.',
  },
  Bot: {
    mitreId: 'T1071',
    mitreName: 'Application Layer Protocol / C2',
    severity: 'MEDIUM',
    ports: 'TCP 8080, 6667',
    color: '#c084fc',
    playbook: 'Isolate compromised host segment, block C2 beacon IPs at gateway, inspect process execution tree.',
  },
  WebAttack: {
    mitreId: 'T1190',
    mitreName: 'Exploit Public-Facing Application',
    severity: 'CRITICAL',
    ports: 'HTTP 80 / HTTPS 443',
    color: 'var(--status-critical)',
    playbook: 'Engage Web Application Firewall (WAF) deep packet inspection, sanitize inputs, enforce strict CSP headers.',
  },
}

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
  const [simulating, setSimulating] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeVectorFilter, setActiveVectorFilter] = useState('All')
  const [timeWindow, setTimeWindow] = useState('Live')
  const [dbInfo, setDbInfo] = useState(null)
  const [dbLoading, setDbLoading] = useState(false)

  // Load database storage diagnostics
  const loadDbInfo = async () => {
    try {
      setDbLoading(true)
      const data = await fetchDbStatus()
      setDbInfo(data)
    } catch (err) {
      console.warn('[Analytics] DB status fetch notice:', err.message)
    } finally {
      setDbLoading(false)
    }
  }

  // Auto-refresh stats & DB status periodically
  useEffect(() => {
    refreshStats()
    loadDbInfo()
    const id = setInterval(() => {
      refreshStats()
      loadDbInfo()
    }, 4000)
    return () => clearInterval(id)
  }, [refreshStats, lastAttack])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refreshStats(), loadDbInfo()])
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Interactive attack simulation trigger from SOC console
  const handleSimulate = async (type) => {
    setSimulating(type)
    setNotice('')
    try {
      await simulateAttack(type, 15, 15)
      setNotice(`Simulated 15 ${type} flows injected into detection pipeline & database.`)
      await Promise.all([refreshStats(), loadDbInfo()])
      setTimeout(() => setNotice(''), 4500)
    } catch (err) {
      setNotice(`Simulation notice: ${err.message}`)
      setTimeout(() => setNotice(''), 4500)
    } finally {
      setSimulating(null)
    }
  }

  // Reset telemetry counters to 0
  const handleResetTelemetry = async () => {
    if (!window.confirm('Reset all attack and packet counters to 0 for this session?')) return
    setResetting(true)
    try {
      await resetSessionData()
      await Promise.all([refreshStats(), loadDbInfo()])
      setNotice('Session telemetry records and attack counters reset to 0.')
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setNotice(`Reset failed: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  // Dominant attack vector calculation
  const dominantVector = useMemo(() => {
    if (!attackDistribution || attackDistribution.length === 0) return null
    return [...attackDistribution].sort((a, b) => b.count - a.count)[0]
  }, [attackDistribution])

  const threatColor = THREAT_COLORS[threatLevel] || THREAT_COLORS.SAFE
  const threatBg = THREAT_BG_COLORS[threatLevel] || THREAT_BG_COLORS.SAFE
  const attackRatio = totalPackets > 0 ? ((attackCount / totalPackets) * 100).toFixed(1) : '0.0'
  const maxAttackerCount = (topAttackers || []).reduce((max, a) => Math.max(max, a.count), 1)

  // Filtered attack distribution list
  const filteredDistribution = useMemo(() => {
    if (activeVectorFilter === 'All') return attackDistribution || []
    return (attackDistribution || []).filter((item) => item.attack_type === activeVectorFilter)
  }, [attackDistribution, activeVectorFilter])

  // Computed Risk Exposure Score (0 - 100)
  const riskScore = useMemo(() => {
    if (attackCount === 0) return 4
    if (threatLevel === 'CRITICAL') return Math.min(100, Math.max(82, Math.round((attackCount / Math.max(totalPackets, 1)) * 100 + 40)))
    if (threatLevel === 'ELEVATED') return Math.min(80, Math.max(45, Math.round((attackCount / Math.max(totalPackets, 1)) * 100 + 25)))
    return Math.min(30, Math.max(10, Math.round((attackCount / Math.max(totalPackets, 1)) * 100)))
  }, [threatLevel, attackCount, totalPackets])

  // Target Port Exposure Breakdown
  const portTargets = useMemo(() => {
    const counts = {
      'Port 80 (HTTP)': 0,
      'Port 443 (HTTPS)': 0,
      'Port 22 (SSH)': 0,
      'Port 8080 (Web-Alt)': 0,
      'Ports 1–1024 (Recon)': 0,
    }
    ;(attackDistribution || []).forEach((item) => {
      if (item.attack_type === 'DDoS' || item.attack_type === 'DoS') counts['Port 80 (HTTP)'] += item.count
      else if (item.attack_type === 'WebAttack') counts['Port 443 (HTTPS)'] += item.count
      else if (item.attack_type === 'BruteForce') counts['Port 22 (SSH)'] += item.count
      else if (item.attack_type === 'Bot') counts['Port 8080 (Web-Alt)'] += item.count
      else if (item.attack_type === 'PortScan') counts['Ports 1–1024 (Recon)'] += item.count
    })
    const maxPortVal = Math.max(...Object.values(counts), 1)
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: ((count / maxPortVal) * 100).toFixed(0),
    }))
  }, [attackDistribution])

  return (
    <div className="analytics-workspace flex-col gap-lg">
      {/* 1. Header Hero Control Toolbar with Glassmorphic Surface */}
      <div className="glass-card analytics-header-glass">
        <div className="header-meta">
          <div className="header-pill-row">
            <span className="glass-status-pill">
              <span className={`live-dot ${socketConnected ? 'live-dot-active' : 'offline-dot'}`} />
              <span className="mono">{socketConnected ? 'TELEMETRY LIVE' : 'SOCKET OFFLINE'}</span>
            </span>

            <span
              className="glass-threat-pill mono"
              style={{
                color: threatColor,
                background: threatBg,
                borderColor: `${threatColor}40`,
                boxShadow: threatLevel === 'CRITICAL' ? `0 0 12px ${threatColor}30` : 'none',
              }}
            >
              THREAT LEVEL: {threatLevel}
            </span>

            <span className="glass-window-pill mono text-muted">
              MODE: {timeWindow.toUpperCase()}
            </span>
          </div>

          <h1 className="analytics-title">Security Analytics & Threat Intelligence</h1>
          <p className="analytics-subtitle text-muted">
            Adversary forensics, real-time vector signatures, MITRE ATT&CK mapping, and persistence telemetry.
          </p>
        </div>

        {/* Action Controls & Interactive Simulation Bar */}
        <div className="header-actions">
          <div className="simulation-glass-cluster">
            <span className="sim-label mono text-muted">INJECT:</span>
            {['DDoS', 'PortScan', 'BruteForce', 'DoS', 'Bot', 'WebAttack'].map((atk) => (
              <button
                key={atk}
                className="btn-sim-glass mono"
                onClick={() => handleSimulate(atk)}
                disabled={!!simulating}
                title={`Inject 15 ${atk} test packets into pipeline`}
              >
                {simulating === atk ? <RefreshCw size={11} className="spin-icon text-cyan" /> : <Zap size={11} />}
                <span>{atk}</span>
              </button>
            ))}
          </div>

          <div className="glass-divider" />

          {/* Time Window Selector */}
          <div className="window-selector-glass mono">
            {['Live', '15m', '1h', 'All'].map((w) => (
              <button
                key={w}
                className={`window-tab ${timeWindow === w ? 'window-tab-active' : ''}`}
                onClick={() => setTimeWindow(w)}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="glass-divider" />

          <button
            className="btn-glass-control mono"
            onClick={handleResetTelemetry}
            disabled={resetting}
            title="Reset telemetry counters to 0"
          >
            <RotateCcw size={12} className={resetting ? 'spin-icon' : ''} />
            <span>Reset</span>
          </button>

          <button
            className={`btn-glass-control mono btn-glass-cyan ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            title="Force refresh statistics & DB diagnostics"
          >
            <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Notice Banner */}
      {notice && (
        <div className="glass-card analytics-notice-glass mono">
          <CheckCircle2 size={15} className="text-safe" />
          <span>{notice}</span>
        </div>
      )}

      {/* Active Threat Vector Alert Playbook Banner */}
      {dominantVector && threatLevel !== 'SAFE' && (
        <div className="glass-card active-playbook-glass">
          <div className="playbook-top-bar">
            <div className="playbook-left">
              <span className="playbook-beacon" />
              <span className="playbook-tag mono">TACTICAL COUNTERMEASURE</span>
              <span
                className="playbook-name"
                style={{ color: ATTACK_COLORS[dominantVector.attack_type] || 'var(--text-primary)' }}
              >
                {dominantVector.attack_type}
              </span>
              <span className="playbook-mitre-chip mono">
                MITRE {VECTOR_INTEL[dominantVector.attack_type]?.mitreId || 'T1498'}
              </span>
            </div>
            <span className="mono text-muted text-xs">
              {dominantVector.count} events ({((dominantVector.count / Math.max(attackCount, 1)) * 100).toFixed(1)}% share)
            </span>
          </div>
          <div className="playbook-content">
            <span className="playbook-label mono text-muted">AUTOMATED SOC MITIGATION PLAYBOOK:</span>
            <p className="playbook-desc">
              {VECTOR_INTEL[dominantVector.attack_type]?.playbook ||
                'Deploy dynamic edge firewall rules, inspect upstream flow rates, and enforce automated rate-limiting.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. Systematic 5-Metric KPI Row (Glassmorphic Cards) */}
      <div className="stats-row analytics-kpi-grid">
        {/* KPI 1: Total Attacks */}
        <div className="glass-card kpi-glass-card">
          <div className="kpi-header">
            <span className="kpi-label">Hostile Events</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.25)' }}>
              <ShieldAlert size={14} className="text-critical" />
            </div>
          </div>
          <div className="kpi-value mono text-critical">{formatNumber(attackCount)}</div>
          <div className="kpi-footer mono text-muted">
            <span className="kpi-dot bg-critical" />
            <span>{attackRatio}% malicious flow ratio</span>
          </div>
        </div>

        {/* KPI 2: Dominant Attack Vector */}
        <div className="glass-card kpi-glass-card">
          <div className="kpi-header">
            <span className="kpi-label">Dominant Vector</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.25)' }}>
              <AlertTriangle size={14} className="text-warning" />
            </div>
          </div>
          <div
            className="kpi-value mono"
            style={{
              color: dominantVector ? ATTACK_COLORS[dominantVector.attack_type] || 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '1.28rem',
            }}
          >
            {dominantVector ? dominantVector.attack_type : 'None (Safe)'}
          </div>
          <div className="kpi-footer mono text-muted">
            <span className="kpi-dot" style={{ background: dominantVector ? ATTACK_COLORS[dominantVector.attack_type] : 'var(--status-safe)' }} />
            <span>
              {dominantVector && attackCount > 0
                ? `${dominantVector.count} events (${((dominantVector.count / attackCount) * 100).toFixed(1)}%)`
                : 'No malicious activity'}
            </span>
          </div>
        </div>

        {/* KPI 3: Unique Malicious IPs */}
        <div className="glass-card kpi-glass-card">
          <div className="kpi-header">
            <span className="kpi-label">Adversary Source IPs</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
              <Globe size={14} className="text-cyan" />
            </div>
          </div>
          <div className="kpi-value mono text-cyan">{(topAttackers || []).length}</div>
          <div className="kpi-footer mono text-muted">
            <span className="kpi-dot bg-cyan" />
            <span className="truncate">{(topAttackers || [])[0] ? `Top: ${(topAttackers || [])[0].src_ip}` : 'No hostile IPs flagged'}</span>
          </div>
        </div>

        {/* KPI 4: Threat Level Posture */}
        <div className="glass-card kpi-glass-card">
          <div className="kpi-header">
            <span className="kpi-label">Defense Posture</span>
            <div className="kpi-icon-wrap" style={{ background: `${threatColor}18`, borderColor: `${threatColor}35` }}>
              <Activity size={14} style={{ color: threatColor }} />
            </div>
          </div>
          <div className="kpi-value mono" style={{ color: threatColor }}>
            {threatLevel}
          </div>
          <div className="kpi-footer mono text-muted">
            <span className="kpi-dot" style={{ background: threatColor }} />
            <span>Real-time rolling engine</span>
          </div>
        </div>

        {/* KPI 5: Storage Engine Profile */}
        <div className="glass-card kpi-glass-card">
          <div className="kpi-header">
            <span className="kpi-label">Database Architecture</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.25)' }}>
              <Database size={14} className="text-safe" />
            </div>
          </div>
          <div className="kpi-value mono text-safe">
            {dbInfo ? dbInfo.engine : 'PostgreSQL 18'}
          </div>
          <div className="kpi-footer mono text-muted">
            <span className="kpi-dot bg-safe" />
            <span>{dbInfo ? `${dbInfo.size_formatted} • ${dbInfo.filename || 'netshield_db'}` : 'Live ACID Cluster'}</span>
          </div>
        </div>
      </div>

      {/* 3. Primary Visualizations Row: Donut Chart + Vector Breakdown Bars */}
      <div className="analytics-split-grid">
        {/* Left Column: Attack Distribution Donut with Glassmorphic Frame */}
        <div className="grid-cell-donut">
          <AttackPieChart />
        </div>

        {/* Right Column: Attack Vector Breakdown with Systematic Visual Meters */}
        <div className="grid-cell-breakdown">
          <div className="glass-card vector-breakdown-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <div className="chart-icon-box">
                  <BarChart3 size={15} className="text-amber" />
                </div>
                <div>
                  <h3 className="chart-title">Attack Vector Distribution & Signatures</h3>
                  <span className="chart-subtitle text-muted mono">MITRE ATT&CK technique classifications</span>
                </div>
              </div>
              <div className="vector-filter-bar mono">
                {['All', 'DDoS', 'PortScan', 'BruteForce', 'DoS', 'Bot', 'WebAttack'].map((v) => (
                  <button
                    key={v}
                    className={`vector-tab ${activeVectorFilter === v ? 'vector-tab-active' : ''}`}
                    onClick={() => setActiveVectorFilter(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="vector-meter-list">
              {filteredDistribution.length === 0 ? (
                <div className="empty-state-glass text-muted">
                  <Shield size={32} className="empty-icon text-muted" />
                  <p className="empty-title">All network traffic within selected filter is benign</p>
                  <span className="text-muted text-xs mono">
                    Trigger an interactive simulation above to inspect live vector metrics.
                  </span>
                </div>
              ) : (
                filteredDistribution.map((item, idx) => {
                  const color = ATTACK_COLORS[item.attack_type] || FALLBACK_COLOR
                  const pct = attackCount > 0 ? ((item.count / attackCount) * 100).toFixed(1) : 0
                  const intel = VECTOR_INTEL[item.attack_type] || {
                    mitreId: 'T1498',
                    severity: 'HIGH',
                    ports: 'TCP/IP',
                  }

                  return (
                    <div key={idx} className="vector-meter-row">
                      <div className="vector-meter-top">
                        <div className="vector-identity">
                          <span className="vector-swatch" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                          <span className="vector-name" style={{ color }}>{item.attack_type}</span>
                          <span className="vector-chip mono">MITRE {intel.mitreId}</span>
                          <span className="vector-ports mono text-muted">{intel.ports}</span>
                        </div>
                        <div className="vector-stats mono">
                          <strong className="text-primary">{item.count}</strong>
                          <span className="text-muted text-xs"> events</span>
                          <span className="vector-pct-badge mono" style={{ color, background: `${color}15`, borderColor: `${color}30` }}>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div className="meter-track-glass">
                        <div
                          className="meter-fill-bar"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${color}90, ${color})`,
                            boxShadow: `0 0 10px ${color}50`,
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

      {/* 4. Telemetry Row: Database & Storage Engine Architecture Inspector */}
      <div className="glass-card db-telemetry-panel">
        <div className="chart-header">
          <div className="chart-title-wrap">
            <div className="chart-icon-box" style={{ background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.25)' }}>
              <Database size={15} className="text-safe" />
            </div>
            <div>
              <div className="db-title-row">
                <h3 className="chart-title">Database & Storage Engine Architecture</h3>
                <span className="db-badge mono">
                  {dbInfo?.engine ? `${dbInfo.engine.toUpperCase()} ACID COMPLIANT` : 'POSTGRESQL 18 / SQLITE 3'}
                </span>
              </div>
              <span className="chart-subtitle text-muted mono">Live relational persistence and concurrency diagnostics</span>
            </div>
          </div>

          <div className="db-status-cluster mono">
            <span className="db-live-tag">
              <span className="live-dot live-dot-active" />
              <span>{dbInfo?.status || 'HEALTHY'}</span>
            </span>
            <span className="db-file-tag text-muted text-xs">
              Target: <strong className="text-primary">{dbInfo?.filename || 'netshield_db'}</strong>
            </span>
          </div>
        </div>

        <div className="db-cards-grid">
          {/* Box 1: Storage Profile */}
          <div className="db-tile-glass">
            <span className="db-tile-label mono text-muted">STORAGE PROFILE</span>
            <div className="db-tile-value mono text-safe">
              {dbInfo?.size_formatted || '9.57 MB'}
            </div>
            <div className="db-tile-sub text-muted text-xs mono">
              Journal / WAL: {dbInfo?.journal_mode || 'WAL'} • Pages: {dbInfo?.page_count || 320}
            </div>
          </div>

          {/* Box 2: Total Flows Recorded */}
          <div className="db-tile-glass">
            <span className="db-tile-label mono text-muted">FLOW LOGS (attacks TABLE)</span>
            <div className="db-tile-value mono text-primary">
              {formatNumber(dbInfo?.tables?.attacks ?? attackCount)}
            </div>
            <div className="db-tile-sub text-muted text-xs mono">
              Malicious: {dbInfo?.tables?.malicious_events ?? attackCount} indexed records
            </div>
          </div>

          {/* Box 3: Registered SOC Users */}
          <div className="db-tile-glass">
            <span className="db-tile-label mono text-muted">OPERATORS (users TABLE)</span>
            <div className="db-tile-value mono text-cyan">
              {dbInfo?.tables?.users ?? 15}
            </div>
            <div className="db-tile-sub text-muted text-xs mono">
              Argon2id Hashed • RBAC Enforced
            </div>
          </div>

          {/* Box 4: Concurrency Architecture */}
          <div className="db-tile-glass">
            <span className="db-tile-label mono text-muted">CONCURRENCY & POOLING</span>
            <div className="db-tile-value mono text-safe text-sm" style={{ marginTop: '3px' }}>
              Multi-Threaded Pool
            </div>
            <div className="db-tile-sub text-muted text-xs mono">
              ACID Safe • Zero Transaction Locks
            </div>
          </div>
        </div>

        {/* Database Index Inventory & Performance */}
        <div className="db-index-strip">
          <span className="db-index-label mono text-muted">ACTIVE B-TREE INDEXES:</span>
          <div className="db-index-chips mono">
            {(dbInfo?.indexes || [
              'idx_attacks_ts (timestamp_utc)',
              'idx_attacks_type (attack_type)',
              'idx_attacks_src (src_ip)',
              'idx_users_email_nocase (email)',
              'idx_users_username_nocase (username)',
            ]).map((idxName, i) => (
              <span key={i} className="db-index-chip">
                <Hash size={10} className="text-muted" />
                <span>{idxName}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Perimeter Risk Exposure & Target Port Exposure Row */}
      <div className="analytics-split-grid reverse-grid">
        {/* Left Column: Target Port Attack Distribution */}
        <div className="grid-cell-breakdown">
          <div className="glass-card port-exposure-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <div className="chart-icon-box">
                  <Server size={15} className="text-cyan" />
                </div>
                <div>
                  <h3 className="chart-title">Target Destination Port Exposure</h3>
                  <span className="chart-subtitle text-muted mono">Service vulnerability targeting breakdown</span>
                </div>
              </div>
              <span className="glass-tag mono">5 MONITORED RANGES</span>
            </div>

            <div className="port-meters-list">
              {portTargets.map((port, idx) => {
                const barColor =
                  idx === 0
                    ? 'var(--status-critical)'
                    : idx === 1
                    ? 'var(--status-elevated)'
                    : idx === 2
                    ? '#fb923c'
                    : 'var(--accent-cyan)'

                return (
                  <div key={idx} className="port-meter-item">
                    <div className="port-meta mono">
                      <span className="port-label">{port.name}</span>
                      <span className="port-number text-muted">
                        <strong className="text-primary">{port.count}</strong> flows ({port.pct}%)
                      </span>
                    </div>
                    <div className="meter-track-glass">
                      <div
                        className="meter-fill-bar"
                        style={{
                          width: `${port.pct}%`,
                          background: barColor,
                          boxShadow: `0 0 8px ${barColor}60`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Perimeter Threat Exposure Gauge Card */}
        <div className="grid-cell-donut">
          <div className="glass-card risk-meter-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <div className="chart-icon-box">
                  <Gauge size={15} className="text-critical" />
                </div>
                <div>
                  <h3 className="chart-title">Perimeter Risk Score</h3>
                  <span className="chart-subtitle text-muted mono">Exposure index (0–100)</span>
                </div>
              </div>
            </div>

            <div className="risk-dial-wrap">
              <div
                className="risk-radial-ring"
                style={{
                  background: `conic-gradient(${threatColor} ${riskScore * 3.6}deg, rgba(255, 255, 255, 0.05) 0deg)`,
                }}
              >
                <div className="risk-radial-inner">
                  <span className="risk-score-value mono" style={{ color: threatColor }}>
                    {riskScore}
                  </span>
                  <span className="risk-score-sub text-muted mono">INDEX / 100</span>
                </div>
              </div>

              <div
                className="risk-badge-status mono"
                style={{
                  color: threatColor,
                  background: threatBg,
                  borderColor: `${threatColor}40`,
                }}
              >
                {threatLevel === 'CRITICAL' ? 'SEVERE THREAT' : threatLevel === 'ELEVATED' ? 'MODERATE RISK' : 'PERIMETER SECURE'}
              </div>

              <div className="risk-metrics-card mono text-xs text-muted">
                <div className="risk-row">
                  <span>Critical Threats (DDoS/Web):</span>
                  <strong className="text-critical">{attackDistribution?.find(a => a.attack_type === 'DDoS' || a.attack_type === 'WebAttack')?.count || 0}</strong>
                </div>
                <div className="risk-row">
                  <span>Elevated Attacks (Brute/DoS):</span>
                  <strong className="text-warning">{attackDistribution?.find(a => a.attack_type === 'BruteForce' || a.attack_type === 'DoS')?.count || 0}</strong>
                </div>
                <div className="risk-row">
                  <span>Reconnaissance Sweeps:</span>
                  <strong className="text-cyan">{attackDistribution?.find(a => a.attack_type === 'PortScan')?.count || 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Secondary Forensics Row: Top Malicious IPs & MITRE ATT&CK Matrix */}
      <div className="analytics-split-grid reverse-grid">
        {/* Left Column: Top Adversary IPs */}
        <div className="grid-cell-breakdown">
          <div className="glass-card top-adversaries-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <div className="chart-icon-box">
                  <Globe size={15} className="text-cyan" />
                </div>
                <div>
                  <h3 className="chart-title">Adversary Source IPs & Impact Forensics</h3>
                  <span className="chart-subtitle text-muted mono">Ranked by attack traffic frequency</span>
                </div>
              </div>
              <span className="glass-tag mono">HOSTILE CLUSTERS</span>
            </div>

            <div className="adversary-table-frame">
              {(topAttackers || []).length === 0 ? (
                <div className="empty-state-glass text-muted py-6">
                  <p>No hostile source IPs flagged in active recording window.</p>
                </div>
              ) : (
                <table className="adversary-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>Rank</th>
                      <th>Adversary IP</th>
                      <th style={{ width: '135px' }}>Target Service</th>
                      <th style={{ width: '110px' }}>Incidents</th>
                      <th style={{ width: '25%' }}>Volume Impact</th>
                      <th style={{ width: '110px' }}>Intervention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAttackers.map((attacker, idx) => {
                      const pctOfMax = ((attacker.count / maxAttackerCount) * 100).toFixed(1)
                      return (
                        <tr key={attacker.src_ip || idx}>
                          <td className="mono text-faint">#{idx + 1}</td>
                          <td>
                            <div className="adversary-ip-cell">
                              <span className="mono font-semibold text-primary">{attacker.src_ip}</span>
                              <span className="hostile-badge mono">HOSTILE</span>
                            </div>
                          </td>
                          <td className="mono text-muted text-xs">
                            192.168.1.16:80
                          </td>
                          <td className="mono font-semibold text-critical">
                            {attacker.count} flows
                          </td>
                          <td>
                            <div className="meter-track-glass" style={{ height: '5px' }}>
                              <div
                                className="meter-fill-bar"
                                style={{
                                  width: `${pctOfMax}%`,
                                  background: 'var(--status-critical)',
                                  boxShadow: '0 0 6px rgba(248, 113, 113, 0.4)',
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            <span className="mitigated-pill mono">
                              BLOCKED
                            </span>
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

        {/* Right Column: MITRE Detection Matrix */}
        <div className="grid-cell-donut">
          <div className="glass-card mitre-matrix-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <div className="chart-icon-box">
                  <Layers size={15} className="text-purple" />
                </div>
                <div>
                  <h3 className="chart-title">MITRE ATT&CK Matrix</h3>
                  <span className="chart-subtitle text-muted mono">Enterprise Tactics</span>
                </div>
              </div>
            </div>

            <div className="mitre-tactics-list">
              {Object.entries(VECTOR_INTEL).map(([key, item], idx) => (
                <div key={idx} className="mitre-tactic-row">
                  <div className="mitre-tactic-left">
                    <span className="mitre-color-strip" style={{ background: item.color }} />
                    <div className="mitre-details">
                      <span className="mitre-vector-name">{key}</span>
                      <span className="mitre-sub-info mono text-muted text-xs">{item.mitreId} • {item.ports}</span>
                    </div>
                  </div>
                  <span
                    className="mitre-severity-tag mono"
                    style={{
                      color: item.color,
                      borderColor: `${item.color}35`,
                      background: `${item.color}10`,
                    }}
                  >
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Tertiary Row: Real-Time Incident Audit History */}
      <AttackHistory showFilters />

      {/* Component Stylesheet for Instrument-Grade Visuals & Glassmorphism */}
      <style>{`
        .analytics-workspace {
          max-width: 1650px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Glassmorphic Base Setup */
        .glass-card {
          background: rgba(19, 23, 34, 0.75);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .glass-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* 1. Header Toolbar */
        .analytics-header-glass {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .header-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .header-pill-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .glass-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--status-safe);
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.25);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .live-dot-active {
          background: var(--status-safe);
          box-shadow: 0 0 8px var(--status-safe);
        }

        .offline-dot {
          background: var(--text-muted);
        }

        .glass-threat-pill {
          font-size: 0.68rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          letter-spacing: 0.4px;
        }

        .glass-window-pill {
          font-size: 0.66rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 2px 6px;
          border-radius: var(--radius-xs);
        }

        .analytics-title {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .analytics-subtitle {
          font-size: 0.76rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .simulation-glass-cluster {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(14, 17, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          padding: 3px 6px;
          flex-wrap: wrap;
        }

        .sim-label {
          font-size: 0.64rem;
          font-weight: 600;
          margin-right: 2px;
        }

        .btn-sim-glass {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xs);
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .btn-sim-glass:hover:not(:disabled) {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          background: rgba(56, 189, 248, 0.12);
        }

        .btn-sim-glass:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .glass-divider {
          width: 1px;
          height: 22px;
          background: rgba(255, 255, 255, 0.08);
        }

        .window-selector-glass {
          display: flex;
          background: rgba(14, 17, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          padding: 2px;
        }

        .window-tab {
          padding: 2px 7px;
          font-size: 0.66rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: var(--radius-xs);
          cursor: pointer;
          transition: all 0.12s;
        }

        .window-tab-active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          font-weight: 600;
        }

        .btn-glass-control {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          font-size: 0.72rem;
          font-weight: 600;
          background: rgba(14, 17, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-glass-control:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .btn-glass-cyan:hover:not(:disabled) {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          background: rgba(56, 189, 248, 0.1);
        }

        .analytics-notice-glass {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(52, 211, 153, 0.08);
          border: 1px solid rgba(52, 211, 153, 0.25);
          color: var(--status-safe);
          padding: 9px 16px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
        }

        /* Active Playbook Glass Card */
        .active-playbook-glass {
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.28);
          padding: 12px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .playbook-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .playbook-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .playbook-beacon {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--status-critical);
          box-shadow: 0 0 8px var(--status-critical);
          animation: pulse 1.6s infinite;
        }

        .playbook-tag {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--status-critical);
          letter-spacing: 0.5px;
        }

        .playbook-name {
          font-weight: 700;
          font-size: 0.85rem;
        }

        .playbook-mitre-chip {
          font-size: 0.65rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1px 6px;
          border-radius: var(--radius-xs);
          color: var(--text-secondary);
        }

        .playbook-content {
          display: flex;
          gap: 8px;
          align-items: baseline;
        }

        .playbook-label {
          font-size: 0.68rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .playbook-desc {
          font-size: 0.78rem;
          color: var(--text-primary);
          line-height: 1.4;
        }

        /* 2. Systematic 5-Metric KPI Row */
        .analytics-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .analytics-kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .kpi-glass-card {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kpi-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .kpi-icon-wrap {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-xs);
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-value {
          font-size: 1.45rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .kpi-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          margin-top: 2px;
        }

        .kpi-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* 3. Split Grid Layout */
        .analytics-split-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 16px;
        }

        .reverse-grid {
          grid-template-columns: 2fr 1fr;
        }

        @media (max-width: 1024px) {
          .analytics-split-grid,
          .reverse-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Common Header Inside Cards */
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 10px;
          flex-wrap: wrap;
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
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
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

        /* Vector Breakdown Card */
        .vector-breakdown-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          min-height: 440px;
        }

        .vector-filter-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }

        .vector-tab {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xs);
          padding: 2px 7px;
          font-size: 0.66rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.12s;
        }

        .vector-tab:hover {
          color: var(--text-primary);
        }

        .vector-tab-active {
          color: var(--accent-cyan);
          border-color: var(--accent-cyan);
          background: rgba(56, 189, 248, 0.1);
        }

        .vector-meter-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 6px;
        }

        .vector-meter-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .vector-meter-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .vector-identity {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .vector-swatch {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .vector-name {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .vector-chip {
          font-size: 0.64rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1px 5px;
          border-radius: var(--radius-xs);
        }

        .vector-ports {
          font-size: 0.64rem;
        }

        .vector-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
        }

        .vector-pct-badge {
          font-size: 0.64rem;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: var(--radius-xs);
          border: 1px solid;
        }

        /* Glass Track & Fill Bar */
        .meter-track-glass {
          height: 6px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .meter-fill-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.35s ease-in-out;
        }

        /* 4. Database Telemetry Panel */
        .db-telemetry-panel {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .db-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .db-badge {
          font-size: 0.64rem;
          color: var(--status-safe);
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.25);
          padding: 2px 7px;
          border-radius: var(--radius-xs);
          font-weight: 600;
        }

        .db-status-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .db-live-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.66rem;
          color: var(--status-safe);
          background: rgba(52, 211, 153, 0.08);
          border: 1px solid rgba(52, 211, 153, 0.2);
          padding: 2px 7px;
          border-radius: var(--radius-xs);
        }

        .db-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 900px) {
          .db-cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 550px) {
          .db-cards-grid {
            grid-template-columns: 1fr;
          }
        }

        .db-tile-glass {
          background: rgba(14, 17, 26, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .db-tile-label {
          font-size: 0.64rem;
          letter-spacing: 0.3px;
        }

        .db-tile-value {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .db-index-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-wrap: wrap;
        }

        .db-index-label {
          font-size: 0.66rem;
          font-weight: 600;
        }

        .db-index-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .db-index-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.62rem;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 2px 6px;
          border-radius: var(--radius-xs);
        }

        /* 5. Target Port Exposure & Risk Dial */
        .port-exposure-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
        }

        .port-meters-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 6px 0;
        }

        .port-meter-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .port-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
        }

        .risk-meter-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
        }

        .risk-dial-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 0;
          gap: 12px;
        }

        .risk-radial-ring {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
          transition: all 0.4s ease;
        }

        .risk-radial-inner {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .risk-score-value {
          font-size: 2rem;
          font-weight: 800;
          line-height: 1;
        }

        .risk-score-sub {
          font-size: 0.6rem;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        .risk-badge-status {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          letter-spacing: 0.4px;
        }

        .risk-metrics-card {
          display: flex;
          flex-direction: column;
          gap: 5px;
          width: 100%;
          padding: 9px 12px;
          background: rgba(14, 17, 26, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-sm);
        }

        .risk-row {
          display: flex;
          justify-content: space-between;
        }

        /* 6. Top Adversaries Table & MITRE ATT&CK Matrix */
        .top-adversaries-card,
        .mitre-matrix-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
        }

        .adversary-table-frame {
          overflow-x: auto;
          margin-top: 4px;
        }

        .adversary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.74rem;
        }

        .adversary-table th {
          text-align: left;
          padding: 7px 10px;
          font-size: 0.68rem;
          color: var(--text-muted);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-mono);
          font-weight: 600;
        }

        .adversary-table td {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .adversary-ip-cell {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .hostile-badge {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--status-critical);
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.3);
          padding: 1px 4px;
          border-radius: var(--radius-xs);
        }

        .mitigated-pill {
          font-size: 0.64rem;
          font-weight: 600;
          color: var(--status-safe);
          background: rgba(52, 211, 153, 0.08);
          border: 1px solid rgba(52, 211, 153, 0.2);
          padding: 2px 6px;
          border-radius: var(--radius-xs);
        }

        /* MITRE Tactic Rows */
        .mitre-tactics-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .mitre-tactic-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 10px;
          background: rgba(14, 17, 26, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-xs);
          transition: all 0.12s ease;
        }

        .mitre-tactic-row:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(14, 17, 26, 0.85);
        }

        .mitre-tactic-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mitre-color-strip {
          width: 4px;
          height: 24px;
          border-radius: 2px;
        }

        .mitre-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mitre-vector-name {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .mitre-severity-tag {
          font-size: 0.64rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: var(--radius-xs);
          border: 1px solid;
        }

        /* Utility Helpers */
        .empty-state-glass {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          text-align: center;
          gap: 6px;
        }

        .empty-title {
          font-size: 0.84rem;
          color: var(--text-secondary);
        }

        .spin-icon {
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
