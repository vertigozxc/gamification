import { useLayoutEffect, useRef, useState } from "react";
import SilverVault from "../SilverVault";
import CouponIcon from "../CouponIcon";
import COSMETIC_ITEMS, { parseOwnedCosmetics } from "../../data/cosmetics";
import { parseCouponInventory, groupCouponsByType, parseActiveCosmetics } from "../../data/coupons";
import {
  IconSilver,
  IconGold,
  IconCheck,
  IconBolt,
  IconPalette,
  IconBag,
  IconClose
} from "../icons/Icons";

// 3-tab Store screen with the dashboard-style sliding tab bar:
//   Utility    — silver-currency items (freeze, reroll, change habits, XP boost, reset city)
//   Cosmetics  — gold-currency items (frames, backgrounds — 7 placeholder stubs)
//   Inventory  — dynamic 4×4 WoW-bag: coupons (stacked by type), owned cosmetics
//                (with active marker), legacy active effects (charges, XP boost timer)

const TABS = [
  { id: "utility",   labelKey: "storeTabUtility",   IconCmp: IconBolt    },
  { id: "cosmetics", labelKey: "storeTabCosmetics", IconCmp: IconPalette },
  { id: "inventory", labelKey: "storeTabInventory", IconCmp: IconBag     }
];

const INVENTORY_GRID_SIZE = 16; // 4 cols × 4 rows

// Coupon raster art lives at /public/coupons/<type>.png — see
// CouponIcon component. Mapping is by coupon.type.

// One slot in the WoW-bag grid. 1:1 aspect square. Filled slots can be
// "tappable" (coupons, owned cosmetics) or read-only (active effects);
// the tappable variant gets a stronger primary-tinted border and an
// active:scale press feedback. Count badge lives in the bottom-right
// corner WoW-style — white with dark stroke for legibility against any
// glyph underneath.
function BagSlot({ slot, onTap }) {
  if (!slot || slot.kind === "empty") {
    return (
      <div
        style={{
          aspectRatio: "1 / 1",
          borderRadius: 8,
          background: "color-mix(in srgb, var(--card-bg) 60%, rgba(0,0,0,0.18))",
          border: "1px solid color-mix(in srgb, var(--card-border-idle) 70%, transparent)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)"
        }}
      />
    );
  }

  const isActive = slot.kind === "cosmetic" && slot.active;
  const isReadOnly = slot.kind === "active-effect";

  const baseColor = isActive
    ? "#4ade80"  // green for "currently equipped" cosmetics
    : "var(--color-primary)";

  const wrapStyle = {
    aspectRatio: "1 / 1",
    borderRadius: 8,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isReadOnly
      ? "color-mix(in srgb, var(--card-bg) 50%, rgba(0,0,0,0.10))"
      : `color-mix(in srgb, ${baseColor} 14%, transparent)`,
    border: isReadOnly
      ? "1px solid color-mix(in srgb, var(--card-border-idle) 70%, transparent)"
      : `1px solid color-mix(in srgb, ${baseColor} ${isActive ? 70 : 55}%, transparent)`,
    boxShadow: isReadOnly
      ? "inset 0 1px 2px rgba(0,0,0,0.25)"
      : `inset 0 0 8px color-mix(in srgb, ${baseColor} 18%, transparent)`,
    color: isReadOnly ? "var(--color-muted)" : baseColor,
    cursor: "pointer",
    padding: 4,
    opacity: isReadOnly ? 0.85 : 1
  };

  const Inner = (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {slot.icon}
      </div>
      {isActive ? (
        // Currently-equipped marker — small green checkmark in top-right
        <span
          aria-label="active"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#4ade80",
            color: "#0b1120",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <IconCheck size={10} />
        </span>
      ) : null}
      {slot.count ? (
        <span
          className="cinzel"
          style={{
            position: "absolute",
            bottom: 2,
            right: 4,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
            letterSpacing: "0.02em",
            pointerEvents: "none"
          }}
        >
          {slot.count}
        </span>
      ) : null}
    </>
  );

  // Every non-empty slot is tappable — opens the bottom-sheet with details.
  // Activation runs from the sheet's "Use" CTA, not from the slot tap, so
  // the user always sees the description before committing.
  return (
    <button
      type="button"
      onClick={() => onTap?.(slot)}
      className="mobile-pressable"
      aria-label={slot.label || ""}
      style={wrapStyle}
    >
      {Inner}
    </button>
  );
}

// Bottom-sheet for the inventory: tap a slot → slides up from below
// with full title/description/count + a "Use" or "Equip" CTA. Backdrop
// tap closes (per the user spec — "tap outside to close, not just the X").
function InventorySheet({ slot, onClose, t }) {
  if (!slot) return null;

  const ctaDestructive = Boolean(slot.ctaDestructive);
  const ctaDisabled = Boolean(slot.ctaDisabled);
  const hasAction = typeof slot.action === "function";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        background: "rgba(5, 10, 20, 0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <div
        // stop the inner click from bubbling to the backdrop
        onClick={(e) => e.stopPropagation()}
        className="mobile-card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "20px 18px 24px",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--panel-border)",
          borderBottom: "none",
          background: "linear-gradient(180deg, var(--panel-bg), color-mix(in srgb, var(--panel-bg) 92%, var(--color-primary)))",
          animation: "slideInUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          position: "relative"
        }}
      >
        {/* drag handle (visual only) */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "color-mix(in srgb, var(--color-muted) 40%, transparent)",
            margin: "0 auto 16px"
          }}
        />

        {/* close X — top-right */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closeLabel || "Close"}
          className="mobile-pressable"
          style={{
            position: "absolute",
            top: 14,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid var(--card-border-idle)",
            background: "var(--card-bg)",
            color: "var(--color-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <IconClose size={16} />
        </button>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div
            style={{
              flex: "0 0 auto",
              width: 88,
              height: 88,
              borderRadius: 16,
              background: "color-mix(in srgb, var(--card-bg) 70%, rgba(0,0,0,0.2))",
              border: "1px solid var(--card-border-idle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {slot.bigIcon || slot.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="cinzel" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: "var(--color-text)", margin: 0 }}>
              {slot.title}
            </p>
            {slot.count ? (
              <p style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 700, margin: "4px 0 0" }}>
                {String(slot.count).startsWith("×") || /^\d+$/.test(String(slot.count)) ? `× ${String(slot.count).replace("×", "")}` : slot.count}
              </p>
            ) : null}
          </div>
        </div>

        {slot.description ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.5, margin: "0 0 18px" }}>
            {slot.description}
          </p>
        ) : null}

        {hasAction ? (
          <button
            type="button"
            onClick={() => {
              if (ctaDisabled) return;
              try { slot.action(); } catch { /* swallow — handler logs */ }
              onClose();
            }}
            disabled={ctaDisabled}
            className="mobile-pressable cinzel"
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              border: ctaDestructive
                ? "1.5px solid color-mix(in srgb, #ef4444 65%, transparent)"
                : "1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
              background: ctaDisabled
                ? "color-mix(in srgb, var(--card-border-idle) 30%, transparent)"
                : ctaDestructive
                  ? "linear-gradient(135deg, #dc2626, #ef4444)"
                  : "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
              color: ctaDisabled ? "var(--color-muted)" : (ctaDestructive ? "#fff" : "#0b1120"),
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: ctaDisabled ? "not-allowed" : "pointer",
              boxShadow: ctaDisabled
                ? "none"
                : ctaDestructive
                  ? "0 6px 18px color-mix(in srgb, #ef4444 35%, transparent)"
                  : "0 6px 18px color-mix(in srgb, var(--color-primary) 30%, transparent)"
            }}
          >
            {slot.ctaLabel || (t.couponUseCta || "Use")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Compose the dynamic inventory grid. Order: coupons (stacked by type)
// → active effects (read-only) → owned cosmetics (with active marker)
// → empty padding to 16.
function buildBagSlots({
  couponInventoryRaw,
  ownedCosmetics,
  activeCosmeticsRaw,
  streakFreezeCharges,
  xpBoostExpiresAt,
  rouletteCoupons,
  onActivateCoupon,
  onActivateCosmetic,
  t
}) {
  const slots = [];

  // 1) Coupons — group by type, stack count = number of coupons of that type.
  // Tap on the slot opens the bottom-sheet with details + Use button.
  const couponInv = parseCouponInventory(couponInventoryRaw);
  const grouped = groupCouponsByType(couponInv);
  grouped.forEach((bucket) => {
    const oldest = bucket.coupons[0];
    const name = t[`couponName_${bucket.type}`] || bucket.type;
    slots.push({
      kind: "coupon",
      type: bucket.type,
      icon: <CouponIcon type={bucket.type} size={44} alt={name} />,
      bigIcon: <CouponIcon type={bucket.type} size={120} alt={name} />,
      count: bucket.count > 1 ? bucket.count : null,
      label: name,
      title: name,
      description: t[`couponSheetDesc_${bucket.type}`] || "",
      ctaLabel: t.couponUseCta || "Use",
      ctaDestructive: bucket.type === "city_reset",
      action: () => onActivateCoupon?.(oldest)
    });
  });

  // 2) Active effects (read-only) — these are direct-credit balances
  // that the user already activated previously. Show so the inventory
  // tells the WHOLE story, not just unactivated coupons.
  if (Number(streakFreezeCharges) > 0) {
    slots.push({
      kind: "active-effect",
      type: "freeze",
      icon: <CouponIcon type="freeze" size={44} alt="freeze" />,
      bigIcon: <CouponIcon type="freeze" size={120} alt="freeze" />,
      count: streakFreezeCharges > 1 ? streakFreezeCharges : null,
      label: t.activeFreezeChargesLabel || "Freeze charges (auto-consume)",
      title: t.activeFreezeChargesLabel || "Freeze charges",
      description: t.activeFreezeChargesDesc || "Already activated. Will auto-shield a missed streak day."
    });
  }
  const xpBoostMs = xpBoostExpiresAt ? new Date(xpBoostExpiresAt).getTime() - Date.now() : 0;
  if (xpBoostMs > 0) {
    const daysLeft = Math.max(1, Math.ceil(xpBoostMs / 86400000));
    slots.push({
      kind: "active-effect",
      type: "xp_boost",
      icon: <CouponIcon type="xp_boost" size={44} alt="xp boost" />,
      bigIcon: <CouponIcon type="xp_boost" size={120} alt="xp boost" />,
      count: `${daysLeft}d`,
      label: t.activeXpBoostLabel || "XP Boost active",
      title: t.activeXpBoostLabel || "XP Boost active",
      description: (t.activeXpBoostDesc || "+15% XP on every quest. {days} day(s) left.").replace("{days}", String(daysLeft))
    });
  }
  if (Number(rouletteCoupons) > 0) {
    slots.push({
      kind: "active-effect",
      icon: "🎟",
      bigIcon: <span style={{ fontSize: 40 }}>🎟</span>,
      count: rouletteCoupons > 1 ? rouletteCoupons : null,
      label: t.inventoryCouponLabel || "Roulette coupon",
      title: t.inventoryCouponLabel || "Roulette coupon",
      description: t.rouletteCouponDesc || "Spend on a free spin of the City wheel."
    });
  }

  // 3) Owned cosmetics — each its own slot with an "active" marker if
  // currently equipped via activeCosmetics map. Tap → activate (sets
  // active for that category, doesn't remove from ownedCosmetics).
  const owned = parseOwnedCosmetics(ownedCosmetics);
  const active = parseActiveCosmetics(activeCosmeticsRaw);
  owned
    .map((id) => COSMETIC_ITEMS.find((c) => c.id === id))
    .filter(Boolean)
    .forEach((item) => {
      const isActive = active[item.category] === item.id;
      const cosmeticName = t[item.nameKey] || item.id;
      slots.push({
        kind: "cosmetic",
        icon: <span style={{ fontSize: 22 }}>{item.previewIcon}</span>,
        bigIcon: <span style={{ fontSize: 56 }}>{item.previewIcon}</span>,
        count: null,
        active: isActive,
        label: cosmeticName,
        title: cosmeticName,
        description: t[item.descKey] || "",
        ctaLabel: isActive ? (t.cosmeticEquippedLabel || "Currently equipped") : (t.cosmeticEquipCta || "Equip"),
        ctaDisabled: isActive,
        action: () => onActivateCosmetic?.(item.id)
      });
    });

  // 4) Pad to 16
  while (slots.length < INVENTORY_GRID_SIZE) {
    slots.push({ kind: "empty" });
  }
  return slots.slice(0, INVENTORY_GRID_SIZE);
}

function CosmeticCard({ item, owned, canAfford, onBuy, busy, t }) {
  const name = t[item.nameKey] || item.id;
  const desc = t[item.descKey] || "";
  const buyDisabled = owned || !canAfford || busy;
  return (
    <div
      className="mobile-card flex flex-col gap-2"
      style={{
        background: "var(--panel-bg)",
        border: owned
          ? "1px solid color-mix(in srgb, #4ade80 50%, transparent)"
          : "1px solid var(--card-border-idle)",
        padding: 12,
        borderRadius: 16,
        position: "relative"
      }}
    >
      {/* Preview tile — placeholder emoji until real animated previews ship. */}
      <div
        style={{
          aspectRatio: "1 / 1",
          width: "100%",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, transparent), color-mix(in srgb, var(--color-accent) 8%, transparent))",
          border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
          overflow: "hidden"
        }}
      >
        <span aria-hidden="true">{item.previewIcon}</span>
      </div>

      <p className="cinzel" style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{name}</p>
      {desc ? (
        <p style={{ fontSize: 11, color: "var(--color-muted)", margin: 0, lineHeight: 1.35 }}>{desc}</p>
      ) : null}

      {owned ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 10,
            background: "color-mix(in srgb, #4ade80 16%, transparent)",
            border: "1px solid color-mix(in srgb, #4ade80 50%, transparent)",
            color: "#16a34a",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
        >
          <IconCheck size={14} />
          {t.cosmeticOwnedLabel || "Owned"}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onBuy?.(item)}
          disabled={buyDisabled}
          className="mobile-pressable cinzel font-bold"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 12,
            border: buyDisabled
              ? "1px solid var(--card-border-idle)"
              : "1px solid color-mix(in srgb, var(--color-primary) 50%, transparent)",
            background: buyDisabled
              ? "color-mix(in srgb, var(--card-border-idle) 30%, transparent)"
              : "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            color: buyDisabled ? "var(--color-muted)" : "#0b1120",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: buyDisabled ? "not-allowed" : "pointer",
            boxShadow: buyDisabled ? "none" : "0 6px 16px color-mix(in srgb, var(--color-primary) 25%, transparent)"
          }}
        >
          <span style={{ display: "inline-flex" }}><IconGold size={14} /></span>
          <span>{item.costGold}</span>
          <span style={{ opacity: 0.85 }}>· {t.cosmeticBuyCta || "Buy"}</span>
        </button>
      )}
    </div>
  );
}

export default function StoreTab({
  silver = 0,
  gold = 0,
  rouletteCoupons = 0,
  ownedCosmetics = "[]",
  streakFreezeCharges = 0,
  freezeCost = 7,
  rerollCost = 3,
  freezeWeeklyLocked = false,
  residentialLevel = 0,
  extraRerollsToday,
  hasRerolledToday,
  freezeStreakPending,
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
  onBuyCosmetic,
  cosmeticPurchasePending = null,
  // Coupon-flow additions
  couponInventory = "[]",
  activeCosmetics = "{}",
  onActivateCoupon,
  onActivateCosmetic,
  t
}) {
  const [activeTab, setActiveTab] = useState("utility");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const tabsRowRef = useRef(null);
  const indicatorRef = useRef(null);

  // CSS-grid columns: active tab gets 2fr (room for label), inactive
  // tabs get 1fr each (collapsing to icon-only). MUST be declared
  // before the useLayoutEffect below — that effect lists this in its
  // dep array, and a `const` referenced before its declaration would
  // hit the temporal dead zone and crash the whole tab.
  const gridTemplateColumns = TABS
    .map((tab) => (tab.id === activeTab ? "2fr" : "1fr"))
    .join(" ");

  // Slide the indicator under the active tab. Mirrors QuestBoard's
  // qb-tab-bar-expand pattern: because grid-template-columns is also
  // transitioning, the active button's offsetLeft / offsetWidth keep
  // changing for ~420ms after the tab switch. We run a rAF loop over
  // that window so the indicator stays glued to the moving target
  // instead of snapping ahead. First mount snaps without animation
  // so the pill doesn't flash from x=0.
  useLayoutEffect(() => {
    if (!tabsRowRef.current || !indicatorRef.current) return undefined;
    const ind = indicatorRef.current;
    const apply = () => {
      const row = tabsRowRef.current;
      if (!row || !indicatorRef.current) return;
      const activeBtn = row.querySelector(`[data-store-tab="${activeTab}"]`);
      if (!activeBtn) return;
      indicatorRef.current.style.width = `${activeBtn.offsetWidth}px`;
      indicatorRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    };
    const firstMeasure = ind.dataset.storeMeasured !== "1";
    if (firstMeasure) {
      const prev = ind.style.transition;
      ind.style.transition = "none";
      apply();
      // eslint-disable-next-line no-unused-expressions
      ind.offsetHeight;
      ind.style.transition = prev;
      ind.dataset.storeMeasured = "1";
      return undefined;
    }
    let rafId = 0;
    let startTs = 0;
    const durationMs = 420;
    const sync = (ts) => {
      if (!startTs) startTs = ts;
      apply();
      if (ts - startTs < durationMs) {
        rafId = requestAnimationFrame(sync);
      }
    };
    rafId = requestAnimationFrame(sync);
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab, gridTemplateColumns]);

  const ownedList = parseOwnedCosmetics(ownedCosmetics);
  const bagSlots = buildBagSlots({
    couponInventoryRaw: couponInventory,
    ownedCosmetics,
    activeCosmeticsRaw: activeCosmetics,
    streakFreezeCharges,
    xpBoostExpiresAt,
    rouletteCoupons,
    onActivateCoupon,
    onActivateCosmetic,
    t
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Slim 1-row hero: store title + inline silver/gold chips on the
          right. Yellow city-hero-surface frame and background kept as-is
          per the design pick — only the inner layout collapses to a
          single row to free up vertical space. */}
      <div data-tour="store-hero" className="city-hero-surface mobile-card top-screen-block p-3 shadow-[0_0_20px_rgba(234,179,8,0.06)]">
        <div className="relative z-10 flex items-center gap-3">
          {/* Title block — left */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-[0.2em] m-0 leading-none" style={{ color: "var(--color-muted)" }}>
              {t.storeScreenKicker}
            </p>
            <h3 className="cinzel text-base font-bold tracking-wide leading-tight m-0 mt-0.5 flex items-center gap-1.5" style={{ color: "var(--color-primary)" }}>
              <span>🛍</span>
              <span className="truncate">{t.storeScreenTitle}</span>
            </h3>
          </div>
          {/* Wallet chips — right. Two coin-amount pairs separated by a
              thin vertical divider; no individual borders so they read
              as one wallet, not two cards. */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5" aria-label={t.silverLabel || "Silver"}>
              <IconSilver size={20} />
              <span className="cinzel font-bold text-base leading-none" style={{ color: "var(--color-primary)" }}>{silver}</span>
            </span>
            <span aria-hidden="true" style={{ width: 1, height: 18, background: "var(--card-border-idle)", opacity: 0.7 }} />
            <span className="flex items-center gap-1.5" aria-label={t.goldLabel || "Gold"}>
              <IconGold size={20} />
              <span className="cinzel font-bold text-base leading-none" style={{ color: "var(--color-primary)" }}>{gold}</span>
            </span>
          </div>
        </div>
        {/* Compact economy hint — three facts about how the dual-currency
            economy works, separated by middle dots so each fact reads as
            its own chunk without bloating the header. Two-line max on
            narrow screens; ≤14 words per fact keeps it scannable. */}
        <p className="relative z-10 text-[10px] leading-snug m-0 mt-2 pt-2" style={{
          color: "var(--color-muted)",
          borderTop: "1px solid color-mix(in srgb, var(--card-border-idle) 50%, transparent)"
        }}>
          {t.storeEconomyHint || "Silver — most activities · Gold — high-level only · Swap 100:1 (see About)"}
        </p>
      </div>

      {/* Slide-bar tabs (qb-tab-bar pattern from QuestBoard so the two surfaces
          share visual DNA). The indicator slides between active tabs and the
          inactive labels collapse to icons-only on narrow screens via the
          built-in qb-tab-bar-expand styling. */}
      <div
        ref={tabsRowRef}
        className="qb-tab-bar qb-tab-bar-expand"
        style={{ gridTemplateColumns }}
        role="tablist"
      >
        <div ref={indicatorRef} className="qb-tab-indicator" />
        {TABS.map((tab) => {
          const Icon = tab.IconCmp;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-store-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`mobile-pressable qb-tab-btn ${isActive ? "qb-tab-active" : ""}`}
            >
              <span className="qb-tab-icon"><Icon size={15} /></span>
              <span className="qb-tab-label">{t[tab.labelKey] || tab.id}</span>
            </button>
          );
        })}
      </div>

      {/* ── Utility tab ─────────────────────────────────────── */}
      {activeTab === "utility" ? (
        <>
          {residentialLevel >= 1 ? (
            <div className="mobile-card flex items-center gap-2" style={{ background: "color-mix(in srgb, #b57cd0 10%, var(--panel-bg))", border: "1px solid color-mix(in srgb, #b57cd0 40%, transparent)", padding: "10px 12px", borderRadius: 12 }}>
              <span style={{ fontSize: 18 }}>🏘️</span>
              <p className="cinzel" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b57cd0", margin: 0 }}>
                {t.storeResidentialPerksTitle || "Residential perks"} · {t.districtLevelShort || "LVL"} {residentialLevel}
              </p>
            </div>
          ) : null}

          <SilverVault
            silver={silver}
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
            cityResetCost={cityResetCost}
            cityResetRefund={cityResetRefund}
            onResetCity={onResetCity}
            onSwapSilverToGold={onSwapSilverToGold}
            onBuyPinnedRerollCoupon={onBuyPinnedRerollCoupon}
            buyPinnedRerollCouponPending={buyPinnedRerollCouponPending}
            compact
          />
        </>
      ) : null}

      {/* ── Cosmetics tab ───────────────────────────────────── */}
      {activeTab === "cosmetics" ? (
        <div className="grid grid-cols-2 gap-3">
          {COSMETIC_ITEMS.map((item) => (
            <CosmeticCard
              key={item.id}
              item={item}
              owned={ownedList.includes(item.id)}
              canAfford={(Number(gold) || 0) >= item.costGold}
              busy={cosmeticPurchasePending === item.id}
              onBuy={onBuyCosmetic}
              t={t}
            />
          ))}
        </div>
      ) : null}

      {/* ── Inventory tab ───────────────────────────────────── */}
      {activeTab === "inventory" ? (
        <div className="mobile-card" style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", padding: 12, borderRadius: 14 }}>
          <p className="cinzel mobile-section-kicker" style={{ marginBottom: 10 }}>
            {t.inventoryTitle || "Inventory"}
          </p>
          {/* 4×4 WoW-bag grid. Square slots, no "empty" labels, optional
              count badge in the bottom-right corner of stacked items. */}
          <div className="grid grid-cols-4 gap-1.5">
            {bagSlots.map((slot, i) => (
              <BagSlot key={i} slot={slot} onTap={setSelectedSlot} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom-sheet: opens on slot tap. Backdrop click + close button
          + Use-CTA all dismiss. Closes after activation so the user
          sees the inventory grid update right away. */}
      <InventorySheet
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        t={t}
      />
    </div>
  );
}
