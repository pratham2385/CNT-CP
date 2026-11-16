/**
 * Express Authentication Router — NetShield AI.
 *
 * Secure gateway bridging to Python FastAPI Authentication Engine:
 * - Argon2id hashing & 12+ char password complexity
 * - Case-insensitive unique emails/usernames
 * - Rate limiting and brute-force lockout
 * - HttpOnly session cookies & JWT access tokens
 * - Email verification & password reset single-use tokens
 * - User profile management & API key rotation
 *
 * @module routes/auth
 */

import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'netshield_ai_secure_jwt_secret_key_2026_super_safe';

/**
 * Middleware: Verify JWT Bearer Token in Authorization header or HttpOnly cookie.
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/netshield_access_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    req.user = payload;
    next();
  });
}

/**
 * Proxy helper: forwards auth requests to FastAPI engine on port 8000.
 */
async function proxyToFastApi(req, res, endpoint) {
  const targetUrl = `${req.pythonApiUrl || 'http://127.0.0.1:8000'}/api/auth${endpoint}`;
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      'User-Agent': req.headers['user-agent'] || 'NetShield-Gateway',
    };

    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }

    const resp = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      timeout: 15000,
      validateStatus: () => true, // Don't throw on 4xx/5xx, pass through
    });

    // Forward Set-Cookie headers from FastAPI
    const setCookie = resp.headers['set-cookie'];
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    return res.status(resp.status).json(resp.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      return res.status(503).json({ error: 'Authentication engine is currently starting or unavailable.' });
    }
    console.error(`[Auth Gateway Error] ${endpoint}:`, err.message);
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail || err.response?.data?.error || err.message;
    return res.status(status).json({ error: message });
  }
}

// ── Auth Endpoints (Forwarded to Python FastAPI Engine) ───────────

router.post('/register', (req, res) => proxyToFastApi(req, res, '/register'));
router.post('/login', (req, res) => proxyToFastApi(req, res, '/login'));
router.post('/logout', (req, res) => proxyToFastApi(req, res, '/logout'));
router.post('/refresh', (req, res) => proxyToFastApi(req, res, '/refresh'));
router.get('/me', (req, res) => proxyToFastApi(req, res, '/me'));
router.patch('/me', (req, res) => proxyToFastApi(req, res, '/me'));
router.put('/profile', (req, res) => proxyToFastApi(req, res, '/profile'));
router.post('/change-password', (req, res) => proxyToFastApi(req, res, '/change-password'));
router.post('/forgot-password', (req, res) => proxyToFastApi(req, res, '/forgot-password'));
router.post('/reset-password', (req, res) => proxyToFastApi(req, res, '/reset-password'));
router.post('/verify-email', (req, res) => proxyToFastApi(req, res, '/verify-email'));
router.post('/resend-verification', (req, res) => proxyToFastApi(req, res, '/resend-verification'));
router.post('/regenerate-api-key', (req, res) => proxyToFastApi(req, res, '/regenerate-api-key'));

export default router;
