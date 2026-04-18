import sys

baselines = {
    'A': {'total': 1.2040, 'ttfb': 0.3591},
    'B': {'total': 1.3290, 'ttfb': 0.4301},
    'C': {'total': 1.5460, 'ttfb': 0.6257},
    'D': {'total': 1.3709, 'ttfb': 0.4727},
    'E': {'total': 1.4137, 'ttfb': 0.4451},
}

def analyze_file(filename):
    ttfb_vals = []
    total_vals = []
    with open(filename, 'r') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 5: continue
            # curl format: lookup connect appconnect starttransfer total
            # ttfb = starttransfer - appconnect
            appconnect = float(parts[2])
            starttransfer = float(parts[3])
            total = float(parts[4])
            ttfb_vals.append(starttransfer - appconnect)
            total_vals.append(total)
    
    if not ttfb_vals: return None
    return {
        'ttfb_avg': sum(ttfb_vals) / len(ttfb_vals),
        'total_avg': sum(total_vals) / len(total_vals)
    }

print(f"{'EP':<2} | {'OldTot':<7} | {'NewTot':<7} | {'dTot(s)':<8} | {'dTot%':<7} | {'OldTTFB':<7} | {'NewTTFB':<7} | {'dTTFB(s)':<8} | {'dTTFB%':<7}")
print("-" * 85)

results = {}
for ep in 'ABCDE':
    data = analyze_file(f'bench_new_{ep}.txt')
    if not data: continue
    
    old_tot = baselines[ep]['total']
    new_tot = data['total_avg']
    d_tot = new_tot - old_tot
    p_tot = (d_tot / old_tot) * 100
    
    old_ttfb = baselines[ep]['ttfb']
    new_ttfb = data['ttfb_avg']
    d_ttfb = new_ttfb - old_ttfb
    p_ttfb = (d_ttfb / old_ttfb) * 100
    
    results[ep] = {'d_tot': d_tot, 'd_ttfb': d_ttfb}
    
    print(f"{ep:<2} | {old_tot:<7.4f} | {new_tot:<7.4f} | {d_tot:<+8.4f} | {p_tot:<+7.2f}% | {old_ttfb:<7.4f} | {new_ttfb:<7.4f} | {d_ttfb:<+8.4f} | {p_ttfb:<+7.2f}%")

avg_d_tot = sum(r['d_tot'] for r in results.values()) / len(results)
if avg_d_tot < 0:
    print(f"\nConclusion: Performance improved by {abs(avg_d_tot):.4f}s on average.")
else:
    print(f"\nConclusion: Performance degraded by {avg_d_tot:.4f}s on average.")
