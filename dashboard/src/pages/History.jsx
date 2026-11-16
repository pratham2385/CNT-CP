/**
 * NetShield AI — Attack history page.
 *
 * Full-page attack history with filtering and pagination.
 *
 * @module pages/History
 */

import AttackHistory from '../components/AttackHistory.jsx'

export default function History() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Attack History</h1>
        <p className="page-subtitle text-muted">
          Complete log of all detected attacks and predictions
        </p>
      </div>
      <AttackHistory showFilters />
      <style>{`
        .page-container {
          max-width: 1400px;
        }
        .page-header {
          margin-bottom: 16px;
        }
        .page-title {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .page-subtitle {
          font-size: 0.78rem;
          margin-top: 3px;
        }
      `}</style>
    </div>
  )
}
