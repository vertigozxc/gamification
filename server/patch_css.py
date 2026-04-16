import re
import sys

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'r') as f:
    text = f.read()

# Replace fadeInUp
text = re.sub(
    r'@keyframes fadeInUp \{.*?\n.*?100% \{ opacity: 1; transform: translateY\(0\); filter: blur\(0\); \}\n\}',
    '@keyframes fadeInUp {\n    0% { opacity: 0; transform: translateY(15px); }\n    100% { opacity: 1; transform: translateY(0); }\n}',
    text, flags=re.DOTALL
)

# Replace mobileTabReveal
text = re.sub(
    r'@keyframes mobileTabReveal \{.*?501.*?\n\}',
    """@keyframes mobileTabReveal {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.96);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}""",
    text, flags=re.DOTALL
)

# Replace mobileTabSlideLeft
text = re.sub(
    r'@keyframes mobileTabSlideLeft \{.*?\n.*?100% \{.*?opacity: 1;.*?transform: translateX\(0\) translateY\(0\) scale\(1\);.*?filter: blur\(0\);.*?\n.*?\}',
    """@keyframes mobileTabSlideLeft {
    0% { opacity: 0; transform: translateX(-30px) scale(0.96); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
}""",
    text, flags=re.DOTALL
)

# Replace mobileTabSlideRight
text = re.sub(
    r'@keyframes mobileTabSlideRight \{.*?\n.*?100% \{.*?opacity: 1;.*?transform: translateX\(0\) translateY\(0\) scale\(1\);.*?filter: blur\(0\);.*?\n.*?\}',
    """@keyframes mobileTabSlideRight {
    0% { opacity: 0; transform: translateX(30px) scale(0.96); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
}""",
    text, flags=re.DOTALL
)

# Replace mobilePanelRise
text = re.sub(
    r'@keyframes mobilePanelRise \{.*?\n.*?100% \{.*?opacity: 1;.*?transform: translateY\(0\);.*?\n.*?\}',
    """@keyframes mobilePanelRise {
    0% { opacity: 0; transform: translateY(20px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}""",
    text, flags=re.DOTALL
)

text = re.sub(
    r'\.mobile-tab-screen \{\n.*?transform-origin: center bottom;\n\}',
    """.mobile-tab-screen {
    animation: mobileTabReveal 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    transform-origin: center center;
}""",
    text
)
text = re.sub(
    r'\.mobile-tab-screen-left \{\n.*?\}',
    """.mobile-tab-screen-left {
    animation: mobileTabSlideLeft 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}""",
    text
)
text = re.sub(
    r'\.mobile-tab-screen-right \{\n.*?\}',
    """.mobile-tab-screen-right {
    animation: mobileTabSlideRight 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}""",
    text
)
text = re.sub(
    r'\.mobile-tab-panel \{\n.*?\}',
    """.mobile-tab-panel {
    animation: mobilePanelRise 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}""",
    text
)

with open('/Users/vertigozxc/Documents/gamification/client/src/styles.css', 'w') as f:
    f.write(text)

print("done")
