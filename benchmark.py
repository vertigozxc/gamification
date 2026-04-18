import subprocess
import json
import time
import statistics

BASE_URL = "https://life-rpg-api.onrender.com"

def get_stats(method, url, data=None):
    cmd = [
        "curl", "-s", "-o", "/dev/null",
        "-w", "%{time_namelookup} %{time_connect} %{time_starttransfer} %{time_total}",
        "-X", method, url
    ]
    if data:
        cmd.extend(["-H", "Content-Type: application/json", "-d", data])
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    parts = res.stdout.split()
    if len(parts) < 4:
        return [0.0, 0.0, 0.0, 0.0]
    return [float(p) for p in parts]

def print_stats(name, results):
    ttfb = [r[2] for r in results]
    total = [r[3] for r in results]
    
    def get_metrics(data):
        return {
            "avg": sum(data) / len(data),
            "p50": statistics.median(data),
            "p95": sorted(data)[int(len(data) * 0.95)],
            "p99": sorted(data)[int(len(data) * 0.99)]
        }

    t_metrics = get_metrics(ttfb)
    tot_metrics = get_metrics(total)
    
    print(f"--- {name} (N={len(results)}) ---")
    print(f"  TTFB:  avg={t_metrics['avg']:.4f}s, p50={t_metrics['p50']:.4f}s, p95={t_metrics['p95']:.4f}s, p99={t_metrics['p99']:.4f}s")
    print(f"  Total: avg={tot_metrics['avg']:.4f}s, p50={tot_metrics['p50']:.4f}s, p95={tot_metrics['p95']:.4f}s, p99={tot_metrics['p99']:.4f}s")

def run_bulk(name, method, url, data, count):
    print(f"Running {count} requests for {name}...")
    results = []
    for _ in range(count):
        results.append(get_stats(method, url, data))
    print_stats(name, results)

def run_warm_batch(method, url, data, count):
    results = []
    for _ in range(count):
        results.append(get_stats(method, url, data))
    total = [r[3] for r in results]
    avg = sum(total)/len(total)
    p50 = statistics.median(total)
    p95 = sorted(total)[int(len(total) * 0.95)]
    return f"avg={avg:.4f}s, p50={p50:.4f}s, p95={p95:.4f}s"

# 1) Bulk 50 requests
run_bulk("GET /api/health", "GET", f"{BASE_URL}/api/health", None, 50)
run_bulk("POST /api/quests/complete", "POST", f"{BASE_URL}/api/quests/complete", '{"questId":"dummy"}', 50)

# 3) Cold vs warm
print(f"\nWaiting 35s for potential idle timeout...")
time.sleep(35)

print("\n--- Cold vs Warm Test ---")
for name, method, url, data in [
    ("GET /api/health", "GET", f"{BASE_URL}/api/health", None),
    ("POST /api/quests/complete", "POST", f"{BASE_URL}/api/quests/complete", '{"questId":"dummy"}')
]:
    cold = get_stats(method, url, data)
    print(f"Cold {name}: TTFB={cold[2]:.4f}s, Total={cold[3]:.4f}s")
    warm_results = run_warm_batch(method, url, data, 10)
    print(f"Warm {name} (N=10): {warm_results}")

