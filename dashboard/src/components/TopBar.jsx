/**
 * NetShield AI — Instrument-Grade Header Bar.
 *
 * Displays workspace title, live system threat indicator, session reset,
 * real-time clock, and operator authentication control.
 *
 * @module components/TopBar
 */

import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RotateCcw, Bot, LogIn, LogOut, Key, Check, Copy, ChevronDown, User } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AuthModal from './AuthModal.jsx'
import UserProfileModal from './UserProfileModal.jsx'
import { THREAT_COLORS, THREAT_BG_COLORS } from '../utils/constants.js'

const BREADCRUMBS = {
  '/': { title: 'Network Telemetry Overview', subtitle: 'Live flow classification and packet inspection' },
  '/analytics': { title: 'Security Analytics', subtitle: 'Threat distribution, vector breakdown, and host forensics' },
  '/history': { title: 'Attack Log History', subtitle: 'Audit trail of classified network anomalies' },
  '/reports': { title: 'Security Reports', subtitle: 'Comprehensive summary export and PDF reports' },
  '/status': { title: 'System Diagnostics', subtitle: 'Model parameters, packet sniffer, and runtime status' },
}

export default function TopBar({ onOpenChat }) {
  const { threatLevel, resetData } = useDashboard()
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  const [clock, setClock] = useState('')
  const [resetting, setResetting] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const menuRef = useRef(null)

  const currentMeta = BREADCRUMBS[location.pathname] || {
    title: 'Console',
    subtitle: 'Security Workspace',
  }

  useEffect(() => {
    const update = () => {
      const d = new Date()
      setClock(
        d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const handleReset = async () => {
    setResetting(true)
    await resetData()
    setResetting(false)
  }

  const handleLogout = async () => {
    setUserMenuOpen(false)
    setProfileModalOpen(false)
    setAuthModalOpen(false)
    await logout()
  }

  const handleCopyKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const threatColor = THREAT_COLORS[threatLevel] || THREAT_COLORS.SAFE
  const threatBg = THREAT_BG_COLORS[threatLevel] || THREAT_BG_COLORS.SAFE

  return (
    <>
      <header className="topbar">
        {/* Workspace Title */}
        <div className="topbar-breadcrumb">
          <h1 className="breadcrumb-title">{currentMeta.title}</h1>
          <span className="breadcrumb-subtitle text-muted">{currentMeta.subtitle}</span>
        </div>

        {/* Controls */}
        <div className="topbar-actions">
          <button
            className="topbar-btn ai-btn"
            onClick={onOpenChat}
            title="Open AI security assistant (Ctrl+K)"
          >
            <Bot size={14} className="text-cyan" />
            <span>Assistant</span>
          </button>

          <button
            className="topbar-btn reset-btn"
            onClick={handleReset}
            disabled={resetting}
            title="Reset telemetry counters and session logs to 0"
          >
            <RotateCcw size={13} className={resetting ? 'spin' : ''} />
            <span>{resetting ? 'Resetting…' : 'Reset Data'}</span>
          </button>

          <div
            className="threat-indicator-pill"
            style={{ color: threatColor, background: threatBg, borderColor: `${threatColor}33` }}
          >
            <span className="threat-led" style={{ background: threatColor }} />
            <span className="mono">{threatLevel}</span>
          </div>

          <span className="topbar-clock mono">{clock}</span>

          {/* User Auth Control */}
          {isAuthenticated ? (
            <div className="user-profile-menu-container" ref={menuRef}>
              <button
                className="user-profile-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                title="Account Settings & API Key"
              >
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user.username}</span>
                <ChevronDown size={13} className={`menu-arrow ${userMenuOpen ? 'open' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="dropdown-user-name-row">
                      <span className="dropdown-user-name">{user.username}</span>
                      <span className="dropdown-role-tag">{user.role?.toUpperCase()}</span>
                    </div>
                    <div className="dropdown-user-email">{user.email}</div>
                  </div>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false)
                      setProfileModalOpen(true)
                    }}
                  >
                    <User size={13} />
                    <span>Profile & Security</span>
                  </button>

                  <div className="dropdown-section">
                    <div className="dropdown-label">Agent API Key</div>
                    <div className="dropdown-api-key-row">
                      <code className="dropdown-key-code">
                        {user.apiKey ? `${user.apiKey.slice(0, 14)}…` : 'No Key'}
                      </code>
                      <button className="dropdown-copy-btn" onClick={handleCopyKey} title="Copy Full API Key">
                        {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <button className="dropdown-item logout-item" onClick={handleLogout}>
                    <LogOut size={13} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="topbar-btn signin-btn" onClick={() => setAuthModalOpen(true)}>
              <LogIn size={13} />
              <span>Operator Login</span>
            </button>
          )}
        </div>

        <style>{`
          .topbar {
            height: var(--header-height);
            background: var(--bg-header);
            border-bottom: 1px solid var(--border-default);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            position: sticky;
            top: 0;
            z-index: 100;
            user-select: none;
          }

          .topbar-breadcrumb {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .breadcrumb-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            line-height: 1.2;
          }

          .breadcrumb-subtitle {
            font-size: 0.73rem;
            color: var(--text-tertiary);
          }

          .topbar-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .topbar-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 10px;
            border-radius: var(--radius-sm);
            font-size: 0.78rem;
            font-weight: 500;
            background: var(--bg-raised);
            border: 1px solid var(--border-default);
            color: var(--text-secondary);
            cursor: pointer;
            transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
          }

          .topbar-btn:hover {
            background: var(--bg-raised-alt);
            color: var(--text-primary);
            border-color: var(--border-hover);
          }

          .signin-btn {
            color: var(--text-primary);
            background: var(--bg-raised);
            border-color: var(--border-hover);
          }

          .signin-btn:hover {
            background: var(--bg-raised-alt);
          }

          .threat-indicator-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 10px;
            border-radius: var(--radius-sm);
            font-size: 0.74rem;
            font-weight: 600;
            border: 1px solid;
            letter-spacing: 0.3px;
          }

          .threat-led {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .topbar-clock {
            font-size: 0.78rem;
            color: var(--text-secondary);
            background: var(--bg-card);
            border: 1px solid var(--border-default);
            padding: 0 10px;
            height: 30px;
            display: inline-flex;
            align-items: center;
            border-radius: var(--radius-sm);
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            100% { transform: rotate(360deg); }
          }

          /* Profile menu */
          .user-profile-menu-container {
            position: relative;
          }

          .user-profile-btn {
            display: flex;
            align-items: center;
            gap: 7px;
            background: var(--bg-raised);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-sm);
            height: 30px;
            padding: 0 8px 0 5px;
            color: var(--text-primary);
            font-size: 0.78rem;
            font-weight: 500;
            cursor: pointer;
            transition: background var(--transition-fast), border-color var(--transition-fast);
          }

          .user-profile-btn:hover {
            border-color: var(--border-hover);
            background: var(--bg-raised-alt);
          }

          .user-avatar {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--accent-cyan);
            color: #0b0d14;
            font-weight: 700;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .menu-arrow {
            color: var(--text-tertiary);
            transition: transform var(--transition-fast);
          }

          .menu-arrow.open {
            transform: rotate(180deg);
          }

          .user-dropdown-menu {
            position: absolute;
            right: 0;
            top: calc(100% + 6px);
            width: 230px;
            background: var(--bg-card);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-dropdown);
            padding: 6px;
            z-index: 200;
          }

          .user-dropdown-header {
            padding: 8px;
            border-bottom: 1px solid var(--border-default);
          }

          .dropdown-user-name-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
          }

          .dropdown-user-name {
            font-weight: 600;
            font-size: 0.85rem;
            color: var(--text-primary);
          }

          .dropdown-role-tag {
            font-size: 0.65rem;
            font-weight: 700;
            color: var(--accent-cyan);
            border: 1px solid rgba(34, 211, 238, 0.3);
            border-radius: var(--radius-xs);
            padding: 1px 4px;
            letter-spacing: 0.04em;
          }

          .dropdown-user-email {
            font-size: 0.72rem;
            color: var(--text-tertiary);
            word-break: break-all;
            margin-top: 2px;
          }

          .dropdown-section {
            padding: 8px;
          }

          .dropdown-label {
            font-size: 0.7rem;
            font-weight: 500;
            color: var(--text-tertiary);
            margin-bottom: 6px;
          }

          .dropdown-api-key-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--bg-dark);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xs);
            padding: 4px 6px;
          }

          .dropdown-key-code {
            font-family: var(--font-mono);
            font-size: 0.72rem;
            color: var(--text-secondary);
          }

          .dropdown-copy-btn {
            background: var(--bg-raised);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xs);
            padding: 2px 6px;
            color: var(--accent-cyan);
            font-size: 0.68rem;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 3px;
          }

          .dropdown-copy-btn:hover {
            background: var(--bg-raised-alt);
          }

          .dropdown-divider {
            height: 1px;
            background: var(--border-default);
            margin: 4px 0;
          }

          .dropdown-item {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            background: transparent;
            border: none;
            border-radius: var(--radius-xs);
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background var(--transition-fast);
          }

          .logout-item {
            color: var(--accent-crimson);
          }

          .logout-item:hover {
            background: rgba(248, 113, 113, 0.1);
          }

          @media (max-width: 768px) {
            .breadcrumb-subtitle { display: none; }
            .breadcrumb-title { font-size: 0.92rem; }
            .topbar-clock { display: none; }
          }
        `}</style>
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <UserProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </>
  )
}
