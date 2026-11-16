/**
 * NetShield AI — Production Authentication Modal.
 *
 * Full-featured modal providing:
 * - Operator Sign In (with rate limiting feedback)
 * - Operator Registration (with strict 12+ char validation & API key provision)
 * - Forgot Password (requests expiring, single-use token)
 * - Reset Password (accepts token + sets new password meeting complexity)
 * - Email Verification (activates account using token)
 *
 * Designed using calm, instrument-grade graphite design tokens.
 *
 * @module components/AuthModal
 */

import { useState, useEffect } from 'react'
import {
  X,
  Shield,
  Lock,
  Mail,
  User,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Copy,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// Password validation rules matching backend Argon2id policy
function getPasswordValidations(pw) {
  return [
    { label: 'Minimum 12 characters', valid: pw.length >= 12 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(pw) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(pw) },
    { label: 'At least one digit (0-9)', valid: /[0-9]/.test(pw) },
    { label: 'At least one special symbol (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(pw) },
  ]
}

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, forgotPassword, resetPassword, verifyEmail } = useAuth()
  
  // Active mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify'
  const [tab, setTab] = useState('login')

  // Form Fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Feedback & States
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [registeredApiKey, setRegisteredApiKey] = useState(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [devTokenNotice, setDevTokenNotice] = useState('')

  const resetForm = () => {
    setError('')
    setSuccessMsg('')
    setDevTokenNotice('')
    setRegisteredApiKey(null)
    setLoading(false)
    setPassword('')
    setConfirmPassword('')
    setTokenInput('')
  }

  const handleClose = () => {
    resetForm()
    setTab('login')
    onClose()
  }

  // When modal closes, always reset transient states so it never opens to a stale registration or error screen
  useEffect(() => {
    if (!isOpen) {
      resetForm()
      setTab('login')
    }
  }, [isOpen])

  if (!isOpen) return null

  const switchTab = (newTab) => {
    setTab(newTab)
    resetForm()
  }

  const validations = getPasswordValidations(password)
  const isPasswordValid = validations.every((v) => v.valid)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setDevTokenNotice('')
    setLoading(true)

    try {
      if (tab === 'login') {
        await login(email || username, password)
        handleClose()
      } else if (tab === 'register') {
        if (!isPasswordValid) {
          setError('Password does not satisfy the instrument-grade security policy.')
          setLoading(false)
          return
        }
        const data = await register(username, email, password)
        setRegisteredApiKey(data.user.apiKey || data.user.api_key)
        if (data.verification_token) {
          setDevTokenNotice(`Dev Verification Token: ${data.verification_token}`)
        }
      } else if (tab === 'forgot') {
        const res = await forgotPassword(email)
        setSuccessMsg(res.message || 'If an account exists, a reset token has been dispatched.')
        if (res.reset_token) {
          setDevTokenNotice(`Local Test Reset Token: ${res.reset_token}`)
        }
      } else if (tab === 'reset') {
        if (!isPasswordValid) {
          setError('New password does not satisfy the security policy.')
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          setLoading(false)
          return
        }
        const res = await resetPassword(tokenInput.trim(), password)
        setSuccessMsg(res.message || 'Password has been successfully updated. You may now sign in.')
        setPassword('')
        setConfirmPassword('')
        setTokenInput('')
        setTimeout(() => switchTab('login'), 2500)
      } else if (tab === 'verify') {
        const res = await verifyEmail(tokenInput.trim())
        setSuccessMsg(res.message || 'Email verified successfully.')
        setTokenInput('')
        setTimeout(() => switchTab('login'), 2000)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Authentication request failed.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyKey = () => {
    if (registeredApiKey) {
      navigator.clipboard.writeText(registeredApiKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-brand">
            <Shield size={20} className="auth-brand-icon" />
            <span>NetShield AI SOC Console</span>
          </div>
          <button className="auth-close-btn" onClick={handleClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Successful Registration Screen with API Key */}
        {registeredApiKey ? (
          <div className="auth-success-body">
            <div className="success-badge">
              <CheckCircle2 size={32} />
            </div>
            <h3>Operator Account Provisioned</h3>
            <p className="success-desc">
              Your account has been created with role-based SOC access. Copy your unique <strong>SOC Agent Secret Key</strong> for endpoint sensors.
            </p>

            <div className="api-key-box">
              <div className="api-key-label">
                <Key size={14} />
                <span>Agent Sensor Key (Secret)</span>
              </div>
              <div className="api-key-value-row">
                <code className="api-key-code mono">{registeredApiKey}</code>
                <button className="api-key-copy-btn" onClick={handleCopyKey}>
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {devTokenNotice && (
              <div className="dev-token-box mono">
                <span className="dev-token-label">[DEV / LOCAL TEST]</span>
                <span>{devTokenNotice}</span>
              </div>
            )}

            <button className="auth-primary-btn margin-top" onClick={handleClose}>
              <span>Enter Security Operations Center</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            {/* Tab Bar */}
            <div className="auth-tabs">
              <button
                className={`auth-tab ${tab === 'login' ? 'auth-tab-active' : ''}`}
                onClick={() => switchTab('login')}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${tab === 'register' ? 'auth-tab-active' : ''}`}
                onClick={() => switchTab('register')}
              >
                Create Account
              </button>
              <button
                className={`auth-tab ${tab === 'forgot' || tab === 'reset' ? 'auth-tab-active' : ''}`}
                onClick={() => switchTab('forgot')}
              >
                Password Recovery
              </button>
              <button
                className={`auth-tab ${tab === 'verify' ? 'auth-tab-active' : ''}`}
                onClick={() => switchTab('verify')}
              >
                Verify
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="auth-alert error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div className="auth-alert success">
                <Check size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Dev Token Notice */}
            {devTokenNotice && (
              <div className="dev-token-box mono">
                <span className="dev-token-label">[DEV / LOCAL TOKEN]</span>
                <span>{devTokenNotice}</span>
              </div>
            )}

            {/* FORM CONTAINER */}
            <form onSubmit={handleSubmit} className="auth-form">
              {/* 1. LOGIN */}
              {tab === 'login' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Operator Handle or Email</label>
                    <div className="input-wrapper">
                      <User size={16} className="input-icon" />
                      <input
                        type="text"
                        className="auth-input"
                        placeholder="analyst or analyst@netshield.ai"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="label-with-link">
                      <label className="form-label">Password</label>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => switchTab('forgot')}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="input-wrapper">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 2. REGISTER */}
              {tab === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Operator Handle (Username)</label>
                    <div className="input-wrapper">
                      <User size={16} className="input-icon" />
                      <input
                        type="text"
                        className="auth-input"
                        placeholder="e.g. cyber_analyst_01"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                    <span className="form-hint text-muted">3–32 alphanumeric characters and underscores</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Corporate Email Address</label>
                    <div className="input-wrapper">
                      <Mail size={16} className="input-icon" />
                      <input
                        type="email"
                        className="auth-input"
                        placeholder="analyst@netshield.ai"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Master Password</label>
                    <div className="input-wrapper">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Min 12 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Live Password Complexity Checklist */}
                  <div className="password-checklist">
                    <div className="checklist-title">Argon2id Complexity Policy</div>
                    {validations.map((v, i) => (
                      <div key={i} className={`checklist-item ${v.valid ? 'valid' : 'invalid'}`}>
                        {v.valid ? <Check size={12} className="check-icon" /> : <div className="dot-icon" />}
                        <span>{v.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 3. FORGOT PASSWORD */}
              {tab === 'forgot' && (
                <>
                  <div className="info-box">
                    Enter your registered email address. We will generate a secure, single-use reset token valid for 60 minutes.
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registered Account Email</label>
                    <div className="input-wrapper">
                      <Mail size={16} className="input-icon" />
                      <input
                        type="email"
                        className="auth-input"
                        placeholder="operator@netshield.ai"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="tab-switch-row">
                    <span>Already have a reset token?</span>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => switchTab('reset')}
                    >
                      Enter Token & Reset
                    </button>
                  </div>
                </>
              )}

              {/* 4. RESET PASSWORD */}
              {tab === 'reset' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Password Reset Token</label>
                    <div className="input-wrapper">
                      <Key size={16} className="input-icon" />
                      <input
                        type="text"
                        className="auth-input mono"
                        placeholder="Paste single-use token"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div className="input-wrapper">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Min 12 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="password-checklist">
                    {validations.map((v, i) => (
                      <div key={i} className={`checklist-item ${v.valid ? 'valid' : 'invalid'}`}>
                        {v.valid ? <Check size={12} className="check-icon" /> : <div className="dot-icon" />}
                        <span>{v.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div className="input-wrapper">
                      <Lock size={16} className="input-icon" />
                      <input
                        type="password"
                        className="auth-input"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 5. VERIFY EMAIL */}
              {tab === 'verify' && (
                <>
                  <div className="info-box">
                    Enter the single-use token dispatched to your email to verify your operator profile.
                  </div>
                  <div className="form-group">
                    <label className="form-label">Verification Token</label>
                    <div className="input-wrapper">
                      <Key size={16} className="input-icon" />
                      <input
                        type="text"
                        className="auth-input mono"
                        placeholder="Paste verification token"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="auth-primary-btn"
                disabled={
                  loading ||
                  (tab === 'register' && !isPasswordValid) ||
                  (tab === 'reset' && (!isPasswordValid || password !== confirmPassword))
                }
              >
                {loading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    <span>
                      {tab === 'login' && 'Sign In to Console'}
                      {tab === 'register' && 'Create Operator Account'}
                      {tab === 'forgot' && 'Send Password Reset Token'}
                      {tab === 'reset' && 'Confirm Password Reset'}
                      {tab === 'verify' && 'Verify Account'}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        .auth-modal-overlay {
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

        .auth-modal-card {
          width: 100%;
          max-width: 480px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalScale 0.15s ease-out;
        }

        @keyframes modalScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .auth-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-header);
        }

        .auth-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .auth-brand-icon {
          color: var(--accent-cyan);
        }

        .auth-close-btn {
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
        .auth-close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-panel);
        }

        .auth-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-header);
        }

        .auth-tab {
          flex: 1;
          padding: 10px 8px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .auth-tab:hover {
          color: var(--text-primary);
        }

        .auth-tab-active {
          color: var(--accent-cyan);
          border-bottom-color: var(--accent-cyan);
          background: var(--bg-surface);
        }

        .auth-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          font-size: 12px;
          margin: 14px 20px 0;
          border-radius: var(--radius-sm);
        }

        .auth-alert.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--accent-red);
        }

        .auth-alert.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: var(--accent-green);
        }

        .dev-token-box {
          background: rgba(34, 211, 238, 0.08);
          border: 1px dashed rgba(34, 211, 238, 0.3);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 11px;
          color: var(--accent-cyan);
          margin: 14px 20px 0;
          word-break: break-all;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dev-token-label {
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.05em;
        }

        .auth-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .info-box {
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-secondary);
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label-with-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .form-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .text-link {
          background: none;
          border: none;
          color: var(--accent-cyan);
          font-size: 11px;
          cursor: pointer;
          padding: 0;
        }
        .text-link:hover {
          text-decoration: underline;
        }

        .form-hint {
          font-size: 10px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .auth-input {
          width: 100%;
          height: 38px;
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 36px 0 36px;
          font-size: 13px;
          color: var(--text-primary);
          transition: border-color 0.15s;
        }

        .auth-input:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .toggle-pass-btn {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .password-checklist {
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
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
          gap: 6px;
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
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-muted);
          margin-left: 3px;
          margin-right: 4px;
        }

        .tab-switch-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .auth-primary-btn {
          height: 38px;
          background: var(--accent-cyan);
          border: 1px solid var(--accent-cyan);
          border-radius: var(--radius-sm);
          color: #0b0f19;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s;
          margin-top: 4px;
        }

        .auth-primary-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .auth-primary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .auth-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .auth-success-body {
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }

        .success-badge {
          color: var(--accent-green);
          margin-bottom: 4px;
        }

        .success-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .api-key-box {
          width: 100%;
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-top: 6px;
          text-align: left;
        }

        .api-key-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .api-key-value-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
        }

        .api-key-code {
          flex: 1;
          font-size: 12px;
          color: var(--accent-cyan);
          word-break: break-all;
        }

        .api-key-copy-btn {
          height: 26px;
          padding: 0 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .api-key-copy-btn:hover {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .margin-top {
          margin-top: 14px;
          width: 100%;
        }
      `}</style>
    </div>
  )
}
