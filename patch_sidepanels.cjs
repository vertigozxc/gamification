const fs = require('fs');
const content = fs.readFileSync('client/src/components/SidePanels.jsx', 'utf8');
const newContent = content.replace(
  /return \(\s*<div className="flex flex-col gap-4">[\s\S]*?<\/div>\s*\);\s*}/g,
  `return (
    <div className="flex flex-col gap-4">
      {compact ? (
        <div className="flex flex-col gap-3">
          {leaderboard.length === 0 ? (
            <p className="cinzel text-slate-500 italic text-sm text-center mt-8">{t.leaderboardEmpty}</p>
          ) : leaderboard.slice(0, 10).map(renderEntry)}
        </div>
      ) : (
        <div className="rounded-2xl flex flex-col shadow-2xl p-5" style={{ flex: "7", background: "var(--leaderboard-bg)", border: "2px solid var(--leaderboard-border)" }}>
          <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "2px solid var(--leaderboard-border)" }}>
            <h2 className="cinzel text-lg text-transparent bg-clip-text uppercase tracking-[0.18em] font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.leaderboard}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.length === 0 ? (
              <p className="cinzel text-slate-500 italic text-sm text-center mt-8">{t.leaderboardEmpty}</p>
            ) : leaderboard.slice(0, 5).map(renderEntry)}
          </div>
        </div>
      )}
    </div>
  );
}`
);
fs.writeFileSync('client/src/components/SidePanels.jsx', newContent);
