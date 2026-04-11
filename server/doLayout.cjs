const fs = require('fs');
const file = 'C:/Users/User/Desktop/gamification/client/src/components/ProfilePanel.jsx';
let str = fs.readFileSync(file, 'utf8');

str = str.replace(
  '<div className="xl:col-span-4 rounded-lg border px-3 py-2 shadow-lg h-full"',
  '<!-- removed Rank -->'
).replace(
  '<div className="xl:col-span-8',
  '<div className="xl:col-span-12' // make stage progress take full width
);

// Now we need to insert the Rank code right before the `div className="text-center"` inside lg:col-span-1
const rankCode = `
          <div className="w-full rounded-lg border px-4 py-3 mb-6 shadow-lg flex flex-col items-center justify-center gap-2" style={{ background: "var(--card-bg)", borderColor: "var(--card-border-idle)" }}>
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Rank</span>
            <div className="px-4 py-1 rounded border-2 shadow-lg" style={{ borderColor: tierStyle.borderColor, background: tierStyle.background, boxShadow: tierStyle.glow }}>
              <span className="cinzel text-xs font-bold tracking-[0.08em]" style={{ color: tierStyle.color }}>{rankLabel}</span>
            </div>
            <span className="text-[11px] text-slate-400">• {state.productivity?.weeksInCurrentTier ?? 0}w in this rank</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{t.weekResetLabel || "Week reset in:"}</span>
              <span className="cinzel text-sm font-bold week-reset-timer" style={{ color: "var(--color-primary)" }}>⏳ {weekResetTimer}</span>
            </div>
          </div>
`;
str = str.replace('<div className="text-center">', rankCode + '\n          <div className="text-center">');

// Fix Reroll responsive button
str = str.replace(
  '<div className="flex items-center justify-between gap-4 mb-4">',
  '<div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">'
).replace(
  '<div className="h-12 w-px" style={{ background: "var(--streak-border)" }} />',
  '<div className="hidden sm:block h-12 w-px" style={{ background: "var(--streak-border)" }} />'
).replace(
  '<div className="h-12 w-px" style={{ background: "var(--streak-border)" }} />',
  '<div className="hidden sm:block h-12 w-px" style={{ background: "var(--streak-border)" }} />'
).replace(
  'style={{ marginRight: "30px", marginTop: "10px" }}',
  'style={{}}'
).replace(
  'className={`cinzel font-bold px-5 py-3 rounded-lg border transition-all text-xs flex items-center gap-1.5 whitespace-nowrap ${',
  'className={`cinzel font-bold px-5 py-3 rounded-lg border transition-all text-xs flex justify-center items-center gap-1.5 whitespace-nowrap w-full sm:w-auto ${'
);

fs.writeFileSync(file, str, 'utf8');
