"""Database layer for NetShield AI supporting both SQLite and PostgreSQL.

Thread-safe wrapper that logs predictions, queries attack history,
manages user authentication, and computes summary statistics.

Supports:
- PostgreSQL 18 (via psycopg2) when DATABASE_URL is configured
- SQLite 3 (via sqlite3) as zero-configuration local fallback
"""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import threading
import time
import urllib.parse
from typing import Any, Optional

try:
    import psycopg2
    import psycopg2.extras
    _HAS_PSYCOPG2 = True
except ImportError:
    _HAS_PSYCOPG2 = False

from prediction.schemas import PredictionResult

logger = logging.getLogger("netshield")

_THREAT_SAFE: int = 0
_THREAT_ELEVATED_THRESHOLD: int = 1
_THREAT_CRITICAL_THRESHOLD: int = 6
_WINDOW_SECONDS: float = 60.0


class Database:
    """Thread-safe database layer supporting both SQLite and PostgreSQL.

    Args:
        db_path: Filesystem path to the SQLite database (fallback).
        database_url: Optional PostgreSQL connection URL.
    """

    def __init__(self, db_path: str, database_url: Optional[str] = None) -> None:
        self._db_path = db_path
        self._database_url = (database_url or "").strip()
        self._lock = threading.RLock()
        self.is_postgres: bool = False
        self._pg_params: dict[str, Any] = {}

        # 1. Attempt PostgreSQL connection if DATABASE_URL is provided
        if self._database_url and self._database_url.startswith(("postgres://", "postgresql://")):
            if _HAS_PSYCOPG2:
                try:
                    self._pg_params = self._parse_postgres_url(self._database_url)
                    self._conn = psycopg2.connect(**self._pg_params)
                    self._conn.autocommit = False
                    self.is_postgres = True
                    logger.info(
                        "Connected to PostgreSQL database '%s' at %s:%s",
                        self._pg_params.get("dbname"),
                        self._pg_params.get("host"),
                        self._pg_params.get("port"),
                    )
                except Exception as exc:
                    logger.warning(
                        "PostgreSQL connection to '%s' failed (%s). Falling back to SQLite.",
                        self._database_url,
                        exc,
                    )
                    self.is_postgres = False
            else:
                logger.warning("psycopg2 is not installed. Falling back to SQLite.")
                self.is_postgres = False

        # 2. SQLite Fallback
        if not self.is_postgres:
            parent = os.path.dirname(db_path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            self._conn = sqlite3.connect(db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            logger.info("Connected to local SQLite database: %s", db_path)

        # 3. Ensure schema exists (preserves existing data)
        self._init_tables()

    @staticmethod
    def _parse_postgres_url(url: str) -> dict[str, Any]:
        """Parse PostgreSQL connection URL safely, supporting special characters in passwords."""
        # Matches: postgresql://user:password@host:port/dbname (handles '@' inside password)
        pattern = r"^(?:postgresql|postgres)://([^:]+):(.+)@([^:/]+)(?::(\d+))?/(.+)$"
        match = re.match(pattern, url.strip())
        if match:
            user, password, host, port, dbname = match.groups()
            return {
                "user": user,
                "password": password,
                "host": host,
                "port": int(port) if port else 5432,
                "dbname": dbname,
            }
        parsed = urllib.parse.urlparse(url)
        return {
            "user": parsed.username or "postgres",
            "password": parsed.password or "",
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 5432,
            "dbname": parsed.path.lstrip("/") or "netshield_db",
        }

    # ------------------------------------------------------------------
    # Query Execution Helper
    # ------------------------------------------------------------------

    def _execute(self, query: str, params: tuple = ()) -> Any:
        """Execute a query uniformly across PostgreSQL (%s) and SQLite (?)."""
        if self.is_postgres:
            pg_query = query.replace("?", "%s")
            cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            try:
                cur.execute(pg_query, params)
                return cur
            except Exception:
                try:
                    self._conn.rollback()
                except Exception:
                    pass
                raise
        else:
            return self._conn.execute(query, params)

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_tables(self) -> None:
        """Create tables and indexes if they do not exist. Preserves existing data."""
        with self._lock:
            if self.is_postgres:
                cur = self._conn.cursor()
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(64) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role VARCHAR(32) NOT NULL DEFAULT 'analyst',
                        is_verified INT NOT NULL DEFAULT 0,
                        api_key VARCHAR(128) UNIQUE NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        updated_at DOUBLE PRECISION NOT NULL,
                        last_login DOUBLE PRECISION
                    );

                    CREATE TABLE IF NOT EXISTS attacks (
                        id SERIAL PRIMARY KEY,
                        attack_type VARCHAR(64) NOT NULL,
                        src_ip VARCHAR(64) NOT NULL,
                        dst_ip VARCHAR(64) NOT NULL,
                        src_port INT NOT NULL,
                        dst_port INT NOT NULL,
                        protocol INT NOT NULL,
                        confidence DOUBLE PRECISION NOT NULL,
                        is_attack INT NOT NULL,
                        flow_id TEXT,
                        timestamp_utc DOUBLE PRECISION NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS traffic_stats (
                        id SERIAL PRIMARY KEY,
                        total_packets INT NOT NULL,
                        normal_count INT NOT NULL,
                        attack_count INT NOT NULL,
                        timestamp_utc DOUBLE PRECISION NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        token_hash VARCHAR(128) UNIQUE NOT NULL,
                        user_agent TEXT,
                        ip_address VARCHAR(64),
                        expires_at DOUBLE PRECISION NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        revoked_at DOUBLE PRECISION
                    );

                    CREATE TABLE IF NOT EXISTS auth_tokens (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        token_type VARCHAR(32) NOT NULL,
                        token_hash VARCHAR(128) UNIQUE NOT NULL,
                        expires_at DOUBLE PRECISION NOT NULL,
                        used_at DOUBLE PRECISION,
                        created_at DOUBLE PRECISION NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_attacks_ts ON attacks(timestamp_utc);
                    CREATE INDEX IF NOT EXISTS idx_attacks_type ON attacks(attack_type);
                    CREATE INDEX IF NOT EXISTS idx_attacks_src ON attacks(src_ip);
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
                    CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
                    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
                    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
                    """
                )
                self._conn.commit()
                cur.close()
            else:
                self._conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS attacks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        attack_type TEXT NOT NULL,
                        src_ip TEXT NOT NULL,
                        dst_ip TEXT NOT NULL,
                        src_port INTEGER NOT NULL,
                        dst_port INTEGER NOT NULL,
                        protocol INTEGER NOT NULL,
                        confidence REAL NOT NULL,
                        is_attack INTEGER NOT NULL,
                        flow_id TEXT,
                        timestamp_utc REAL NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS traffic_stats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        total_packets INTEGER NOT NULL,
                        normal_count INTEGER NOT NULL,
                        attack_count INTEGER NOT NULL,
                        timestamp_utc REAL NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT COLLATE NOCASE UNIQUE NOT NULL,
                        email TEXT COLLATE NOCASE UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'analyst',
                        is_verified INTEGER NOT NULL DEFAULT 0,
                        api_key TEXT UNIQUE NOT NULL,
                        created_at REAL NOT NULL,
                        updated_at REAL NOT NULL,
                        last_login REAL
                    );

                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token_hash TEXT UNIQUE NOT NULL,
                        user_agent TEXT,
                        ip_address TEXT,
                        expires_at REAL NOT NULL,
                        created_at REAL NOT NULL,
                        revoked_at REAL,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS auth_tokens (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token_type TEXT NOT NULL,
                        token_hash TEXT UNIQUE NOT NULL,
                        expires_at REAL NOT NULL,
                        used_at REAL,
                        created_at REAL NOT NULL,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_attacks_ts
                        ON attacks(timestamp_utc);
                    CREATE INDEX IF NOT EXISTS idx_attacks_type
                        ON attacks(attack_type);
                    CREATE INDEX IF NOT EXISTS idx_attacks_src
                        ON attacks(src_ip);
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase
                        ON users(email COLLATE NOCASE);
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
                        ON users(username COLLATE NOCASE);
                    CREATE INDEX IF NOT EXISTS idx_users_api_key
                        ON users(api_key);
                    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
                        ON refresh_tokens(token_hash);
                    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash
                        ON auth_tokens(token_hash);
                    """
                )
                self._conn.commit()

    def clear_all_data(self) -> None:
        """Clear all stored attacks and traffic stats from the database."""
        with self._lock:
            if self.is_postgres:
                cur = self._execute("DELETE FROM attacks; DELETE FROM traffic_stats;")
                self._conn.commit()
                cur.close()
            else:
                self._conn.executescript(
                    """
                    DELETE FROM attacks;
                    DELETE FROM traffic_stats;
                    """
                )
                self._conn.commit()
                self._conn.execute("VACUUM;")

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    def log_prediction(self, result: PredictionResult) -> None:
        """Insert one prediction result into the database."""
        ctx = result.context
        src_ip = ctx.src_ip if ctx else ""
        dst_ip = ctx.dst_ip if ctx else ""
        src_port = ctx.src_port if ctx else 0
        dst_port = ctx.dst_port if ctx else 0
        protocol = ctx.protocol if ctx else 0
        flow_id = ctx.flow_id if ctx else ""

        with self._lock:
            self._execute(
                """
                INSERT INTO attacks
                    (attack_type, src_ip, dst_ip, src_port, dst_port,
                     protocol, confidence, is_attack, flow_id, timestamp_utc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.label,
                    src_ip,
                    dst_ip,
                    src_port,
                    dst_port,
                    protocol,
                    result.confidence,
                    1 if result.is_attack else 0,
                    flow_id,
                    result.timestamp_utc,
                ),
            )
            self._conn.commit()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_attacks(
        self,
        limit: int = 50,
        offset: int = 0,
        attack_type: Optional[str] = None,
        only_attacks: bool = False,
    ) -> list[dict[str, Any]]:
        """Return paginated attack/prediction records."""
        with self._lock:
            if attack_type and attack_type != "All":
                cur = self._execute(
                    """
                    SELECT * FROM attacks
                    WHERE attack_type = ?
                    ORDER BY timestamp_utc DESC
                    LIMIT ? OFFSET ?
                    """,
                    (attack_type, limit, offset),
                )
            elif only_attacks:
                cur = self._execute(
                    """
                    SELECT * FROM attacks
                    WHERE is_attack = 1
                    ORDER BY timestamp_utc DESC
                    LIMIT ? OFFSET ?
                    """,
                    (limit, offset),
                )
            else:
                cur = self._execute(
                    """
                    SELECT * FROM attacks
                    ORDER BY timestamp_utc DESC
                    LIMIT ? OFFSET ?
                    """,
                    (limit, offset),
                )
            rows = cur.fetchall()
        return [dict(r) for r in rows]

    def get_attack_count(
        self,
        attack_type: Optional[str] = None,
        only_attacks: bool = True,
    ) -> int:
        """Return total count of attacks matching the criteria."""
        with self._lock:
            if attack_type and attack_type != "All":
                cur = self._execute(
                    "SELECT COUNT(*) AS c FROM attacks WHERE attack_type = ?",
                    (attack_type,),
                )
            elif only_attacks:
                cur = self._execute(
                    "SELECT COUNT(*) AS c FROM attacks WHERE is_attack = 1"
                )
            else:
                cur = self._execute(
                    "SELECT COUNT(*) AS c FROM attacks"
                )
            row = cur.fetchone()
            return int(row["c"]) if row else 0

    def get_stats(self) -> dict[str, Any]:
        """Return aggregate statistics and attack-type distribution."""
        with self._lock:
            cur = self._execute("SELECT COUNT(*) AS c FROM attacks")
            total = cur.fetchone()["c"]

            cur = self._execute("SELECT COUNT(*) AS c FROM attacks WHERE is_attack = 0")
            normal = cur.fetchone()["c"]

            cur = self._execute("SELECT COUNT(*) AS c FROM attacks WHERE is_attack = 1")
            attacks = cur.fetchone()["c"]

            cur = self._execute(
                """
                SELECT attack_type, COUNT(*) AS cnt
                FROM attacks
                WHERE is_attack = 1
                GROUP BY attack_type
                ORDER BY cnt DESC
                """
            )
            distribution = [
                {"attack_type": r["attack_type"], "count": r["cnt"]}
                for r in cur.fetchall()
            ]

        return {
            "total": total,
            "normal": normal,
            "attacks": attacks,
            "attack_distribution": distribution,
        }

    def get_attack_summary(self) -> list[dict[str, Any]]:
        """Return per-attack-type summary with counts and percentages."""
        with self._lock:
            cur = self._execute(
                """
                SELECT attack_type, COUNT(*) AS cnt
                FROM attacks WHERE is_attack = 1
                GROUP BY attack_type
                ORDER BY cnt DESC
                """
            )
            rows = cur.fetchall()
            total = sum(r["cnt"] for r in rows)

        result: list[dict[str, Any]] = []
        for r in rows:
            pct = (r["cnt"] / total * 100) if total > 0 else 0.0
            result.append(
                {
                    "attack_type": r["attack_type"],
                    "count": r["cnt"],
                    "percentage": round(pct, 2),
                }
            )
        return result

    def get_top_attackers(self, limit: int = 10) -> list[dict[str, Any]]:
        """Return top attacker IPs by frequency."""
        with self._lock:
            cur = self._execute(
                """
                SELECT src_ip, COUNT(*) AS cnt
                FROM attacks WHERE is_attack = 1
                GROUP BY src_ip
                ORDER BY cnt DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [{"src_ip": r["src_ip"], "count": r["cnt"]} for r in rows]

    def get_recent_predictions(self, limit: int = 10) -> list[dict[str, Any]]:
        """Return the most recent prediction records."""
        with self._lock:
            cur = self._execute(
                """
                SELECT * FROM attacks
                ORDER BY timestamp_utc DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]

    def get_threat_level(self) -> str:
        """Return the current threat level based on attacks in the last 60s."""
        cutoff = time.time() - _WINDOW_SECONDS
        with self._lock:
            cur = self._execute(
                """
                SELECT COUNT(*) AS c FROM attacks
                WHERE is_attack = 1 AND timestamp_utc >= ?
                """,
                (cutoff,),
            )
            count = cur.fetchone()["c"]
        if count >= _THREAT_CRITICAL_THRESHOLD:
            return "CRITICAL"
        if count >= _THREAT_ELEVATED_THRESHOLD:
            return "ELEVATED"
        return "SAFE"

    def get_db_info(self) -> dict[str, Any]:
        """Return diagnostic metrics about the active database and storage."""
        with self._lock:
            cur = self._execute("SELECT COUNT(*) AS c FROM attacks")
            total_attacks = cur.fetchone()["c"]

            cur = self._execute("SELECT COUNT(*) AS c FROM attacks WHERE is_attack = 1")
            malicious_attacks = cur.fetchone()["c"]

            cur = self._execute("SELECT COUNT(*) AS c FROM users")
            user_count = cur.fetchone()["c"]

            if self.is_postgres:
                dbname = self._pg_params.get("dbname", "netshield_db")
                try:
                    cur = self._execute("SELECT pg_database_size(?);", (dbname,))
                    size_row = cur.fetchone()
                    size_bytes = list(size_row.values())[0] if size_row else 0
                except Exception:
                    size_bytes = 0

                size_formatted = (
                    f"{size_bytes / 1024:.1f} KB"
                    if size_bytes < 1048576
                    else f"{size_bytes / 1048576:.2f} MB"
                )

                try:
                    cur = self._execute("SELECT version();")
                    ver_row = cur.fetchone()
                    ver_text = list(ver_row.values())[0] if ver_row else "PostgreSQL 18"
                    engine_name = "PostgreSQL 18" if "18" in ver_text else "PostgreSQL"
                except Exception:
                    engine_name = "PostgreSQL"

                return {
                    "engine": engine_name,
                    "db_path": f"{self._pg_params.get('host', 'localhost')}:{self._pg_params.get('port', 5432)}/{dbname}",
                    "filename": f"{dbname} (PostgreSQL)",
                    "size_bytes": size_bytes,
                    "size_formatted": size_formatted,
                    "journal_mode": "WAL (Write-Ahead Logging)",
                    "page_size": 8192,
                    "page_count": size_bytes // 8192 if size_bytes else 0,
                    "tables": {
                        "attacks": total_attacks,
                        "malicious_events": malicious_attacks,
                        "users": user_count,
                        "traffic_stats": "Active",
                        "refresh_tokens": "Active",
                        "auth_tokens": "Active",
                    },
                    "indexes": [
                        "idx_attacks_ts (timestamp_utc)",
                        "idx_attacks_type (attack_type)",
                        "idx_attacks_src (src_ip)",
                        "idx_users_email_lower (email)",
                        "idx_users_username_lower (username)",
                    ],
                    "concurrency": "Enterprise Multi-Connection ACID Pool",
                    "status": "HEALTHY",
                }
            else:
                size_bytes = 0
                if os.path.exists(self._db_path):
                    try:
                        size_bytes = os.path.getsize(self._db_path)
                    except OSError:
                        size_bytes = 0

                cur = self._conn.cursor()
                cur.execute("PRAGMA journal_mode;")
                journal_row = cur.fetchone()
                journal_mode = journal_row[0] if journal_row else "delete"

                cur.execute("PRAGMA page_size;")
                page_size_row = cur.fetchone()
                page_size = page_size_row[0] if page_size_row else 4096

                cur.execute("PRAGMA page_count;")
                page_count_row = cur.fetchone()
                page_count = page_count_row[0] if page_count_row else 0

                size_formatted = (
                    f"{size_bytes / 1024:.1f} KB"
                    if size_bytes < 1048576
                    else f"{size_bytes / 1048576:.2f} MB"
                )

                return {
                    "engine": "SQLite 3",
                    "db_path": self._db_path,
                    "filename": os.path.basename(self._db_path),
                    "size_bytes": size_bytes,
                    "size_formatted": size_formatted,
                    "journal_mode": str(journal_mode).upper(),
                    "page_size": page_size,
                    "page_count": page_count,
                    "tables": {
                        "attacks": total_attacks,
                        "malicious_events": malicious_attacks,
                        "users": user_count,
                        "traffic_stats": "Active",
                        "refresh_tokens": "Active",
                        "auth_tokens": "Active",
                    },
                    "indexes": [
                        "idx_attacks_ts (timestamp_utc)",
                        "idx_attacks_type (attack_type)",
                        "idx_attacks_src (src_ip)",
                        "idx_users_email_nocase (email)",
                        "idx_users_username_nocase (username)",
                    ],
                    "concurrency": "Thread-safe RLock (WAL / In-Process Synchronized)",
                    "status": "HEALTHY",
                }

    # ------------------------------------------------------------------
    # User Authentication & Management
    # ------------------------------------------------------------------

    def create_user(
        self,
        username: str,
        email: str,
        password_hash: str,
        role: str = "analyst",
        is_verified: bool = False,
        api_key: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a new user account with case-insensitive unique username and email."""
        now = time.time()
        with self._lock:
            if self.is_postgres:
                cur = self._execute(
                    """
                    INSERT INTO users (
                        username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id
                    """,
                    (
                        username.strip(),
                        email.strip().lower(),
                        password_hash,
                        role.lower(),
                        1 if is_verified else 0,
                        api_key,
                        now,
                        now,
                        now,
                    ),
                )
                user_id = cur.fetchone()["id"]
                self._conn.commit()
            else:
                cur = self._conn.execute(
                    """
                    INSERT INTO users (
                        username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        username.strip(),
                        email.strip().lower(),
                        password_hash,
                        role.lower(),
                        1 if is_verified else 0,
                        api_key,
                        now,
                        now,
                        now,
                    ),
                )
                self._conn.commit()
                user_id = cur.lastrowid

            user = self.get_user_by_id(user_id)
            if not user:
                raise RuntimeError("Failed to retrieve created user")
            return user

    def get_user_by_id(self, user_id: int) -> Optional[dict[str, Any]]:
        """Find user by primary key ID."""
        with self._lock:
            cur = self._execute(
                """
                SELECT id, username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                FROM users WHERE id = ?
                """,
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[dict[str, Any]]:
        """Find user by email address (case-insensitive)."""
        with self._lock:
            cur = self._execute(
                """
                SELECT id, username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                FROM users WHERE LOWER(email) = LOWER(?)
                """,
                (email.strip(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_username(self, username: str) -> Optional[dict[str, Any]]:
        """Find user by username (case-insensitive)."""
        with self._lock:
            cur = self._execute(
                """
                SELECT id, username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                FROM users WHERE LOWER(username) = LOWER(?)
                """,
                (username.strip(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_identifier(self, identifier: str) -> Optional[dict[str, Any]]:
        """Find user by either username or email (case-insensitive)."""
        clean = identifier.strip()
        with self._lock:
            cur = self._execute(
                """
                SELECT id, username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
                """,
                (clean, clean),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_api_key(self, api_key: str) -> Optional[dict[str, Any]]:
        """Find user by Agent API key."""
        with self._lock:
            cur = self._execute(
                """
                SELECT id, username, email, password_hash, role, is_verified, api_key, created_at, updated_at, last_login
                FROM users WHERE api_key = ?
                """,
                (api_key.strip(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def count_users(self) -> int:
        """Return total number of registered users."""
        with self._lock:
            cur = self._execute("SELECT COUNT(*) AS c FROM users")
            return cur.fetchone()["c"]

    def update_user_last_login(self, user_id: int) -> None:
        """Update last login timestamp for a user."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?",
                (now, now, user_id),
            )
            self._conn.commit()

    def update_user_password(self, user_id: int, password_hash: str) -> None:
        """Update user password hash and revoke other active sessions."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (password_hash, now, user_id),
            )
            self._conn.commit()

    def update_user_profile(
        self,
        user_id: int,
        username: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Update user display profile (username or email)."""
        user = self.get_user_by_id(user_id)
        if not user:
            return None

        new_username = username.strip() if username else user["username"]
        new_email = email.strip().lower() if email else user["email"]
        now = time.time()

        with self._lock:
            self._execute(
                """
                UPDATE users
                SET username = ?, email = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_username, new_email, now, user_id),
            )
            self._conn.commit()

        return self.get_user_by_id(user_id)

    def update_user_api_key(self, user_id: int, new_api_key: str) -> str:
        """Rotate user Agent API key."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE users SET api_key = ?, updated_at = ? WHERE id = ?",
                (new_api_key, now, user_id),
            )
            self._conn.commit()
        return new_api_key

    def set_user_verified(self, user_id: int, is_verified: bool = True) -> None:
        """Mark user email as verified."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE users SET is_verified = ?, updated_at = ? WHERE id = ?",
                (1 if is_verified else 0, now, user_id),
            )
            self._conn.commit()

    # ── Refresh Token Management ─────────────────────────────────────

    def store_refresh_token(
        self,
        user_id: int,
        token_hash: str,
        user_agent: Optional[str],
        ip_address: Optional[str],
        expires_at: float,
    ) -> None:
        """Store a SHA-256 hashed refresh token in the database."""
        now = time.time()
        with self._lock:
            self._execute(
                """
                INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, token_hash, user_agent, ip_address, expires_at, now),
            )
            self._conn.commit()

    def get_valid_refresh_token(self, token_hash: str) -> Optional[dict[str, Any]]:
        """Look up a valid, unexpired, non-revoked refresh token."""
        now = time.time()
        with self._lock:
            cur = self._execute(
                """
                SELECT id, user_id, token_hash, user_agent, ip_address, expires_at, created_at, revoked_at
                FROM refresh_tokens
                WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
                """,
                (token_hash, now),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def revoke_refresh_token(self, token_hash: str) -> None:
        """Revoke a single refresh token on logout."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?",
                (now, token_hash),
            )
            self._conn.commit()

    def revoke_all_user_refresh_tokens(self, user_id: int) -> None:
        """Revoke all active refresh tokens for a user (e.g. after password change)."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                (now, user_id),
            )
            self._conn.commit()

    # ── Auth Tokens (Verification & Password Reset) ──────────────────

    def create_auth_token(
        self,
        user_id: int,
        token_type: str,
        token_hash: str,
        expires_at: float,
    ) -> None:
        """Store a single-use verification or password reset token hash."""
        now = time.time()
        with self._lock:
            self._execute(
                """
                INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, token_type, token_hash, expires_at, now),
            )
            self._conn.commit()

    def get_valid_auth_token(self, token_type: str, token_hash: str) -> Optional[dict[str, Any]]:
        """Retrieve a valid, unexpired, unused token."""
        now = time.time()
        with self._lock:
            cur = self._execute(
                """
                SELECT id, user_id, token_type, token_hash, expires_at, used_at, created_at
                FROM auth_tokens
                WHERE token_type = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?
                """,
                (token_type, token_hash, now),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def consume_auth_token(self, token_hash: str) -> None:
        """Mark a single-use token as used."""
        now = time.time()
        with self._lock:
            self._execute(
                "UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?",
                (now, token_hash),
            )
            self._conn.commit()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the database connection."""
        with self._lock:
            self._conn.close()
