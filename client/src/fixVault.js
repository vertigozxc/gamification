import fs from 'fs';
const p = 'C:/Users/User/Desktop/gamification/client/src/components/SilverVault.jsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/7/g, '5');
c = c.replace(/onClick={onOpenPinnedReplacement}/, 'onClick={() => window.scrollTo(0,0)}');
c = c.replace(/silver < 5 \? t\.notEnough : \`\$\{t\.customizePrefix\}/g, '`See Board');
c = c.replace(/disabled=\{silver < 5\}/, '');
c = c.replace(/\{silver < 5 \? t\.notEnough :/g, '{`See Board');
fs.writeFileSync(p, c);
