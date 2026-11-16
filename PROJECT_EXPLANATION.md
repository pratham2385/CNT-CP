# 🛡️ NetShield AI — Complete Technical & Theoretical Guide

> **A Comprehensive Guide to Database Management Systems (DBMS), Socket Programming, Network Protocols, Web Development, and Computer Networks & Technology (CNT) in NetShield AI.**

---

## 📖 Table of Contents
1. [Project Overview in Simple Terms](#1-project-overview-in-simple-terms)
2. [DBMS (Database Management Systems)](#2-dbms-database-management-systems)
   - What Database is Used & Why?
   - Database Tables & Schema Design
   - ACID Properties Explained
   - Indexing & Query Optimization (B-Trees)
   - Concurrency & Thread-Safe Locking
3. [Socket Programming & Network Protocols](#3-socket-programming--network-protocols)
   - What is a Socket? (Real-World Analogy)
   - Dual-Level Sockets in NetShield AI
   - The Core Protocols (IP, TCP, UDP, HTTP, WebSocket)
   - Deep Dive: The TCP 3-Way Handshake & SYN Floods
   - How WebSockets Deliver Real-Time Telemetry
4. [Web Development Architecture](#4-web-development-architecture)
   - Full-Stack Architecture (Client-Server Model)
   - Frontend: React 18, Vite & Single Page Applications (SPA)
   - Backend 1: FastAPI Python Microservice (Port 8000)
   - Backend 2: Node.js Express Gateway (Port 3001)
   - Web Security (Argon2id, JWT, HttpOnly Cookies, Rate Limiting)
5. [CNT (Computer Networks & Technology) Core Concepts](#5-cnt-computer-networks--technology-core-concepts)
   - The 7-Layer OSI Model Mapped to NetShield AI
   - NIDS vs. Traditional Firewall
   - What is a Network Flow? (The 5-Tuple)
   - The 6 Major Cyber Attacks Detected by the System
   - MITRE ATT&CK Framework Mapping
6. [Viva & Project Examination Q&A (Cheat Sheet)](#6-viva--project-examination-qa-cheat-sheet)

---

## 1. Project Overview in Simple Terms

### What is NetShield AI?
**NetShield AI** is a **Real-Time Network Intrusion Detection System (NIDS)**. 

Imagine your computer network is an international airport:
- A traditional **Firewall** acts like passport control at the entrance gates — checking if the passport (IP address) or boarding pass (Port number) is on a blacklist.
- **NetShield AI** acts like undercover intelligence detectives and security cameras with facial and behavioral recognition operating inside the airport terminal. It watches how every passenger (data packet) moves, analyzes suspicious behavior using **Machine Learning (AI)**, detects cyber attacks in under **10 milliseconds**, logs evidence in a secure database, and sounds the alarm on a live web dashboard.

---

## 2. DBMS (Database Management Systems)

### What Database is Used & Why?
NetShield AI uses **SQLite 3** as its database engine, stored physically as a single file on disk:
`python-engine/netshield.db`

#### Why SQLite 3 instead of MySQL or MongoDB?
1. **Serverless & Zero Configuration**: It does not require installing or running a separate heavy database server daemon (like MySQL or Oracle). It lives directly inside the Python engine process.
2. **Ultra-Low Latency (Fast Reads/Writes)**: Since network packets arrive at rates of hundreds per second, SQLite provides in-process memory-mapped reading and writing without inter-process network overhead.
3. **Full ACID Compliance**: Even if your laptop suddenly loses power or the backend crashes, SQLite guarantees zero corrupted records.
4. **Portability**: The entire database is contained within `netshield.db`, making project submission, testing, and migration instant.

---

### Database Tables & Schema Design

The database contains **5 dedicated tables** designed following relational database normalization rules:

```
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE SCHEMA                       │
├──────────────────────────────┬──────────────────────────────┤
│ attacks                      │ users                        │
│ • id (PK, AutoIncrement)     │ • id (PK, AutoIncrement)     │
│ • attack_type (TEXT)         │ • username (TEXT UNIQUE)     │
│ • src_ip (TEXT)              │ • email (TEXT UNIQUE)        │
│ • dst_ip (TEXT)              │ • password_hash (Argon2id)   │
│ • src_port (INTEGER)         │ • role (admin / analyst)     │
│ • dst_port (INTEGER)         │ • api_key (TEXT UNIQUE)      │
│ • protocol (INTEGER)         │ • is_verified (INTEGER)      │
│ • confidence (REAL)          │ • created_at, last_login     │
│ • is_attack (INTEGER: 0/1)   └──────────────┬───────────────┘
│ • timestamp_utc (REAL)                      │ 1-to-Many
│                              ┌──────────────┴───────────────┐
├──────────────────────────────┤ refresh_tokens               │
│ traffic_stats                │ • id (PK)                    │
│ • id (PK, AutoIncrement)     │ • user_id (FK -> users.id)   │
│ • total_packets (INTEGER)    │ • token_hash (TEXT UNIQUE)   │
│ • normal_count (INTEGER)     │ • expires_at, revoked_at     │
│ • attack_count (INTEGER)     ├──────────────────────────────┤
│ • timestamp_utc (REAL)       │ auth_tokens                  │
│                              │ • id (PK)                    │
│                              │ • user_id (FK -> users.id)   │
│                              │ • token_type (verify/reset)  │
│                              │ • token_hash, expires_at     │
└──────────────────────────────┴──────────────────────────────┘
```

1. **`attacks` Table**:
   - Logs every single predicted network flow.
   - Fields: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol` (6=TCP, 17=UDP), `confidence` (e.g. 0.98), `attack_type` (e.g. "DDoS"), and UTC timestamp.
2. **`traffic_stats` Table**:
   - Stores per-minute aggregate summaries (total flows, normal flows, malicious flows).
   - Used to generate the rolling 60-second live area charts on the frontend without scanning millions of raw rows.
3. **`users` Table**:
   - Stores authenticated SOC security operators and administrators.
   - Enforces **Case-Insensitive Uniqueness** (`COLLATE NOCASE`) so that registering `Admin` and `admin` is safely recognized as the same person.
   - Passwords are never stored in plain text; only Argon2id cryptographic hashes are saved.
4. **`refresh_tokens` Table**:
   - Implements rotating refresh token sessions. Contains a foreign key linking to `users.id` with `ON DELETE CASCADE` (if a user is deleted, their tokens are automatically wiped).
5. **`auth_tokens` Table**:
   - Stores cryptographically hashed, single-use, time-expiring tokens for Email Verification and Password Reset.

---

### ACID Properties Explained in NetShield AI

ACID is the foundation of any reliable relational DBMS:

- **A — Atomicity ("All or Nothing")**:
  - *Example*: When rotating a refresh token, the old token must be marked `revoked` and the new token must be inserted. Both operations succeed together inside a transaction block (`BEGIN ... COMMIT`). If the power cuts halfway through, the transaction rolls back cleanly (`ROLLBACK`).
- **C — Consistency**:
  - The database rules are strictly enforced at all times. If a user tries to create an account with an existing email, SQLite raises a `409 Conflict` database constraint violation.
- **I — Isolation**:
  - The packet capture thread continuously writes new incoming flows while the user simultaneously queries historical attacks from the web dashboard. Neither transaction interferes with the other.
- **D — Durability**:
  - Once a transaction is committed, it is written to non-volatile disk storage. Even if the server stops, the attack logs remain safe.

---

### Indexing & Query Optimization (B-Trees)

Without indexes, searching for attacks from a specific IP among 500,000 flows requires a **Full Table Scan** ($O(N)$ time complexity) — checking every single row one by one.

To make queries instantaneous ($O(\log N)$ time), NetShield AI builds **B-Tree Indexes**:
```sql
CREATE INDEX idx_attacks_ts   ON attacks(timestamp_utc);
CREATE INDEX idx_attacks_type ON attacks(attack_type);
CREATE INDEX idx_attacks_src  ON attacks(src_ip);
```
- **Why this matters**: When the frontend requests "Show me the last 50 DDoS attacks", the database uses the index pointer to jump directly to the target rows in less than **1 millisecond**.

---

### Concurrency & Thread-Safe Locking
In Python, multiple threads run at the same time:
1. The **Packet Sniffer Thread** (writing flows).
2. The **FastAPI Web Server** (reading stats for dashboard users).
3. The **Synthetic Traffic Generator** (simulating flows).

To prevent database deadlocks or database corruption, NetShield AI wraps database calls inside a **Re-entrant Lock (`threading.RLock()`)**:
```python
with self._lock:
    self._conn.execute("INSERT INTO attacks (...) VALUES (...)")
    self._conn.commit()
```
`RLock` allows the same thread to acquire the lock multiple times without deadlocking itself during nested database operations.

---

## 3. Socket Programming & Network Protocols

### What is a Socket? (Real-World Analogy)

> **Analogy**: Think of an **IP Address** as a large apartment building (e.g., `192.168.1.50`), and a **Port Number** as an individual apartment number inside that building (e.g., Port `80` for web traffic, Port `22` for SSH).  
> A **Socket** is the telephone line connected between two specific apartment numbers in two different buildings, allowing them to speak back and forth.

In computer science, a socket is an endpoint for sending and receiving data across a computer network using an operating system communication handle:
$$\text{Socket} = (\text{IP Address}, \text{Port Number})$$

---

### Dual-Level Sockets in NetShield AI

NetShield AI operates sockets at **two completely different layers** of the network stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                  DUAL-LEVEL SOCKET ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 2: APPLICATION WEBSOCKETS (Layer 7 - User Experience)     │
│ React Frontend  ◄═════ Socket.io ═════► Node Gateway (3001)    │
│ Node Gateway    ◄═════ WebSocket ═════► FastAPI (8000)         │
│ (Pushes live alerts, attack notifications & real-time graphs)   │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 1: RAW PACKET CAPTURE SOCKETS (Layer 2/3/4 - Security)    │
│ Physical Wi-Fi / Ethernet Adapter                               │
│       │                                                         │
│       ▼ Raw Promiscuous Sniffing Socket (Scapy / AF_PACKET)     │
│ [Ethernet Frame] ➔ [IP Packet] ➔ [TCP/UDP Segment] ➔ [ML Flow] │
└─────────────────────────────────────────────────────────────────┘
```

1. **Level 1: Raw Network Sniffing Sockets (OSI Layers 2–4)**:
   - Python uses **Scapy** to open raw low-level sockets (`AF_INET` / `SOCK_RAW`) on the Wi-Fi network interface card.
   - It captures live Ethernet frames and IP packets traveling across the local network before they are processed by the OS.
2. **Level 2: WebSockets & Socket.IO (OSI Layer 7)**:
   - High-level full-duplex socket connecting the browser to the backend.
   - Allows the server to push attack notifications to your screen **instantly** without the browser having to constantly refresh the page.

---

### The Core Protocols Used in NetShield AI

| Protocol | OSI Layer | Role in NetShield AI | Real-World Comparison |
| :--- | :---: | :--- | :--- |
| **IP (Internet Protocol)** | Layer 3 (Network) | Delivers packets from source IP to destination IP. Encapsulates source & target addresses. | The postal envelope showing the sender address and recipient address. |
| **TCP (Transmission Control Protocol)** | Layer 4 (Transport) | Connection-oriented, guarantees packet delivery, handles handshakes, packet sequencing, and flow control. | A registered post letter that requires a signature receipt. |
| **UDP (User Datagram Protocol)** | Layer 4 (Transport) | Connectionless, fast, no handshake, zero delivery guarantee. Used in DNS, streaming, and flood attacks. | A postcard dropped into a mailbox without tracking or confirmation. |
| **HTTP (Hypertext Transfer Protocol)** | Layer 7 (Application) | Request-response protocol used for login, profile editing, and fetching historical attack logs. | A customer ordering food at a counter: customer asks, counter responds. |
| **WebSocket / Socket.IO** | Layer 7 (Application) | Bidirectional persistent connection. Enables sub-20ms live updates of packet meters and attack alerts. | An open phone call where both sides can talk and hear immediately without redialing. |

---

### Deep Dive: The TCP 3-Way Handshake & SYN Floods

#### 1. Normal TCP Connection (The 3-Way Handshake)
Before two computers exchange TCP data, they must agree to communicate:

```
Client (Attacker / User)                     Server (Target)
       │                                            │
       │────────────── 1. SYN (Port 80) ───────────►│ (Client: "Can we connect?")
       │                                            │
       │◄───────────── 2. SYN-ACK ──────────────────│ (Server: "Yes, I am ready!")
       │                                            │
       │────────────── 3. ACK ─────────────────────►│ (Client: "Great, connection open!")
       │                                            │
       ▼                                            ▼
   [Connection Established: Normal HTTP Data Transfer Begins]
```

#### 2. The DDoS Attack: SYN Flood (How Attackers Abuse TCP)
In a **SYN Flood (DDoS)** attack:
1. The attacker sends thousands of **SYN** packets per second from spoofed fake IP addresses.
2. The server responds with **SYN-ACK** and allocates memory in its **Half-Open Connection Table (Backlog Queue)**, waiting for the final **ACK**.
3. The attacker deliberately **never sends the ACK**.
4. The server runs out of memory and socket descriptors, causing it to crash or stop accepting legitimate users.

> **How NetShield AI Detects This**: The ML model inspects flow metrics such as `Fwd Packets/s`, `SYN Flag Count`, and `Backward Packet Ratio`. When it sees hundreds of SYN packets with 0 return packets, it immediately flags a **Critical DDoS** alert.

---

### How WebSockets Deliver Real-Time Telemetry

In traditional web development, the browser must use **HTTP Polling** (repeatedly asking the server every second: *"Any new attacks? Any new attacks?"*). This wastes bandwidth and creates server lag.

NetShield AI uses **WebSockets**:
1. When you open the dashboard at `http://localhost:5173`, the browser establishes a single persistent connection via `ws://127.0.0.1:3001`.
2. The Node.js gateway connects to FastAPI via `ws://127.0.0.1:8000/ws/packets`.
3. The millisecond the ML engine classifies a packet, it pushes a tiny JSON message down the socket:
   ```json
   {
     "label": "DDoS",
     "confidence": 0.992,
     "src_ip": "192.168.1.105",
     "dst_port": 80,
     "is_attack": true
   }
   ```
4. The React dashboard receives the event and renders the red alert banner in real time.

---

## 4. Web Development Architecture

### Full-Stack Architecture (Client-Server Model)

NetShield AI adopts a modern **3-Tier Microservices Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                 TIER 1: FRONTEND (CLIENT)                   │
│  React 18 + Vite SPA                                        │
│  • Components: LiveTrafficChart, AttackHistory, TopBar      │
│  • State: Context API (AuthContext, DashboardContext)       │
│  • Styling: Instrument-Grade Graphite CSS Design System     │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP REST + Socket.io (Port 3001)
┌──────────────────────────────▼──────────────────────────────┐
│            TIER 2: API GATEWAY (NODE.JS / EXPRESS)          │
│  • Reverse Proxy (Forwards /api requests to Python)         │
│  • Socket.io Room & Real-Time Broadcast Server              │
│  • Rate Limiting & Gateway Security                         │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP REST + WebSocket (Port 8000)
┌──────────────────────────────▼──────────────────────────────┐
│           TIER 3: BACKEND ENGINE (PYTHON / FASTAPI)         │
│  • Machine Learning Inference Engine (Random Forest / v3)   │
│  • Scapy Live Packet Sniffer + Flow Aggregator              │
│  • SQLite 3 Embedded Database (netshield.db)                │
│  • Authentication (Argon2id, JWT, RBAC)                     │
│  • Gemini AI Copilot + PDF Report Generator                 │
└─────────────────────────────────────────────────────────────┘
```

---

### Frontend: React 18 & Single Page Applications (SPA)

1. **Single Page Application (SPA)**:
   - Traditional websites reload the entire HTML page when you navigate between tabs (`/` to `/analytics`).
   - React loads a single HTML shell (`index.html`) once. When you switch pages, React dynamically replaces components in the DOM in milliseconds without refreshing the browser.
2. **React Context API (State Management)**:
   - `AuthContext.jsx`: Stores the currently logged-in user, roles, access tokens, and login/logout functions globally across the entire app.
   - `DashboardContext.jsx`: Maintains active WebSocket connections, live throughput numbers, attack counters, and incoming packet streams.
3. **Calm, Instrument-Grade Design System**:
   - Built using strict dark graphite CSS tokens (`--bg-primary: #0a0b0e`, `--status-critical: #ef4444`, `--accent-cyan: #22d3ee`).
   - Clean tabular numbers using monospace fonts (`JetBrains Mono`, `Fira Code`) for network IP addresses and millisecond timestamps.

---

### Backend 1: FastAPI Python Microservice (Port 8000)

**FastAPI** is a modern, high-performance web framework for Python:
- **Asynchronous Execution (`async`/`await`)**: Uses Python's `asyncio` event loop to handle hundreds of concurrent requests without blocking.
- **Native AI/ML Integration**: Python is the standard language for data science; running the ML model directly inside FastAPI ensures $0$ cross-language serialization delay.
- **Pydantic Data Validation**: Automatically checks that incoming JSON payloads match strict data schemas before processing them.

---

### Backend 2: Node.js Express Gateway (Port 3001)

Why do we have both Node.js and Python?
- **Separation of Concerns**: Python handles heavy CPU-bound tasks (packet capture, numerical matrix transformations, ML model predictions).
- **Node.js handles I/O-bound tasks**: Serving client assets, managing hundreds of active client WebSocket connections, providing reverse proxy capabilities, and load buffering.

---

### Web Security Architecture

1. **Argon2id Password Hashing**:
   - Passwords are never stored in plain text.
   - NetShield AI uses **Argon2id** (winner of the Password Hashing Competition). It is memory-hard, making it resistant to brute-force attacks even with high-end GPUs or ASIC mining rigs.
2. **JWT (JSON Web Tokens) & HttpOnly Cookies**:
   - When a user logs in, the server generates a signed **JWT** containing user metadata.
   - The token is placed inside an **`HttpOnly` Cookie**. This cookie cannot be read or stolen by malicious JavaScript code running in the browser, protecting against **Cross-Site Scripting (XSS)** attacks.
3. **Brute-Force Rate Limiting**:
   - If a malicious user attempts to guess a password and fails **5 times within 15 minutes**, the backend automatically locks the account (`HTTP 429 Too Many Requests`).

---

## 5. CNT (Computer Networks & Technology) Core Concepts

### The 7-Layer OSI Model Mapped to NetShield AI

Every layer of the Open Systems Interconnection (OSI) model is represented in this project:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      THE 7-LAYER OSI MODEL IN NETSHIELD AI             │
├───────┬──────────────┬─────────────────────────────────────────────────┤
│ Layer │ Name         │ How it works in this Project                    │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   7   │ Application  │ HTTP REST API, WebSocket streams, React UI,     │
│       │              │ Gemini AI Chatbot, DNS resolution.              │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   6   │ Presentation │ JSON encoding/decoding, TLS/SSL encryption,     │
│       │              │ Argon2id password hashing.                      │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   5   │ Session      │ JWT token sessions, Socket.io connection state, │
│       │              │ User authentication state management.          │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   4   │ Transport    │ TCP (Handshakes, Port 80, 443, 22), UDP,        │
│       │              │ Flow sequence tracking, SYN flag inspection.   │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   3   │ Network      │ IPv4 addressing, Source IP vs. Destination IP,   │
│       │              │ Packet routing, Time-To-Live (TTL).             │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   2   │ Data Link    │ Ethernet frames, MAC addresses, Promiscuous    │
│       │              │ packet sniffing via Scapy adapter drivers.      │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│   1   │ Physical     │ Wi-Fi radio frequencies (802.11) and physical   │
│       │              │ Ethernet cables carrying raw digital bits.      │
└───────┴──────────────┴─────────────────────────────────────────────────┘
```

---

### NIDS vs. Traditional Firewall

| Feature | Traditional Firewall (e.g., iptables, Windows Defender) | NetShield AI (NIDS) |
| :--- | :--- | :--- |
| **Location** | Perimeter barrier (Gatekeeper) | Internal network inspector (Analyst) |
| **Inspection Type** | **Stateless / Shallow**: Checks only if IP or Port is allowed or blocked. | **Deep Behavioral Inspection**: Analyzes traffic patterns, packet sizes, and flow timing. |
| **AI Capability** | No. Uses static hardcoded rules. | **Yes**. Uses an 80%-threshold ML model trained on 2.8 million real network flows. |
| **Zero-Day Detection** | Fails against new or unknown attacks that use allowed ports. | Can detect novel attack patterns based on anomalous behavioral signatures. |
| **Action** | Drops or allows packets. | Detects, alerts, logs forensic evidence, maps MITRE ATT&CK codes, and recommends countermeasures. |

---

### What is a Network Flow? (The 5-Tuple)

In network security, analyzing individual packets one by one is inefficient. A packet by itself does not tell you if an attack is happening; a conversation between two machines does.

A **Network Flow** groups all packets belonging to the same conversation using the **5-Tuple**:
$$\text{5-Tuple} = (\text{Source IP}, \text{Source Port}, \text{Destination IP}, \text{Destination Port}, \text{Protocol})$$

From this flow, NetShield AI computes statistical features:
1. **Flow Duration**: How long the conversation lasted (in microseconds).
2. **Total Forward / Backward Packets**: Ratio of packets sent vs. received.
3. **Flow Bytes/s**: Throughput rate.
4. **Packet Length Variance**: Standard deviation of payload sizes.
5. **Flag Counts**: Number of SYN, ACK, FIN, and RST flags.

These statistical features are passed to the **Random Forest / XGBoost ML Model** to classify the flow.

---

### The 6 Major Cyber Attacks Detected by the System

```
                  ┌─────────────────────────────────┐
                  │   ATTACK SIGNATURES DETECTED    │
                  └────────────────┬────────────────┘
         ┌──────────────┬──────────┴───┬──────────────┬─────────────┐
         ▼              ▼              ▼              ▼             ▼
      [ DDoS ]       [ DoS ]      [ PortScan ]  [ BruteForce ]   [ Bot / Web ]
    Floods with    Exhausts CPU   Probes Ports   Guesses SSH    Malicious C2
    millions of     or RAM of     1 to 1024 to    passwords     or SQLi/XSS
     SYN packets     1 server     find openings   repeatedly     injection
```

1. **DDoS (Distributed Denial of Service)**:
   - *How it works*: Thousands of compromised computers (bots) flood a target server with massive traffic volumes, overwhelming bandwidth or connection tables.
   - *Target*: Port 80 (HTTP) & Port 443 (HTTPS).
   - *MITRE ATT&CK Code*: `T1498` (Network Denial of Service).
2. **DoS (Denial of Service)**:
   - *How it works*: A single attack machine sends resource-exhausting requests (e.g. Slowloris or Ping of Death) to crash a service.
   - *MITRE ATT&CK Code*: `T1499` (Endpoint Denial of Service).
3. **Port Scanning**:
   - *How it works*: Reconnaissance scan (e.g. using Nmap). The attacker sequentially probes ports 1 through 1024 to discover which services (Web, SSH, FTP, Database) are open and vulnerable.
   - *MITRE ATT&CK Code*: `T1046` (Network Service Discovery).
4. **Brute Force**:
   - *How it works*: Automated credential attacks. The attacker attempts thousands of username/password combinations per minute against login portals or SSH terminals.
   - *Target*: Port 22 (SSH).
   - *MITRE ATT&CK Code*: `T1110` (Brute Force).
5. **Botnet C2 Traffic**:
   - *How it works*: Malware-infected computers inside the network periodically send small beacon signals out to an attacker's Command & Control (C2) server.
   - *Target*: Port 8080, 6667 (IRC).
   - *MITRE ATT&CK Code*: `T1071` (Application Layer Protocol).
6. **Web Attacks (SQLi & XSS)**:
   - *How it works*: Exploiting vulnerabilities in web application inputs (e.g. injecting `' OR 1=1 --` into login boxes) to manipulate backend databases or hijack browser sessions.
   - *MITRE ATT&CK Code*: `T1190` (Exploit Public-Facing Application).

---

## 6. Viva & Project Examination Q&A (Cheat Sheet)

### Q1: What is the primary objective of your project?
> **Answer**: "The objective of NetShield AI is to build a real-time Network Intrusion Detection System that captures live network traffic, extracts bidirectional flow features, classifies traffic using a machine learning model trained on the CICIDS2017 dataset into 9 distinct classes, logs events into an ACID-compliant SQLite database, and streams real-time threat intelligence to an instrument-grade React SOC dashboard."

### Q2: Why did you use SQLite instead of MongoDB or MySQL?
> **Answer**: "SQLite is an embedded, serverless relational database engine. Since our Python engine performs sub-second network packet inspection, SQLite eliminates network overhead by accessing data in-process via local disk storage. It is fully ACID-compliant, supports B-Tree indexing, and uses thread-safe re-entrant locks (`RLock`) to safely manage simultaneous reads from web clients and writes from packet capture threads."

### Q3: Explain what a 'Socket' is and where it is used in your code.
> **Answer**: "A socket is a communication endpoint defined by an IP address and a Port number. In NetShield AI, sockets are used at two levels: First, low-level raw network sockets via Scapy to capture raw Ethernet and IP frames from the Wi-Fi card. Second, application-layer WebSockets via Socket.IO to maintain an open, full-duplex communication channel between the Node.js server and the React frontend to push instant security alerts without page reloads."

### Q4: What is the difference between TCP and UDP?
> **Answer**: "TCP is connection-oriented and reliable; it performs a 3-way handshake (SYN, SYN-ACK, ACK) and guarantees delivery and packet ordering, which is why services like HTTP and SSH use it. UDP is connectionless and does not guarantee delivery, trading reliability for maximum speed, which is used in DNS and live video streaming. Attackers exploit TCP handshakes during SYN flood DDoS attacks."

### Q5: What is a Network Flow and what is the 5-Tuple?
> **Answer**: "A network flow represents all packets belonging to a bidirectional communication session between two devices. It is uniquely identified by the 5-Tuple: Source IP, Destination IP, Source Port, Destination Port, and Protocol (TCP or UDP). Analyzing flows allows the ML model to evaluate behavioral metrics like packet inter-arrival time and flow duration rather than inspecting isolated packets."

### Q6: How does the system prevent False Positives?
> **Answer**: "We employ a two-stage filter: First, a rule-based Traffic Filter that automatically bypasses broadcast, multicast, DHCP, and ICMP traffic which the model cannot meaningfully classify. Second, a strict 80% confidence threshold on ML predictions. If an attack prediction has less than 80% model confidence, it is automatically downgraded to benign traffic to prevent alert fatigue."

### Q7: How is user authentication secured in your project?
> **Answer**: "We enforce strict password validation (minimum 12 characters, uppercase, lowercase, numbers, and symbols). Passwords are hashed using the memory-hard Argon2id algorithm. Authenticated sessions use signed JSON Web Tokens (JWT) stored inside secure, HttpOnly cookies to prevent Cross-Site Scripting (XSS) attacks. Furthermore, account brute-force protection locks out users for 15 minutes after 5 consecutive failed login attempts."

### Q8: What role does the Node.js server play if Python is already running FastAPI?
> **Answer**: "Node.js acts as an API Gateway and Reverse Proxy. It isolates the Python ML engine from public client traffic, manages Socket.IO client rooms and broadcasts, handles frontend API routing, and provides rate limiting. This microservice separation ensures that heavy machine learning computation in Python does not block client UI responsiveness."

---

*Document generated for **NetShield AI** — Computer Networks & Technology (CNT) Project Documentation.*

