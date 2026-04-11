import fs from 'fs';
const p = 'C:/Users/User/Desktop/gamification/client/src/components/TokenVault.jsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/7/g, '5');
c = c.replace(/onClick={onOpenPinnedReplacement}/, 'onClick={() => window.scrollTo(0,0)}');
c = c.replace(/tokens < 5 \? t\.notEnough : \`\$\{t\.customizePrefix\}/g, '`See Board');
c = c.replace(/disabled=\{tokens < 5\}/, '');
c = c.replace(/\{tokens < 5 \? t\.notEnough :/g, '{`See Board');
fs.writeFileSync(p, c);
