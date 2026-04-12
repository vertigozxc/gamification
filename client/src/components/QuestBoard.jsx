import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";

function QuestBoard({
  pinnedQuests,
  otherQuests,
  pinnedQuestProgressById,
  canRerollRandom,
  onRerollRandom,
  rerollButtonLabel,
  rerollButtonTitle,
  completedIds,
  questRenderCount,
  onCompleteQuest,
  resetTimer,
  streakFreezeActive
}) {
  const { t } = useTheme();
  const totalQuestCount = pinnedQuests.length + otherQuests.length;
  const remainingQuestCount = Math.max(0, totalQuestCount - completedIds.length);

  return (
    <div className="lg:col-span-2 relative">
      <div className="rounded-2xl p-6" style={{ background: "var(--section-quest-bg)", border: "2px solid var(--section-quest-border)" }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="quest-header-icon">🧭</span>
            <h2 className="cinzel text-2xl text-transparent bg-clip-text tracking-widest" style={{ backgroundImage: "var(--quest-heading-gradient)" }}>
              {t.availableItems} <span className="text-lg align-middle">({remainingQuestCount}/{totalQuestCount})</span>
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 sm:justify-end mt-4" />
        </div>

        <div className="text-sm text-slate-300 text-center mb-6 flex justify-center items-center gap-2">
          <div>
            ⏰ {t.dailyResetLabel} <span className="font-bold font-mono" style={{ color: "var(--color-primary)" }}>{resetTimer}</span>
          </div>
          <div className="relative group inline-block cursor-help z-50">
            <svg className="w-5 h-5 text-slate-400 hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
              {t.dailyBoardTooltip || "Ежедневная доска, случайные задания и прогресс стрика обновляются в полночь по локальному времени. Не забывайте выполнять задания, чтобы получать награды и повышать стрик!"}
            </div>
          </div>
          {streakFreezeActive && (
            <span className="ml-3 inline-flex items-center gap-1 bg-cyan-900/50 border border-cyan-500/60 rounded-full px-2.5 py-0.5 text-xs text-cyan-300 cinzel">
              {t.streakProtectedBadge}
            </span>
          )}
        </div>

        {pinnedQuests.length > 0 && (
          <div className="mb-5 rounded-2xl p-4 shadow-lg" style={{ background: "var(--pinned-section-bg)", border: "2px solid var(--pinned-section-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="cinzel text-sm uppercase tracking-[0.2em] font-bold" style={{ color: "var(--pinned-heading)" }}>{t.pinnedSection}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pinnedQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const pinnedProgress = pinnedQuestProgressById?.[quest.id] || { daysCompleted: 0, totalDays: 21 };
                const progressPercent = Math.max(0, Math.min(100, (pinnedProgress.daysCompleted / pinnedProgress.totalDays) * 100));

                return (
                  <div
                    key={`pinned-${quest.id}`}
                    className={`quest-card p-5 rounded-xl flex flex-col min-h-[15rem] ${isDone ? "completed" : ""}`}
                    style={Object.assign({ background: "var(--card-pinned-bg)", border: "2px solid var(--card-pinned-border)" }, !isDone && questRenderCount === 0 ? { animationDelay: `${index * 0.1}s` } : {})}
                    onClick={(event) => onCompleteQuest(quest, event)}
                  >
                    <div className="quest-card-meta">
                      <div className="quest-category-block">
                        <p className="quest-category-value">{String(quest.category || "Uncategorized").toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="cinzel text-xs md:text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--xp-badge-bg)", color: "var(--xp-badge-text)" }}>+{quest.xp} {t.xpLabel}</span>
                      </div>
                    </div>

                    <div className="flex-grow mt-3">
                      <h3 className="cinzel text-lg text-white font-bold mb-1">{quest.title}</h3>
                      <p className="text-slate-300 text-sm">{quest.desc}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-700/60">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="cinzel text-[11px] tracking-widest uppercase shrink-0" style={{ color: "var(--color-primary)" }}>{t.progressLabel || "Progress"}</p>
                          <span className="cinzel text-sm font-bold text-white">{pinnedProgress.daysCompleted}/{pinnedProgress.totalDays}</span>
                        </div>
                        {isDone && (
                          <span className="completed-badge" style={{ position: "static", transform: "none", padding: "0.26rem 0.65rem", fontSize: "0.72rem", letterSpacing: "0.12em" }}>
                            {t.completedLabel}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-4 bg-black rounded-full border border-yellow-700 overflow-hidden shadow-inner">
                        <div className="bar-fill h-full rounded-full" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {otherQuests.length > 0 && (
          <div className="rounded-2xl p-4 shadow-lg" style={{ background: "var(--pinned-section-bg)", border: "2px solid var(--pinned-section-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="cinzel text-sm uppercase tracking-[0.2em] font-bold" style={{ color: "var(--pinned-heading)" }}>{t.otherSection}</h3>
                <button
                  type="button"
                  onClick={onRerollRandom}
                  disabled={!canRerollRandom}
                  className="cinzel font-bold px-4 py-2 rounded-lg border transition-all text-[11px] flex justify-center items-center gap-1.5 whitespace-nowrap bg-gradient-to-r from-violet-700 to-purple-700 border-violet-400 text-white hover:from-violet-600 hover:to-purple-600 shadow-md shadow-violet-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={rerollButtonTitle}
                >
                  <span>🎲</span>
                  {rerollButtonLabel}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                return (
                  <div
                    key={quest.id}
                    className={`quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? "completed" : ""}`}
                    style={!isDone && questRenderCount === 0 ? { animationDelay: `${(index + 4) * 0.1}s` } : {}}
                    onClick={(event) => onCompleteQuest(quest, event)}
                  >
                    <div className="quest-card-meta">
                      <div className="quest-category-block">
                        <p className="quest-category-value">{String(quest.category || "Uncategorized").toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="cinzel text-xs md:text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--xp-badge-bg)", color: "var(--xp-badge-text)" }}>+{quest.xp} {t.xpLabel}</span>
                      </div>
                    </div>
                    <div className="flex-grow mt-3">
                      <h3 className="cinzel text-lg text-white font-bold mb-1">{quest.title}</h3>
                      <p className="text-slate-300 text-sm">{quest.desc}</p>
                    </div>
                    {!isDone && <div className="text-xs cinzel text-slate-400">{t.clickPrompt}</div>}
                    {isDone && <span className="completed-badge">{t.completedLabel}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

QuestBoard.propTypes = {
  pinnedQuests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string,
    desc: PropTypes.string,
    xp: PropTypes.number,
    category: PropTypes.string,
    icon: PropTypes.string
  })).isRequired,
  otherQuests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string,
    desc: PropTypes.string,
    xp: PropTypes.number,
    category: PropTypes.string,
    icon: PropTypes.string
  })).isRequired,
  pinnedQuestProgressById: PropTypes.object,
  canRerollRandom: PropTypes.bool.isRequired,
  onRerollRandom: PropTypes.func.isRequired,
  rerollButtonLabel: PropTypes.string.isRequired,
  rerollButtonTitle: PropTypes.string.isRequired,
  completedIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  questRenderCount: PropTypes.number.isRequired,
  onCompleteQuest: PropTypes.func.isRequired,
  resetTimer: PropTypes.string.isRequired,
  streakFreezeActive: PropTypes.bool.isRequired
};

export default QuestBoard;
