"""NetShield AI — Login Rate Limiter and Brute-Force Protection.

Enforces a 5-failed-attempts limit per 15 minutes per IP or identifier.
Protects against automated credential stuffing and dictionary attacks.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Tuple

logger = logging.getLogger(__name__)

# Rate limiting parameters
MAX_ATTEMPTS: int = 5
WINDOW_SECONDS: float = 15 * 60.0  # 15 minutes
LOCKOUT_SECONDS: float = 15 * 60.0  # 15 minutes lockout


class AuthRateLimiter:
    """Thread-safe rate limiter tracking failed authentication attempts."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Structure: { key: { "attempts": int, "first_attempt": float, "locked_until": float } }
        self._records: dict[str, dict[str, float]] = {}

    def is_locked(self, key: str) -> Tuple[bool, int]:
        """Check if a key is currently locked out.

        Args:
            key: Rate limit key, e.g. "ip:192.168.1.5" or "user:analyst".

        Returns:
            (is_locked: bool, remaining_seconds: int)
        """
        now = time.time()
        with self._lock:
            record = self._records.get(key)
            if not record:
                return False, 0

            locked_until = record.get("locked_until", 0.0)
            if locked_until > now:
                remaining = int(locked_until - now)
                return True, max(1, remaining)

            # Check if window expired
            first_attempt = record.get("first_attempt", 0.0)
            if now - first_attempt > WINDOW_SECONDS:
                del self._records[key]
                return False, 0

            return False, 0

    def record_failure(self, key: str) -> Tuple[bool, int, int]:
        """Record a failed login attempt for a key.

        Args:
            key: Rate limit key.

        Returns:
            (is_locked_now: bool, remaining_lock_seconds: int, total_attempts: int)
        """
        now = time.time()
        with self._lock:
            record = self._records.get(key)
            if not record or (now - record.get("first_attempt", 0.0) > WINDOW_SECONDS):
                record = {
                    "attempts": 1,
                    "first_attempt": now,
                    "locked_until": 0.0,
                }
                self._records[key] = record
                return False, 0, 1

            record["attempts"] = int(record["attempts"]) + 1
            attempts = record["attempts"]

            if attempts >= MAX_ATTEMPTS:
                locked_until = now + LOCKOUT_SECONDS
                record["locked_until"] = locked_until
                logger.warning(
                    "Rate limit exceeded for '%s' (%d attempts). Locked for %d seconds.",
                    key,
                    attempts,
                    LOCKOUT_SECONDS,
                )
                return True, int(LOCKOUT_SECONDS), attempts

            return False, 0, attempts

    def reset(self, key: str) -> None:
        """Reset failed attempt counters upon successful login."""
        with self._lock:
            if key in self._records:
                del self._records[key]


# Global rate limiter singleton
rate_limiter = AuthRateLimiter()

