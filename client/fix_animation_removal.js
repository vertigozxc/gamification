import fs from 'fs';
let css = fs.readFileSync('src/styles.css', 'utf8');

const newAnim = \
@keyframes floatCard1 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(2px, -2px) rotate(0.8deg); }
  50% { transform: translate(0, -4px) rotate(0deg); }
  75% { transform: translate(-2px, -2px) rotate(-0.8deg); }
}
@keyframes floatCard2 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-1.5px, -3px) rotate(-0.4deg); }
  50% { transform: translate(0, -5px) rotate(0deg); }
  75% { transform: translate(1.5px, -3px) rotate(0.4deg); }
}
@keyframes floatCard3 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(1.5px, -1.5px) rotate(0.5deg); }
  50% { transform: translate(0, -3px) rotate(0deg); }
  75% { transform: translate(-1.5px, -1.5px) rotate(-0.5deg); }
}

.quest-card.float-random {
  animation: slideIn 0.5s ease-out, floatCard3 6s infinite ease-in-out !important;
}
.quest-card.float-random:nth-child(2n) {
  animation: slideIn 0.5s ease-out, floatCard1 7s infinite ease-in-out !important;
}
.quest-card.float-random:nth-child(3n) {
  animation: slideIn 0.5s ease-out, floatCard2 5.5s infinite ease-in-out !important;
}
.quest-card.float-random:hover {
  animation: none !important;
}\;

let cutIndex = css.indexOf('@keyframes floatCard');
if (cutIndex !== -1) {
  css = css.substring(0, cutIndex) + newAnim;
  fs.writeFileSync('src/styles.css', css, 'utf8');
  console.log('CSS Replaced via script');
} else {
  console.log('Could not find floatCard');
}
