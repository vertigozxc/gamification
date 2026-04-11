const fs = require('fs');
let css = fs.readFileSync('src/styles.css', 'utf8');

const oldCss = @keyframes shimmerPulse {
  0%, 100% { box-shadow: 0 0 5px rgba(255,255,255,0.05); }
  50% { box-shadow: 0 0 20px var(--color-primary-glow), inset 0 0 10px var(--color-primary-glow); }
}

.quest-card.shimmer-border {
  animation: slideIn 0.5s ease-out, shimmerPulse 2.5s infinite ease-in-out;
};

const newCss = @keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.quest-card.floating-card {
  animation: slideIn 0.5s ease-out, floatCard 3.5s ease-in-out infinite 0.5s;
}

.quest-card.floating-card:hover {
  animation: none;
};

css = css.replace(oldCss, newCss);
fs.writeFileSync('src/styles.css', css, 'utf8');
console.log('CSS Replaced');
