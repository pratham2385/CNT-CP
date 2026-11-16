/**
 * NetShield AI — User Profile & Operator Security Modal.
 *
 * Full-featured modal for account management:
 * - Profile details (username, email)
 * - Role & authorization display (admin, analyst, viewer)
 * - Email verification badge with 1-click token resend
 * - Password change with live 12+ character instrument-grade rule validation
 * - Agent API Key reveal, copy, and rotation with confirmation
 * - Audit details (creation date, last login) and session termination
 *
 * @module components/UserProfileModal
 */

import { useState } from 'react'
import {
  X,
  User,
  Mail,
  Shield,
  Key,
  Lock,
  Check,
  AlertCircle,
  Copy,
  RotateCcw,
  Eye,
  EyeOff,
  LogOut,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// Password complexity rules matching backend policy
function getPasswordValidations(pw) {
  return [
    { label: 'Minimum 12 characters', valid: pw.length >= 12 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(pw) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(pw) },
    { label: 'At least one digit (0-9)', valid: /[0-9]/.test(pw) },
    { label: 'At least one special symbol (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(pw) },
  ]
}

export default function UserProfileModal({ isOpen, onClose }) {
  const {
    user,
    logout,
    updateProfile,
    changePassword,
    rotateApiKey,
    resendVerification,
    verifyEmail,
  } = useAuth()

  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'security' | 'apikey'

  // Profile Edit State
  const [editUsername, setEditUsername] = useState(user?.username || '')
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // API Key State
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [rotatingKey, setRotatingKey] = useState(false)
  const [keyNotice, setKeyNotice] = useState('')

  // Verification State
  const [resendingCode, setResendingCode] = useState(false)
  const [verifyNotice, setVerifyNotice] = useState('')
  const [verifyTokenInput, setVerifyTokenInput] = useState('')
  const [verifyingToken, setVerifyingToken] = useState(false)

  if (!isOpen || !user) return null

  // Profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileSuccess('')
    setProfileError('')

    try {
      await updateProfile({ username: editUsername, email: editEmail })
      setProfileSuccess('Profile credentials updated successfully.')
      setTimeout(() => setProfileSuccess(''), 4000)
    } catch (err) {
      setProfileError(err.response?.data?.detail || err.message || 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  // Password change submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordSuccess('')
    setPasswordError('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      setPasswordSaving(false)
      return
    }

    const validations = getPasswordValidations(newPassword)
    if (validations.some((v) => !v.valid)) {
      setPasswordError('New password does not meet the 12+ character complexity policy.')
      setPasswordSaving(false)
      return
    }

    try {
      await changePassword(currentPassword, newPassword)
      setPasswordSuccess('Password successfully updated. All other active sessions revoked.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 5000)
    } catch (err) {
      setPasswordError(err.response?.data?.detail || err.message || 'Failed to change password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  // Copy API Key
  const handleCopyKey = () => {
    if (user.apiKey) {
      navigator.clipboard.writeText(user.apiKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  // Rotate API Key
  const handleRotateKey = async () => {
    if (!window.confirm('Are you sure you want to rotate your Agent API Key? Any agents currently using this key will immediately be disconnected.')) {
      return
    }
    setRotatingKey(true)
    setKeyNotice('')
    try {
      await rotateApiKey()
      setKeyNotice('API Key rotated successfully. Update your agent config.')
      setTimeout(() => setKeyNotice(''), 4000)
    } catch (err) {
      setKeyNotice(err.response?.data?.detail || 'Failed to rotate API Key.')
    } finally {
      setRotatingKey(false)
    }
  }

  // Resend email verification
  const handleResendVerification = async () => {
    setResendingCode(true)
    setVerifyNotice('')
    try {
      const res = await resendVerification(user.email)
      let msg = res.message || 'Verification token sent.'
      if (res.verification_token) {
        msg += ` (Dev/Test Token: ${res.verification_token})`
      }
      setVerifyNotice(msg)
    } catch (err) {
      setVerifyNotice(err.response?.data?.detail || 'Failed to resend verification.')
    } finally {
      setResendingCode(false)
    }
  }

  // Manually submit verification token
  const handleVerifyTokenSubmit = async (e) => {
    e.preventDefault()
    if (!verifyTokenInput.trim()) return
    setVerifyingToken(true)
    try {
      await verifyEmail(verifyTokenInput.trim())
      setVerifyNotice('Email verified successfully!')
      setVerifyTokenInput('')
    } catch (err) {
      setVerifyNotice(err.response?.data?.detail || 'Verification failed. Token may be invalid or expired.')
    } finally {
      setVerifyingToken(false)
    }
  }

  const roleColor =
    user.role === 'admin'
      ? 'var(--accent-red)'
      : user.role === 'analyst'
      ? 'var(--accent-cyan)'
      : 'var(--text-muted)'

  const isVerified = !!user.is_verified || !!user.isVerified
  const validations = getPasswordValidations(newPassword)

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <div className="profile-header-title">
            <Shield size={18} className="text-cyan" />
            <span>Operator Security & Profile</span>
          </div>
          <button className="profile-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* User Badge Bar */}
        <div className="profile-user-summary">
          <div className="profile-avatar-large">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="profile-summary-meta">
            <div className="profile-summary-name-row">
              <span className="profile-name">{user.username}</span>
              <span className="profile-role-badge" style={{ color: roleColor, borderColor: `${roleColor}40` }}>
                {user.role.toUpperCase()}
              </span>
              {isVerified ? (
                <span className="profile-verified-badge verified" title="Email is verified">
                  <CheckCircle2 size={12} />
                  <span>Verified</span>
                </span>
              ) : (
                <span className="profile-verified-badge unverified" title="Email pending verification">
                  <AlertCircle size={12} />
                  <span>Unverified</span>
                </span>
              )}
            </div>
            <div className="profile-summary-sub mono text-muted">{user.email}</div>
          </div>
        </div>

        {/* Unverified Email Warning Banner */}
        {!isVerified && (
          <div className="unverified-banner">
            <div className="unverified-banner-text">
              <ShieldAlert size={15} className="text-amber" />
              <span>Email address is not yet verified. Sensitive actions require verified status.</span>
            </div>
            <div className="unverified-actions">
              <button
                className="btn-tiny btn-secondary"
                onClick={handleResendVerification}
                disabled={resendingCode}
              >
                {resendingCode ? 'Sending…' : 'Send Verification Code'}
              </button>
            </div>
            {verifyNotice && <div className="verify-notice-row mono">{verifyNotice}</div>}

            {/* Quick manual verification token entry */}
            <form onSubmit={handleVerifyTokenSubmit} className="verify-inline-form">
              <input
                type="text"
                placeholder="Paste verification token here…"
                className="verify-token-input mono"
                value={verifyTokenInput}
                onChange={(e) => setVerifyTokenInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn-tiny btn-primary"
                disabled={verifyingToken || !verifyTokenInput.trim()}
              >
                {verifyingToken ? 'Verifying…' : 'Verify'}
              </button>
            </form>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} />
            <span>Profile Details</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={14} />
            <span>Password & Security</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'apikey' ? 'active' : ''}`}
            onClick={() => setActiveTab('apikey')}
          >
            <Key size={14} />
            <span>Agent API Key</span>
          </button>
        </div>

        {/* TAB 1: Profile Details */}
        {activeTab === 'profile' && (
          <div className="profile-tab-content">
            {profileSuccess && (
              <div className="profile-alert success">
                <Check size={14} />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="profile-alert error">
                <AlertCircle size={14} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-field">
                <label className="field-label">Operator Handle (Username)</label>
                <div className="input-group">
                  <User size={15} className="field-icon" />
                  <input
                    type="text"
                    className="field-input"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                </div>
                <span className="field-hint text-muted">
                  3–32 alphanumeric characters and underscores.
                </span>
              </div>

              <div className="form-field">
                <label className="field-label">Notification Email</label>
                <div className="input-group">
                  <Mail size={15} className="field-icon" />
                  <input
                    type="email"
                    className="field-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>
                <span className="field-hint text-muted">
                  Changing email resets verified status until re-verified.
                </span>
              </div>

              <div className="form-field">
                <label className="field-label">Assigned SOC Role</label>
                <div className="static-field mono">
                  <Shield size={14} style={{ color: roleColor }} />
                  <span>{user.role.toUpperCase()} (Backend Enforced)</span>
                </div>
                <span className="field-hint text-muted">
                  Role permissions: {user.role === 'admin' ? 'Full administrative control and user governance' : 'Security incident review and live telemetry access'}.
                </span>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving Changes…' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Password & Security */}
        {activeTab === 'security' && (
          <div className="profile-tab-content">
            {passwordSuccess && (
              <div className="profile-alert success">
                <Check size={14} />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="profile-alert error">
                <AlertCircle size={14} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="form-field">
                <label className="field-label">Current Password</label>
                <div className="input-group">
                  <Lock size={15} className="field-icon" />
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    className="field-input"
                    placeholder="Enter existing password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-visibility-btn"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                  >
                    {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">New Password</label>
                <div className="input-group">
                  <Lock size={15} className="field-icon" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className="field-input"
                    placeholder="Min 12 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-visibility-btn"
                    onClick={() => setShowNewPw(!showNewPw)}
                  >
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Password Complexity Validation Checklist */}
              <div className="password-checklist">
                <div className="checklist-title">Password Security Policy (Argon2id Enforced)</div>
                {validations.map((v, i) => (
                  <div key={i} className={`checklist-item ${v.valid ? 'valid' : 'invalid'}`}>
                    {v.valid ? <Check size={12} className="check-icon" /> : <div className="dot-icon" />}
                    <span>{v.label}</span>
                  </div>
                ))}
              </div>

              <div className="form-field">
                <label className="field-label">Confirm New Password</label>
                <div className="input-group">
                  <Lock size={15} className="field-icon" />
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Re-type new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={passwordSaving || validations.some((v) => !v.valid) || newPassword !== confirmPassword}
                >
                  {passwordSaving ? 'Updating Password…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: Agent API Key */}
        {activeTab === 'apikey' && (
          <div className="profile-tab-content">
            <div className="apikey-description text-muted">
              Use this key to authenticate telemetry sensors, edge agents, or automated simulation scripts to the NetShield AI engine.
            </div>

            {keyNotice && (
              <div className="profile-alert success">
                <Check size={14} />
                <span>{keyNotice}</span>
              </div>
            )}

            <div className="apikey-container">
              <div className="apikey-label-row">
                <span className="mono text-muted">LIVE AGENT SECRET KEY</span>
                <button
                  type="button"
                  className="btn-tiny btn-ghost"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showApiKey ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>

              <div className="apikey-value-box">
                <code className="mono apikey-code">
                  {showApiKey
                    ? user.apiKey || 'No key generated'
                    : user.apiKey
                    ? `${user.apiKey.slice(0, 10)}••••••••••••••••••••••••`
                    : 'No key generated'}
                </code>
                <button className="btn-tiny btn-secondary" onClick={handleCopyKey} title="Copy Key">
                  {copiedKey ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="apikey-rotation-box">
              <div className="rotation-warning">
                <AlertCircle size={15} className="text-amber" />
                <span>
                  Rotating this API key invalidates all existing agent connections immediately.
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary btn-danger-hover"
                onClick={handleRotateKey}
                disabled={rotatingKey}
              >
                <RotateCcw size={13} className={rotatingKey ? 'spin' : ''} />
                <span>{rotatingKey ? 'Generating…' : 'Rotate API Key'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer with Session Logout */}
        <div className="profile-modal-footer">
          <div className="session-info mono text-muted">
            <Clock size={12} />
            <span>Session: Active (HttpOnly Secure Cookie + Bearer)</span>
          </div>
          <button
            className="btn-logout"
            onClick={async () => {
              onClose()
              await logout()
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <style>{`
        .profile-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(8, 10, 15, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .profile-modal-card {
          width: 100%;
          max-width: 540px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalAppear 0.15s ease-out;
        }

        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .profile-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-header);
        }

        .profile-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .profile-close-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: var(--radius-sm);
        }
        .profile-close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-panel);
        }

        .profile-user-summary {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border-default);
        }

        .profile-avatar-large {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34, 211, 238, 0.12);
          border: 1px solid rgba(34, 211, 238, 0.3);
          color: var(--accent-cyan);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
        }

        .profile-summary-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .profile-summary-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .profile-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .profile-role-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          background: rgba(0, 0, 0, 0.2);
        }

        .profile-verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .profile-verified-badge.verified {
          color: var(--accent-green);
          background: rgba(34, 197, 94, 0.1);
        }

        .profile-verified-badge.unverified {
          color: var(--accent-amber);
          background: rgba(245, 158, 11, 0.1);
        }

        .profile-summary-sub {
          font-size: 12px;
        }

        .unverified-banner {
          background: rgba(245, 158, 11, 0.08);
          border-bottom: 1px solid rgba(245, 158, 11, 0.25);
          padding: 10px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .unverified-banner-text {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-primary);
        }

        .unverified-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .verify-notice-row {
          font-size: 11px;
          color: var(--accent-cyan);
          background: rgba(0, 0, 0, 0.3);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          word-break: break-all;
        }

        .verify-inline-form {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }

        .verify-token-input {
          flex: 1;
          height: 28px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 8px;
          font-size: 11px;
          color: var(--text-primary);
        }

        .profile-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-header);
        }

        .profile-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 14px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }

        .profile-tab:hover {
          color: var(--text-primary);
        }

        .profile-tab.active {
          color: var(--accent-cyan);
          border-bottom-color: var(--accent-cyan);
          background: var(--bg-surface);
        }

        .profile-tab-content {
          padding: 18px 20px;
          max-height: 400px;
          overflow-y: auto;
        }

        .profile-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          margin-bottom: 14px;
        }

        .profile-alert.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: var(--accent-green);
        }

        .profile-alert.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--accent-red);
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .field-input {
          width: 100%;
          height: 36px;
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 34px 0 32px;
          font-size: 13px;
          color: var(--text-primary);
          transition: border-color 0.15s;
        }

        .field-input:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .toggle-visibility-btn {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .static-field {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 12px;
          font-size: 12px;
          color: var(--text-primary);
        }

        .field-hint {
          font-size: 11px;
        }

        .password-checklist {
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .checklist-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 2px;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .checklist-item.valid {
          color: var(--accent-green);
        }

        .checklist-item.invalid {
          color: var(--text-muted);
        }

        .check-icon {
          color: var(--accent-green);
        }

        .dot-icon {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted);
          margin-left: 3px;
          margin-right: 3px;
        }

        .apikey-description {
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 14px;
        }

        .apikey-container {
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .apikey-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
        }

        .apikey-value-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
        }

        .apikey-code {
          flex: 1;
          font-size: 12px;
          color: var(--accent-cyan);
          word-break: break-all;
        }

        .apikey-rotation-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          background: rgba(245, 158, 11, 0.05);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-sm);
        }

        .rotation-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .profile-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: var(--bg-header);
          border-top: 1px solid var(--border-default);
        }

        .session-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        .btn-primary {
          height: 34px;
          padding: 0 16px;
          background: var(--accent-cyan);
          border: 1px solid var(--accent-cyan);
          border-radius: var(--radius-sm);
          color: #0b0f19;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          height: 28px;
          padding: 0 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .btn-danger-hover:hover:not(:disabled) {
          border-color: var(--accent-red);
          color: var(--accent-red);
        }

        .btn-tiny {
          height: 24px;
          padding: 0 8px;
          font-size: 10px;
        }

        .btn-ghost {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .btn-ghost:hover {
          color: var(--accent-cyan);
        }

        .btn-logout {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-sm);
          color: var(--accent-red);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }
        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: var(--accent-red);
        }
      `}</style>
    </div>
  )
}

