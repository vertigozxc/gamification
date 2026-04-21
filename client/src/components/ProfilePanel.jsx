import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";

function ProfilePanel({
  portraitUploadRef,
  portraitData,
  onPortraitUpload,
  state,
  levelDisplayRef,
  editingName,
  nameDraft,
  characterName,
  onNameDraftChange,
  onSubmitNameEdit,
  onStartEditingName,
  onCancelEditingName,
  xpPercent,
  completedToday,
  milestoneProgressPercent,
  milestoneSteps,
  streakBonusPercent,
  maxDailyQuests,
  compact = false
}) {
  const { t } = useTheme();
  const totalSegments = Math.max(1, Number(maxDailyQuests) || 6);
  const milestoneTargets = new Set(milestoneSteps.map((step) => step.target));
  return (
    <div className={`${compact ? "p-4 mb-4" : "p-4 mb-8"} rounded-3xl shadow-2xl`} style={{ background: "var(--panel-bg)", border: "2px solid var(--panel-border)" }}>
      <div className={`grid grid-cols-1 ${compact ? "gap-4" : "lg:grid-cols-3 gap-8 items-center"}`}>
        <div className={`flex flex-col items-center justify-center ${compact ? "" : "lg:col-span-1"}`}>
          <div className="text-center">
            <div className="flex flex-col items-center">
              <p className={`cinzel tracking-widest uppercase mb-1 font-bold ${compact ? "text-sm" : "text-xl"}`} style={{ color: "var(--color-primary)" }}>{t.levelLabel}</p>
              <p ref={levelDisplayRef} className={`cinzel lvl-text font-black drop-shadow-lg ${compact ? "text-6xl" : "text-8xl"}`} style={{ color: "var(--color-primary)" }}>{state.lvl}</p>
            </div>
            {!editingName ? (
              <p className="character-name text-slate-400 cinzel text-sm tracking-wider uppercase cursor-pointer hover:text-yellow-300 transition-colors mt-2" title={t.doubleClickEditName} onDoubleClick={onStartEditingName}>
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

        <div className={`${compact ? "" : "lg:col-span-2"} flex flex-col w-full`}>
          <div className={`grid grid-cols-1 ${compact ? "gap-3 mb-3" : "md:grid-cols-[6fr_4fr] gap-4 mb-4 items-stretch"}`}>
            {/* Progress Board */}
            <div className={`bg-slate-900/80 border border-yellow-700/80 rounded-lg shadow-lg w-full ${compact ? "px-3 py-3" : "px-4 py-2"}`} style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex justify-between items-center mb-2">
                <p className={`cinzel tracking-widest uppercase ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--color-primary)" }}>{t.levelProgress}</p>
                <span className={`cinzel text-slate-400 ${compact ? "text-xs" : "text-sm"}`}>{state.xp} / {state.xpNext} {t.xpLabel}</span>
              </div>
              <div className={`w-full bg-black rounded-full border border-yellow-700 overflow-hidden ${compact ? "h-4" : "h-6"}`}>
                <div className="bar-fill h-full rounded-full" style={{ width: `${xpPercent}%` }} />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="cinzel text-xs" style={{ color: "var(--color-primary)" }}>{t.levelShort} {state.lvl}</span>
                <span className="cinzel text-xs text-slate-500">{t.levelShort} {state.lvl + 1}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-700/30">
                <span className="cinzel text-[11px] tracking-widest uppercase" style={{ color: "var(--color-muted)" }}>{t.currentStreak}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">🔥</span>
                  <span className="cinzel text-sm font-bold" style={{ color: "var(--streak-text)" }}>{state.streak}</span>
                </span>
              </div>
            </div>

            {/* Streak Section */}
            <div className={`${compact ? "p-3" : "p-4"} rounded-lg border-2 shadow-lg w-full relative`} style={{ background: "var(--streak-bg)", borderColor: "var(--streak-border)" }}>
              <div className="absolute top-2 right-2 group cursor-help z-50">
                <svg className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <div className="absolute right-0 top-full mt-1 w-56 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
                  {t.streakTooltip}
                </div>
              </div>
              <div className="flex items-center gap-4 h-full">
                <div className="flex items-center gap-4">
                  <p className={compact ? "text-4xl" : "text-5xl"}>🔥</p>
                  <div>
                    <p className="cinzel text-xs tracking-widest uppercase" style={{ color: "var(--streak-label)" }}>{t.currentStreak}</p>
                    <p className={`${compact ? "text-3xl" : "text-4xl"} font-black cinzel leading-none`} style={{ color: "var(--streak-text)" }}>{state.streak}</p>
                    <p className="text-xs cinzel tracking-wide mt-1" style={{ color: "var(--color-primary)" }}>+{streakBonusPercent}% {t.xpMultiplier}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Board */}
          <div className={`daily-board-panel bg-slate-900/80 rounded-lg shadow-lg w-full ${compact ? "px-3 py-3" : "px-3 py-2"}`} style={{ borderWidth: 1, borderStyle: "solid", borderColor: "var(--panel-border)" }}>
            <div className="flex justify-between items-center mb-2">
              <p className="cinzel text-[10px] tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.dailyBoard}</p>
              <div className="flex items-center gap-3">
                <span className="daily-board-count text-[10px] cinzel text-slate-400"><span className="text-white font-bold">{completedToday}</span> / <span>{totalSegments}</span></span>
              </div>
            </div>
            
            {/* Segmented Progress Tracker */}
            <div className="flex gap-1 w-full h-2 mt-2 mb-3">
              {Array.from({ length: totalSegments }).map((_, i) => {
                const isActive = completedToday > i;
                const isMilestone = milestoneTargets.has(i + 1);
                return (
                  <div
                    key={i}
                    className={`daily-board-segment flex-1 rounded-sm transition-all duration-300 ${
                      isActive
                        ? "daily-board-segment-active bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]"
                        : "daily-board-segment-inactive bg-slate-800"
                    } ${isMilestone && !isActive ? "daily-board-segment-milestone bg-slate-600" : ""}`}
                  />
                );
              })}
            </div>

            {/* Milestone Cards */}
            <div className="flex justify-between gap-2 w-full">
              {milestoneSteps.map((step) => {
                const unlocked = completedToday >= step.target;
                return (
                  <div key={step.target} className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded border overflow-hidden ${
                    unlocked 
                      ? "daily-board-card-unlocked bg-yellow-900/20 border-yellow-700/50 shadow-[inset_0_0_10px_rgba(234,179,8,0.15)]" 
                      : "daily-board-card-locked bg-slate-900/60 border-slate-700/50"
                  }`}>
                    <p className={`text-[20px] mb-1.5 drop-shadow-md ${unlocked ? "" : "opacity-40 grayscale"}`}>{step.rune}</p>
                    <p className={`daily-board-milestone-label cinzel text-[11px] font-bold tracking-wider mb-1 whitespace-nowrap ${unlocked ? "text-yellow-400" : "text-slate-400"}`}>
                      {step.target} {t.itemLabel}
                    </p>
                    <div className={`daily-board-reward text-[11.5px] font-bold tracking-tight text-center flex flex-wrap items-center justify-center ${unlocked ? "text-amber-200" : "text-slate-500"}`}>
                      {step.reward.split(/(🔥|🪙)/).map((part, i) => (
                        part === '🔥' || part === '🪙' ? (
                          <span key={i} className="text-[18px] leading-none mx-0.5 drop-shadow-sm">{part}</span>
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

        </div>
      </div>
    </div>
  );
}

ProfilePanel.propTypes = {
  state: PropTypes.shape({
    lvl: PropTypes.number.isRequired,
    xp: PropTypes.number.isRequired,
    xpNext: PropTypes.number.isRequired,
    streak: PropTypes.number.isRequired,
    completed: PropTypes.arrayOf(PropTypes.number).isRequired,
    hasRerolledToday: PropTypes.bool.isRequired,
    extraRerollsToday: PropTypes.number.isRequired
  }).isRequired,
  levelDisplayRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  editingName: PropTypes.bool.isRequired,
  nameDraft: PropTypes.string.isRequired,
  characterName: PropTypes.string.isRequired,
  onNameDraftChange: PropTypes.func.isRequired,
  onSubmitNameEdit: PropTypes.func.isRequired,
  onStartEditingName: PropTypes.func.isRequired,
  onCancelEditingName: PropTypes.func.isRequired,
  xpPercent: PropTypes.number.isRequired,
  completedToday: PropTypes.number.isRequired,
  milestoneProgressPercent: PropTypes.number.isRequired,
  milestoneSteps: PropTypes.arrayOf(PropTypes.shape({
    target: PropTypes.number.isRequired,
    reward: PropTypes.string.isRequired,
    rune: PropTypes.string.isRequired
  })).isRequired,
  streakBonusPercent: PropTypes.number.isRequired,
  maxDailyQuests: PropTypes.number,
  compact: PropTypes.bool
};

export default ProfilePanel;

