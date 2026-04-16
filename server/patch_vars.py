import re

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'r') as f:
    text = f.read()

# Add to adventure
text = re.sub(
    r'(body\[data-theme="adventure"\] \{.+?--border-radius-panel: 1\.5rem;)',
    r'\1\n    --mobile-tab-bg: rgba(8, 15, 30, 0.88);\n    --mobile-tab-active: var(--color-primary);\n    --mobile-tab-inactive: #94a3b8;\n    --mobile-tab-orb: var(--color-primary);\n    --mobile-tab-orb-text: #111827;',
    text, flags=re.DOTALL
)

# Add to focus
text = re.sub(
    r'(body\[data-theme="focus"\] \{.+?--border-radius-panel: 1rem;)',
    r'\1\n    --mobile-tab-bg: rgba(12, 14, 20, 0.90);\n    --mobile-tab-active: var(--color-primary);\n    --mobile-tab-inactive: #6b7280;\n    --mobile-tab-orb: var(--color-primary);\n    --mobile-tab-orb-text: #111827;',
    text, flags=re.DOTALL
)

# Add to balance
text = re.sub(
    r'(body\[data-theme="balance"\] \{.+?--border-radius-panel: 1\.5rem;)',
    r'\1\n    --mobile-tab-bg: rgba(10, 22, 18, 0.90);\n    --mobile-tab-active: var(--color-primary);\n    --mobile-tab-inactive: #9ca3af;\n    --mobile-tab-orb: var(--color-primary);\n    --mobile-tab-orb-text: #111827;',
    text, flags=re.DOTALL
)

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'w') as f:
    f.write(text)
