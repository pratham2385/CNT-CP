/**
 * NetShield AI — PDF report generation page.
 *
 * Allows the user to trigger PDF report generation. Shows a summary
 * of what the report contains and the file path after generation.
 *
 * @module pages/Reports
 */

import { useState } from 'react'
import { FileText, Download, FileCheck, Loader2 } from 'lucide-react'
import { generateReport } from '../api/client.js'
import { useDashboard } from '../context/DashboardContext.jsx'

export default function Reports() {
  const { attackCount, totalPackets, threatLevel, attackSummary } = useDashboard()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await generateReport()
      setResult(data)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate report'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    handleGenerate()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Security Reports</h1>
        <p className="page-subtitle text-muted">
          Generate a comprehensive PDF security report
        </p>
      </div>

      <div className="reports-grid">
        {/* Summary card */}
        <div className="card report-summary-card">
          <div className="report-card-header">
            <FileText size={16} className="text-muted" />
            <span className="report-card-title">Current System Telemetry</span>
          </div>
          <div className="report-stats">
            <div className="report-stat-row">
              <span className="text-muted">Total packets analyzed</span>
              <span className="mono">{totalPackets.toLocaleString()}</span>
            </div>
            <div className="report-stat-row">
              <span className="text-muted">Attacks detected</span>
              <span className="mono text-critical">{attackCount.toLocaleString()}</span>
            </div>
            <div className="report-stat-row">
              <span className="text-muted">Threat level</span>
              <span className="mono">{threatLevel}</span>
            </div>
            <div className="report-stat-row">
              <span className="text-muted">Attack types active</span>
              <span className="mono">{attackSummary.length}</span>
            </div>
          </div>
        </div>

        {/* Generate button card */}
        <div className="card report-action-card">
          <div className="report-card-header">
            <FileCheck size={16} className="text-muted" />
            <span className="report-card-title">Generate PDF Report</span>
          </div>
          <p className="report-desc text-muted">
            The report includes: executive summary, attack breakdown table,
            top attacker IPs, and security recommendations.
          </p>
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="spin" />
                Generating…
              </>
            ) : (
              <>
                <Download size={15} />
                Generate Report
              </>
            )}
          </button>

          {result && (
            <div className="report-result">
              <div className="report-result-icon">
                <FileCheck size={18} style={{ color: 'var(--status-safe)' }} />
              </div>
              <div className="report-result-info">
                <span className="report-result-title">Report Generated Successfully</span>
                <span className="report-result-file mono text-muted">
                  {result.filename}
                </span>
                <span className="report-result-path mono text-faint">
                  {result.path}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="report-error">
              <span>{error}</span>
              <button className="retry-btn mono" onClick={handleRetry}>Retry</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .page-container {
          max-width: 1000px;
        }
        .page-header {
          margin-bottom: 16px;
        }
        .page-title {
          font-size: 1.15rem;
          font-weight: 600;
        }
        .page-subtitle {
          font-size: 0.78rem;
          margin-top: 3px;
        }
        .reports-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 767px) {
          .reports-grid {
            grid-template-columns: 1fr;
          }
        }
        .report-summary-card, .report-action-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .report-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .report-card-title {
          font-size: 0.88rem;
          font-weight: 600;
        }
        .report-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .report-stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.78rem;
          padding: 5px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .report-desc {
          font-size: 0.78rem;
          line-height: 1.5;
        }
        .generate-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          padding: 9px 18px;
          background: var(--accent-blue);
          color: #ffffff;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }
        .generate-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .report-result {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(52, 211, 153, 0.08);
          border: 1px solid rgba(52, 211, 153, 0.25);
          border-radius: var(--radius-sm);
        }
        .report-result-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          word-break: break-all;
        }
        .report-result-title {
          font-weight: 600;
          color: var(--status-safe);
          font-size: 0.82rem;
        }
        .report-result-file {
          font-size: 0.78rem;
        }
        .report-result-path {
          font-size: 0.68rem;
        }
        .report-error {
          padding: 10px 12px;
          background: rgba(248, 113, 113, 0.08);
          border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: var(--radius-sm);
          color: var(--status-critical);
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .retry-btn {
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 3px 10px;
          color: var(--text-primary);
          font-size: 0.72rem;
          cursor: pointer;
          transition: background-color var(--transition-fast);
          flex-shrink: 0;
        }
        .retry-btn:hover {
          background: var(--bg-card);
        }
        .text-critical {
          color: var(--status-critical);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
