import sys

baselines = {
    'A': {'ttfb': 0.3591, 'total': 1.2040},
    'B': {'ttfb': 0.4301, 'total': 1.3290},
    'C': {'ttfb': 0.6257, 'total': 1.5460},
    'D': {'ttfb': 0.4727, 'total': 1.3709},
    'E': {'ttfb': 0.4451, 'total': 1.4137},
}

current = {
    'A': {'ttfb': 0.4011, 'total': 1.2569},
    'B': {'ttfb': 0.4297, 'total': 1.3168},
    'C': {'ttfb': 0.6170, 'total': 1.5361},
    'D': {'ttfb': 0.4451, 'total': 1.3240},
    'E': {'ttfb': 0.3887, 'total': 1.2850},
}

print(f"{'Endpoint':<10} | {'Metric':<6} | {'Old':<8} | {'New':<8} | {'Diff (s)':<10} | {'Diff (%)':<8}")
print("-" * 60)

for ep in ['A', 'B', 'C', 'D', 'E']:
    for metric in ['ttfb', 'total']:
        old = baselines[ep][metric]
        new = current[ep][metric]
        diff = new - old
        pct = (diff / old) * 100
        print(f"{ep:<10} | {metric.upper():<6} | {old:<8.4f} | {new:<8.4f} | {diff:<+10.4f} | {pct:<+8.2f}%")
