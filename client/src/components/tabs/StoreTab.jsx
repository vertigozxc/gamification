import TokenVault from "../TokenVault";

export default function StoreTab({
  tokens, streakFreezeCharges = 0, freezeCost = 7, rerollCost = 3,
  freezeWeeklyLocked = false, residentialLevel = 0,
  extraRerollsToday, hasRerolledToday,
  freezeStreakPending,
  canRerollPinned, isFreePinnedReroll, daysUntilFreePinnedReroll,
  xpBoostCost = 15, xpBoostExpiresAt = null,
  onOpenPinnedReplacement, onFreezeStreak, onBuyExtraReroll, onBuyXpBoost, t
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden mobile-card top-screen-block shadow-[0_0_20px_rgba(234,179,8,0.08)]" style={{ background: "var(--card-bg)" }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05]"></div>
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: "var(--color-muted)" }}>
              {t.storeScreenKicker}
            </p>
            <h3 className="cinzel text-[1.15rem] font-bold tracking-wide leading-tight m-0 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
              <span>🛍</span>
              <span className="truncate">{t.storeScreenTitle}</span>
            </h3>
            <p className="text-xs leading-relaxed mt-2 mb-0" style={{ color: "var(--color-text)", opacity: 0.88 }}>
              {t.storeScreenSubtitle}
            </p>
          </div>
          <div
            className="text-center shrink-0 min-w-[120px] rounded-xl px-3 py-2"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)" }}
          >
            <p className="text-[9px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--color-muted)" }}>
              {t.storeBalanceTitle}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-2xl">{t.tokenIcon}</span>
              <p className="cinzel text-2xl font-bold leading-none m-0" style={{ color: "var(--color-accent)" }}>{tokens}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px my-1" style={{ background: "linear-gradient(to right, transparent, var(--card-border-idle), transparent)" }}></div>

      {residentialLevel >= 1 && (() => {
        const perks = [];
        if (residentialLevel >= 1) perks.push(t.perkResidential1);
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
        xpBoostCost={xpBoostCost}
        xpBoostExpiresAt={xpBoostExpiresAt}
        onBuyXpBoost={onBuyXpBoost}
        compact
      />
    </div>
  );
}
