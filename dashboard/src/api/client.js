/**
 * NetShield AI — Axios HTTP client and API functions.
 *
 * All REST calls go through the Node.js backend on port 3001.
 * No direct calls to the Python FastAPI server are made from the browser.
 *
 * @module api/client
 */

import axios from 'axios'
import { API_BASE_URL } from '../utils/constants.js'

/** Configured axios instance with default timeout and base URL. */
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Attach Bearer token to all outgoing requests if token exists in localStorage
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('netshield_auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle token refresh automatically on 401
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    // Don't loop refresh requests if auth endpoint itself returned 401
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url &&
      !originalRequest.url.includes('/api/auth/login') &&
      !originalRequest.url.includes('/api/auth/refresh') &&
      !originalRequest.url.includes('/api/auth/register')
    ) {
      originalRequest._retry = true
      try {
        const { data } = await client.post('/api/auth/refresh')
        if (data.token) {
          localStorage.setItem('netshield_auth_token', data.token)
          originalRequest.headers.Authorization = `Bearer ${data.token}`
        }
        return client(originalRequest)
      } catch (refreshErr) {
        localStorage.removeItem('netshield_auth_token')
        window.dispatchEvent(new CustomEvent('netshield_session_expired'))
        return Promise.reject(refreshErr)
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth API Functions ──────────────────────────────────────────

/** Register a new user account. */
export async function registerUser(username, email, password) {
  const { data } = await client.post('/api/auth/register', { username, email, password })
  return data
}

/** Log in to an existing account. */
export async function loginUser(identifier, password) {
  const { data } = await client.post('/api/auth/login', { identifier, password })
  return data
}

/** Log out and revoke active tokens. */
export async function logoutUser() {
  try {
    const { data } = await client.post('/api/auth/logout')
    return data
  } catch (err) {
    console.warn('[client] Logout endpoint call completed with notice:', err.message)
    return { status: 'ok' }
  }
}

/** Refresh the active access token using the HttpOnly refresh token. */
export async function refreshSession() {
  const { data } = await client.post('/api/auth/refresh')
  return data
}

/** Fetch current authenticated user profile. */
export async function fetchCurrentUser() {
  const { data } = await client.get('/api/auth/me')
  return data
}

/** Update profile info (username and/or email). */
export async function updateUserProfile({ username, email }) {
  const { data } = await client.patch('/api/auth/me', { username, email })
  return data
}

/** Change account password with old and new passwords. */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await client.post('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data
}

/** Request password reset email / single-use token. */
export async function forgotPassword(email) {
  const { data } = await client.post('/api/auth/forgot-password', { email })
  return data
}

/** Complete password reset using token and new password. */
export async function resetPassword(token, newPassword) {
  const { data } = await client.post('/api/auth/reset-password', {
    token,
    new_password: newPassword,
  })
  return data
}

/** Verify user email address with token. */
export async function verifyEmail(token) {
  const { data } = await client.post('/api/auth/verify-email', { token })
  return data
}

/** Resend verification email / token. */
export async function resendVerification(email) {
  const { data } = await client.post('/api/auth/resend-verification', { email })
  return data
}

/** Regenerate user API Key. */
export async function regenerateApiKey() {
  const { data } = await client.post('/api/auth/regenerate-api-key')
  return data
}

/**
 * Fetch the current system status.
 *
 * @returns {Promise<object>} Status response.
 */
export async function getStatus() {
  const { data } = await client.get('/api/status')
  return data
}

/**
 * Fetch aggregate statistics including attack distribution.
 *
 * @returns {Promise<object>} Stats response.
 */
export async function getStats() {
  const { data } = await client.get('/api/stats')
  return data
}

/**
 * Fetch paginated attack history.
 *
 * @param {number} [limit=50] - Max rows.
 * @param {number} [offset=0] - Pagination offset.
 * @param {string|null} [attackType=null] - Filter by attack type.
 * @returns {Promise<object>} { attacks, total, limit, offset }
 */
export async function getAttacks(limit = 50, offset = 0, attackType = null) {
  const params = { limit, offset }
  if (attackType && attackType !== 'All') {
    params.attack_type = attackType
  }
  const { data } = await client.get('/api/attacks', { params })
  return data
}

/**
 * Send a query to the Gemini-powered chatbot.
 *
 * @param {string} query - User's question.
 * @returns {Promise<string>} Chatbot response text.
 */
export async function sendChatbotQuery(query) {
  const { data } = await client.post('/api/chatbot', { query }, { timeout: 120000 })
  return data.response
}

/**
 * Check whether the Gemini chatbot is available (API key set + model loaded).
 *
 * @returns {Promise<object>} { available, model, api_key_configured }
 */
export async function getChatbotStatus() {
  const { data } = await client.get('/api/chatbot/status')
  return data
}

/**
 * Test all alert channels (Telegram, Email, Voice).
 *
 * @returns {Promise<object>} { telegram: {...}, email: {...}, voice: {...} }
 */
export async function testAlerts() {
  const { data } = await client.post('/api/alerts/test', {})
  return data
}

/**
 * Get alert channel configuration status.
 *
 * @returns {Promise<object>} { channels: { telegram, email, voice } }
 */
export async function getAlertStatus() {
  const { data } = await client.get('/api/alerts/status')
  return data
}

/**
 * Trigger PDF report generation.
 *
 * @returns {Promise<object>} { path, filename }
 */
export async function generateReport() {
  const { data } = await client.post('/api/reports', {})
  return data
}

/**
 * Check Node.js backend health.
 *
 * @returns {Promise<object>} Health response.
 */
export async function getNodeHealth() {
  const { data } = await client.get('/api/node-health')
  return data
}

/**
 * Reset all database records and clear packet/attack counts to 0.
 *
 * @returns {Promise<object>} Reset response.
 */
export async function resetSessionData() {
  const { data } = await client.post('/api/reset', {})
  return data
}

/**
 * Trigger an attack simulation through the backend pipeline.
 *
 * @param {string} [attackType='DDoS'] - e.g. 'DDoS', 'PortScan', 'BruteForce', 'DoS', 'Bot', 'WebAttack'
 * @param {number} [count=20] - Number of flows to inject
 * @param {number} [delayMs=10] - Delay between flows in milliseconds
 * @returns {Promise<object>}
 */
export async function simulateAttack(attackType = 'DDoS', count = 20, delayMs = 10) {
  const { data } = await client.post('/api/simulate', {
    attack_type: attackType,
    count,
    delay_ms: delayMs,
  })
  return data
}

/**
 * Fetch database engine diagnostics, table counts, and storage metrics.
 *
 * @returns {Promise<object>}
 */
export async function fetchDbStatus() {
  const { data } = await client.get('/api/db/status')
  return data
}

