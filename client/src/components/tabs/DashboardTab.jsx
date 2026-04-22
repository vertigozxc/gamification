import QuestBoard from "../QuestBoard";
import { useTheme } from "../../ThemeContext";
import DashboardChallengeStrip from "../social/DashboardChallengeStrip";

export default function DashboardTab({
  state, characterName, t,
  xpPercent, completedToday, milestoneSteps,
  streakBonusPercent = 0,
  maxDailyQuests = 6,
  pinnedQuests, otherQuests, pinnedQuestProgressById,
  dailyQuestFreshDayKey, dailyQuestFreshStorageId,
  canReroll, allRandomCompleted, questRenderCount,
  pendingQuestIds,
  resetTimer,
  onReroll, onCompleteQuest,
  rerollButtonLabel, rerollButtonTitle,
  rerollingQuestId, rerollingPinned,
  renderQuestTimer,
  emptyPinnedSlotCount,
  emptyOtherSlotCount,
  onOpenHabitPicker,
  authUser,
  onOpenSocial
}) {
  const { themeId } = useTheme();
  const isLight = themeId === "light";
  const totalSegments = Math.max(1, Number(maxDailyQuests) || 6);
  const milestoneTargetSet = new Set(milestoneSteps.map((step) => step.target));
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Hero: XP + Level compact row */}
      <div className="dash-hero top-screen-block">
        <div className="dash-hero-top">
          <div className="min-w-0 flex-1 flex flex-col gap-0">
            <p className="cinzel text-lg truncate" style={{ color: "var(--color-primary)" }}>{characterName}</p>
            <p className="text-xs cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.levelShort} {state.lvl}</p>
            <p className="cinzel text-sm" style={{ color: "var(--color-text)" }}>{state.xp}<span className="opacity-70" style={{ color: "var(--color-muted)" }}>/{state.xpNext}</span></p>
          </div>
          <div className="text-right shrink-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-end gap-1">
              <p className="text-xs cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.currentStreak}</p>
              <span className="text-base">🔥</span>
              <p className="text-xs cinzel font-bold" style={{ color: "var(--streak-text)" }}>{state.streak}</p>
            </div>
            <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>+{streakBonusPercent}% {t.xpMultiplier}</p>
            {(() => {
              const sportLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[0]) || 0)));
              const sportBonusPct = sportLvl * 5;
              if (sportBonusPct <= 0) return null;
              return (
                <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>
                  +{sportBonusPct}% {t.dashSportBonusFrom || "from"} {t.districtSport || "Sports"}
                </p>
              );
            })()}
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
            <span className="cinzel text-[11px] font-bold opacity-80" style={{ color: "var(--color-text)" }}>{completedToday}<span className="opacity-50">/{totalSegments}</span></span>
          </div>
          <div className="dash-progress-strip">
            <div className="flex gap-1 flex-1">
              {Array.from({ length: totalSegments }).map((_, i) => {
                const isActive = completedToday > i;
                const isMilestone = milestoneTargetSet.has(i + 1);
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
                <div className={`text-[20px] leading-tight mb-[2px] drop-shadow-md ${unlocked ? "" : isLight ? "opacity-75" : "opacity-40 grayscale"}`}>{step.rune}</div>
                <div className={"cinzel text-[11px] font-bold tracking-wider mb-0.5"}>
                  <span style={{ color: unlocked ? "var(--color-primary)" : isLight ? "#3d4450" : "var(--color-text)", opacity: unlocked ? 1 : isLight ? 1 : 0.6 }}>{step.target} <span className="text-[9px] uppercase tracking-widest opacity-60">{step.target >= 5 && t.itemLabelPlural ? t.itemLabelPlural : t.itemLabel}</span></span>
                </div>
                <div className={"text-[10px] font-extrabold tracking-tight whitespace-nowrap flex flex-wrap items-center justify-center"} style={{ color: unlocked ? "var(--color-text)" : isLight ? "#3d4450" : "var(--color-muted)", opacity: unlocked ? 1 : isLight ? 1 : 0.6, filter: unlocked ? "drop-shadow(0 0 2px var(--color-primary-glow))" : "none" }}>
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

      {/* Quest board with tabs. The group-challenges strip is slotted
          directly under the daily-reset timer row via `postTimerRow`. */}
      <div className="mobile-card">
        <QuestBoard
          pinnedQuests={pinnedQuests} otherQuests={otherQuests}
          pinnedQuestProgressById={pinnedQuestProgressById}
          dailyQuestFreshDayKey={dailyQuestFreshDayKey}
          dailyQuestFreshStorageId={dailyQuestFreshStorageId}
          canRerollRandom={canReroll}
          onRerollRandom={onReroll}
          rerollButtonLabel={rerollButtonLabel}
          rerollButtonTitle={rerollButtonTitle}
          completedIds={state.completed}
          pendingQuestIds={pendingQuestIds}
          questRenderCount={questRenderCount}
          onCompleteQuest={onCompleteQuest}
          resetTimer={resetTimer}
          postTimerRow={<DashboardChallengeStrip authUser={authUser} t={t} onOpenSocial={onOpenSocial} />}
          rerollingQuestId={rerollingQuestId}
          rerollingPinned={rerollingPinned}
          renderQuestTimer={renderQuestTimer}
          emptyPinnedSlotCount={emptyPinnedSlotCount}
          emptyOtherSlotCount={emptyOtherSlotCount}
          onOpenHabitPicker={onOpenHabitPicker}
          maxDailyQuests={totalSegments}
          compact
        />
      </div>
    </div>
  );
}
