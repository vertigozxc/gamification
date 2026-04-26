import { useState } from "react";
import TokenVault from "../TokenVault";
import COSMETIC_ITEMS, { parseOwnedCosmetics } from "../../data/cosmetics";
import { IconSilver, IconGold, IconCheck } from "../icons/Icons";

// New 3-tab Store screen (Schema 2):
//   Utility    — silver-currency items (freeze, reroll, change habits, XP boost, reset city)
//   Cosmetics  — gold-currency items (frames, backgrounds — 7 placeholder stubs)
//   Inventory  — 3×4 RPG-style grid: currencies, consumables, active effects, owned cosmetics

const TABS = [
  { id: "utility",   labelKey: "storeTabUtility"  },
  { id: "cosmetics", labelKey: "storeTabCosmetics" },
  { id: "inventory", labelKey: "storeTabInventory" }
];

// Tab pill with mobile-pressable feedback. Active tab gets a primary
// gradient + dark text; inactive stays muted, so the active state is
// instantly readable on both light and dark themes.
function TabPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mobile-pressable cinzel font-bold tracking-wider uppercase"
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 12,
        fontSize: 12,
        letterSpacing: "0.12em",
        border: active
          ? "1px solid color-mix(in srgb, var(--color-primary) 70%, transparent)"
          : "1px solid var(--card-border-idle)",
        background: active
          ? "linear-gradient(135deg, var(--color-primary), var(--color-accent))"
          : "var(--card-bg)",
        color: active ? "#0b1120" : "var(--color-muted)",
        boxShadow: active
          ? "0 6px 18px color-mix(in srgb, var(--color-primary) 25%, transparent)"
          : "none",
        transition: "all 180ms ease"
      }}
    >
      {children}
    </button>
  );
}

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

// One slot inside the 3×4 inventory grid. Visually mirrors the daily-board
// milestone card (locked/unlocked) — same flex-1, padding, rounded-border
// container so the two surfaces feel like one design system.
function InventorySlot({ filled, icon, label, sub, t }) {
  const cls = filled ? "daily-board-card-unlocked" : "daily-board-card-locked";
  const bgStyle = filled
    ? { background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 50%, transparent)", boxShadow: "inset 0 0 10px color-mix(in srgb, var(--color-primary) 12%, transparent)" }
    : { background: "color-mix(in srgb, var(--panel-bg) 80%, transparent)", border: "1px solid var(--card-border-idle)" };
  return (
    <div
      className={`flex flex-col items-center justify-center rounded overflow-hidden ${cls}`}
      style={{
        padding: "10px 6px",
        minHeight: 76,
        ...bgStyle,
        opacity: filled ? 1 : 0.55
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4, display: "inline-flex" }}>{icon}</div>
      <p className="cinzel" style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textAlign: "center",
        color: filled ? "var(--color-primary)" : "var(--color-muted)",
        margin: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%"
      }}>{label}</p>
      {sub ? (
        <p style={{
          fontSize: 10,
          fontWeight: 700,
          color: filled ? "var(--color-accent)" : "var(--color-muted)",
          margin: 0,
          marginTop: 2,
          opacity: filled ? 1 : 0.7
        }}>{sub}</p>
      ) : null}
    </div>
  );
}

// 3×4 = 12 slots. Composition:
//   [silver]     [gold]      [coupon]
//   [freeze]     [boost]     [-empty-]
//   [cosmetic1..6 if owned, else empty]
function buildSlots({ silver, gold, rouletteCoupons, streakFreezeCharges, xpBoostExpiresAt, ownedCosmetics, t }) {
  const slots = [];

  // Currencies — always shown, "filled" iff > 0
  slots.push({
    filled: silver > 0,
    icon: <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconSilver size={22} /></span>,
    label: t.silverLabel || "Silver",
    sub: String(silver || 0)
  });
  slots.push({
    filled: gold > 0,
    icon: <span style={{ display: "inline-flex", color: "var(--color-accent)" }}><IconGold size={22} /></span>,
    label: t.goldLabel || "Gold",
    sub: String(gold || 0)
  });
  slots.push({
    filled: rouletteCoupons > 0,
    icon: "🎟",
    label: t.inventoryCouponLabel || "Coupon",
    sub: rouletteCoupons > 0 ? `×${rouletteCoupons}` : null
  });

  // Consumables / active effects
  slots.push({
    filled: streakFreezeCharges > 0,
    icon: "🧊",
    label: t.inventoryFreezeLabel || "Freeze",
    sub: streakFreezeCharges > 0 ? `×${streakFreezeCharges}` : null
  });

  const xpBoostMs = xpBoostExpiresAt ? new Date(xpBoostExpiresAt).getTime() - Date.now() : 0;
  const xpBoostActive = xpBoostMs > 0;
  const daysLeft = xpBoostActive ? Math.max(1, Math.ceil(xpBoostMs / 86400000)) : 0;
  slots.push({
    filled: xpBoostActive,
    icon: "⚡",
    label: t.inventoryBoostLabel || "Boost",
    sub: xpBoostActive ? `${daysLeft}${t.inventoryDaysLeftSuffix || "d"}` : null
  });

  // Cosmetic collection — fill in order of ownership, then pad with empty
  const ownedItems = ownedCosmetics
    .map((id) => COSMETIC_ITEMS.find((c) => c.id === id))
    .filter(Boolean);
  ownedItems.forEach((item) => {
    slots.push({
      filled: true,
      icon: item.previewIcon,
      label: item.category === "frame" ? (t.inventoryFrameLabel || "Frame") : (t.inventoryBackgroundLabel || "BG"),
      sub: t[item.nameKey] ? String(t[item.nameKey]).split(" ")[0] : null
    });
  });

  // Pad to 12 slots so the grid is always 3×4
  while (slots.length < 12) {
    slots.push({ filled: false, icon: "", label: t.inventoryEmptySlotLabel || "Empty", sub: null });
  }
  return slots.slice(0, 12);
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
      {/* Preview tile — placeholder emoji until real animated previews ship.
          Rounded square so it visually reads as art, not chrome. */}
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
  const ownedList = parseOwnedCosmetics(ownedCosmetics);
  const slots = buildSlots({
    silver,
    gold,
    rouletteCoupons,
    streakFreezeCharges,
    xpBoostExpiresAt,
    ownedCosmetics: ownedList,
    t
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Compact dual-currency wallet header */}
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

      {/* Tab pills */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <TabPill
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {t[tab.labelKey] || tab.id}
          </TabPill>
        ))}
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

          <TokenVault
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
          {/* 3×4 RPG-style grid. Each cell mirrors the daily-board milestone
              card so the two surfaces share the same visual language. */}
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot, i) => (
              <InventorySlot
                key={i}
                filled={slot.filled}
                icon={slot.icon}
                label={slot.label}
                sub={slot.sub}
                t={t}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
