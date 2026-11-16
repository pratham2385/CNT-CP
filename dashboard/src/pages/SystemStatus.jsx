/**
 * NetShield AI — System Status Workspace Page.
 *
 * Full system health, machine learning model details, and network capture interface diagnostic.
 *
 * @module pages/SystemStatus
 */

import SystemInfo from '../components/SystemInfo.jsx'
import { Cpu, ShieldCheck, Terminal, HardDrive, Database, Server } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { MODEL_ACCURACY } from '../utils/constants.js'

export default function SystemStatus() {
  const { captureActive, captureInterface, modelVersion, socketConnected, totalPackets } = useDashboard()

  return (
    <div className="status-page flex-col gap-lg">
      <SystemInfo />

      <div className="dashboard-grid" style={{ marginTop: '16px' }}>
        <div className="card status-detail-card">
          <div className="chart-header">
            <Cpu size={16} className="text-muted" />
            <span className="chart-title">Machine Learning Model</span>
          </div>
          <div className="status-kv-list">
            <div className="kv-item">
              <span className="text-muted">Model classifier</span>
              <span className="mono">XGBoost Multiclass v3</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Training dataset</span>
              <span className="mono">CICIDS2017 Benchmark</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Test accuracy score</span>
              <span className="mono text-safe">{MODEL_ACCURACY}</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Input features</span>
              <span className="mono">40 Standardized Flow Metrics</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Model binary file</span>
              <span className="mono text-faint">{modelVersion || 'xgboost_cicids2017_v3.pkl'}</span>
            </div>
          </div>
        </div>

        <div className="card status-detail-card">
          <div className="chart-header">
            <ShieldCheck size={16} className="text-muted" />
            <span className="chart-title">Live Sniffer & Traffic Filter</span>
          </div>
          <div className="status-kv-list">
            <div className="kv-item">
              <span className="text-muted">Capture engine</span>
              <span className="mono">Scapy / Npcap Live Sniffer</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Selected interface</span>
              <span className="mono">{captureInterface || 'Wi-Fi'}</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Sniffer state</span>
              <span className="mono text-safe">{captureActive ? 'Recording' : 'Inactive'}</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Noise pre-filter</span>
              <span className="mono text-safe">Active (ICMP/DHCP bypass)</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Total analyzed packets</span>
              <span className="mono">{totalPackets.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card status-detail-card">
          <div className="chart-header">
            <Server size={16} className="text-muted" />
            <span className="chart-title">Gateway & Services</span>
          </div>
          <div className="status-kv-list">
            <div className="kv-item">
              <span className="text-muted">FastAPI Python engine</span>
              <span className="mono text-safe">Port 8000</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Node.js API Express</span>
              <span className="mono text-safe">Port 3001</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Socket.io connection</span>
              <span className="mono text-safe">{socketConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="kv-item">
              <span className="text-muted">Database storage</span>
              <span className="mono">SQLite (netshield.db)</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .status-detail-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chart-header {
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
        .status-kv-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kv-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.78rem;
          padding: 5px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .text-safe {
          color: var(--status-safe);
        }
      `}</style>
    </div>
  )
}
