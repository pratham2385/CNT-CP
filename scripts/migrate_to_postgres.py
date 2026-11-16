"""NetShield AI — SQLite to PostgreSQL Migration Tool.

Migrates all tables, schemas, constraints, indexes, and records from
the local SQLite database (netshield.db) into a PostgreSQL instance.

Usage:
    py scripts/migrate_to_postgres.py --password your_postgres_password
    py scripts/migrate_to_postgres.py --host localhost --port 5432 --user postgres --password mypass --dbname netshield_db
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from typing import Any

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("[ERROR] psycopg2-binary is not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate NetShield AI SQLite to PostgreSQL")
    parser.add_argument("--sqlite-path", default="python-engine/netshield.db", help="Path to SQLite db")
    parser.add_argument("--host", default="localhost", help="PostgreSQL host (default: localhost)")
    parser.add_argument("--port", type=int, default=5432, help="PostgreSQL port (default: 5432)")
    parser.add_argument("--user", default="postgres", help="PostgreSQL user (default: postgres)")
    parser.add_argument("--password", required=True, help="PostgreSQL superuser password")
    parser.add_argument("--dbname", default="netshield_db", help="Target PostgreSQL database name (default: netshield_db)")
    return parser.parse_args()


def ensure_target_database(args: argparse.Namespace) -> None:
    """Connect to default 'postgres' database to ensure the target database exists."""
    print(f"[*] Connecting to PostgreSQL at {args.host}:{args.port} as '{args.user}'...")
    try:
        conn = psycopg2.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            dbname="postgres",
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (args.dbname,))
        if not cur.fetchone():
            print(f"[+] Creating target database '{args.dbname}'...")
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(args.dbname)))
            print(f"[✓] Database '{args.dbname}' created successfully.")
        else:
            print(f"[i] Target database '{args.dbname}' already exists.")
            
        cur.close()
        conn.close()
    except Exception as exc:
        print(f"[!] Failed to connect to PostgreSQL: {exc}")
        print("\nMake sure your PostgreSQL Windows service is running:")
        print("  1. Press Win+R, type 'services.msc' and press Enter")
        print("  2. Locate 'postgresql-x64-18' and click 'Start'")
        print("  or in an Admin terminal: net start postgresql-x64-18")
        sys.exit(1)


def create_postgres_schema(pg_conn: psycopg2.extensions.connection) -> None:
    """Create all required tables, constraints, and indexes in PostgreSQL."""
    print("[*] Creating PostgreSQL schema and tables...")
    cur = pg_conn.cursor()

    cur.execute("""
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

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_attacks_ts ON attacks(timestamp_utc);
    CREATE INDEX IF NOT EXISTS idx_attacks_type ON attacks(attack_type);
    CREATE INDEX IF NOT EXISTS idx_attacks_src ON attacks(src_ip);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
    """)
    pg_conn.commit()
    cur.close()
    print("[✓] PostgreSQL schema initialized successfully.")


def migrate_table(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    table_name: str,
    columns: list[str],
) -> int:
    """Copy all records of a table from SQLite to PostgreSQL."""
    sq_cur = sqlite_conn.cursor()
    pg_cur = pg_conn.cursor()

    col_names = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    
    sq_cur.execute(f"SELECT {col_names} FROM {table_name}")
    rows = sq_cur.fetchall()
    
    if not rows:
        print(f"  [-] Table '{table_name}': 0 records in SQLite.")
        return 0

    insert_query = f"""
    INSERT INTO {table_name} ({col_names})
    VALUES ({placeholders})
    ON CONFLICT DO NOTHING
    """
    
    pg_cur.executemany(insert_query, rows)
    pg_conn.commit()

    # Sync PostgreSQL sequence so future auto-increment IDs do not collide
    if "id" in columns:
        try:
            pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name};")
            pg_conn.commit()
        except Exception:
            pass

    pg_cur.close()
    sq_cur.close()
    print(f"  [✓] Table '{table_name}': Migrated {len(rows)} records.")
    return len(rows)


def main() -> None:
    args = parse_args()
    print("=" * 65)
    print("  NetShield AI — SQLite to PostgreSQL Migration")
    print("=" * 65)

    if not os.path.exists(args.sqlite_path):
        print(f"[!] SQLite file '{args.sqlite_path}' does not exist.")
        sys.exit(1)

    # 1. Ensure target DB exists
    ensure_target_database(args)

    # 2. Connect to SQLite
    sqlite_conn = sqlite3.connect(args.sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    # 3. Connect to Target PostgreSQL
    pg_conn = psycopg2.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        dbname=args.dbname,
    )

    # 4. Initialize schema
    create_postgres_schema(pg_conn)

    print("\n[*] Migrating records from SQLite to PostgreSQL...")

    # 5. Migrate in proper dependency order (users first, then foreign key tables)
    migrate_table(
        sqlite_conn,
        pg_conn,
        "users",
        ["id", "username", "email", "password_hash", "role", "is_verified", "api_key", "created_at", "updated_at", "last_login"],
    )

    migrate_table(
        sqlite_conn,
        pg_conn,
        "refresh_tokens",
        ["id", "user_id", "token_hash", "user_agent", "ip_address", "expires_at", "created_at", "revoked_at"],
    )

    migrate_table(
        sqlite_conn,
        pg_conn,
        "auth_tokens",
        ["id", "user_id", "token_type", "token_hash", "expires_at", "used_at", "created_at"],
    )

    migrate_table(
        sqlite_conn,
        pg_conn,
        "attacks",
        ["id", "attack_type", "src_ip", "dst_ip", "src_port", "dst_port", "protocol", "confidence", "is_attack", "flow_id", "timestamp_utc"],
    )

    migrate_table(
        sqlite_conn,
        pg_conn,
        "traffic_stats",
        ["id", "total_packets", "normal_count", "attack_count", "timestamp_utc"],
    )

    # 6. Verify row counts
    print("\n[*] Verifying row counts in PostgreSQL:")
    pg_cur = pg_conn.cursor()
    for tbl in ["users", "attacks", "traffic_stats", "refresh_tokens", "auth_tokens"]:
        pg_cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        count = pg_cur.fetchone()[0]
        print(f"  • {tbl}: {count} rows")
    pg_cur.close()

    sqlite_conn.close()
    pg_conn.close()

    print("\n" + "=" * 65)
    print("  [SUCCESS] SQLite -> PostgreSQL Migration Complete!")
    print(f"  Database: postgresql://{args.user}:***@{args.host}:{args.port}/{args.dbname}")
    print("=" * 65)


if __name__ == "__main__":
    main()

