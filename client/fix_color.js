const fs = require('fs');
let css = fs.readFileSync('src/styles.css', 'utf8');

const regex = /@keyframes floatCard[\s\S]*?\.quest-card\.floating-card:hover\s*\{\s*animation:\s*none;\s*\}/g;

const newCss = \@keyframes pulseGlowSubtle {
  0%, 100% {
    border-color: var(--card-border-idle);
    box-shadow: 0 0 4px rgba(0,0,0,0.1);
  }
  33% {
    border-color: var(--color-primary-dim);
    box-shadow: 0 0 10px var(--color-primary-dim);
  }
  66% {
    border-color: var(--color-accent-dim);
    box-shadow: 0 0 10px var(--color-accent-dim);
  }
}

.quest-card.color-flow {
  animation: slideIn 0.5s ease-out, pulseGlowSubtle 6s infinite ease-in-out;
}

.quest-card.color-flow:hover {
  animation: none;
}\;

const replaced = css.replace(regex, newCss);
if(css !== replaced) {
  fs.writeFileSync('src/styles.css', replaced, 'utf8');
  console.log('CSS updated');
} else {
  console.log('Regex did not match!');
}
