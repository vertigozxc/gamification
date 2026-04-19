import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";

function TokenVault({
  tokens,
  streakFreezeActive,
  freezeStreakPending = false,
  extraRerollsToday,
  hasRerolledToday,
  canRerollPinned,
  isFreePinnedReroll,
  daysUntilFreePinnedReroll,
  onOpenPinnedReplacement,
  onFreezeStreak,
  onBuyExtraReroll,
  compact = false
}) {
  const { t, tf } = useTheme();

  function getPluralizedToken(count, singular = String(t.tokenSingular || "TOKEN").toUpperCase(), plural = String(t.tokenPlural || "TOKENS").toUpperCase()) {
    return count === 1 ? singular : plural;
  }

  return (
    <>
      {compact ? (
        <div className="flex flex-col gap-4">
          <div className={`mobile-card flex flex-col gap-3 ${streakFreezeActive ? "border-cyan-500/60 shadow-[0_0_18px_rgba(6,182,212,0.15)]" : ""}`} style={streakFreezeActive ? { background: "rgba(8, 51, 68, 0.4)" } : { background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧊</span>
              <div className="flex-1">
                <p className="cinzel text-white font-bold text-base tracking-wide">{t.freezeTitle}</p>
                <p className="text-slate-400 text-xs mt-0.5">{t.freezeDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: "var(--xp-badge-bg)", border: "1px solid var(--color-primary-dim)" }}>
                <span className="text-base">{t.tokenIcon}</span>
                <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>3</span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {t.freezeDetail}
            </p>
            {streakFreezeActive ? (
              <div className="mt-auto flex items-center gap-2 bg-cyan-900/40 border border-cyan-500/60 rounded-xl px-4 py-2">
                <span className="text-cyan-300 text-lg">✦</span>
                <span className="cinzel text-cyan-300 text-sm font-bold tracking-widest">{t.freezeActive}</span>
              </div>
            ) : (
              <button
                onClick={onFreezeStreak}
                disabled={tokens < 3 || freezeStreakPending}
                className={`mobile-pressable mt-auto cinzel font-bold px-4 py-2 rounded-xl border border-white/5 transition-all text-sm flex items-center justify-center gap-2 ${
                  tokens >= 3 && !freezeStreakPending
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-md"
                    : "bg-slate-800/80 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span>{t.tokenIcon}</span>
                {freezeStreakPending ? t.processingLabel : tokens < 3 ? t.notEnough : `${t.buyPrefix} 3 ${getPluralizedToken(3)}`}
              </button>
            )}
          </div>

          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎲</span>
              <div className="flex-1">
                <p className="cinzel text-white font-bold text-base tracking-wide">{t.rerollShopTitle}</p>
                <p className="text-slate-400 text-xs mt-0.5">{t.rerollShopDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: "var(--xp-badge-bg)", border: "1px solid var(--color-primary-dim)" }}>
                <span className="text-base">{t.tokenIcon}</span>
                <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>1</span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {t.rerollShopDetail}
            </p>
            {extraRerollsToday > 0 && (
              <div className="flex items-center gap-2 bg-violet-900/30 border border-violet-500/50 rounded-xl px-3 py-1.5">
                <span className="text-violet-300">✦</span>
                <span className="cinzel text-violet-300 text-xs font-bold tracking-widest">{extraRerollsToday} {extraRerollsToday > 1 ? t.rerollReadyPlural : t.rerollReady} {t.rerollReadySuffix}</span>
              </div>
            )}
            <button
              onClick={onBuyExtraReroll}
              disabled={tokens < 1 || !hasRerolledToday}
              className={`mobile-pressable mt-auto cinzel font-bold px-4 py-2 rounded-xl border border-white/5 transition-all text-sm flex items-center justify-center gap-2 ${
                tokens >= 1 && hasRerolledToday
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-md"
                  : "bg-slate-800/80 text-slate-500 cursor-not-allowed"
              }`}
            >
              <span>{t.tokenIcon}</span>
              {!hasRerolledToday ? t.rerollFreeFirst : tokens < 1 ? t.notEnough : `${t.buyPrefix} 1 ${getPluralizedToken(1)}`}
            </button>
          </div>

          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">🧩</span>
              <div className="flex-1">
                <p className="cinzel text-white font-bold text-base tracking-wide">{t.pinnedQuestRerollTitle}</p>
                <p className="text-slate-400 text-xs mt-0.5">{t.pinnedQuestRerollDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1 self-start" style={{ background: "var(--xp-badge-bg)", border: "1px solid var(--color-primary-dim)" }}>
                <span className="text-base">{t.tokenIcon}</span>
                <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{isFreePinnedReroll ? t.freeLabel.toUpperCase() : "7"}</span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {isFreePinnedReroll
                ? t.freeMonthlyPinnedReroll
                : tf("nextFreePinnedReroll", {
                  days: daysUntilFreePinnedReroll,
                  dayLabel: daysUntilFreePinnedReroll === 1 ? t.daySingular : t.dayPlural
                })}
            </p>
            <button
              onClick={onOpenPinnedReplacement}
              disabled={!canRerollPinned}
              className={`mobile-pressable mt-auto cinzel font-bold px-4 py-2 rounded-xl border border-white/5 transition-all text-sm flex items-center justify-center gap-2 ${
                canRerollPinned
                  ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-700 hover:to-violet-700 shadow-md"
                  : "bg-slate-800/80 text-slate-500 cursor-not-allowed"
              }`}
            >
              <span>⟳</span>
              {isFreePinnedReroll ? t.rerollFree : tokens < 7 ? t.notEnough : `${t.buyPrefix} 7 ${getPluralizedToken(7)}`}
            </button>
          </div>

          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)", opacity: 0.7 }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl grayscale">🎴</span>
              <div className="flex-1">
                <p className="cinzel text-slate-300 font-bold text-base tracking-wide">{t.mysteryItemTitle}</p>
                <p className="text-slate-500 text-xs mt-0.5">{t.mysteryItemDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1 self-start" style={{ background: "var(--xp-badge-bg)", border: "1px solid var(--color-primary-dim)", filter: "grayscale(100%)" }}>
                <span className="text-base">{t.tokenIcon}</span>
                <span className="cinzel font-bold text-sm text-slate-400">?</span>
              </div>
            </div>
            <button
              disabled
              className="mt-auto cinzel font-bold px-4 py-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/50 text-slate-500 text-sm flex items-center justify-center gap-2 cursor-not-allowed uppercase tracking-widest"
            >
              {t.comingSoon}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 mb-4">
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--token-bg)", border: "2px solid var(--token-border)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "2px solid var(--token-header-border)" }}>
                <h2 className="flex items-center gap-2 cinzel text-transparent bg-clip-text font-bold text-xl tracking-[0.18em] uppercase" style={{ backgroundImage: "var(--heading-gradient)" }}>
                  {t.tokenSection}
                  <div className="relative group inline-block cursor-help z-50">
                    <svg className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans font-normal normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
                      {t.tokenTooltip}
                    </div>
                  </div>
                </h2>
              <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--token-header-border)" }}>
                <span className="text-2xl">{t.tokenIcon}</span>
                <span className="cinzel text-lg font-bold" style={{ color: "var(--color-primary)" }}>{tokens}</span>
                <span className="cinzel text-xs" style={{ color: "var(--color-muted)" }}>{getPluralizedToken(tokens)}</span>
              </div>
            </div>
            <div className="px-6 py-5">

              <div className="flex flex-col md:flex-row items-stretch gap-6 px-1 py-1">
                <div className="flex-1 flex flex-col gap-4">
                  <p className="mobile-section-kicker">{t.tokenAboutTitle}</p>
                  
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span className="text-3xl grayscale brightness-150">🪙</span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.tokenAboutWhatAre}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.tokenAboutWhatAreDesc}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span className="text-3xl grayscale brightness-150">⚔️</span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.tokenAboutHowEarn}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.tokenAboutHowEarnDesc}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span className="text-3xl grayscale brightness-150">🛍️</span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.tokenAboutUseFor}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.tokenAboutUseForDesc}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 w-full md:w-1/4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 rounded-xl border border-slate-700/60 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 transition-opacity bg-cover opacity-10"></div>
                  <p className="cinzel text-slate-400 font-bold tracking-[0.2em] text-xs z-10 mb-4 text-center">{t.tokenBalanceLabel}</p>
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-7xl drop-shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-transform group-hover:scale-110 duration-500">{t.tokenIcon}</span>
                    <p className="cinzel text-5xl font-bold mt-4" style={{ color: "var(--color-primary)", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{tokens}</p>
                    <span className="cinzel text-sm text-slate-500 mt-2">{getPluralizedToken(tokens)}</span>
                  </div>
                </div>
              </div>
  
            </div>
          </div>
        </div>
      )}
    </>
  );
}

TokenVault.propTypes = {
  tokens: PropTypes.number.isRequired,
  streakFreezeActive: PropTypes.bool.isRequired,
  freezeStreakPending: PropTypes.bool,
  extraRerollsToday: PropTypes.number.isRequired,
  hasRerolledToday: PropTypes.bool.isRequired,
  canRerollPinned: PropTypes.bool.isRequired,
  isFreePinnedReroll: PropTypes.bool.isRequired,
  daysUntilFreePinnedReroll: PropTypes.number.isRequired,
  onOpenPinnedReplacement: PropTypes.func.isRequired,
  onFreezeStreak: PropTypes.func.isRequired,
  onBuyExtraReroll: PropTypes.func.isRequired,
  compact: PropTypes.bool
};

export default TokenVault;
