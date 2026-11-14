"""NetShield AI — Attack simulation script for live demos.

Generates synthetic malicious traffic and injects it into the NetShield AI
engine in real-time so that:
  - The live traffic telemetry chart spikes with red attack packets.
  - The threat level indicator turns CRITICAL (pulsing red glow).
  - The alert banner flashes red across the dashboard.
  - Attack history and live packet feeds record the incoming threat.
  - Multi-channel alerts (Telegram, Email, Voice) trigger as configured.

Supported attack modes:
    --ddos        DDoS SYN flood to port 80 (50 flows, random source ports)
    --portscan    TCP SYN scan across ports 1-200
    --bruteforce  Rapid SSH SYN attempts on port 22
    --dos         High-volume DoS SYN flood on port 80

Usage:
    py scripts/simulate_attack.py --ddos
    py scripts/simulate_attack.py --portscan
    py scripts/simulate_attack.py --bruteforce
    py scripts/simulate_attack.py --dos
    py scripts/simulate_attack.py --ddos --portscan    # combined
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

DEFAULT_PYTHON_URL = "http://localhost:8000"
DEFAULT_NODE_URL = "http://localhost:3001"
DEFAULT_COUNT = 50
DEFAULT_DELAY_MS = 25.0


def check_server(base_url: str) -> bool:
    """Check if the given server is reachable."""
    try:
        url = f"{base_url}/api/health" if "8000" in base_url else f"{base_url}/api/node-health"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def simulate_via_api(
    base_url: str,
    attack_type: str,
    count: int,
    delay_ms: float,
    src_ip: Optional[str] = None,
) -> dict[str, Any]:
    """Send an attack simulation request to the NetShield AI backend."""
    url = f"{base_url}/api/simulate"
    payload = json.dumps({
        "attack_type": attack_type,
        "count": count,
        "delay_ms": delay_ms,
        "src_ip": src_ip,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_scapy_raw(attack_type: str, count: int, delay_ms: float, iface: Optional[str]) -> int:
    """Attempt raw Scapy packet generation (fallback mode)."""
    try:
        from scapy.all import IP, TCP, send
    except ImportError:
        print("[!] Scapy is not installed. Use HTTP simulation instead.")
        return 0

    print(f"[netshield] Attempting raw Scapy packet generation for {attack_type}...")
    sent = 0
    target = "127.0.0.1"

    for i in range(count):
        try:
            sport = random.randint(1024, 65535)
            if attack_type.lower() == "portscan":
                dport = (i % 1024) + 1
            elif attack_type.lower() == "bruteforce":
                dport = 22
            else:
                dport = 80

            pkt = IP(dst=target) / TCP(sport=sport, dport=dport, flags="S", seq=random.randint(1000, 999999))
            send(pkt, verbose=0, iface=iface)
            sent += 1
            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)
        except Exception as exc:
            print(f"[!] Scapy send error: {exc}")
            break

    return sent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="simulate_attack",
        description="NetShield AI — Attack simulator for live demos.",
    )
    mode = parser.add_argument_group("Attack modes")
    mode.add_argument("--ddos", action="store_true", help="SYN flood to port 80 (DDoS)")
    mode.add_argument("--portscan", action="store_true", help="TCP SYN scan across ports (PortScan)")
    mode.add_argument("--bruteforce", action="store_true", help="Rapid SYN to port 22 (BruteForce)")
    mode.add_argument("--dos", action="store_true", help="High-volume SYN flood (DoS)")

    opts = parser.add_argument_group("Options")
    opts.add_argument("--count", "-n", type=int, default=DEFAULT_COUNT, help=f"Packet/flow count (default: {DEFAULT_COUNT})")
    opts.add_argument("--delay", type=float, default=DEFAULT_DELAY_MS, help=f"Delay between flows in ms (default: {DEFAULT_DELAY_MS})")
    opts.add_argument("--src-ip", type=str, default=None, help="Spoof source IP address")
    opts.add_argument("--url", type=str, default=None, help="Backend URL (default: auto-detect 8000 or 3001)")
    opts.add_argument("--raw-scapy", action="store_true", help="Use raw Scapy L3 socket sending instead of API injection")
    opts.add_argument("--interface", "-i", type=str, default=None, help="Network interface for raw Scapy")

    args = parser.parse_args(argv)

    selected_modes = []
    if args.ddos:
        selected_modes.append("DDoS")
    if args.portscan:
        selected_modes.append("PortScan")
    if args.bruteforce:
        selected_modes.append("BruteForce")
    if args.dos:
        selected_modes.append("DoS")

    if not selected_modes:
        parser.error("At least one attack mode is required (--ddos, --portscan, --bruteforce, --dos)")

    print()
    print("=" * 60)
    print("  NetShield AI — Live Attack Simulation")
    print("=" * 60)

    # Determine backend URL
    target_url = args.url
    if not target_url:
        if check_server(DEFAULT_PYTHON_URL):
            target_url = DEFAULT_PYTHON_URL
        elif check_server(DEFAULT_NODE_URL):
            target_url = DEFAULT_NODE_URL
        else:
            target_url = DEFAULT_PYTHON_URL

    if not args.raw_scapy:
        print(f"[*] Target NetShield Engine: {target_url}")
    else:
        print("[*] Mode: Raw Scapy Packet Injection")

    total_packets = 0
    start_time = time.monotonic()

    for attack in selected_modes:
        print()
        print(f"[*] Simulating {attack} Attack ({args.count} flows, delay={args.delay}ms)...")

        if args.raw_scapy:
            sent = run_scapy_raw(attack, args.count, args.delay, args.interface)
            total_packets += sent
            print(f"[+] {attack}: {sent} raw packets sent.")
        else:
            try:
                # Progress animation
                print(f"    Injecting packets into real-time pipeline...", end="", flush=True)
                res = simulate_via_api(target_url, attack, args.count, args.delay, args.src_ip)
                sent = res.get("packets_sent", args.count)
                total_packets += sent
                threat = res.get("threat_level", "CRITICAL")
                print(f" DONE! ({sent} events injected)")
                print(f"    Current Threat Level: {threat}")
            except urllib.error.URLError as exc:
                print(f"\n[!] Failed to reach NetShield engine at {target_url}: {exc}")
                print("    Make sure the Python engine or Node backend is running:")
                print("      .\\scripts\\start_all.ps1")
                return 1

    elapsed = time.monotonic() - start_time
    print()
    print("=" * 60)
    print("  Simulation Complete!")
    print("=" * 60)
    print(f"  Attacks Executed:   {', '.join(selected_modes)}")
    print(f"  Total Flows/Events: {total_packets}")
    print(f"  Elapsed Time:       {elapsed:.2f}s")
    print()
    print("  >>> Open your dashboard to view the attack telemetry:")
    print("      http://localhost:5173")
    print("=" * 60)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
