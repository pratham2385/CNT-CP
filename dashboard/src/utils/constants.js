/**
 * NetShield AI — Constants and configuration values.
 *
 * @module utils/constants
 */

/** Threat level to colour mapping (Instrument-grade calibrated palette). */
export const THREAT_COLORS = {
  SAFE: '#34d399',
  ELEVATED: '#fbbf24',
  CRITICAL: '#f87171',
}

/** Threat level to background colour mapping (with opacity). */
export const THREAT_BG_COLORS = {
  SAFE: 'rgba(52, 211, 153, 0.12)',
  ELEVATED: 'rgba(251, 191, 36, 0.12)',
  CRITICAL: 'rgba(248, 113, 113, 0.12)',
}

/** Attack type to colour mapping for telemetry charts and badges. */
export const ATTACK_COLORS = {
  DDoS: '#f87171',
  DoS: '#fb923c',
  PortScan: '#fbbf24',
  BruteForce: '#facc15',
  Bot: '#c084fc',
  WebAttack: '#f472b6',
  Infiltration: '#818cf8',
  Heartbleed: '#2dd4bf',
  BENIGN: '#34d399',
}

/** Protocol number to name mapping. */
export const PROTOCOL_MAP = {
  6: 'TCP',
  17: 'UDP',
  1: 'ICMP',
}

/** Fallback colour palette for unknown attack types. */
export const FALLBACK_COLOR = '#64748b'

/** Base URL for REST API (Node.js server). */
const NODE_URL = import.meta.env.VITE_NODE_URL || 'http://localhost:3001'

export const API_BASE_URL = NODE_URL

/** Socket.io connection URL. */
export const SOCKET_URL = NODE_URL

/** Static model accuracy from training metadata (for display). */
export const MODEL_ACCURACY = '99.92%'

/** Max items in the packet feed buffer. */
export const MAX_PACKET_FEED = 50

/** Max data points in the live traffic chart (rolling window in seconds). */
export const MAX_CHART_POINTS = 60

/** Interval for periodic stats refresh (ms). */
export const STATS_REFRESH_INTERVAL = 30000

/** Alert banner auto-dismiss time (ms). */
export const ALERT_DISMISS_MS = 10000
