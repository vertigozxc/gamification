const fs = require('fs');
const content = `
.city-fullscreen-mode {
  position: fixed;
  top: 0;
  left: 100%;
  width: 100dvh;
  height: 100dvw;
  transform: rotate(90deg);
  transform-origin: top left;
  z-index: 99999;
  border-radius: 0 !important;
  border: none !important;
}
`;
fs.appendFileSync('client/src/styles.css', content);
