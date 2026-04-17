import QuestBoard from "../QuestBoard";

export default function DashboardTab({
  state, characterName, t,
  xpPercent, completedToday, milestoneSteps,
  pinnedQuests, otherQuests, pinnedQuestProgressById,
  canReroll, allRandomCompleted, questRenderCount,
  resetTimer,
  onResetDaily, onHardReset, onAddXp,
  onReroll, onCompleteQuest,
  rerollButtonLabel, rerollButtonTitle
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex gap-2 justify-center mb-1">
        <button onClick={onResetDaily} className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80" style={{ borderColor: "var(--color-primary-dim)", background: "var(--card-bg)", color: "var(--color-primary)" }}>{t.resetDaily}</button>
        <button
          onClick={() => onAddXp(500)}
          className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80"
          style={{ borderColor: "rgba(251,191,36,0.5)", background: "rgba(127,95,0,0.3)", color: "rgb(251,191,36)" }}
        >
          ⚡ +500 {t.xpLabel || "XP"}
        </button>
        <button onClick={onHardReset} className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80" style={{ borderColor: "rgba(220,38,38,0.5)", background: "rgba(127,29,29,0.3)", color: "rgb(239,68,68)" }}>{t.resetProgress}</button>
      </div>
      {/* Hero: XP + Level compact row */}
      <div className="dash-hero">
        <div className="dash-hero-top">
          <div className="min-w-0 flex-1">
            <p className="cinzel text-lg truncate" style={{ color: "var(--color-primary)" }}>{characterName}</p>
            <p className="text-xs mt-0.5 cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.levelShort} {state.lvl}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="cinzel text-sm" style={{ color: "var(--color-text)" }}>{state.xp}<span className="opacity-70" style={{ color: "var(--color-muted)" }}>/{state.xpNext}</span></p>
            <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>{t.xpLabel}</p>
          </div>
        </div>
        <div className="dash-xp-bar">
          <div className="dash-xp-fill" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Daily Board Section */}
      <div className="mobile-card flex flex-col gap-4">
        {/* Daily progress strip & Board Title */}
        <div className="flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="cinzel text-[11px] font-bold tracking-[0.15em] uppercase drop-shadow-sm flex items-center gap-1.5" style={{color: "var(--color-primary)"}}>
              <span className="text-[12px]">{t.dailyBoardIcon}</span> {t.dailyBoard}
            </span>
            <span className="cinzel text-[11px] font-bold opacity-80" style={{ color: "var(--color-text)" }}>{completedToday}<span className="opacity-50">/6</span></span>
          </div>
          <div className="dash-progress-strip">
            <div className="flex gap-1 flex-1">
              {Array.from({ length: 6 }).map((_, i) => {
                const isActive = completedToday > i;
                const isMilestone = i + 1 === 4 || i + 1 === 5 || i + 1 === 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full transition-all duration-300" style={{ background: isActive ? "var(--color-primary)" : isMilestone ? "var(--card-border-idle)" : "rgba(255,255,255,0.1)", boxShadow: isActive ? "0 0 6px var(--color-primary-glow)" : "none" }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Milestones row */}
        <div className="grid grid-cols-3 gap-2">
          {milestoneSteps.map((step) => {
            const unlocked = completedToday >= step.target;
            return (
              <div key={step.target} className={`dash-milestone mobile-pressable ${unlocked ? "dash-milestone-on" : ""}`}>
                <div className={`text-[20px] leading-tight mb-[2px] drop-shadow-md ${unlocked ? "" : "opacity-40 grayscale"}`}>{step.rune}</div>
                <div className={"cinzel text-[11px] font-bold tracking-wider mb-0.5"}>
                  <span style={{ color: unlocked ? "var(--color-primary)" : "var(--color-text)", opacity: unlocked ? 1 : 0.6 }}>{step.target} <span className="text-[9px] uppercase tracking-widest opacity-60">{t.itemLabel}</span></span>
                </div>
                <div className={"text-[10px] font-extrabold tracking-tight whitespace-nowrap flex flex-wrap items-center justify-center"} style={{ color: unlocked ? "var(--color-text)" : "var(--color-muted)", opacity: unlocked ? 1 : 0.6, filter: unlocked ? "drop-shadow(0 0 2px var(--color-primary-glow))" : "none" }}>
                  {step.reward.split(new RegExp(`(${t.streakIcon}|${t.tokenIcon})`)).map((part, i) => (
                    part === t.streakIcon || part === t.tokenIcon ? (
                      <span key={i} className="text-[13px] leading-none ml-0.5 drop-shadow-sm">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quest board with tabs */}
      <div className="mobile-card">
        <QuestBoard
          pinnedQuests={pinnedQuests} otherQuests={otherQuests}
          pinnedQuestProgressById={pinnedQuestProgressById}
          canRerollRandom={canReroll}
          onRerollRandom={onReroll}
          rerollButtonLabel={rerollButtonLabel}
          rerollButtonTitle={rerollButtonTitle}
          completedIds={state.completed}
          questRenderCount={questRenderCount}
          onCompleteQuest={onCompleteQuest}
          resetTimer={resetTimer}
          streakFreezeActive={state.streakFreezeActive}
          compact
        />
      </div>
    </div>
  );
}
