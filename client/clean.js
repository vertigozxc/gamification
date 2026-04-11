import fs from 'fs';
let css = fs.readFileSync('src/styles.css', 'utf8');
let idx = css.indexOf('.quest-card.float-random:nth-child(3n)');
let correctEnding = \.quest-card.float-random:nth-child(3n) {
  animation: slideIn 0.5s ease-out, floatCard2 5.5s infinite ease-in-out !important;
}
.quest-card.float-random:hover {
  animation: none !important;
  box-shadow: 0 0 20px var(--color-primary-glow), 0 10px 30px rgba(0,0,0,0.7) !important;
}\;

css = css.substring(0, idx) + correctEnding;
fs.writeFileSync('src/styles.css', css, 'utf8');
console.log('Fixed correctly');
