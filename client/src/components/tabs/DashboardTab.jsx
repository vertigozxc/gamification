import { useCallback, useEffect, useRef, useState } from "react";
import QuestBoard from "../QuestBoard";
import { useTheme } from "../../ThemeContext";
import { completeChallenge, fetchUserChallenges, joinChallenge, leaveChallenge } from "../../api";
import { IconFlame } from "../icons/Icons";
// (IconFlame is also used inside the milestone-reward renderer below.)

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function DashboardTab({
  state, characterName, t,
  xpPercent, completedToday, milestoneSteps,
  streakBonusPercent = 0,
  xpBoostExpiresAt = null,
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
  renderQuestMechanic,
  emptyPinnedSlotCount,
  emptyOtherSlotCount,
  onOpenHabitPicker,
  authUser,
  questsLoaded = true,
  computeEffectiveQuestXp,
}) {
  const { themeId } = useTheme();
  const isLight = themeId === "light";
  const totalSegments = Math.max(1, Number(maxDailyQuests) || 6);
  const milestoneTargetSet = new Set(milestoneSteps.map((step) => step.target));

  // ── Challenge state ──────────────────────────────────────────────────────
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenges, setChallenges] = useState([]);
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [busyChallengeId, setBusyChallengeId] = useState(null);
  const [optimisticDone, setOptimisticDone] = useState(() => new Set());

  const refreshChallenges = useCallback(async () => {
    if (!meUid) return;
    try {
      const data = await fetchUserChallenges(meUid);
      const now = Date.now();
      setChallenges((data?.challenges || []).filter((c) => new Date(c.endsAt).getTime() > now));
    } catch {
      setChallenges([]);
    } finally {
      setChallengesLoaded(true);
    }
  }, [meUid]);

  useEffect(() => { refreshChallenges(); }, [refreshChallenges]);
  useEffect(() => {
    const h = () => refreshChallenges();
    window.addEventListener("social:refresh-challenges", h);
    return () => window.removeEventListener("social:refresh-challenges", h);
  }, [refreshChallenges]);

  const handleCompleteChallenge = useCallback(async (id) => {
    setBusyChallengeId(id);
    setOptimisticDone((prev) => new Set(prev).add(id));
    try {
      await completeChallenge(id, meUid);
      await refreshChallenges();
    } catch {
      setOptimisticDone((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } finally {
      setBusyChallengeId(null);
    }
  }, [meUid, refreshChallenges]);

  const handleAcceptChallenge = useCallback(async (id) => {
    setBusyChallengeId(id);
    try { await joinChallenge(id, meUid); await refreshChallenges(); }
    catch { /* silent */ } finally { setBusyChallengeId(null); }
  }, [meUid, refreshChallenges]);

  const handleDeclineChallenge = useCallback(async (id) => {
    setBusyChallengeId(id);
    try { await leaveChallenge(id, meUid); await refreshChallenges(); }
    catch { /* silent */ } finally { setBusyChallengeId(null); }
  }, [meUid, refreshChallenges]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Hero: XP + Level compact row */}
      <div className="dash-hero city-hero-surface top-screen-block">
        <div className="dash-hero-top relative z-10">
          <div className="min-w-0 flex-1 flex flex-col gap-0">
            <p className="cinzel text-lg truncate" style={{ color: "var(--color-primary)" }}>{characterName}</p>
            <p className="text-xs cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.levelShort} {state.lvl}</p>
            <p className="cinzel text-sm" style={{ color: "var(--color-text)" }}>{state.xp}<span className="opacity-70" style={{ color: "var(--color-muted)" }}>/{state.xpNext}</span></p>
          </div>
          <div className="text-right shrink-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-end gap-1">
              <p className="text-xs cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.currentStreak}</p>
              <span style={{ display: "inline-flex", color: "var(--streak-text)" }}><IconFlame size={14} /></span>
              <p className="text-xs cinzel font-bold" style={{ color: "var(--streak-text)" }}>{state.streak}</p>
            </div>
            <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>+{streakBonusPercent}% XP {t.dashSportBonusFrom || "from"} {t.streakLabel || "Streak"}</p>
            {(() => {
              const ms = xpBoostExpiresAt ? new Date(xpBoostExpiresAt).getTime() - Date.now() : 0;
              if (ms <= 0) return null;
              const daysLeft = Math.max(1, Math.ceil(ms / 86400000));
              const dayLabel = daysLeft === 1 ? t.daySingular : t.dayPlural;
              return (
                <p className="text-[10px] opacity-80 cinzel tracking-wider" style={{ color: "#d97706" }}>
                  +15% {t.xpBoostDashLabel || "XP Boost"} · {daysLeft} {dayLabel}
                </p>
              );
            })()}
            {(() => {
              const sportLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[0]) || 0)));
              const sportBonusPct = sportLvl * 5;
              if (sportBonusPct <= 0) return null;
              return (
                <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>
                  +{sportBonusPct}% XP {t.dashSportBonusFrom || "from"} {t.cityLabel || "City"}
                </p>
              );
            })()}
          </div>
        </div>
        <div className="dash-xp-bar relative z-10">
          <div className="dash-xp-fill" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Daily Board Section */}
      <div data-tour="daily-board" className="mobile-card flex flex-col gap-4" style={{ background: "var(--panel-bg)" }}>
        <div className="flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="cinzel text-[11px] font-bold tracking-[0.15em] uppercase drop-shadow-sm flex items-center gap-1.5" style={{ color: "var(--color-primary)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="14" height="17" rx="2.5" />
                <path d="M8.5 9 L9.8 10.2 L12.2 7.8" />
                <line x1="14" y1="9" x2="16" y2="9" />
                <line x1="8.5" y1="13.8" x2="15.5" y2="13.8" />
                <line x1="8.5" y1="17.2" x2="13" y2="17.2" />
              </svg>
              {t.dailyBoard}
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

        <div className="grid grid-cols-3 gap-2">
          {milestoneSteps.map((step) => {
            const unlocked = completedToday >= step.target;
            return (
              <div key={step.target} className={`dash-milestone mobile-pressable ${unlocked ? "dash-milestone-on" : ""}`}>
                <div className={`text-[20px] leading-tight mb-[2px] drop-shadow-md ${unlocked ? "" : isLight ? "opacity-75" : "opacity-40 grayscale"}`}>{step.rune}</div>
                <div className="cinzel text-[11px] font-bold tracking-wider mb-0.5">
                  <span style={{ color: unlocked ? "var(--color-primary)" : isLight ? "#3d4450" : "var(--color-text)", opacity: unlocked ? 1 : isLight ? 1 : 0.6 }}>{step.target} <span className="text-[9px] uppercase tracking-widest opacity-60">{step.target >= 5 && t.itemLabelPlural ? t.itemLabelPlural : t.itemLabel}</span></span>
                </div>
                {Array.isArray(step.parts) && step.parts.length > 1 ? (
                  // Multi-reward (jackpot) milestone — render each reward
                  // as its own colored pill so XP / silver / streak read
                  // distinctly instead of mashing into one cramped line.
                  <div className="dash-milestone-pills" style={{ opacity: unlocked ? 1 : 0.55 }}>
                    {step.parts.map((p, i) => (
                      <span key={`${p.kind}-${i}`} className={`dash-milestone-pill dash-milestone-pill-${p.kind}`}>
                        {p.kind === "streak" ? (
                          <span className="dash-milestone-pill-icon" aria-hidden="true">
                            <IconFlame size={11} />
                          </span>
                        ) : (
                          <span className="dash-milestone-pill-icon" aria-hidden="true">
                            {p.kind === "silver" ? t.silverIcon : "⚡"}
                          </span>
                        )}
                        <span className="dash-milestone-pill-amount">+{p.amount}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  // Single-reward milestone (XP only) — keep the simple
                  // centered "+N XP" rendering, no need for chips.
                  <div className="text-[10px] font-extrabold tracking-tight whitespace-nowrap flex flex-wrap items-center justify-center" style={{ color: unlocked ? "var(--color-text)" : isLight ? "#3d4450" : "var(--color-muted)", opacity: unlocked ? 1 : isLight ? 1 : 0.6, filter: unlocked ? "drop-shadow(0 0 2px var(--color-primary-glow))" : "none" }}>
                    +{(step.parts && step.parts[0]?.amount) || ""} {t.xpLabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quest board with Habits / Quests / Challenges tabs.
          Don't mount QuestBoard at all until BOTH the user's gameplay
          state and the group-challenges fetch have resolved. Mounting
          it earlier caused two visual glitches on slower connections:
            1. Tab bar would briefly render in 2-tab "equal" layout,
               then re-flow to 3-tab "expanding" once challenges
               arrived — the Quests label collapse transition (~340ms)
               briefly flashed "0/2" on the inactive Quests tab.
            2. Tab counts would render with stale state.zero values
               before the real numbers arrived. */}
      <div
        data-tour="quest-board"
        className="mobile-card"
        style={{ background: "var(--panel-bg)", minHeight: questsLoaded && challengesLoaded ? undefined : 280 }}
      >
        {questsLoaded && challengesLoaded ? (
        <QuestBoard
          computeEffectiveQuestXp={computeEffectiveQuestXp}
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
          rerollingQuestId={rerollingQuestId}
          rerollingPinned={rerollingPinned}
          renderQuestTimer={renderQuestTimer}
          renderQuestMechanic={renderQuestMechanic}
          emptyPinnedSlotCount={emptyPinnedSlotCount}
          emptyOtherSlotCount={emptyOtherSlotCount}
          onOpenHabitPicker={onOpenHabitPicker}
          maxDailyQuests={totalSegments}
          compact
          challenges={challengesLoaded ? challenges : []}
          meUid={meUid}
          busyChallengeId={busyChallengeId}
          optimisticDoneChallenges={optimisticDone}
          onCompleteChallenge={handleCompleteChallenge}
          onAcceptChallenge={handleAcceptChallenge}
          onDeclineChallenge={handleDeclineChallenge}
        />
        ) : (
          <div
            aria-hidden="true"
            style={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div className="ref-spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
