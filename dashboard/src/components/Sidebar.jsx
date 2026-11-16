/**
 * NetShield AI — Instrument-Grade Sidebar Navigation.
 *
 * Clean telemetry navigation for switching between core workspaces:
 * Overview, Analytics, Attack Logs, Reports, and System Diagnostics.
 *
 * @module components/Sidebar
 */

import { NavLink } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  PieChart,
  Activity,
  FileText,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'

export default function Sidebar({ collapsed, onToggle }) {
  const { attackCount, socketConnected } = useDashboard()

  return (
    <aside className={`soc-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header / Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo-group">
          <div className="sidebar-logo-icon">
            <Shield size={18} className="logo-shield" />
          </div>
          {!collapsed && (
            <div className="logo-text">
              <span className="brand-name">NetShield <span className="brand-tag">NIDS</span></span>
              <span className="brand-subtitle">Telemetry & IDS Console</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        <div className="menu-label">{!collapsed ? 'Workspaces' : '•'}</div>

        <NavLink to="/" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={16} className="item-icon" />
          {!collapsed && <span className="item-text">Overview</span>}
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <PieChart size={16} className="item-icon" />
          {!collapsed && <span className="item-text">Analytics</span>}
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <div className="icon-with-badge">
            <Activity size={16} className="item-icon" />
            {attackCount > 0 && <span className="nav-badge-dot" />}
          </div>
          {!collapsed && (
            <div className="item-text-row">
              <span className="item-text">Attack Logs</span>
              {attackCount > 0 && <span className="nav-count-badge mono">{attackCount}</span>}
            </div>
          )}
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <FileText size={16} className="item-icon" />
          {!collapsed && <span className="item-text">Reports</span>}
        </NavLink>

        <div className="menu-label" style={{ marginTop: '20px' }}>{!collapsed ? 'System' : '•'}</div>

        <NavLink to="/status" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <Terminal size={16} className="item-icon" />
          {!collapsed && <span className="item-text">Diagnostics</span>}
        </NavLink>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="system-live-indicator">
          <span className={`status-dot ${socketConnected ? 'dot-online' : 'dot-offline'}`} />
          {!collapsed && (
            <span className="status-label mono">
              {socketConnected ? 'Engine connected' : 'Engine offline'}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .soc-sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          z-index: 150;
          transition: width var(--transition-fast);
          user-select: none;
        }

        .soc-sidebar.collapsed {
          width: var(--sidebar-collapsed);
        }

        /* ── Sidebar Header ── */
        .sidebar-header {
          height: var(--header-height);
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-default);
        }

        .sidebar-logo-group {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }

        .sidebar-logo-icon {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          background: var(--bg-raised);
          border: 1px solid var(--border-default);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--accent-cyan);
        }

        .logo-text {
          display: flex;
          flex-direction: column;
          white-space: nowrap;
        }

        .brand-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.1;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand-tag {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 500;
          color: var(--accent-cyan);
          background: rgba(56, 189, 248, 0.1);
          padding: 1px 4px;
          border-radius: var(--radius-xs);
          border: 1px solid rgba(56, 189, 248, 0.2);
        }

        .brand-subtitle {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .sidebar-toggle {
          background: transparent;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xs);
          color: var(--text-secondary);
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
          flex-shrink: 0;
        }

        .sidebar-toggle:hover {
          background: var(--bg-raised);
          color: var(--text-primary);
        }

        /* ── Menu Items ── */
        .sidebar-menu {
          flex: 1;
          padding: 16px 8px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .menu-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-tertiary);
          padding: 0 10px 6px 10px;
          white-space: nowrap;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 400;
          transition: background var(--transition-fast), color var(--transition-fast);
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .sidebar-item:hover {
          color: var(--text-primary);
          background: var(--bg-raised);
        }

        .sidebar-item.active {
          background: var(--bg-raised);
          color: var(--text-primary);
          font-weight: 500;
          border-color: var(--border-hover);
        }

        .item-icon {
          flex-shrink: 0;
          color: var(--text-tertiary);
        }

        .sidebar-item.active .item-icon {
          color: var(--accent-cyan);
        }

        .sidebar-item:hover .item-icon {
          color: var(--text-secondary);
        }

        .icon-with-badge {
          position: relative;
          display: flex;
          align-items: center;
        }

        .nav-badge-dot {
          position: absolute;
          top: -2px;
          right: -3px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-crimson);
        }

        .item-text-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 1;
        }

        .nav-count-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--accent-crimson);
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.25);
          padding: 1px 6px;
          border-radius: var(--radius-xs);
        }

        /* ── Footer ── */
        .sidebar-footer {
          padding: 12px 14px;
          border-top: 1px solid var(--border-default);
        }

        .system-live-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dot-online {
          background: var(--accent-green);
        }

        .dot-offline {
          background: var(--accent-crimson);
        }

        .status-label {
          font-size: 0.72rem;
          color: var(--text-tertiary);
        }
      `}</style>
    </aside>
  )
}
