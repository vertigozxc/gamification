import TokenVault from "../TokenVault";

export default function StoreTab({
  tokens, streakFreezeCharges = 0, freezeCost = 7, rerollCost = 3,
  freezeWeeklyLocked = false, residentialLevel = 0,
  extraRerollsToday, hasRerolledToday,
  freezeStreakPending,
  canRerollPinned, isFreePinnedReroll, daysUntilFreePinnedReroll,
  onOpenPinnedReplacement, onFreezeStreak, onBuyExtraReroll, t
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden mobile-card top-screen-block flex flex-col gap-4 shadow-[0_0_20px_rgba(234,179,8,0.1)]" style={{ background: "var(--card-bg)" }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05]"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="mobile-section-kicker mb-1 leading-none" style={{ color: "var(--color-primary-dim)" }}>{t.storeBalanceTitle}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">{t.tokenIcon}</span>
              <h2 className="cinzel text-5xl font-bold tracking-wide" style={{ color: "var(--color-primary)", textShadow: "0 4px 15px rgba(0,0,0,0.6)" }}>{tokens}</h2>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="inline-flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(16,185,129,0.15)]" style={{ background: "color-mix(in srgb, var(--color-success) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--color-success) 32%, transparent)", color: "var(--color-success)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]"></span>
                {t.storeVaultActive}
              </div>
              <p className="text-[9px] tracking-wider uppercase mt-0.5 opacity-80" style={{ color: "var(--color-text)" }}>{t.storeDailyLimits}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px my-1" style={{ background: "linear-gradient(to right, transparent, var(--card-border-idle), transparent)" }}></div>

      {residentialLevel > 0 && (() => {
        const perks = [];
        if (residentialLevel >= 1) perks.push(t.perkResidential1);
        if (residentialLevel >= 2) perks.push(t.perkResidential2);
        if (residentialLevel >= 3) perks.push(t.perkResidential3);
        if (residentialLevel >= 4) perks.push(t.perkResidential4);
        if (residentialLevel >= 5) perks.push(t.perkResidential5);
        return (
          <div className="mobile-card flex flex-col gap-2" style={{ background: "color-mix(in srgb, #b57cd0 10%, var(--panel-bg))", border: "1px solid color-mix(in srgb, #b57cd0 40%, transparent)" }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏘️</span>
              <p className="cinzel text-xs font-bold tracking-widest uppercase m-0" style={{ color: "#b57cd0" }}>
                {t.storeResidentialPerksTitle || "Residential perks active"} · {t.districtLevelShort || "LVL"} {residentialLevel}
              </p>
            </div>
            <ul className="flex flex-col gap-1 m-0 p-0" style={{ listStyle: "none" }}>
              {perks.filter(Boolean).map((perk, i) => (
                <li key={i} className="text-[12px] leading-snug" style={{ color: "var(--color-text)" }}>
                  <span style={{ color: "#4fa85e", marginRight: 6 }}>✓</span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      <TokenVault
        tokens={tokens}
        streakFreezeCharges={streakFreezeCharges}
        freezeCost={freezeCost}
        rerollCost={rerollCost}
        freezeWeeklyLocked={freezeWeeklyLocked}
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
