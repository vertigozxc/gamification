const fs = require('fs');
const p = 'src/components/TokenVault.jsx';
let code = fs.readFileSync(p, 'utf8');

code = code.split('   <div className="p-6 py-4 flex items-center justify-" + "between" + "" style=y{ borderBottom: "2px solid var(--token-header-border)" }>')[0] + `let me <div fix="this up">` +replacement;