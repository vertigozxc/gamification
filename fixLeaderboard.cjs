const fs = require('fs');

// Fix App.jsx
let app = fs.readFileSync('client/src/App.jsx', 'utf8');
app = app.replace(
  /<div className="mobile-chip text-right">\s*<p className="mobile-chip-label">{t\.players \?\? "Players"}<\/p>\s*<p className="cinzel text-lg mt-1" style={{ color: "var\(--color-primary\)" }}>{leaderboard\.length}<\/p>\s*<\/div>/,
  ''
);
fs.writeFileSync('client/src/App.jsx', app);

// Fix SidePanels.jsx
let sp = fs.readFileSync('client/src/components/SidePanels.jsx', 'utf8');

sp = sp.replace(
  /if \(compact\) {[\s\S]*?return \([\s\S]*?className={`rounded-2xl border px-3 py-3 \${isMe \? "bg-amber-950\/30 border-yellow-500\/60 shadow-\[0_0_18px_rgba\(234,179,8,0\.12\)\]" : "bg-slate-900\/70 border-slate-700"}[\s\S]*?<\/\/\s*if compact\s*\n\s*}/,
  ''
);

// Actually, I'll rewrite the entire `SidePanels.jsx` renderEntry for compact.
sp = sp.replace(
  /if \(compact\) {[\s\S]*?<div key={entry.username}[\s\S]*?padding: "0" \?>\s*<\/div>\s*\)\s*;\s*}/, // Need regex that won't fail
  ''
)

fs.writeFileSync('client/src/components/SidePanels.jsx', sp);
