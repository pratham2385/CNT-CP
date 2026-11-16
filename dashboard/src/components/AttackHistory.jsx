/**
 * NetShield AI — Attack history table component.
 *
 * Sortable, filterable, paginated table of recent attack events.
 *
 * @module components/AttackHistory
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, ShieldAlert } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { getAttacks } from '../api/client.js'
import { ATTACK_COLORS, FALLBACK_COLOR } from '../utils/constants.js'
import { formatTime, formatDateTime, formatConfidence, protocolName, formatEndpoint } from '../utils/format.js'

const COLUMNS = [
  { key: 'timestamp_utc', label: 'Time', sortable: true, width: '90px' },
  { key: 'attack_type', label: 'Type', sortable: true, width: '95px' },
  { key: 'src_ip', label: 'Source', sortable: true, width: '1fr' },
  { key: 'dst_ip', label: 'Destination', sortable: true, width: '1fr' },
  { key: 'protocol', label: 'Proto', sortable: true, width: '60px' },
  { key: 'confidence', label: 'Confidence', sortable: true, width: '110px' },
]

function compareValues(a, b, dir) {
  let aVal = a
  let bVal = b
  if (typeof aVal === 'string') aVal = aVal.toLowerCase()
  if (typeof bVal === 'string') bVal = bVal.toLowerCase()
  if (aVal < bVal) return dir === 'asc' ? -1 : 1
  if (aVal > bVal) return dir === 'asc' ? -1 : 1
  return 0
}

function rowsToCsv(rows) {
  const headers = COLUMNS.map(c => c.label)
  const lines = [headers.join(',')]
  for (const r of rows) {
    const vals = COLUMNS.map(c => {
      let v = r[c.key]
      if (c.key === 'timestamp_utc') v = formatDateTime(v)
      if (c.key === 'confidence') v = formatConfidence(v)
      if (c.key === 'protocol') v = protocolName(v)
      if (c.key === 'src_ip') v = formatEndpoint(r.src_ip, r.src_port)
      if (c.key === 'dst_ip') v = formatEndpoint(r.dst_ip, r.dst_port)
      const s = String(v ?? '')
      return s.includes(',') ? `"${s}"` : s
    })
    lines.push(vals.join(','))
  }
  return lines.join('\n')
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AttackHistory({ compact = false, showFilters = false }) {
  const { recentAttacks, lastAttack } = useDashboard()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState('timestamp_utc')
  const [sortDir, setSortDir] = useState('desc')
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pageSize = compact ? 5 : 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAttacks(pageSize, page * pageSize, filter === 'All' ? null : filter)
      setRows(data.attacks || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch attacks')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, filter, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Live real-time update when lastAttack comes in
  useEffect(() => {
    if (!lastAttack) return
    if (page === 0) {
      const type = lastAttack.attack_type || lastAttack.label
      if (filter === 'All' || filter === type) {
        setRows(prev => {
          const exists = prev.some(r =>
            (r.id && lastAttack.id && r.id === lastAttack.id) ||
            (r.timestamp_utc === lastAttack.timestamp_utc && (r.src_ip === lastAttack.src_ip || r.context?.src_ip === lastAttack.src_ip))
          )
          if (exists) return prev
          return [lastAttack, ...prev].slice(0, pageSize)
        })
        setTotal(t => t + 1)
      }
    }
  }, [lastAttack, page, filter, pageSize])

  const baseRows = compact
    ? (recentAttacks.length > 0 ? recentAttacks : rows).slice(0, pageSize)
    : rows

  const displayRows = useMemo(() => {
    const normalized = baseRows.map(r => {
      const ctx = r.context || {}
      return {
        ...r,
        attack_type: r.attack_type || r.label || 'BENIGN',
        src_ip: r.src_ip || ctx.src_ip || '',
        dst_ip: r.dst_ip || ctx.dst_ip || '',
        src_port: r.src_port ?? ctx.src_port ?? 0,
        dst_port: r.dst_port ?? ctx.dst_port ?? 0,
        protocol: r.protocol ?? ctx.protocol ?? 0,
      }
    })
    return normalized.sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDir))
  }, [baseRows, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleExport = () => {
    const csv = rowsToCsv(displayRows)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    downloadCsv(csv, `netshield_attacks_${ts}.csv`)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="card history-card">
      <div className="chart-header">
        <div className="chart-title-wrap">
          <ShieldAlert size={16} className="text-muted" />
          <span className="chart-title">
            {compact ? 'Recent Attack Events' : 'Attack History Log'}
          </span>
        </div>
        <div className="history-header-actions">
          {showFilters && (
            <select
              className="history-filter mono"
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(0) }}
            >
              <option value="All">All Types</option>
              <option value="DDoS">DDoS</option>
              <option value="DoS">DoS</option>
              <option value="PortScan">Port Scan</option>
              <option value="BruteForce">Brute Force</option>
              <option value="Bot">Bot</option>
              <option value="WebAttack">Web Attack</option>
              <option value="Infiltration">Infiltration</option>
              <option value="Heartbleed">Heartbleed</option>
            </select>
          )}
          {displayRows.length > 0 && (
            <button className="history-export-btn mono" onClick={handleExport} title="Export CSV">
              <Download size={13} />
              CSV
            </button>
          )}
        </div>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{ cursor: col.sortable ? 'pointer' : 'default', width: col.width }}
                >
                  <span className="th-content">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp size={12} />
                        : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} className="history-empty text-muted">Loading telemetry…</td></tr>
            ) : error ? (
              <tr>
                <td colSpan={COLUMNS.length} className="history-error">
                  {error} — <button className="retry-link" onClick={fetchData}>retry</button>
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} className="history-empty text-muted">No attack events recorded</td></tr>
            ) : (
              displayRows.map((row, i) => {
                const isAttack = row.is_attack === 1 || row.is_attack === true
                const color = isAttack
                  ? (ATTACK_COLORS[row.attack_type] || FALLBACK_COLOR)
                  : 'var(--status-safe)'
                return (
                  <tr key={row.id || i}>
                    <td className="mono text-faint" title={formatDateTime(row.timestamp_utc)}>
                      {formatTime(row.timestamp_utc)}
                    </td>
                    <td>
                      <span className="type-badge mono" style={{ color, borderColor: `${color}35`, background: `${color}10` }}>
                        {row.attack_type}
                      </span>
                    </td>
                    <td className="mono">
                      {formatEndpoint(row.src_ip, row.src_port)}
                    </td>
                    <td className="mono">
                      {formatEndpoint(row.dst_ip, row.dst_port)}
                    </td>
                    <td className="text-muted mono">
                      {protocolName(row.protocol)}
                    </td>
                    <td>
                      <div className="conf-cell">
                        <div className="conf-bar-bg">
                          <div
                            className="conf-bar-fill"
                            style={{
                              width: `${(row.confidence || 0) * 100}%`,
                              background: color,
                            }}
                          />
                        </div>
                        <span className="mono text-muted">
                          {formatConfidence(row.confidence)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!compact && totalPages > 1 && (
        <div className="history-pagination">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="page-btn"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="page-info mono">
            Page {page + 1} of {totalPages} ({total.toLocaleString()} total)
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className="page-btn"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <style>{`
        .history-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          height: 425px;
        }
        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
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
        .history-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .history-filter {
          background: var(--bg-dark);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 4px 8px;
          font-size: 0.72rem;
          cursor: pointer;
        }
        .history-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--bg-raised);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 4px 10px;
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }
        .history-export-btn:hover {
          background: var(--bg-card);
          color: var(--text-primary);
          border-color: var(--border-default);
        }
        .history-table-wrap {
          flex: 1;
          overflow-x: auto;
          overflow-y: auto;
          margin-top: 6px;
        }
        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .history-table th {
          text-align: left;
          padding: 7px 8px;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid var(--border-default);
          white-space: nowrap;
          background: var(--bg-card);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .th-content {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .history-table td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-subtle);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .history-table tr:hover td {
          background: var(--bg-raised);
        }
        .history-empty {
          text-align: center !important;
          padding: 50px !important;
          color: var(--text-muted);
        }
        .history-error {
          text-align: center !important;
          padding: 50px !important;
          color: var(--status-critical);
        }
        .retry-link {
          background: none;
          border: none;
          color: var(--accent-blue);
          cursor: pointer;
          text-decoration: underline;
          font-size: inherit;
        }
        .type-badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          font-size: 0.65rem;
          font-weight: 600;
          border: 1px solid;
        }
        .conf-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .conf-bar-bg {
          width: 44px;
          height: 3px;
          background: var(--bg-dark);
          border-radius: 2px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .conf-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s;
        }
        .history-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 0 0;
        }
        .page-btn {
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 4px 8px;
          color: var(--text-primary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          transition: background-color var(--transition-fast);
        }
        .page-btn:hover:not(:disabled) {
          background: var(--bg-card);
          border-color: var(--border-default);
        }
        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .page-info {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
