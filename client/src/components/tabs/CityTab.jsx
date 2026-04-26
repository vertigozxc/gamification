import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CityFireworks from "../CityFireworks";
import CityIsometricOverview, { DISTRICTS } from "../CityIsometricOverview";
import CityMapHint from "../CityMapHint";
import DistrictView from "../DistrictView";
import InteractiveMapWrapper from "../InteractiveMapWrapper";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";
import SpinWheelModal from "../SpinWheelModal";
import { useTheme } from "../../ThemeContext";
import { pluralizeDays, pluralizeCharges } from "../../i18nConfig";
import { citySpinStatus, upgradeDistrict, downgradeDistrict, devGrantStats, claimBusinessSilver, updateCityName } from "../../api";
import { IconCheck, IconClose, IconArrowRight, IconSparkle, IconTimer, IconTag, IconSilver } from "../icons/Icons";

const DISTRICT_MAX_LEVEL = 5;

// Upgrade requirements per step. Index = currentLevel (0..4).
const DISTRICT_UPGRADE_REQS = [
  { level: 2,  silver: 5,   streak: 0  }, // 0 → 1
  { level: 7,  silver: 15,  streak: 0  }, // 1 → 2
  { level: 13, silver: 25,  streak: 5  }, // 2 → 3
  { level: 21, silver: 50,  streak: 10 }, // 3 → 4
  { level: 33, silver: 100, streak: 21 }  // 4 → 5
];

// Perk translation key builder. Uses t lookup at render time.
function perkKey(districtId, lvl) {
  const capped = districtId.charAt(0).toUpperCase() + districtId.slice(1);
  return `perk${capped}${lvl}`;
}
function perkText(t, districtId, lvl) {
  return t?.[perkKey(districtId, lvl)] || "—";
}

// Short blurb used ONLY on the overview's active-benefits list.
// Inside the district detail the user sees the full per-level perks.
// Residential always reads 'Custom benefits' regardless of level — the
// specific perk list lives inside the district detail screen.
function overviewPerkText(t, districtId, lvl) {
  if (districtId === "residential") {
    return t?.residentialActiveBenefitsBlurb || "Custom benefits";
  }
  return perkText(t, districtId, lvl);
}

function tpl(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}

// Residential free-freeze auto-grant status — 30-day rolling cycle.
// Cap: lvl 2–3 = 1 per cycle; lvl ≥4 = 2 per cycle. Charges are issued
// automatically by the server (in /api/game-state and on the threshold
// upgrade itself); this helper only computes how many days remain until
// the next auto-grant so the City UI can render a countdown.
// New JSON shape: { lastGrantAt: ISO }. Legacy { cycleStartAt, count }
// rows are read forward by treating cycleStartAt as the previous grant.
const FREEZE_CYCLE_DAYS = 30;
const FREEZE_CYCLE_MS = FREEZE_CYCLE_DAYS * 24 * 3600_000;
const VACATION_COOLDOWN_DAYS = 365;
const VACATION_COOLDOWN_MS = VACATION_COOLDOWN_DAYS * 24 * 3600_000;

function residentialFreezeStatus(resLvl, monthlyFreezeClaimsJson, nowMs) {
  const cap = resLvl >= 4 ? 2 : resLvl >= 2 ? 1 : 0;
  if (cap === 0) return { cap: 0, nextResetInDays: 0 };
  let parsed = null;
  try { parsed = JSON.parse(monthlyFreezeClaimsJson || "{}"); } catch { parsed = null; }
  const lastGrantSrc = parsed?.lastGrantAt || parsed?.cycleStartAt;
  const lastGrantMs = lastGrantSrc ? new Date(lastGrantSrc).getTime() : NaN;
  if (!Number.isFinite(lastGrantMs)) {
    return { cap, nextResetInDays: FREEZE_CYCLE_DAYS };
  }
  const dueAtMs = lastGrantMs + FREEZE_CYCLE_MS;
  const nextResetInDays = Math.max(0, Math.ceil((dueAtMs - nowMs) / (24 * 3600_000)));
  return { cap, nextResetInDays };
}

// Residential vacation claim status — 365-day rolling cooldown.
// Vacation is no longer an active window; it's a one-shot grant of 20
// streak-freeze charges, so the `active` branch is gone and the button
// goes straight from cooldown → availableNow.
// The second arg is kept in the signature for backward-compat with the
// call sites that pass it; the value is ignored.
function residentialVacationStatus(resLvl, lastVacationAt, _vacationEndsAt, nowMs) {
  if (resLvl < 3) return { unlocked: false };
  if (lastVacationAt) {
    const nextAvailableMs = new Date(lastVacationAt).getTime() + VACATION_COOLDOWN_MS;
    const daysUntil = Math.max(0, Math.ceil((nextAvailableMs - nowMs) / (24 * 3600_000)));
    if (nextAvailableMs > nowMs) {
      return { unlocked: true, active: false, nextAvailableInDays: daysUntil };
    }
  }
  return { unlocked: true, active: false, availableNow: true };
}

// Client mirror of the server streak XP multiplier tiers
// (see server/rpg_life_daily_quests_v2.json → streak_xp_multiplier).
function streakMultiplier(streak) {
  const s = Number(streak) || 0;
  if (s >= 30) return 1.3;
  if (s >= 21) return 1.2;
  if (s >= 14) return 1.15;
  if (s >= 7)  return 1.1;
  if (s >= 3)  return 1.05;
  return 1;
}

// Citizens population: 1763 × sum(max(level, 1) per district) × streakMult.
// All districts at 0 → 1763 × 5 × 1.0 = 8815. All at 5 with 30-day streak → 1763 × 25 × 1.3 = 57,297.
const CITIZENS_PER_POINT = 1763;
function computeCitizens(districtLevels, streak) {
  const sum = (Array.isArray(districtLevels) ? districtLevels.slice(0, 5) : [])
    .reduce((acc, l) => acc + Math.max(1, Math.floor(Number(l) || 0)), 0);
  const effectiveSum = Number.isFinite(sum) && sum > 0 ? sum : 5;
  const mult = streakMultiplier(streak);
  return Math.floor(CITIZENS_PER_POINT * effectiveSum * mult);
}

function formatThousands(n) {
  return Math.floor(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const SPIN_CACHE_KEY = "city_spin_cache"; // { dateKey, nextSpinAt }

function getTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function msToHMS(ms) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

function readSpinCache() {
  try {
    const raw = localStorage.getItem(SPIN_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeSpinCache(nextSpinAt) {
  try {
    localStorage.setItem(SPIN_CACHE_KEY, JSON.stringify({ dateKey: getTodayKey(), nextSpinAt }));
  } catch {}
}

function clearSpinCache() {
  try {
    localStorage.removeItem(SPIN_CACHE_KEY);
  } catch {}
}

function DistrictNameBadge({ name, level, max, levelLabel }) {
  return (
    <div
      className="cinzel"
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 35,
        padding: "8px 18px",
        borderRadius: 14,
        background: "color-mix(in srgb, #000 55%, transparent)",
        border: "1.5px solid color-mix(in srgb, var(--color-primary) 75%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 18px color-mix(in srgb, #000 45%, transparent)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        pointerEvents: "none",
        maxWidth: "70%",
        textAlign: "center"
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "var(--color-primary)",
          letterSpacing: "0.08em",
          lineHeight: 1.1,
          textShadow: "0 0 8px color-mix(in srgb, var(--color-primary) 35%, transparent)"
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "color-mix(in srgb, #fff 85%, transparent)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          lineHeight: 1
        }}
      >
        {levelLabel} {level}/{max}
      </span>
    </div>
  );
}

function ReqChip({ icon, label, met, current }) {
  // Always show a status marker next to the chip: green ✓ when met,
  // red ✕ when not — previously the unmet state rendered with no mark,
  // which made it ambiguous whether the requirement was still needed.
  const accent = met ? "#4fa85e" : "#e14b5a";
  return (
    <span
      title={`Current: ${current}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: met ? "#4fa85e" : "var(--color-text)",
        background: met
          ? "color-mix(in srgb, #4fa85e 18%, transparent)"
          : "color-mix(in srgb, #e14b5a 10%, transparent)",
        border: `1px solid color-mix(in srgb, ${accent} ${met ? 55 : 40}%, transparent)`
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: 7,
          color: "#fff",
          background: accent,
          lineHeight: 1
        }}
      >
        {met ? <IconCheck size={9} strokeWidth={2.6} /> : <IconClose size={7} strokeWidth={2.6} />}
      </span>
    </span>
  );
}

// One row in the district-level perks list. Visual treatment matches
// the overview's "City Benefits" cards: green-tinted outlined card when
// unlocked, dashed outline when still locked. The currently-applied
// level swaps in the primary accent instead of green so the user
// immediately sees "you are here". Rows intentionally render as
// non-interactive <div>s — taps here shouldn't trigger anything.
function PerkRow({ lvl, levelShort = "LVL", text, unlocked, isCurrent, subline = null }) {
  const circleColor = isCurrent
    ? "var(--color-primary)"
    : unlocked
      ? "#4fa85e"
      : "var(--color-muted)";
  const circleBg = isCurrent
    ? "color-mix(in srgb, var(--color-primary) 22%, transparent)"
    : unlocked
      ? "color-mix(in srgb, #4fa85e 20%, transparent)"
      : "color-mix(in srgb, var(--panel-bg) 80%, transparent)";
  const circleBorder = isCurrent
    ? "color-mix(in srgb, var(--color-primary) 70%, transparent)"
    : unlocked
      ? "color-mix(in srgb, #4fa85e 55%, transparent)"
      : "var(--panel-border)";
  const cardBorder = isCurrent
    ? "1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent)"
    : unlocked
      ? "1px solid color-mix(in srgb, #4fa85e 35%, transparent)"
      : "1px dashed var(--panel-border)";
  const cardBg = isCurrent
    ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
    : unlocked
      ? "color-mix(in srgb, #4fa85e 8%, transparent)"
      : "transparent";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: cardBg,
        border: cardBorder,
        opacity: unlocked ? 1 : 0.62,
        boxShadow: isCurrent
          ? "0 0 14px color-mix(in srgb, var(--color-primary) 20%, transparent)"
          : "none"
      }}
    >
      <span
        style={{
          width: 26, height: 26, borderRadius: 13,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800,
          color: circleColor,
          background: circleBg,
          border: `1px solid ${circleBorder}`,
          flexShrink: 0,
          lineHeight: 1
        }}
        title={`Level ${lvl}`}
      >
        {unlocked ? lvl : "🔒"}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isCurrent ? "var(--color-primary)" : "var(--color-muted)",
          letterSpacing: "0.08em",
          minWidth: 44,
          flexShrink: 0,
          textTransform: "uppercase",
          textShadow: isCurrent
            ? "0 0 6px color-mix(in srgb, var(--color-primary) 45%, transparent)"
            : "none"
        }}
      >
        {levelShort}&nbsp;{lvl}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: subline ? 3 : 0
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: isCurrent ? 700 : 600,
            color: unlocked ? "var(--color-text)" : "var(--color-muted)",
            lineHeight: 1.25
          }}
        >
          {text}
        </span>
        {subline ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-muted)",
              lineHeight: 1.3,
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            {subline}
          </span>
        ) : null}
      </span>
    </div>
  );
}

// Visual before→after reveal used inside the district upgrade popup.
// Layers two <DistrictView> snapshots and crossfades the "before" into
// the "after" over ~1.1 s after a short initial hold, so the user sees
// the procedural illustration literally grow when they upgrade.
function DistrictUpgradeReveal({ districtId, previousLevel, newLevel }) {
  const shouldAnimate = Number.isFinite(previousLevel) && Number.isFinite(newLevel) && newLevel > previousLevel;
  const [crossfaded, setCrossfaded] = useState(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) return undefined;
    // Hold the "before" visible briefly so the change registers as an
    // event rather than a jump — mirrors how CityIsometricOverview reads.
    const id = setTimeout(() => setCrossfaded(true), 500);
    return () => clearTimeout(id);
  }, [shouldAnimate, districtId]);

  const fromLevel = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(previousLevel) || 0)));
  const toLevel = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(newLevel) || 0)));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
        background: "rgba(2, 6, 23, 0.45)",
        boxShadow: "inset 0 0 22px rgba(0,0,0,0.28)"
      }}
    >
      {/* Before snapshot — fades + shrinks out */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: crossfaded ? 0 : 1,
          transform: crossfaded ? "scale(0.96)" : "scale(1)",
          transition: "opacity 1100ms cubic-bezier(0.4, 0, 0.2, 1), transform 1100ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none"
        }}
        aria-hidden={crossfaded ? "true" : undefined}
      >
        <DistrictView districtId={districtId} level={fromLevel} />
      </div>

      {/* After snapshot — fades + settles in from a subtle scale-up */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: crossfaded ? 1 : 0,
          transform: crossfaded ? "scale(1)" : "scale(1.05)",
          transition: "opacity 1100ms cubic-bezier(0.4, 0, 0.2, 1), transform 1100ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none"
        }}
        aria-hidden={crossfaded ? undefined : "true"}
      >
        <DistrictView districtId={districtId} level={toLevel} />
      </div>

      {/* Level pill — LVL X → Y with the Y popping on crossfade */}
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.62)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
          color: "var(--color-text)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums"
        }}
      >
        <span style={{ opacity: 0.75 }}>LVL {fromLevel}</span>
        <span aria-hidden style={{ color: "var(--color-primary)", display: "inline-flex" }}><IconArrowRight size={14} /></span>
        <span
          style={{
            color: "var(--color-primary)",
            display: "inline-block",
            transform: crossfaded ? "scale(1.22)" : "scale(1)",
            textShadow: crossfaded
              ? "0 0 10px color-mix(in srgb, var(--color-primary) 80%, transparent)"
              : "none",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 700ms ease"
          }}
        >
          {toLevel}
        </span>
      </div>
    </div>
  );
}

export default function CityTab({
  stage,
  t,
  dailyXpToday = 0,
  username,
  onRewardClaimed,
  districtLevels = [0, 0, 0, 0, 0],
  silver = 0,
  userLevel = 0,
  userStreak = 0,
  lastBusinessClaimDayKey = "",
  monthlyFreezeClaims = "",
  lastVacationAt = null,
  vacationEndsAt = null,
  onDistrictUpgraded,
  onStatsGranted,
  // Server-persisted custom city name (empty string means "use default").
  cityName: serverCityName = "",
  onCityNameChanged,
  // Tour-only override — when set, the matching district's next
  // upgrade bypasses silver / level / streak gates on the client side.
  // Server grants the same freebie once for Park during onboarding.
  tourFreeUpgradeDistrict = null
}) {
  const [fireworksActive, setFireworksActive] = useState(false);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [cdRemaining, setCdRemaining] = useState(0);
  const [selectedDistrictIdx, setSelectedDistrictIdx] = useState(-1);
  const [upgradePopup, setUpgradePopup] = useState(null); // { districtId, level, name, perk } | null
  // Which district is currently being upgraded (server round-trip can
  // take ~2-3 s, especially during the onboarding tour's free Park
  // upgrade). Drives an inline spinner + disabled state on the upgrade
  // button so the user gets immediate feedback after their tap.
  const [upgradingDistrictId, setUpgradingDistrictId] = useState(null);
  const cdIntervalRef = useRef(null);
  const { themeId, languageId } = useTheme();
  const grassBg = themeId === "light" ? "#7ec382" : "#1d3a28";

  const [lockedInfoOpen, setLockedInfoOpen] = useState(false);
  // Unified success popup. `type` selects icon/copy; `amount` is shown
  // for payloads that have a numeric delta (business profits).
  const [claimSuccessPopup, setClaimSuccessPopup] = useState(null); // { type: "freeze" | "vacation" | "business" | "residentialGrant", amount?: number, freezeCount?: number, vacationCount?: number } | null
  // Residential auto-grant from an upgrade waits for the upgrade popup
  // to be dismissed, then fires its own confirmation.
  const [pendingResidentialPopup, setPendingResidentialPopup] = useState(null);

  // Custom city name — user-editable, persisted server-side (Prisma
  // `User.cityName`, POST /api/profiles/city-name). We keep a localStorage
  // mirror per-username so the header doesn't flicker through the
  // translated default on reload before the game-state fetch resolves.
  // Priority: server value → local cache → translated default.
  const [localCityName, setLocalCityName] = useState("");
  const [cityNameModalOpen, setCityNameModalOpen] = useState(false);
  const [cityNameDraft, setCityNameDraft] = useState("");
  const [cityNameError, setCityNameError] = useState("");
  const [cityNameSaving, setCityNameSaving] = useState(false);
  useEffect(() => {
    if (!username) { setLocalCityName(""); return; }
    try {
      const v = localStorage.getItem(`city_name_${username}`);
      setLocalCityName(v || "");
    } catch { setLocalCityName(""); }
  }, [username]);
  // Keep the local cache in sync with what the server sent back on load so
  // a rename from another device becomes visible the next time this device
  // opens the tab.
  useEffect(() => {
    if (!username || !serverCityName) return;
    try { localStorage.setItem(`city_name_${username}`, serverCityName); } catch {}
    setLocalCityName(serverCityName);
  }, [username, serverCityName]);
  const currentCityName = serverCityName || localCityName || "";
  const effectiveCityName = currentCityName || t.cityNameDefault || "Embervale";
  const openCityNameEdit = useCallback(() => {
    setCityNameDraft(currentCityName || t.cityNameDefault || "");
    setCityNameError("");
    setCityNameModalOpen(true);
  }, [currentCityName, t]);
  const saveCityName = useCallback(async () => {
    const trimmed = String(cityNameDraft || "").trim().slice(0, 24);
    if (!trimmed) { setCityNameError(t.cityNameEditError || "1–24 characters"); return; }
    if (!username) { setCityNameModalOpen(false); return; }
    setCityNameSaving(true);
    try {
      const result = await updateCityName(username, trimmed);
      const saved = typeof result?.cityName === "string" ? result.cityName : trimmed;
      try { localStorage.setItem(`city_name_${username}`, saved); } catch {}
      setLocalCityName(saved);
      onCityNameChanged?.(saved);
      setCityNameModalOpen(false);
    } catch (err) {
      // Fall back to local-only save so the user isn't blocked by a
      // transient backend hiccup; next successful /game-state will
      // reconcile.
      try { localStorage.setItem(`city_name_${username}`, trimmed); } catch {}
      setLocalCityName(trimmed);
      setCityNameError(err?.data?.error || err?.message || (t.cityNameEditError || "Failed to save"));
    } finally {
      setCityNameSaving(false);
    }
  }, [cityNameDraft, username, t, onCityNameChanged]);
  const handleDistrictClick = useCallback((_districtId, idx, meta) => {
    if (meta?.locked) {
      setLockedInfoOpen(true);
      return;
    }
    setSelectedDistrictIdx(idx);
  }, []);

  const handleCloseDistrict = useCallback(() => {
    setSelectedDistrictIdx(-1);
  }, []);
  const districtSwipeBind = useEdgeSwipeBack(handleCloseDistrict, { enabled: selectedDistrictIdx >= 0 });

  const handleQuickUpgrade = useCallback(async (districtId) => {
    if (!username) return;
    // Guard against double-taps while the request is in flight — the
    // backend round-trip is ~2-3 s on the free Park upgrade during
    // onboarding and the user kept tapping again thinking nothing
    // happened. The `upgradingDistrictId` state also drives the
    // spinner + disabled visual on the button itself.
    if (upgradingDistrictId) return;
    setUpgradingDistrictId(districtId);
    // Snapshot the pre-upgrade level BEFORE the API call so the popup can
    // animate before → after. `districtLevels` is the prop-sourced array;
    // DISTRICTS defines the canonical index order (sport, business, park,
    // square, residential).
    const idx = DISTRICTS.findIndex((d) => d.id === districtId);
    const previousLevel = idx >= 0
      ? Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels?.[idx]) || 0)))
      : 0;
    try {
      const result = await upgradeDistrict(username, districtId);
      onDistrictUpgraded?.(result);
      const newLevel = Number(result?.level) || 0;
      const localizedName = t?.[`district${districtId.charAt(0).toUpperCase() + districtId.slice(1)}`] || districtId;
      const perk = t?.[perkKey(districtId, newLevel)] || "";
      // If the server auto-granted Residential perks on this upgrade
      // (lvl 1→2 and 3→4 hand out a Streak Freeze charge; first lvl 3
      // hands out a 20-charge Vacation bundle), surface that as a
      // queued popup so it fires right after the upgrade celebration.
      const grants = result?.grants;
      if (grants && (Number(grants.freeze) > 0 || Number(grants.vacation) > 0)) {
        setPendingResidentialPopup({
          freeze: Number(grants.freeze) || 0,
          vacation: Number(grants.vacation) || 0
        });
      }
      setUpgradePopup({ districtId, level: newLevel, previousLevel, name: localizedName, perk });
      setFireworksActive(true);
      // Park upgrades shorten the spin-wheel cooldown window. The server
      // always returns the latest nextSpinAt, but we cache it locally for
      // the persistent timer — re-sync here so the visible countdown
      // shrinks immediately instead of staying on the pre-upgrade value
      // until the next tab open.
      if (districtId === "park") {
        citySpinStatus(username)
          .then((status) => {
            if (!status?.alreadySpun) {
              clearSpinCache();
              setAlreadySpun(false);
              setCdRemaining(0);
              return;
            }
            if (status?.nextSpinAt) {
              writeSpinCache(status.nextSpinAt);
              const ms = Math.max(0, new Date(status.nextSpinAt) - Date.now());
              setCdRemaining(ms);
              setAlreadySpun(true);
            }
          })
          .catch(() => {
            // Best-effort resync — if the status call fails, leave the
            // cached countdown alone; it'll refresh on the next mount.
          });
      }
    } catch (err) {
      console.warn("[district quick upgrade]", err?.message || err);
    } finally {
      setUpgradingDistrictId(null);
    }
  }, [username, onDistrictUpgraded, t, districtLevels, upgradingDistrictId]);

  const handleQuickDowngrade = useCallback(async (districtId) => {
    if (!username) return;
    try {
      const result = await downgradeDistrict(username, districtId);
      onDistrictUpgraded?.(result);
    } catch (err) {
      console.warn("[district quick downgrade]", err?.message || err);
    }
  }, [username, onDistrictUpgraded]);

  const handleGrantStats = useCallback(async () => {
    if (!username) return;
    try {
      const result = await devGrantStats(username);
      onStatsGranted?.(result);
    } catch (err) {
      console.warn("[dev grant stats]", err?.message || err);
    }
  }, [username, onStatsGranted]);

  const [actionMsg, setActionMsg] = useState("");
  const [businessClaimedLocal, setBusinessClaimedLocal] = useState(null); // null = follow prop; string = override dayKey
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const effectiveBusinessClaimKey = businessClaimedLocal ?? lastBusinessClaimDayKey;
  const businessClaimedToday = effectiveBusinessClaimKey === getTodayKey();
  const msUntilMidnightUtc = (() => {
    const d = new Date(nowMs);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.max(0, next - nowMs);
  })();

  const handleBusinessClaim = useCallback(async () => {
    if (!username) return;
    try {
      const result = await claimBusinessSilver(username);
      onStatsGranted?.({ silver: result.silver });
      setBusinessClaimedLocal(getTodayKey());
      setClaimSuccessPopup({ type: "business", amount: Number(result.granted) || 0 });
    } catch (err) {
      const msg = err?.data?.error || err?.message || "Failed";
      setActionMsg(msg);
      setTimeout(() => setActionMsg(""), 3000);
    }
  }, [username, onStatsGranted]);

  // (Residential freeze + vacation are now auto-granted server-side; no
  // manual claim handlers needed — the popup that confirms an auto
  // grant is fired from the upgrade-district success path and from the
  // game-state lazy-grant payload.)

  // Check localStorage cache on mount
  useEffect(() => {
    const cache = readSpinCache();
    if (cache && cache.dateKey === getTodayKey() && cache.nextSpinAt) {
      setAlreadySpun(true);
      const ms = Math.max(0, new Date(cache.nextSpinAt) - Date.now());
      setCdRemaining(ms);
    }
  }, []);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    // Server is the source of truth: local cache can be stale after admin cooldown reset.
    citySpinStatus(username)
      .then((status) => {
        if (cancelled) return;
        if (!status?.alreadySpun) {
          clearSpinCache();
          setAlreadySpun(false);
          setCdRemaining(0);
          return;
        }

        if (status?.nextSpinAt) {
          writeSpinCache(status.nextSpinAt);
          const ms = Math.max(0, new Date(status.nextSpinAt) - Date.now());
          setCdRemaining(ms);
        }
        setAlreadySpun(true);
      })
      .catch(() => {
        // Keep existing local cache behavior if server status request fails.
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  // Live countdown when already spun
  useEffect(() => {
    if (!alreadySpun || cdRemaining <= 0) {
      if (cdIntervalRef.current) clearInterval(cdIntervalRef.current);
      return;
    }
    cdIntervalRef.current = setInterval(() => {
      const cache = readSpinCache();
      if (!cache?.nextSpinAt) return;
      const ms = Math.max(0, new Date(cache.nextSpinAt) - Date.now());
      setCdRemaining(ms);
      if (ms <= 0) {
        clearInterval(cdIntervalRef.current);
        setAlreadySpun(false);
      }
    }, 1000);
    return () => clearInterval(cdIntervalRef.current);
  }, [alreadySpun, cdRemaining > 0]);

  const handleOpenSpin = useCallback(() => {
    if (alreadySpun) return;
    setSpinModalOpen(true);
  }, [alreadySpun]);

  const handleRewardClaimed = useCallback((result) => {
    if (result?.nextSpinAt) {
      writeSpinCache(result.nextSpinAt);
      setAlreadySpun(true);
      const ms = Math.max(0, new Date(result.nextSpinAt) - Date.now());
      setCdRemaining(ms);
    }
    onRewardClaimed?.(result);
    // Celebrate with fireworks
    setFireworksActive(true);
  }, [onRewardClaimed]);

  const handleSpinModalClose = useCallback(() => {
    setSpinModalOpen(false);
    // If the modal shows cooldown state and user already spun, update local state
    const cache = readSpinCache();
    if (cache && cache.dateKey === getTodayKey()) {
      setAlreadySpun(true);
      const ms = Math.max(0, new Date(cache.nextSpinAt) - Date.now());
      setCdRemaining(ms);
    }
  }, []);

  const handleFireworksDone = useCallback(() => {
    setFireworksActive(false);
  }, []);

  const normalizedStage = Math.max(1, Number(stage) || 1);
  const dailyXpCap = 250;
  const normalizedDailyXp = Math.max(0, Math.min(dailyXpCap, Number(dailyXpToday) || 0));
  const dailyXpPercent = Math.round((normalizedDailyXp / dailyXpCap) * 100);
  const stageCap = 20;
  const stageProgress = normalizedStage <= 1 ? 0 : Math.min(100, 10 + (normalizedStage - 2) * 5);
  const nextMilestone = Math.min(stageCap, Math.ceil(normalizedStage / 4) * 4);
  const eraLabel =
    normalizedStage <= 3
      ? t.cityEraOutpost
      : normalizedStage <= 7
      ? t.cityEraSettlement
      : normalizedStage <= 12
      ? t.cityEraDistrict
      : normalizedStage <= 16
      ? t.cityEraSkyline
      : t.cityEraMetropolis;

  return (
    <div className="mobile-tab-panel flex flex-col gap-4" style={{ minHeight: "calc(100dvh - var(--mobile-footer-offset, 98px) - 100px)" }}>
      {(() => {
        const districtSum = (districtLevels || []).slice(0, 5).reduce((a, l) => a + Math.max(0, Math.floor(Number(l) || 0)), 0);
        const developmentPercent = Math.round((districtSum / 25) * 100);
        // Citizens are a pure function of district development — no streak
        // multiplier. The number grows as districts level up, which is
        // enough signal on its own.
        const citizens = computeCitizens(districtLevels, 0);
        return (
          <div data-tour="city-hero" className="city-hero-surface mobile-card top-screen-block p-4">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3
                  className="cinzel text-[1.35rem] font-bold tracking-wide leading-tight m-0 flex items-center gap-2"
                  style={{ color: "var(--color-primary)" }}
                >
                  <span className="truncate" style={{ minWidth: 0 }}>{effectiveCityName}</span>
                  <button
                    type="button"
                    onClick={openCityNameEdit}
                    aria-label={t.cityNameEditLabel || "Rename city"}
                    className="mobile-pressable"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      padding: 0,
                      borderRadius: 8,
                      border: "1px solid color-mix(in srgb, var(--color-primary) 50%, transparent)",
                      background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                      flexShrink: 0
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                </h3>
                <p className="text-xs leading-relaxed mt-2 mb-0" style={{ color: "var(--color-text)", opacity: 0.88 }}>
                  {t.cityHeroTagline}
                </p>
              </div>

              <div className="city-kpi-chip text-center shrink-0 min-w-[120px]">
                <p className="text-[9px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--color-muted)" }}>
                  {t.cityCitizensLabel || "Citizens"}
                </p>
                <p className="cinzel text-xl font-bold leading-none m-0" style={{ color: "var(--color-primary)" }}>
                  {formatThousands(citizens)}
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>
                <span>{t.cityDevelopment}</span>
                <span>{districtSum}/25 · {developmentPercent}%</span>
              </div>
              <div className="city-progress-track">
                <div className="city-progress-fill" style={{ width: `${developmentPercent}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      <div className="city-canvas-shell animate-fade-in transition-all duration-500">
        {selectedDistrictIdx < 0 && (
          <>
            <div className="city-canvas-inner" style={{ position: "relative" }}>
              <InteractiveMapWrapper background={grassBg} initialScale={1.35}>
                <CityIsometricOverview
                  levels={districtLevels}
                  selectedIdx={selectedDistrictIdx}
                  onDistrictClick={handleDistrictClick}
                  t={t}
                />
              </InteractiveMapWrapper>
              <CityMapHint />
              <CityFireworks active={fireworksActive} onDone={handleFireworksDone} />
            </div>
            <p className="text-[11px] text-center m-0 mt-2" style={{ color: "var(--color-muted)" }}>
              {t.districtTapToEnterHint || "Tap a district to enter"}
            </p>
          </>
        )}
        {selectedDistrictIdx >= 0 && (() => {
          const district = DISTRICTS[selectedDistrictIdx];
          const level = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
          const districtName = t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id;
          return (
            <div
              className="absolute inset-0 z-10"
              style={{ background: "var(--panel-bg)" }}
              {...districtSwipeBind}
            >
              {/* District scene fills the whole shell; pan/zoom enabled. */}
              <InteractiveMapWrapper background="var(--panel-bg)" initialScale={1.0}>
                <DistrictView districtId={district.id} level={level} />
              </InteractiveMapWrapper>
              <CityFireworks active={fireworksActive} onDone={handleFireworksDone} />

              {/* District name badge — framed, top-center, over the map */}
              <DistrictNameBadge
                name={districtName}
                level={level}
                max={DISTRICT_MAX_LEVEL}
                levelLabel={t.districtLevelLabel || "Level"}
              />

              {/* Back — arrow only, top-left. Always dark so the arrow
                  remains readable in the light theme (the district art
                  behind it can be bright sand / pavement). */}
              <button
                onClick={handleCloseDistrict}
                aria-label="Back"
                className="qt-btn mobile-pressable"
                style={{
                  position: "absolute", top: 10, left: 10, zIndex: 40,
                  width: 46, height: 46, borderRadius: 13,
                  border: "1px solid rgba(15,23,42,0.55)",
                  background: "rgba(15,23,42,0.78)",
                  backdropFilter: "blur(6px)",
                  color: "#f8fafc",
                  cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.35)"
                }}
              >
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Active benefits panel — shown on iso overview (no district selected) */}
      {selectedDistrictIdx < 0 && (
        <div
          className="mt-3 mobile-card"
          style={{
            background: "var(--panel-bg)",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", paddingBottom: 6, borderBottom: "1px solid color-mix(in srgb, var(--card-border-idle) 65%, transparent)" }}>
            <span style={{ display: "inline-flex", color: "var(--color-primary)" }}><IconSparkle size={14} /></span>
            <span
              className="cinzel"
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--color-primary)",
                fontWeight: 800,
                textShadow: "0 0 8px color-mix(in srgb, var(--color-primary) 35%, transparent)"
              }}
            >
              {t.activeBenefitsLabel || "Active benefits"}
            </span>
            <span style={{ display: "inline-flex", color: "var(--color-primary)" }}><IconSparkle size={14} /></span>
          </div>
          {DISTRICTS.filter((d) => !d.locked).map((d) => {
            const actualIdx = DISTRICTS.findIndex((x) => x.id === d.id);
            const lvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[actualIdx]) || 0)));
            // Residential blurb is constant regardless of level ("Custom
            // benefits"); other districts show their upgrade state.
            const text = d.id === "residential"
              ? overviewPerkText(t, d.id, lvl)
              : (lvl > 0 ? overviewPerkText(t, d.id, lvl) : (t.districtNotUpgradedYet || "Not upgraded yet"));
            const districtName = t?.[`district${d.id.charAt(0).toUpperCase() + d.id.slice(1)}`] || d.id;
            const unlocked = lvl > 0;

            // Residential perk countdowns live INSIDE the district
            // detail (per-level Benefits rows), not in the overview
            // grid — keep this empty here on purpose.
            const timers = [];

            return (
              <button
                type="button"
                key={`act-${d.id}`}
                onClick={() => setSelectedDistrictIdx(actualIdx)}
                className="qt-btn"
                aria-label={districtName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: unlocked
                    ? "color-mix(in srgb, #4fa85e 8%, transparent)"
                    : "transparent",
                  border: unlocked
                    ? "1px solid color-mix(in srgb, #4fa85e 35%, transparent)"
                    : "1px dashed var(--panel-border)",
                  opacity: unlocked ? 1 : 0.6,
                  textAlign: "left",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <span
                  style={{
                    width: 26, height: 26, borderRadius: 13,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    color: unlocked ? "#4fa85e" : "var(--color-muted)",
                    background: unlocked
                      ? "color-mix(in srgb, #4fa85e 20%, transparent)"
                      : "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
                    border: `1px solid ${unlocked ? "color-mix(in srgb, #4fa85e 55%, transparent)" : "var(--panel-border)"}`,
                    flexShrink: 0
                  }}
                  title={`Level ${lvl}`}
                >
                  {unlocked ? lvl : "—"}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-muted)",
                  letterSpacing: "0.06em",
                  width: 108,
                  flex: "0 0 108px",
                  lineHeight: 1.2,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}>
                  {districtName}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: unlocked ? "var(--color-text)" : "var(--color-muted)",
                    lineHeight: 1.25,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    {!unlocked ? <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.75 }}>🔒</span> : null}
                    {text}
                  </span>
                  {timers.map((line, i) => (
                    <span
                      key={`${d.id}-t-${i}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--color-muted)",
                        lineHeight: 1.25,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <span style={{ color: "#5ba0e0", display: "inline-flex" }}><IconTimer size={11} /></span>
                      {line}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* District controls — appear BELOW the action buttons when a
          district is active (upgrade card / perks list). */}
      {selectedDistrictIdx >= 0 && (() => { /* __DISTRICT_CONTROLS_START__ */
        const district = DISTRICTS[selectedDistrictIdx];
        const level = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const atMax = level >= DISTRICT_MAX_LEVEL;
        const districtName = t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id;
        const nextReq = !atMax ? DISTRICT_UPGRADE_REQS[level] : null;
        const isTourFree = !atMax && tourFreeUpgradeDistrict === district.id && level === 0;
        const isUpgrading = upgradingDistrictId === district.id;
        const canUpgrade = !atMax && !!nextReq && !isUpgrading && (
          isTourFree
          || (
            userLevel >= nextReq.level
            && silver >= nextReq.silver
            && userStreak >= nextReq.streak
          )
        );
        return (
          <div className="flex flex-col gap-3" style={{ order: 20 }}>
            {/* Benefits + next-upgrade requirements card */}
            <div
              className="mobile-card"
              style={{
                background: "var(--panel-bg)",
                display: "flex",
                flexDirection: "column",
                gap: 12
              }}
            >
              {/* Next upgrade requirements + Upgrade CTA */}
              {nextReq ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "12px 14px",
                    background: "color-mix(in srgb, var(--panel-bg) 60%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--card-border-idle) 65%, transparent)",
                    borderRadius: 12
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
                      {tpl(t.districtReqForLevel, { level: level + 1 })}
                    </span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <ReqChip icon="⭐" label={`${t.districtReqLevelPrefix || "Lvl"} ${userLevel} / ${nextReq.level}`} met={userLevel >= nextReq.level} current={userLevel} />
                      <ReqChip icon={<IconSilver size={23} />} label={`${silver} / ${nextReq.silver}`} met={silver >= nextReq.silver} current={silver} />
                      {nextReq.streak > 0 && (
                        <ReqChip icon="🔥" label={`${userStreak} / ${nextReq.streak}`} met={userStreak >= nextReq.streak} current={userStreak} />
                      )}
                    </div>
                  </div>
                  <button
                    data-tour={district.id === "park" ? "district-upgrade" : undefined}
                    onClick={() => handleQuickUpgrade(district.id)}
                    disabled={!canUpgrade}
                    className="qt-btn mobile-pressable"
                    style={{
                      width: "100%",
                      minHeight: 46,
                      borderRadius: 12,
                      border: (canUpgrade || isUpgrading)
                        ? "1.5px solid #4fa85e"
                        : "1.5px solid var(--panel-border)",
                      background: (canUpgrade || isUpgrading)
                        ? "color-mix(in srgb, #4fa85e 22%, var(--panel-bg))"
                        : "color-mix(in srgb, var(--panel-border) 18%, var(--panel-bg))",
                      color: (canUpgrade || isUpgrading) ? "#4fa85e" : "var(--color-muted)",
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: isUpgrading ? "wait" : canUpgrade ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                      opacity: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: (canUpgrade || isUpgrading)
                        ? "0 2px 10px color-mix(in srgb, #4fa85e 22%, transparent)"
                        : "none"
                    }}
                  >
                    {/* Visual order: spinner > lock > label. Spinner trumps
                        the 🔒 because once you've actually tapped Upgrade,
                        the request is on the way regardless of req gating. */}
                    {isUpgrading ? (
                      <span
                        className="district-upgrade-spinner"
                        aria-hidden="true"
                      />
                    ) : !canUpgrade ? (
                      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>🔒</span>
                    ) : null}
                    <span>
                      {isUpgrading
                        ? (t.districtUpgradingLabel || "Upgrading…")
                        : isTourFree
                          ? (t.districtUpgradeFreeCta || "Upgrade · Free")
                          : (t.districtUpgradeCta || "Upgrade")}
                    </span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "color-mix(in srgb, #4fa85e 14%, transparent)",
                    border: "1px solid color-mix(in srgb, #4fa85e 55%, transparent)",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4fa85e",
                    textAlign: "center",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><IconCheck size={12} strokeWidth={2.4} /> {t.districtMaxLevel || "Max level reached"}</span>
                </div>
              )}

              {/* Per-level perks list — matches the overview's "City
                  Benefits" visual: each row is its own outlined card,
                  green-tinted when unlocked / dashed when locked, with
                  the current level pulled out in the primary accent. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--color-muted)",
                    fontWeight: 700,
                    paddingLeft: 4
                  }}
                >
                  {t.districtBenefits || "Benefits"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const unlocked = level >= lvl;
                    const isCurrent = level > 0 && lvl === level;

                    // Residential rows show a "next auto-grant in N days"
                    // sub-line on the source-level row that powers each
                    // perk: lvl 2 (1/mo freeze) is the source while the
                    // player is at lvl 2–3; lvl 4 (2/mo freeze) takes
                    // over once the player reaches lvl 4+; lvl 3 owns
                    // the Vacation 365-day timer.
                    let subline = null;
                    if (district.id === "residential" && unlocked) {
                      if (lvl === 2 && level >= 2 && level <= 3) {
                        const fz = residentialFreezeStatus(level, monthlyFreezeClaims, nowMs);
                        if (fz.cap > 0) {
                          subline = "⏱ " + tpl(
                            t.residentialFreezeNextIn || "Next charge in {days} {dayWord}",
                            { days: fz.nextResetInDays, dayWord: pluralizeDays(fz.nextResetInDays, languageId) }
                          );
                        }
                      } else if (lvl === 4 && level >= 4) {
                        const fz = residentialFreezeStatus(level, monthlyFreezeClaims, nowMs);
                        if (fz.cap > 0) {
                          subline = "⏱ " + tpl(
                            t.residentialFreezeNextIn || "Next charge in {days} {dayWord}",
                            { days: fz.nextResetInDays, dayWord: pluralizeDays(fz.nextResetInDays, languageId) }
                          );
                        }
                      } else if (lvl === 3 && level >= 3) {
                        const vac = residentialVacationStatus(level, lastVacationAt, vacationEndsAt, nowMs);
                        if (vac.unlocked && typeof vac.nextAvailableInDays === "number" && vac.nextAvailableInDays > 0) {
                          subline = "⏱ " + tpl(
                            t.residentialVacationNextIn || "Next vacation in {days} {dayWord}",
                            { days: vac.nextAvailableInDays, dayWord: pluralizeDays(vac.nextAvailableInDays, languageId) }
                          );
                        }
                      }
                    }

                    return (
                      <PerkRow
                        key={lvl}
                        lvl={lvl}
                        levelShort={t.districtLevelShort || "LVL"}
                        text={perkText(t, district.id, lvl)}
                        unlocked={unlocked}
                        isCurrent={isCurrent}
                        subline={subline}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Business: Collect District Profits. Always rendered — at lvl 0
          it shows as a locked preview (same pattern as Park's Spin Wheel
          button below) so the player discovers the mechanic early.
          All three states (active / cooldown / locked) keep a solid
          opaque background + border so the control reads as a real
          button, not a flat table cell. */}
      {selectedDistrictIdx >= 0 && DISTRICTS[selectedDistrictIdx]?.id === "business" && (() => {
        const bizLvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const locked = bizLvl < 1;
        const cooldown = !locked && businessClaimedToday;
        const disabled = locked || cooldown;
        let label;
        let showSilverIcon = false;
        if (locked) {
          label = t.businessCollectProfitsLocked || "🔒 Collect — unlock at Business lvl 1";
        } else if (cooldown) {
          label = `${t.businessClaimWait || "Next claim in"} ${msToHMS(msUntilMidnightUtc)}`;
        } else {
          label = `${t.businessCollectProfits || "Collect District Profits"} +${bizLvl}`;
          showSilverIcon = true;
        }
        const ACCENT = "#d9a441";
        const bg = locked
          ? "var(--panel-bg)"
          : cooldown
            ? `color-mix(in srgb, ${ACCENT} 10%, var(--panel-bg))`
            : `color-mix(in srgb, ${ACCENT} 20%, var(--panel-bg))`;
        const borderColor = locked
          ? "var(--panel-border)"
          : cooldown
            ? `color-mix(in srgb, ${ACCENT} 45%, var(--panel-bg))`
            : ACCENT;
        const borderStyle = locked ? "dashed" : "solid";
        const textColor = locked
          ? "var(--color-muted)"
          : cooldown
            ? `color-mix(in srgb, ${ACCENT} 70%, var(--color-muted))`
            : ACCENT;
        return (
          <button
            onClick={disabled ? undefined : handleBusinessClaim}
            disabled={disabled}
            className="qt-btn mobile-pressable"
            style={{
              width: "100%",
              minHeight: 48,
              padding: "12px 14px",
              marginTop: -4,
              marginBottom: -4,
              borderRadius: 14,
              border: `1.5px ${borderStyle} ${borderColor}`,
              background: bg,
              color: textColor,
              fontWeight: 800,
              fontSize: 14,
              cursor: disabled ? "not-allowed" : "pointer",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 1,
              boxShadow: locked
                ? "none"
                : cooldown
                  ? "inset 0 0 0 1px color-mix(in srgb, " + ACCENT + " 20%, transparent)"
                  : "0 2px 10px color-mix(in srgb, " + ACCENT + " 25%, transparent)",
              order: 5
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {label}
              {showSilverIcon ? <IconSilver size={14} /> : null}
            </span>
          </button>
        );
      })()}

      {/* Residential perks (monthly freeze, vacation bundle) auto-grant.
          The countdown to the next auto-grant lives inside the per-level
          PerkRow on the source-level row (lvl 2 / 4 for freeze, lvl 3
          for vacation) — see the Benefits list below. No manual claim
          button is needed. */}

      {actionMsg && (
        <div
          className="mt-2"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--panel-border)",
            background: "color-mix(in srgb, var(--panel-bg) 70%, transparent)",
            textAlign: "center",
            fontSize: 12,
            color: "var(--color-text)",
            fontWeight: 600,
            order: 6
          }}
        >
          {actionMsg}
        </div>
      )}

      {/* Spin Wheel button — always visible inside Park district. All
          three states (active / cooldown / locked) keep a solid opaque
          background so the control reads as a proper button rather than
          a transparent table cell. Cooldown shortens with Park level
          (24 → 8 h). */}
      {selectedDistrictIdx >= 0 && DISTRICTS[selectedDistrictIdx]?.id === "park" && (() => {
        const parkLvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const locked = parkLvl < 1;
        const cooldown = !locked && alreadySpun;
        const disabled = locked || cooldown;
        let label;
        if (locked) {
          label = t.parkSpinLocked || "🔒 Spin Wheel — unlock at Park lvl 1";
        } else if (cooldown) {
          label = `${t.spinCooldownLabel || "🎰 Next spin"}: ${msToHMS(cdRemaining)}`;
        } else {
          label = t.launchFireworks || "🎆 Launch Fireworks";
        }
        const bg = locked
          ? "var(--panel-bg)"
          : cooldown
            ? "color-mix(in srgb, var(--color-primary) 10%, var(--panel-bg))"
            : "color-mix(in srgb, var(--color-primary) 18%, var(--panel-bg))";
        const borderColor = locked
          ? "var(--panel-border)"
          : cooldown
            ? "color-mix(in srgb, var(--color-primary) 45%, var(--panel-bg))"
            : "var(--color-primary)";
        const borderStyle = locked ? "dashed" : "solid";
        const textColor = locked
          ? "var(--color-muted)"
          : cooldown
            ? "color-mix(in srgb, var(--color-primary) 70%, var(--color-muted))"
            : "var(--color-primary)";
        return (
          <button
            data-tour="spin-wheel"
            onClick={disabled ? undefined : handleOpenSpin}
            disabled={disabled}
            className="qt-btn mobile-pressable"
            style={{
              width: "100%",
              padding: "13px 14px",
              marginTop: -4,
              marginBottom: -4,
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.3px",
              color: textColor,
              border: `1.5px ${borderStyle} ${borderColor}`,
              borderRadius: "14px",
              background: bg,
              boxShadow: locked
                ? "none"
                : cooldown
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)"
                  : "0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent)",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: 1,
              order: 5
            }}
          >
            {label}
          </button>
        );
      })()}

      {upgradePopup && createPortal(
        <div
          className="logout-confirm-overlay"
          onClick={() => {
            setUpgradePopup(null);
            if (pendingResidentialPopup) {
              const grant = pendingResidentialPopup;
              setPendingResidentialPopup(null);
              // Defer one frame so the upgrade overlay's exit transition
              // doesn't overlap with the next overlay's entry.
              requestAnimationFrame(() => {
                setClaimSuccessPopup({
                  type: "residentialGrant",
                  freezeCount: grant.freeze,
                  vacationCount: grant.vacation
                });
              });
            }
          }}
        >
          <div
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "2px solid color-mix(in srgb, var(--color-primary) 50%, transparent)",
              boxShadow: "0 0 40px color-mix(in srgb, var(--color-primary) 15%, transparent), 0 25px 50px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14
            }}
          >
            <div className="logout-confirm-icon" style={{ fontSize: "2.8rem" }}>🎉</div>
            <h3 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)", marginBottom: 0 }}>
              {t.districtUpgradePopupTitle || "District Upgraded!"}
            </h3>
            <DistrictUpgradeReveal
              districtId={upgradePopup.districtId}
              previousLevel={upgradePopup.previousLevel}
              newLevel={upgradePopup.level}
            />
            <p className="logout-confirm-msg" style={{ marginBottom: 0 }}>
              {tpl(t.districtUpgradePopupBody, { name: upgradePopup.name, level: upgradePopup.level })}
            </p>
            {upgradePopup.perk && (
              <div
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "color-mix(in srgb, #4fa85e 14%, transparent)",
                  border: "1px solid color-mix(in srgb, #4fa85e 55%, transparent)",
                  borderRadius: 12,
                  display: "flex", flexDirection: "column", gap: 6
                }}
              >
                <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4fa85e", fontWeight: 800 }}>
                  {t.districtUpgradePopupPerkLabel || "New bonus unlocked"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", lineHeight: 1.3 }}>
                  {upgradePopup.perk}
                </span>
              </div>
            )}
            <button
              onClick={() => {
            setUpgradePopup(null);
            if (pendingResidentialPopup) {
              const grant = pendingResidentialPopup;
              setPendingResidentialPopup(null);
              // Defer one frame so the upgrade overlay's exit transition
              // doesn't overlap with the next overlay's entry.
              requestAnimationFrame(() => {
                setClaimSuccessPopup({
                  type: "residentialGrant",
                  freezeCount: grant.freeze,
                  vacationCount: grant.vacation
                });
              });
            }
          }}
              className="cinzel qt-btn"
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 12,
                border: "1.5px solid var(--color-primary)",
                background: "color-mix(in srgb, var(--color-primary) 22%, var(--panel-bg))",
                color: "var(--color-primary)",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer"
              }}
            >
              {t.districtUpgradePopupClose || "Close"}
            </button>
          </div>
        </div>,
        document.body
      )}

      <SpinWheelModal
        open={spinModalOpen}
        username={username}
        t={t}
        onClose={handleSpinModalClose}
        onRewardClaimed={handleRewardClaimed}
      />

      {claimSuccessPopup && createPortal(
        (() => {
          const popupType = claimSuccessPopup.type;
          const isResidentialGrant = popupType === "residentialGrant";
          const grantedFreeze = isResidentialGrant ? Number(claimSuccessPopup.freezeCount) || 0 : 0;
          const grantedVacation = isResidentialGrant ? Number(claimSuccessPopup.vacationCount) || 0 : 0;
          const totalGranted = grantedFreeze + grantedVacation;
          const icon = isResidentialGrant
            ? (grantedVacation > 0 ? "🏖️" : "❄️")
            : popupType === "freeze" ? "❄️" : popupType === "business" ? "🪙" : "🏖️";
          const title = isResidentialGrant
            ? (t.residentialAutoGrantTitle || "Streak Freeze charges added")
            : popupType === "freeze"
              ? (t.residentialClaimFreezeTitle || "Streak Freeze claimed")
              : popupType === "business"
                ? (t.businessClaimSuccessTitle || "Profits Collected")
                : (t.residentialClaimVacationTitle || "Vacation charges claimed");
          const body = isResidentialGrant
            ? (() => {
                if (grantedVacation > 0 && grantedFreeze > 0) {
                  return tpl(
                    t.residentialAutoGrantBodyBoth || "Vacation unlocked: +{vacation} charges. Monthly cycle: +{freeze}. All in your Profile.",
                    { vacation: grantedVacation, freeze: grantedFreeze }
                  );
                }
                if (grantedVacation > 0) {
                  return tpl(
                    t.residentialAutoGrantBodyVacation || "Vacation perk unlocked — {amount} Streak Freeze charges added to your Profile.",
                    { amount: grantedVacation }
                  );
                }
                return tpl(
                  t.residentialAutoGrantBodyFreeze || "+{amount} Streak Freeze {chargeWord} added to your Profile.",
                  { amount: grantedFreeze, chargeWord: pluralizeCharges(grantedFreeze, languageId) }
                );
              })()
            : popupType === "freeze"
              ? (t.residentialClaimFreezeBody || "Your Streak Freeze charges are waiting in your Profile.")
              : popupType === "business"
                ? tpl(t.businessClaimSuccessBody || "+{amount} 🪙 added to your balance.", {
                    amount: Number(claimSuccessPopup.amount) || 0
                  })
                : (t.residentialVacationClaimed || "20 streak-freeze charges added to your profile.");
          // Suppress popup if grant is empty (defensive fallback)
          if (isResidentialGrant && totalGranted === 0) return null;
          return (
            <div
              className="logout-confirm-overlay"
              onClick={() => setClaimSuccessPopup(null)}
            >
              <div
                className="logout-confirm-card"
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                style={{
                  border: "2px solid rgba(74, 222, 128, 0.6)",
                  boxShadow: "0 0 40px rgba(74, 222, 128, 0.22), 0 25px 50px rgba(0, 0, 0, 0.5)"
                }}
              >
                <div className="logout-confirm-icon">{icon}</div>
                <h3 className="cinzel logout-confirm-title" style={{ color: "#4ade80" }}>
                  {title}
                </h3>
                <p className="logout-confirm-msg">{body}</p>
                <div className="logout-confirm-actions" style={{ justifyContent: "center" }}>
                  <button
                    className="logout-confirm-proceed cinzel mobile-pressable"
                    onClick={() => setClaimSuccessPopup(null)}
                    style={{
                      borderColor: "rgba(74, 222, 128, 0.7)",
                      background: "linear-gradient(135deg, rgba(74,222,128,0.3), rgba(16,185,129,0.25))",
                      color: "#dcfce7"
                    }}
                  >
                    {t.proceedLabel || "OK"}
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {cityNameModalOpen && createPortal(
        <div
          className="logout-confirm-overlay"
          onClick={() => setCityNameModalOpen(false)}
        >
          <div
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              border: "2px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
              boxShadow: "0 0 40px color-mix(in srgb, var(--color-primary) 18%, transparent), 0 25px 50px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 14
            }}
          >
            <div className="logout-confirm-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}><IconTag size={36} /></div>
            <h3 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)", textAlign: "center", marginBottom: 0 }}>
              {t.cityNameEditTitle || "Rename your city"}
            </h3>
            <input
              type="text"
              value={cityNameDraft}
              onChange={(e) => { setCityNameDraft(e.target.value); if (cityNameError) setCityNameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCityName(); } }}
              placeholder={t.cityNameEditPlaceholder || "Enter city name"}
              maxLength={24}
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${cityNameError ? "#e14b5a" : "var(--panel-border)"}`,
                background: "color-mix(in srgb, var(--panel-bg) 95%, transparent)",
                color: "var(--color-text)",
                fontSize: 16,
                fontWeight: 600,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
            {cityNameError && (
              <span style={{ fontSize: 12, color: "#e14b5a", fontWeight: 600, textAlign: "center", marginTop: -6 }}>
                {cityNameError}
              </span>
            )}
            <div className="logout-confirm-actions" style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCityNameModalOpen(false)}
                className="cinzel qt-btn mobile-pressable"
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 12,
                  border: "1.5px solid var(--panel-border)",
                  background: "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
                  color: "var(--color-muted)",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer"
                }}
              >
                {t.cityNameEditCancel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={saveCityName}
                disabled={cityNameSaving}
                className="cinzel qt-btn mobile-pressable"
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 12,
                  border: "1.5px solid var(--color-primary)",
                  background: "color-mix(in srgb, var(--color-primary) 22%, var(--panel-bg))",
                  color: "var(--color-primary)",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: cityNameSaving ? "not-allowed" : "pointer",
                  opacity: cityNameSaving ? 0.6 : 1
                }}
              >
                {cityNameSaving ? "…" : (t.cityNameEditSave || "Save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {lockedInfoOpen && createPortal(
        <div
          className="logout-confirm-overlay"
          onClick={() => setLockedInfoOpen(false)}
        >
          <div
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              border: "2px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
              boxShadow: "0 0 40px color-mix(in srgb, var(--color-primary) 18%, transparent), 0 25px 50px rgba(0, 0, 0, 0.5)"
            }}
          >
            <div className="logout-confirm-icon">🔒</div>
            <h3 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>
              {t.districtLockedTitle || "District locked"}
            </h3>
            <p className="logout-confirm-msg">
              {t.districtLockedBody || "Upgrade every existing district to the maximum level to unlock new territories."}
            </p>
            <div className="logout-confirm-actions" style={{ justifyContent: "center" }}>
              <button
                className="logout-confirm-proceed cinzel mobile-pressable"
                onClick={() => setLockedInfoOpen(false)}
                style={{
                  borderColor: "color-mix(in srgb, var(--color-primary) 60%, transparent)",
                  background: "color-mix(in srgb, var(--color-primary) 22%, var(--panel-bg))",
                  color: "var(--color-primary)"
                }}
              >
                {t.districtLockedAck || t.freezeAck || "Got it"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
