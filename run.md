
## Testing & Attack Simulation

### 1. Open 4th Terminal (PowerShell)

cd "C:\Users\admin\Desktop\CNT CP"
.\.venv\Scripts\Activate.ps1

### 2. Simulate Attacks / Traffic

py scripts\simulate_attack.py --ddos
py scripts\simulate_attack.py --portscan
py scripts\simulate_attack.py --bruteforce
py scripts\simulate_attack.py --normal

### 3. Run Security Test Suite (52 Tests)

py scripts\test_auth_production.py

### 4. Stop Project

Press `Ctrl + C` in each terminal, or run:

Stop-Process -Name node, python -Force -ErrorAction SilentlyContinue

> **Note:** Stop-Process forcefully terminates all Node.js/Python processes, including unrelated ones.
