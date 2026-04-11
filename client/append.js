import fs from 'fs';
let css = fs.readFileSync('src/styles.css', 'utf8');
css += \

@keyframes highlightPulse {
  0%, 100% {
    box-shadow: 0 0 5px rgba(251, 191, 36, 0.1);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.8), inset 0 0 10px rgba(251, 191, 36, 0.4);
  }
}

.quest-card.highlight-pulse {
  animation: slideIn 0.5s ease-out, highlightPulse 2.5s infinite ease-in-out !important;
}

.quest-card.highlight-pulse:hover {
  animation: none !important;
  box-shadow: 0 0 20px var(--color-primary-glow), 0 10px 30px rgba(0,0,0,0.7) !important;
}
\;

fs.writeFileSync('src/styles.css', css, 'utf8');
console.log('Appended securely');
