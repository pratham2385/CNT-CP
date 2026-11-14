/**
 * NetShield AI — Formatting utility functions.
 *
 * @module utils/format
 */

/**
 * Parse a timestamp into a valid Date object.
 * Supports seconds, milliseconds, numeric strings, and ISO strings.
 *
 * @param {number|string|Date} ts - Input timestamp.
 * @returns {Date|null} Date object or null if invalid.
 */
export function parseTimestamp(ts) {
  if (ts === null || ts === undefined || ts === '') return null
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts

  if (typeof ts === 'number') {
    if (isNaN(ts) || ts <= 0) return null
    // If greater than 1e11, it's already in milliseconds (e.g. 1731600000000); otherwise seconds
    return new Date(ts > 1e11 ? ts : ts * 1000)
  }

  if (typeof ts === 'string') {
    const num = Number(ts)
    if (!isNaN(num) && num > 0) {
      return new Date(num > 1e11 ? num : num * 1000)
    }
    const parsed = new Date(ts)
    if (!isNaN(parsed.getTime())) return parsed
  }

  return null
}

/**
 * Format a timestamp to real-time local clock "HH:MM:SS".
 * Uses real local time of the user's system.
 *
 * @param {number|string|Date} ts - Timestamp in seconds or milliseconds.
 * @returns {string} Formatted local time string, e.g. "19:04:12".
 */
export function formatTime(ts) {
  const d = parseTimestamp(ts)
  if (!d) return '--:--:--'
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Format a timestamp to a full real-time date-time string in local timezone.
 *
 * @param {number|string|Date} ts - Timestamp in seconds or milliseconds.
 * @returns {string} Formatted date-time string, e.g. "14/11/2026, 19:04:12".
 */
export function formatDateTime(ts) {
  const d = parseTimestamp(ts)
  if (!d) return 'N/A'
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Format a number with thousands separators.
 *
 * @param {number} n - The number to format.
 * @returns {string} Number with commas, e.g. "1,234,567".
 */
export function formatNumber(n) {
  if (n === null || n === undefined || typeof n !== 'number') return '0'
  return n.toLocaleString('en-US')
}

/**
 * Format a confidence float as a percentage string.
 *
 * @param {number} c - Confidence value (0–1).
 * @returns {string} Percentage string, e.g. "95.43%".
 */
export function formatConfidence(c) {
  if (c === null || c === undefined || typeof c !== 'number') return '0.00%'
  return (c * 100).toFixed(2) + '%'
}

/**
 * Map a protocol number to its name.
 *
 * @param {number} p - Protocol number.
 * @returns {string} Protocol name.
 */
export function protocolName(p) {
  const map = { 6: 'TCP', 17: 'UDP', 1: 'ICMP' }
  return map[p] || `Proto-${p || '?'}`
}

/**
 * Truncate a string to a max length with ellipsis.
 *
 * @param {string} str - The string to truncate.
 * @param {number} maxLen - Maximum length.
 * @returns {string} Truncated string.
 */
export function truncateStr(str, maxLen) {
  if (!str || typeof str !== 'string') return ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 1) + '…'
}

/**
 * Format flow duration from microseconds to a human-readable string.
 *
 * @param {number} us - Duration in microseconds.
 * @returns {string} Human-readable duration.
 */
export function formatDuration(us) {
  if (!us || typeof us !== 'number' || us <= 0) return '0 μs'
  if (us < 1000) return `${Math.round(us)} μs`
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)} ms`
  return `${(us / 1_000_000).toFixed(2)} s`
}

/**
 * Format an IP:port pair for display.
 *
 * @param {string} ip - IP address.
 * @param {number} port - Port number.
 * @returns {string} "ip:port" string.
 */
export function formatEndpoint(ip, port) {
  if (!ip) return 'unknown'
  return port ? `${ip}:${port}` : ip
}
