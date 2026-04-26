import { useLayoutEffect, useRef, useState } from "react";
import SilverVault from "../SilverVault";
import COSMETIC_ITEMS, { parseOwnedCosmetics } from "../../data/cosmetics";
import { IconSilver, IconGold, IconCheck, IconBolt, IconPalette, IconBag } from "../icons/Icons";

// 3-tab Store screen with the dashboard-style sliding tab bar:
//   Utility    — silver-currency items (freeze, reroll, change habits, XP boost, reset city)
//   Cosmetics  — gold-currency items (frames, backgrounds — 7 placeholder stubs)
//   Inventory  — 4×4 WoW-bag grid: items only (currencies live in the wallet header)

const TABS = [
  { id: "utility",   labelKey: "storeTabUtility",   IconCmp: IconBolt    },
  { id: "cosmetics", labelKey: "storeTabCosmetics", IconCmp: IconPalette },
  { id: "inventory", labelKey: "storeTabInventory", IconCmp: IconBag     }
];

const INVENTORY_GRID_SIZE = 16; // 4 cols × 4 rows

// Currency pill in the header — shows current silver / gold totals.
function CurrencyPill({ icon, value, label }) {
  return (
    <div
      className="mobile-card"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 8px",
        background: "var(--panel-bg)",
        border: "1px solid var(--panel-border)",
        borderRadius: 14
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", color: "var(--color-accent)" }}>{icon}</span>
        <span className="cinzel" style={{ color: "var(--color-primary)", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
          {value}
        </span>
      </span>
    </div>
  );
}

// One slot in the WoW-bag grid. 1:1 aspect square. Filled slots show
// their item icon centered + a count badge in the bottom-right; empty
// slots are just a dim recessed square (no text, no icon).
function BagSlot({ filled, icon, count }) {
  const wrapStyle = filled
    ? {
        background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
        boxShadow: "inset 0 0 8px color-mix(in srgb, var(--color-primary) 18%, transparent)"
      }
    : {
        background: "color-mix(in srgb, var(--card-bg) 60%, rgba(0,0,0,0.18))",
        border: "1px solid color-mix(in srgb, var(--card-border-idle) 70%, transparent)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)"
      };
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...wrapStyle
      }}
    >
      {filled ? (
        <>
          <div style={{ fontSize: 24, lineHeight: 1, display: "inline-flex", color: "var(--color-primary)" }}>{icon}</div>
          {count ? (
            // WoW-style stack count: bottom-right, white with dark stroke for
            // legibility against any item icon underneath.
            <span
              className="cinzel"
              style={{
                position: "absolute",
                bottom: 2,
                right: 4,
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.85)",
                letterSpacing: "0.02em",
                pointerEvents: "none"
              }}
            >
              {count}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// Build the up-to-16 inventory list. NO currencies (those live in the
// wallet header). Order: consumables → active effects → owned cosmetics.
function buildBagSlots({ rouletteCoupons, streakFreezeCharges, xpBoostExpiresAt, ownedCosmetics }) {
  const slots = [];

  if (streakFreezeCharges > 0) {
    slots.push({ icon: "🧊", count: streakFreezeCharges > 1 ? streakFreezeCharges : null });
  }
  if (rouletteCoupons > 0) {
    slots.push({ icon: "🎟", count: rouletteCoupons > 1 ? rouletteCoupons : null });
  }

  const xpBoostMs = xpBoostExpiresAt ? new Date(xpBoostExpiresAt).getTime() - Date.now() : 0;
  const xpBoostActive = xpBoostMs > 0;
  const daysLeft = xpBoostActive ? Math.max(1, Math.ceil(xpBoostMs / 86400000)) : 0;
  if (xpBoostActive) {
    slots.push({ icon: "⚡", count: `${daysLeft}d` });
  }

  ownedCosmetics
    .map((id) => COSMETIC_ITEMS.find((c) => c.id === id))
    .filter(Boolean)
    .forEach((item) => {
      // Cosmetics are non-stackable singletons, so no count badge.
      slots.push({ icon: item.previewIcon, count: null });
    });

  // Pad to 16. Empty slots have no icon or count.
  while (slots.length < INVENTORY_GRID_SIZE) {
    slots.push({ icon: null, count: null });
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
  onBuyCosmetic,
  cosmeticPurchasePending = null,
  t
}) {
  const [activeTab, setActiveTab] = useState("utility");
  const tabsRowRef = useRef(null);
  const indicatorRef = useRef(null);

  // Slide the indicator under the active tab. Mirrors QuestBoard's
  // qb-tab-bar-expand pattern so the visual language is consistent
  // between the dashboard's habit/daily/challenges bar and this one.
  useLayoutEffect(() => {
    if (!tabsRowRef.current || !indicatorRef.current) return undefined;
    const apply = () => {
      const row = tabsRowRef.current;
      if (!row || !indicatorRef.current) return;
      const activeBtn = row.querySelector(`[data-store-tab="${activeTab}"]`);
      if (!activeBtn) return;
      indicatorRef.current.style.width = `${activeBtn.offsetWidth}px`;
      indicatorRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    };
    const ind = indicatorRef.current;
    const firstMeasure = ind.dataset.storeMeasured !== "1";
    if (firstMeasure) {
      const prev = ind.style.transition;
      ind.style.transition = "none";
      apply();
      // eslint-disable-next-line no-unused-expressions
      ind.offsetHeight;
      ind.style.transition = prev || "";
      ind.dataset.storeMeasured = "1";
    } else {
      apply();
    }
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeTab]);

  const ownedList = parseOwnedCosmetics(ownedCosmetics);
  const bagSlots = buildBagSlots({
    rouletteCoupons,
    streakFreezeCharges,
    xpBoostExpiresAt,
    ownedCosmetics: ownedList
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Compact dual-currency wallet header — silver + gold balance pills */}
      <div data-tour="store-hero" className="city-hero-surface mobile-card top-screen-block p-3 shadow-[0_0_20px_rgba(234,179,8,0.06)]">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-muted)" }}>
              {t.storeScreenKicker}
            </p>
            <h3 className="cinzel text-[1.1rem] font-bold tracking-wide leading-tight m-0 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
              <span>🛍</span>
              <span className="truncate">{t.storeScreenTitle}</span>
            </h3>
          </div>
        </div>
        <div className="relative z-10 flex gap-2 mt-3">
          <CurrencyPill
            icon={<IconSilver size={20} />}
            value={silver}
            label={t.silverLabel || "Silver"}
          />
          <CurrencyPill
            icon={<IconGold size={20} />}
            value={gold}
            label={t.goldLabel || "Gold"}
          />
        </div>
      </div>

      {/* Slide-bar tabs (qb-tab-bar pattern from QuestBoard so the two surfaces
          share visual DNA). The indicator slides between active tabs and the
          inactive labels collapse to icons-only on narrow screens via the
          built-in qb-tab-bar-expand styling. */}
      <div
        ref={tabsRowRef}
        className="qb-tab-bar qb-tab-bar-expand"
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
              <BagSlot key={i} filled={Boolean(slot.icon)} icon={slot.icon} count={slot.count} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
