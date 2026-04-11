import fs from 'fs';
let css = fs.readFileSync('src/styles.css', 'utf8');

// The string contains literally '\n' right now instead of actual newline characters.
// Let's strip ALL the broken content from the end.
const target = '.theme-picker-trigger:hover {\r\n    border-color: var(--color-primary);\r\n    color: var(--color-primary);\r\n    background: rgba(0,0,0,0.5);\r\n}';
const backupTarget = '.theme-picker-trigger:hover {\n    border-color: var(--color-primary);\n    color: var(--color-primary);\n    background: rgba(0,0,0,0.5);\n}';

const idx1 = css.lastIndexOf(target);
const idx2 = css.lastIndexOf(backupTarget);
const cutIndex = Math.max(idx1 !== -1 ? idx1 + target.length : -1, idx2 !== -1 ? idx2 + backupTarget.length : -1);

if (cutIndex !== -1) {
  css = css.substring(0, cutIndex);
  
  css += \

@keyframes floatCard {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(1.5px, -1.5px) rotate(0.5deg);
  }
  50% {
    transform: translate(0, -3px) rotate(0deg);
  }
  75% {
    transform: translate(-1.5px, -1.5px) rotate(-0.5deg);
  }
}

@keyframes highlightPulse {
  0%, 100% {
    box-shadow: 0 0 5px rgba(251, 191, 36, 0.1);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.8), inset 0 0 10px rgba(251, 191, 36, 0.4);
  }
}

.quest-card.highlight-pulse {
  animation: slideIn 0.5s ease-out, highlightPulse 2.5s infinite ease-in-out, floatCard 6s infinite ease-in-out !important;
}

.quest-card.highlight-pulse:hover {
  animation: none !important;
  box-shadow: 0 0 20px var(--color-primary-glow), 0 10px 30px rgba(0,0,0,0.7) !important;
}\;

  fs.writeFileSync('src/styles.css', css, 'utf8');
  console.log('Fixed CSS securely with explicit JS file!');
} else {
  console.log('Target string not found, cannot cut string!');
}
