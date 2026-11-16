# 🐘 NetShield AI — PostgreSQL Migration Guide

This step-by-step guide explains how to shift your NetShield AI database from **SQLite** to **PostgreSQL**.

---

## 🔍 System Detection Summary
We inspected your laptop and found:
- **PostgreSQL Version**: PostgreSQL 18 (64-bit)
- **Install Path**: `C:\Program Files\PostgreSQL\18\bin`
- **Windows Service Name**: `postgresql-x64-18` (currently `STOPPED`)
- **Default Port**: `5432`
- **Default Superuser**: `postgres`
- **Python Driver**: `psycopg2-binary` (Already installed in your virtual environment ✅)

---

## 🚀 3-Step Quick Migration

### Step 1: Start the PostgreSQL Windows Service
Because Windows services require administrator permission, start the service using either of these two methods:

#### Method A: Using Windows Services (Easiest)
1. Press `Win + R` on your keyboard to open the Run box.
2. Type `services.msc` and press **Enter**.
3. Scroll down and locate **`postgresql-x64-18`**.
4. Right-click on it and select **Start**.
   *(Optional: Right-click -> Properties -> set Startup Type to **Automatic** so it always starts with Windows).*

#### Method B: Using PowerShell as Administrator
Open **PowerShell as Administrator** (Right-click Start button -> *Terminal (Admin)* or *PowerShell (Admin)*) and run:
```powershell
net start postgresql-x64-18
```

---

### Step 2: Run the Automated Migration Script
We have created an automated migration script (`scripts/migrate_to_postgres.py`) that will:
1. Connect to PostgreSQL and create the `netshield_db` database if it doesn't exist.
2. Create all tables, relations, foreign keys, and indexes.
3. Copy all existing users, attack logs, and traffic history from `netshield.db` into PostgreSQL.
4. Synchronize auto-increment sequences.

Run this command in your project terminal (replace `YOUR_PASSWORD` with the password you set when you installed PostgreSQL):

```powershell
& ".\python-engine\.venv\Scripts\python.exe" scripts/migrate_to_postgres.py --password YOUR_PASSWORD
```

*Example output:*
```text
=================================================================
  NetShield AI — SQLite to PostgreSQL Migration
=================================================================
[*] Connecting to PostgreSQL at localhost:5432 as 'postgres'...
[+] Creating target database 'netshield_db'...
[✓] Database 'netshield_db' created successfully.
[*] Creating PostgreSQL schema and tables...
[✓] PostgreSQL schema initialized successfully.

[*] Migrating records from SQLite to PostgreSQL...
  [✓] Table 'users': Migrated 11 records.
  [✓] Table 'refresh_tokens': Migrated 2 records.
  [✓] Table 'attacks': Migrated 93 records.
  [✓] Table 'traffic_stats': Migrated 4 records.

[*] Verifying row counts in PostgreSQL:
  • users: 11 rows
  • attacks: 93 rows
  • traffic_stats: 4 rows

=================================================================
  [SUCCESS] SQLite -> PostgreSQL Migration Complete!
  Database: postgresql://postgres:***@localhost:5432/netshield_db
=================================================================
```

---

### Step 3: Switch NetShield AI to Use PostgreSQL

Open your `.env` file in the project root (`C:\Users\admin\Desktop\CNT CP\.env`) and add or uncomment your `DATABASE_URL`:

```env
# ── Database Configuration ──────────────────────────────────────
# Leave blank to use SQLite (python-engine/netshield.db)
# Or provide PostgreSQL URL to connect to PostgreSQL:
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/netshield_db
```

Now restart the Python engine:
```powershell
cd python-engine
.\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

---

## 🖥️ How to Verify the Migration on the Dashboard
1. Open your browser at `http://localhost:5173/analytics`.
2. Scroll to the **Database & Storage Engine Architecture** card.
3. You will see:
   - **Database Engine**: `PostgreSQL 18` (instead of SQLite)
   - **Storage Profile**: Connected to `netshield_db` on port 5432
   - **Status**: `HEALTHY` (pulsing green)
   - **Flow Logs**: All previous attack history preserved!

---

## 🔄 How to Switch Back to SQLite (Anytime)
If you ever want to switch back to SQLite (for portability or viva submission without running PostgreSQL):
Simply comment out `DATABASE_URL` in `.env`:
```env
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/netshield_db
```
NetShield AI automatically falls back to `python-engine/netshield.db` with zero downtime.

---

## ❓ Troubleshooting

### What if I forgot my PostgreSQL password?
You can easily reset your `postgres` superuser password:
1. Open `C:\Program Files\PostgreSQL\18\data\pg_hba.conf` in Notepad.
2. Scroll to the bottom and find the line:
   ```text
   # IPv4 local connections:
   host    all             all             127.0.0.1/32            scram-sha-256
   ```
3. Temporarily change `scram-sha-256` to `trust`:
   ```text
   host    all             all             127.0.0.1/32            trust
   ```
4. Restart the PostgreSQL service.
5. Run:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
   ```
   *(It will log in without asking for a password).*
6. In the SQL prompt, type:
   ```sql
   ALTER USER postgres WITH PASSWORD 'newpassword123';
   \q
   ```
7. Change `trust` back to `scram-sha-256` in `pg_hba.conf` and restart the service.

