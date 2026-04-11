const fs = require('fs');
const file = 'C:/Users/User/Desktop/gamification/client/src/components/ProfilePanel.jsx';
let str = fs.readFileSync(file, 'utf8');

const returnRegex = /return \([\s\S]+?\n  \);/m;

const replacement = `return (
    <div className="p-6 rounded-3xl mb-8 shadow-2xl" style={{ background: "var(--panel-bg)", border: "2px solid var(--panel-border)" }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        <div className="flex flex-col items-center justify-center lg:col-span-1">
          {/* Rank Section moved above Stage */}
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

          <div className="text-center">
            <div className="flex flex-col items-center">
              <p className="cinzel text-xl tracking-widest uppercase mb-1 font-bold" style={{ color: "var(--color-primary)" }}>{t.levelLabel}</p>
              <p ref={levelDisplayRef} className="cinzel text-8xl lvl-text font-black drop-shadow-lg" style={{ color: "var(--color-primary)" }}>{state.lvl}</p>
            </div>
            {!editingName ? (
              <p className="character-name text-slate-400 cinzel text-sm tracking-wider uppercase cursor-pointer hover:text-yellow-300 transition-colors mt-2" title="Double-click to edit name" onDoubleClick={onStartEditingName}>
                {characterName}
              </p>
            ) : (
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => onNameDraftChange(event.target.value)}
                className="character-name-input bg-slate-700 text-yellow-300 cinzel text-sm tracking-wider uppercase text-center border border-yellow-500 rounded px-2 py-1"
                style={{ width: "120px" }}
                maxLength={15}
                autoFocus
                onBlur={onSubmitNameEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSubmitNameEdit();
                  if (event.key === "Escape") onCancelEditingName();
                }}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col w-full">
          {/* Progress Board */}
          <div className="mb-4 bg-slate-900/80 border border-yellow-700/80 rounded-lg px-4 py-2 shadow-lg w-full" style={{ borderColor: "var(--panel-border)" }}>
            <div className="flex justify-between items-center mb-2">
              <p className="cinzel text-sm tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.levelProgress}</p>
              <span className="cinzel text-sm text-slate-400">{state.xp} / {state.xpNext} {t.xpLabel}</span>
            </div>
            <div className="w-full h-6 bg-black rounded-full border border-yellow-700 overflow-hidden">
              <div className="bar-fill h-full rounded-full" style={{ width: \`\${xpPercent}%\` }} />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="cinzel text-xs" style={{ color: "var(--color-primary)" }}>{t.levelShort} {state.lvl}</span>
              <span className="cinzel text-xs text-slate-500">{t.levelShort} {state.lvl + 1}</span>
            </div>
          </div>

          {/* Daily Board */}
          <div className="mb-4 bg-slate-900/80 rounded-lg px-3 py-2 shadow-lg w-full" style={{ borderWidth: 1, borderStyle: "solid", borderColor: "var(--panel-border)" }}>
            <div className="flex justify-between items-center mb-2">
              <p className="cinzel text-[10px] tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.dailyBoard}</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] cinzel text-slate-400"><span>{completedToday}</span> / <span>8</span></span>
              </div>
            </div>
            <div className="relative w-full h-4 bg-black rounded-full border border-yellow-700 overflow-hidden">
              <div className="bar-fill h-full rounded-full" style={{ width: \`\${milestoneProgressPercent}%\` }} />
              {milestoneSteps.map((step) => (
                <div
                  key={step.target}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: \`calc(\${(step.target / 8) * 100}% - 1px)\` }}
                >
                  <div className={\`w-[2px] h-5 \${completedToday >= step.target ? "bg-yellow-300" : "bg-slate-500"}\`} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {milestoneSteps.map((step) => {
                const unlocked = completedToday >= step.target;
                return (
                  <div key={step.target} className="text-center">
                    <p className={\`text-xs leading-none \${unlocked ? "text-yellow-300" : "text-slate-500"}\`}>{step.rune}</p>
                    <p className={\`cinzel text-[9px] tracking-widest mt-1 \${unlocked ? "text-yellow-200" : "text-slate-400"}\`}>{step.target} {t.itemLabel}</p>
                    <p className={\`text-[10px] font-bold \${unlocked ? "text-amber-200" : "text-slate-500"}\`}>{step.reward}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Streak & Reroll Button Section */}
          <div className="mb-4 p-4 rounded-lg border-2 shadow-lg w-full" style={{ background: "var(--streak-bg)", borderColor: "var(--streak-border)" }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <p className="text-5xl">🔥</p>
                <div>
                  <p className="cinzel text-xs tracking-widest uppercase" style={{ color: "var(--streak-label)" }}>{t.currentStreak}</p>
                  <p className="text-4xl font-black cinzel leading-none" style={{ color: "var(--streak-text)" }}>{state.streak}</p>
                  <p className="text-xs cinzel tracking-wide mt-1" style={{ color: "var(--color-primary)" }}>+{streakBonusPercent}% {t.xpMultiplier}</p>
                </div>
              </div>
              <div className="hidden sm:block h-12 w-px" style={{ background: "var(--streak-border)" }} />
              <div className="text-center">
                <p className="cinzel text-xs tracking-widest uppercase" style={{ color: "var(--streak-label)" }}>{t.todaysItems}</p>
                <p className="text-3xl font-bold cinzel" style={{ color: "var(--streak-text)" }}>{state.completed.length}<span className="text-base" style={{ color: "var(--streak-label)" }}>/8</span></p>
              </div>
              <div className="hidden sm:block h-12 w-px" style={{ background: "var(--streak-border)" }} />
              <button
                onClick={onReroll}
                disabled={!canReroll}
                title={rerollButtonTitle}
                className={\`cinzel font-bold px-5 py-3 rounded-lg border transition-all text-xs flex justify-center items-center gap-1.5 whitespace-nowrap w-full sm:w-auto \${
                  canReroll
                    ? "bg-gradient-to-r from-violet-700 to-purple-700 border-violet-400 text-white hover:from-violet-600 hover:to-purple-600 shadow-md shadow-violet-900/50"
                    : "bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed"
                }\`}
              >
                <span>🎲</span>
                {rerollButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );`;

str = str.replace(returnRegex, replacement);
fs.writeFileSync(file, str, 'utf8');
