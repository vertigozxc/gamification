import TokenVault from "../TokenVault";

export default function StoreTab({
  tokens, streakFreezeActive, extraRerollsToday, hasRerolledToday,
  freezeStreakPending,
  canRerollPinned, isFreePinnedReroll, daysUntilFreePinnedReroll,
  onOpenPinnedReplacement, onFreezeStreak, onBuyExtraReroll, t
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden mobile-card flex flex-col gap-4 border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]" style={{ background: "linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(2, 6, 23, 0.95))" }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05]"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="mobile-section-kicker mb-1 leading-none" style={{ color: "var(--color-primary-dim)" }}>Your Balance</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">{t.tokenIcon}</span>
              <h2 className="cinzel text-5xl font-bold tracking-wide" style={{ color: "var(--color-primary)", textShadow: "0 4px 15px rgba(0,0,0,0.6)" }}>{tokens}</h2>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="inline-flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]"></span>
                Vault Active
              </div>
              <p className="text-[9px] tracking-wider uppercase mt-0.5 opacity-80" style={{ color: "var(--color-text)" }}>Daily limits apply</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px my-1" style={{ background: "linear-gradient(to right, transparent, var(--card-border-idle), transparent)" }}></div>

      <TokenVault
        tokens={tokens}
        streakFreezeActive={streakFreezeActive}
        freezeStreakPending={freezeStreakPending}
        extraRerollsToday={extraRerollsToday}
        hasRerolledToday={hasRerolledToday}
        canRerollPinned={canRerollPinned}
        isFreePinnedReroll={isFreePinnedReroll}
        daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
        onOpenPinnedReplacement={onOpenPinnedReplacement}
        onFreezeStreak={onFreezeStreak}
        onBuyExtraReroll={onBuyExtraReroll}
        compact
      />
    </div>
  );
}
