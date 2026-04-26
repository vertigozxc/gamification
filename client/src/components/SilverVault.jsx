import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";
import {
  IconRefresh,
  IconSwords,
  IconShoppingBag,
  IconSilver,
  IconGold,
  IconArrowRight
} from "./icons/Icons";
import CouponIcon from "./CouponIcon";

const SWAP_SILVER_COST = 100;
const SWAP_GOLD_REWARD = 1;

function SilverVault({
  silver,
  streakFreezeCharges = 0,
  freezeCost = 7,
  rerollCost = 3,
  freezeWeeklyLocked = false,
  freezeStreakPending = false,
  extraRerollsToday,
  hasRerolledToday,
  canRerollPinned,
  isFreePinnedReroll,
  daysUntilFreePinnedReroll,
  xpBoostCost = 15,
  xpBoostExpiresAt = null,
  cityResetCost = 10,
  cityResetRefund = 0,
  onOpenPinnedReplacement,
  onFreezeStreak,
  onBuyExtraReroll,
  onBuyXpBoost,
  onResetCity,
  onSwapSilverToGold,
  onBuyPinnedRerollCoupon,
  buyPinnedRerollCouponPending = false,
  compact = false
}) {
  const { t, tf } = useTheme();

  function getPluralizedSilver(count, singular = String(t.silverSingular || "SILVER").toUpperCase(), plural = String(t.silverPlural || "SILVER").toUpperCase()) {
    return count === 1 ? singular : plural;
  }

  // Silver-cost chip uses theme variables so it blends into each interface
  // theme (adventure / balance / light) instead of punching a gold hole
  // through the card. Individual glyph colors below now read from
  // --color-accent too.
  const costChipStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border-idle)",
    color: "var(--color-accent)"
  };
  const costValueColor = "var(--color-accent)";

  // Unified purchase-button styling. All shop CTAs now wear the same
  // theme-primary gradient so the shop reads as one consistent surface
  // instead of five different colours competing for attention.
  const buyButtonClass = "mobile-pressable mt-auto cinzel font-bold px-4 py-2 rounded-xl border border-white/5 transition-all text-sm flex items-center justify-center gap-2";
  const buyButtonActiveStyle = {
    background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
    color: "#0b1120",
    boxShadow: "0 8px 20px color-mix(in srgb, var(--color-primary) 22%, transparent)"
  };
  const buyButtonDisabledClass = "bg-slate-800/80 text-slate-500 cursor-not-allowed";

  const xpBoostMs = xpBoostExpiresAt ? new Date(xpBoostExpiresAt).getTime() - Date.now() : 0;
  const xpBoostActive = xpBoostMs > 0;
  const xpBoostDaysLeft = xpBoostActive ? Math.max(1, Math.ceil(xpBoostMs / 86400000)) : 0;

  return (
    <>
      {compact ? (
        <div className="flex flex-col gap-4">
          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <CouponIcon type="freeze" size={44} alt="freeze" />
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.freezeTitle}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.freezeDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>{freezeCost}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              {t.freezeVaultDetail || t.freezeDetail}
            </p>
            <button
              onClick={onFreezeStreak}
              disabled={silver < freezeCost || freezeStreakPending || freezeWeeklyLocked}
              className={`${buyButtonClass} ${silver >= freezeCost && !freezeStreakPending && !freezeWeeklyLocked ? "" : buyButtonDisabledClass}`}
              style={silver >= freezeCost && !freezeStreakPending && !freezeWeeklyLocked ? buyButtonActiveStyle : undefined}
            >
              {freezeWeeklyLocked
                ? (t.freezeWeeklyLocked || "Already bought this week")
                : freezeStreakPending
                  ? t.processingLabel
                  : silver < freezeCost
                    ? t.notEnough
                    : (t.buyShort || "BUY")}
            </button>
            <p className="text-[10px] text-center m-0 opacity-70" style={{ color: "var(--color-muted)" }}>
              {t.freezeWeeklyHint || "Limit: 1 purchase per week · resets Monday"}
            </p>
          </div>

          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <CouponIcon type="reroll" size={44} alt="reroll" />
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.rerollShopTitle}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.rerollShopDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>{rerollCost}</span>
              </div>
            </div>
            <button
              onClick={onBuyExtraReroll}
              disabled={silver < rerollCost}
              className={`${buyButtonClass} ${silver >= rerollCost ? "" : buyButtonDisabledClass}`}
              style={silver >= rerollCost ? buyButtonActiveStyle : undefined}
            >
              {silver < rerollCost ? t.notEnough : (t.buyShort || "BUY")}
            </button>
            <p className="text-[10px] text-center m-0 opacity-70" style={{ color: "var(--color-muted)" }}>
              {t.extraRerollCouponHint || "Coupon goes to inventory — activate it whenever you need a daily-quest reroll."}
            </p>
          </div>

          {/* Change Habits — coupon-flow. Buying creates a pinned_reroll
              coupon in inventory; the actual habit picker runs from
              the coupon-tap path in the inventory tab. Free coupons
              are auto-granted server-side every 21 days, so there's no
              "free" state in the shop card any more. */}
          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-start gap-3">
              <CouponIcon type="pinned_reroll" size={44} alt="change habits" />
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.pinnedQuestRerollTitle}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.pinnedQuestRerollDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1 self-start" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>7</span>
              </div>
            </div>
            <button
              onClick={onBuyPinnedRerollCoupon}
              disabled={silver < 7 || buyPinnedRerollCouponPending}
              className={`${buyButtonClass} ${silver >= 7 && !buyPinnedRerollCouponPending ? "" : buyButtonDisabledClass}`}
              style={silver >= 7 && !buyPinnedRerollCouponPending ? buyButtonActiveStyle : undefined}
            >
              {silver < 7 ? t.notEnough : (t.buyShort || "BUY")}
            </button>
            <p className="text-[10px] text-center m-0 opacity-70" style={{ color: "var(--color-muted)" }}>
              {t.pinnedRerollFreeGrantHint || "A free coupon arrives every 21 days. Activate any from your inventory."}
            </p>
          </div>

          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <CouponIcon type="xp_boost" size={44} alt="xp boost" />
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.xpBoostTitle}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.xpBoostDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1 self-start" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>{xpBoostCost}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              {t.xpBoostDetail}
            </p>
            <button
              onClick={onBuyXpBoost}
              disabled={silver < xpBoostCost}
              className={`${buyButtonClass} ${silver >= xpBoostCost ? "" : buyButtonDisabledClass}`}
              style={silver >= xpBoostCost ? buyButtonActiveStyle : undefined}
            >
              {silver < xpBoostCost ? t.notEnough : (t.buyShort || "BUY")}
            </button>
            {/* Hint shown only when boost is INACTIVE (per spec). When
                active the user can already see "X days left" in the
                inventory; repeating it here is noise. */}
            {!xpBoostActive ? (
              <p className="text-[10px] text-center m-0 opacity-70" style={{ color: "var(--color-muted)" }}>
                {t.xpBoostInactiveHint}
              </p>
            ) : null}
          </div>

          {/* Silver → Gold swap. Fixed 100:1 rate (server-authoritative).
              Card hero shows the conversion visually: silver coin →
              arrow → gold coin, so the function reads instantly without
              needing the title. Disabled until silver ≥ 100. */}
          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-3">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IconSilver size={26} />
                <span style={{ display: "inline-flex", color: "var(--color-muted)" }}><IconArrowRight size={14} /></span>
                <IconGold size={26} />
              </span>
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.swapTitle || "Swap silver for gold"}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.swapDesc || "Convert silver into premium gold."}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>{SWAP_SILVER_COST}</span>
              </div>
            </div>
            <button
              onClick={onSwapSilverToGold}
              disabled={silver < SWAP_SILVER_COST}
              className={`${buyButtonClass} ${silver >= SWAP_SILVER_COST ? "" : buyButtonDisabledClass}`}
              style={silver >= SWAP_SILVER_COST ? buyButtonActiveStyle : undefined}
            >
              {silver < SWAP_SILVER_COST ? t.notEnough : (t.swapShort || "SWAP")}
            </button>
            <p className="text-[10px] text-center m-0 opacity-70" style={{ color: "var(--color-muted)" }}>
              {t.swapHint || "Useful when you've stocked up on silver but need gold."}
            </p>
          </div>

          {/* Reset city — refunds every silver sunk into districts, wipes
              them all back to level 0. Flat 20 silver per coupon. */}
          <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
            <div className="flex items-start gap-3">
              <CouponIcon type="city_reset" size={44} alt="reset city" />
              <div className="flex-1">
                <p className="cinzel font-bold text-base tracking-wide" style={{ color: "var(--color-text)" }}>{t.cityResetTitle || "Reset city"}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.cityResetDesc || "Wipe all districts and refund every silver spent on them."}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full px-3 py-1 self-start" style={costChipStyle}>
                <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={16} /></span>
                <span className="cinzel font-bold text-sm" style={{ color: costValueColor }}>{cityResetCost}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              {t.cityResetRefundHint || "Every silver you spent upgrading districts comes back to your balance."}
            </p>
            <button
              onClick={onResetCity}
              disabled={silver < cityResetCost}
              className={`${buyButtonClass} ${silver >= cityResetCost ? "" : buyButtonDisabledClass}`}
              style={silver >= cityResetCost ? buyButtonActiveStyle : undefined}
            >
              {silver < cityResetCost ? t.notEnough : (t.buyShort || "BUY")}
            </button>
          </div>

        </div>
      ) : (
        <div className="mt-8 mb-4">
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--silver-bg)", border: "2px solid var(--silver-border)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "2px solid var(--silver-header-border)" }}>
                <h2 className="flex items-center gap-2 cinzel text-transparent bg-clip-text font-bold text-xl tracking-[0.18em] uppercase" style={{ backgroundImage: "var(--heading-gradient)" }}>
                  {t.silverSection}
                  <div className="relative group inline-block cursor-help z-50">
                    <svg className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans font-normal normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
                      {t.silverTooltip}
                    </div>
                  </div>
                </h2>
              <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--silver-header-border)" }}>
                <span className="text-2xl">{t.silverIcon}</span>
                <span className="cinzel text-lg font-bold" style={{ color: "var(--color-primary)" }}>{silver}</span>
                <span className="cinzel text-xs" style={{ color: "var(--color-muted)" }}>{getPluralizedSilver(silver)}</span>
              </div>
            </div>
            <div className="px-6 py-5">

              <div className="flex flex-col md:flex-row items-stretch gap-6 px-1 py-1">
                <div className="flex-1 flex flex-col gap-4">
                  <p className="mobile-section-kicker">{t.silverAboutTitle}</p>
                  
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span className="text-3xl grayscale brightness-150">🪙</span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.silverAboutWhatAre}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.silverAboutWhatAreDesc}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span style={{ display: "inline-flex", color: "var(--color-primary)" }}><IconSwords size={28} /></span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.silverAboutHowEarn}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.silverAboutHowEarnDesc}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start shadow-inner">
                      <span style={{ display: "inline-flex", color: "var(--color-primary)" }}><IconShoppingBag size={28} /></span>
                      <div>
                        <p className="font-bold text-slate-200 text-sm uppercase tracking-wide cinzel">{t.silverAboutUseFor}</p>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{t.silverAboutUseForDesc}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 w-full md:w-1/4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 rounded-xl border border-slate-700/60 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 transition-opacity bg-cover opacity-10"></div>
                  <p className="cinzel text-slate-400 font-bold tracking-[0.2em] text-xs z-10 mb-4 text-center">{t.silverBalanceLabel}</p>
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-7xl drop-shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-transform group-hover:scale-110 duration-500">{t.silverIcon}</span>
                    <p className="cinzel text-5xl font-bold mt-4" style={{ color: "var(--color-primary)", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{silver}</p>
                    <span className="cinzel text-sm text-slate-500 mt-2">{getPluralizedSilver(silver)}</span>
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

SilverVault.propTypes = {
  silver: PropTypes.number.isRequired,
  streakFreezeCharges: PropTypes.number,
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

export default SilverVault;
