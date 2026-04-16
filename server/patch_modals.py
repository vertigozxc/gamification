import re

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'r') as f:
    text = f.read()

# popupFade
text = re.sub(
    r'@keyframes popupFade \{\n    from \{ opacity: 0; transform: scale\(0.95\); \}\n    to \{ opacity: 1; transform: scale\(1\); \}\n\}',
    '@keyframes popupFade {\n    from { opacity: 0; }\n    to { opacity: 1; }\n}',
    text
)

# slideInUp
text = re.sub(
    r'@keyframes slideInUp \{\n    from \{\n        transform: translateY\(50px\);\n        opacity: 0;\n    \}\n    to \{\n        transform: translateY\(0\);\n        opacity: 1;\n    \}\n\}',
    '@keyframes slideInUp {\n    from {\n        transform: translateY(100px) scale(0.95);\n        opacity: 0;\n    }\n    to {\n        transform: translateY(0) scale(1);\n        opacity: 1;\n    }\n}',
    text
)

# update logout-confirm-overlay and logout-confirm-card
text = re.sub(
    r'animation: popupFade 0\.25s ease-out;',
    r'animation: popupFade 0.3s ease-out;',
    text
)
text = re.sub(
    r'animation: slideInUp 0\.25s ease-out;',
    r'animation: slideInUp 0.45s cubic-bezier(0.32, 0.72, 0, 1); transform-origin: center center;',
    text
)
text = re.sub(
    r'animation: popupFade 0\.25s ease-out;',
    r'animation: popupFade 0.3s ease-out;',
    text
)
text = re.sub(
    r'#customize-modal > div \{\n    animation: slideInUp 0\.3s ease-out;\n\}',
    '#customize-modal > div {\n    animation: slideInUp 0.45s cubic-bezier(0.32, 0.72, 0, 1);\n    transform-origin: center center;\n}',
    text
)

print(len(text))

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'w') as f:
    f.write(text)

