import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import CityFireworks from "../CityFireworks";
import CityIsometricOverview, { DISTRICTS } from "../CityIsometricOverview";
import DistrictView from "../DistrictView";
import InteractiveMapWrapper from "../InteractiveMapWrapper";
import SpinWheelModal from "../SpinWheelModal";
import { useTheme } from "../../ThemeContext";
import { pluralizeDays } from "../../i18nConfig";
import { citySpinStatus, upgradeDistrict, downgradeDistrict, devGrantStats, claimBusinessTokens, claimMonthlyFreeze, startVacation } from "../../api";

const DISTRICT_MAX_LEVEL = 5;

// Upgrade requirements per step. Index = currentLevel (0..4).
const DISTRICT_UPGRADE_REQS = [
  { level: 2,  tokens: 5,   streak: 0  }, // 0 → 1
  { level: 7,  tokens: 15,  streak: 0  }, // 1 → 2
  { level: 13, tokens: 25,  streak: 5  }, // 2 → 3
  { level: 21, tokens: 50,  streak: 10 }, // 3 → 4
  { level: 33, tokens: 100, streak: 21 }  // 4 → 5
];

// Perk translation key builder. Uses t lookup at render time.
function perkKey(districtId, lvl) {
  const capped = districtId.charAt(0).toUpperCase() + districtId.slice(1);
  return `perk${capped}${lvl}`;
}
function perkText(t, districtId, lvl) {
  return t?.[perkKey(districtId, lvl)] || "—";
}

function tpl(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}

// Residential free-freeze status — 30-day rolling cycle.
// Cap: lvl 2–3 = 1 per cycle; lvl ≥4 = 2 per cycle.
// Returns { cap, used, remaining, nextResetInDays, availableNow } where
// nextResetInDays counts down to the end of the current cycle (if the cap is
// exhausted); 0 otherwise.
const FREEZE_CYCLE_DAYS = 30;
const FREEZE_CYCLE_MS = FREEZE_CYCLE_DAYS * 24 * 3600_000;
const VACATION_COOLDOWN_DAYS = 365;
const VACATION_COOLDOWN_MS = VACATION_COOLDOWN_DAYS * 24 * 3600_000;

function residentialFreezeStatus(resLvl, monthlyFreezeClaimsJson, nowMs) {
  const cap = resLvl >= 4 ? 2 : resLvl >= 2 ? 1 : 0;
  if (cap === 0) return { cap: 0, used: 0, remaining: 0, nextResetInDays: 0, availableNow: false };
  let parsed = null;
  try { parsed = JSON.parse(monthlyFreezeClaimsJson || "{}"); } catch { parsed = null; }
  const cycleStartMs = parsed?.cycleStartAt ? new Date(parsed.cycleStartAt).getTime() : NaN;
  const count = Math.max(0, Number(parsed?.count) || 0);
  const inCycle = Number.isFinite(cycleStartMs) && (nowMs - cycleStartMs) < FREEZE_CYCLE_MS;
  if (!inCycle) {
    return { cap, used: 0, remaining: cap, nextResetInDays: 0, availableNow: true };
  }
  const used = Math.min(cap, count);
  const remaining = Math.max(0, cap - used);
  const nextResetInDays = remaining > 0
    ? 0
    : Math.max(0, Math.ceil((cycleStartMs + FREEZE_CYCLE_MS - nowMs) / (24 * 3600_000)));
  return { cap, used, remaining, nextResetInDays, availableNow: remaining > 0 };
}

// Residential vacation status — 365-day rolling cooldown.
function residentialVacationStatus(resLvl, lastVacationAt, vacationEndsAt, nowMs) {
  if (resLvl < 3) return { unlocked: false };
  const active = vacationEndsAt && new Date(vacationEndsAt).getTime() > nowMs;
  if (active) {
    const endsInDays = Math.max(0, Math.ceil((new Date(vacationEndsAt).getTime() - nowMs) / (24 * 3600_000)));
    return { unlocked: true, active: true, endsInDays };
  }
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

function ReqChip({ icon, label, met, current }) {
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
          : "color-mix(in srgb, var(--panel-bg) 85%, transparent)",
        border: `1px solid ${met ? "color-mix(in srgb, #4fa85e 55%, transparent)" : "var(--panel-border)"}`
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
      {met && <span style={{ fontSize: 11 }}>✓</span>}
    </span>
  );
}

function PerkRow({ lvl, levelShort = "LVL", text, unlocked, isNext }) {
  const marker = unlocked ? "✓" : isNext ? "►" : "🔒";
  const markerColor = unlocked ? "#4fa85e" : isNext ? "var(--color-primary)" : "var(--color-muted)";
  const textColor = unlocked ? "var(--color-text)" : isNext ? "var(--color-text)" : "var(--color-muted)";
  const bg = isNext
    ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
    : "transparent";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: 10,
        background: bg,
        border: isNext ? "1px dashed color-mix(in srgb, var(--color-primary) 45%, transparent)" : "1px solid transparent",
        opacity: unlocked || isNext ? 1 : 0.72
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 11,
          fontSize: 11,
          fontWeight: 800,
          color: markerColor,
          background: unlocked
            ? "color-mix(in srgb, #4fa85e 18%, transparent)"
            : isNext
              ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
              : "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
          border: `1px solid ${unlocked ? "color-mix(in srgb, #4fa85e 55%, transparent)" : isNext ? "color-mix(in srgb, var(--color-primary) 55%, transparent)" : "var(--panel-border)"}`
        }}
      >
        {marker}
      </span>
      <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 700, letterSpacing: "0.08em", minWidth: 36 }}>
        {levelShort}&nbsp;{lvl}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: textColor, flex: 1, lineHeight: 1.25 }}>
        {text}
      </span>
    </div>
  );
}

export default function CityTab({
  stage,
  t,
  cityFullscreen,
  setCityFullscreen,
  dailyXpToday = 0,
  username,
  onRewardClaimed,
  districtLevels = [0, 0, 0, 0, 0],
  tokens = 0,
  userLevel = 0,
  userStreak = 0,
  lastBusinessClaimDayKey = "",
  monthlyFreezeClaims = "",
  lastVacationAt = null,
  vacationEndsAt = null,
  onDistrictUpgraded,
  onStatsGranted
}) {
  const [fireworksActive, setFireworksActive] = useState(false);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [cdRemaining, setCdRemaining] = useState(0);
  const [selectedDistrictIdx, setSelectedDistrictIdx] = useState(-1);
  const [expandedView, setExpandedView] = useState("none"); // 'none' | 'iso' | 'district'
  const [upgradePopup, setUpgradePopup] = useState(null); // { districtId, level, name, perk } | null
  const cdIntervalRef = useRef(null);
  const { themeId, languageId } = useTheme();
  const grassBg = themeId === "light" ? "#7ec382" : "#1d3a28";

  const handleDistrictClick = useCallback((_districtId, idx) => {
    setSelectedDistrictIdx(idx);
  }, []);

  const handleCloseDistrict = useCallback(() => {
    setSelectedDistrictIdx(-1);
  }, []);

  const handleQuickUpgrade = useCallback(async (districtId) => {
    if (!username) return;
    try {
      const result = await upgradeDistrict(username, districtId);
      onDistrictUpgraded?.(result);
      const newLevel = Number(result?.level) || 0;
      const localizedName = t?.[`district${districtId.charAt(0).toUpperCase() + districtId.slice(1)}`] || districtId;
      const perk = t?.[perkKey(districtId, newLevel)] || "";
      setUpgradePopup({ districtId, level: newLevel, name: localizedName, perk });
      setFireworksActive(true);
    } catch (err) {
      console.warn("[district quick upgrade]", err?.message || err);
    }
  }, [username, onDistrictUpgraded, t]);

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
      const result = await claimBusinessTokens(username);
      onStatsGranted?.({ tokens: result.tokens });
      setBusinessClaimedLocal(getTodayKey());
      setActionMsg(`+${result.granted} 🪙`);
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      const msg = err?.data?.error || err?.message || "Failed";
      setActionMsg(msg);
      setTimeout(() => setActionMsg(""), 3000);
    }
  }, [username, onStatsGranted]);

  const handleResidentialFreeze = useCallback(async () => {
    if (!username) return;
    try {
      const result = await claimMonthlyFreeze(username);
      const nextMonthlyClaims = result.cycleStartAt
        ? JSON.stringify({ cycleStartAt: result.cycleStartAt, count: result.used })
        : undefined;
      onStatsGranted?.({
        streakFreezeCharges: result.streakFreezeCharges,
        ...(nextMonthlyClaims ? { monthlyFreezeClaims: nextMonthlyClaims } : {})
      });
      setActionMsg(`❄️ +1 · ${t.residentialGrantedToProfile || "Granted to Profile"}`);
      setTimeout(() => setActionMsg(""), 3500);
    } catch (err) {
      setActionMsg(err?.data?.error || err?.message || "Failed");
      setTimeout(() => setActionMsg(""), 3000);
    }
  }, [username, onStatsGranted, t]);

  const handleStartVacation = useCallback(async () => {
    if (!username) return;
    try {
      const result = await startVacation(username);
      onStatsGranted?.({
        streakFreezeCharges: result.streakFreezeCharges,
        vacationStartedAt: result.vacationStartedAt ?? null,
        vacationEndsAt: result.vacationEndsAt ?? null,
        lastVacationAt: result.lastVacationAt ?? null
      });
      setActionMsg(`🏖️ +${result.grantedCharges ?? 20} · ${t.residentialGrantedToProfile || "Granted to Profile"}`);
      setTimeout(() => setActionMsg(""), 3500);
    } catch (err) {
      setActionMsg(err?.data?.error || err?.message || "Failed");
      setTimeout(() => setActionMsg(""), 3000);
    }
  }, [username, onStatsGranted, t]);

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
        const citizens = computeCitizens(districtLevels, userStreak);
        const streakMult = streakMultiplier(userStreak);
        return (
          <div className="city-hero-surface mobile-card top-screen-block p-4">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: "var(--color-muted)" }}>
                  {t.mobileCityLabel}
                </p>
                <h3 className="cinzel text-[1.15rem] font-bold tracking-wide leading-tight m-0 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
                  <span>🏙</span>
                  <span className="truncate">{t.landingGrowCityTitle}</span>
                </h3>
                <p className="text-xs leading-relaxed mt-2 mb-0" style={{ color: "var(--color-text)", opacity: 0.88 }}>
                  {t.cityExpansionText}
                </p>
              </div>

              <div className="city-kpi-chip text-center shrink-0 min-w-[120px]">
                <p className="text-[9px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--color-muted)" }}>
                  {t.cityCitizensLabel || "Citizens"}
                </p>
                <p className="cinzel text-xl font-bold leading-none m-0" style={{ color: "var(--color-primary)" }}>
                  {formatThousands(citizens)}
                </p>
                <p className="text-[10px] mt-1 mb-0" style={{ color: "var(--color-text)", opacity: 0.78 }}>
                  ×{streakMult.toFixed(2)} 🔥
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
              <InteractiveMapWrapper background={grassBg}>
                <CityIsometricOverview
                  levels={districtLevels}
                  selectedIdx={selectedDistrictIdx}
                  onDistrictClick={handleDistrictClick}
                  t={t}
                />
              </InteractiveMapWrapper>
              <CityFireworks active={fireworksActive} onDone={handleFireworksDone} />
              {/* Expand city button */}
              <button
                onClick={() => setExpandedView("iso")}
                aria-label="Expand city"
                style={{
                  position: "absolute", top: 10, right: 10, zIndex: 40,
                  width: 40, height: 40, borderRadius: 10,
                  border: "1px solid var(--panel-border)",
                  background: "color-mix(in srgb, var(--panel-bg) 85%, transparent)",
                  backdropFilter: "blur(6px)",
                  color: "var(--color-text)",
                  cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-center m-0 mt-2" style={{ color: "var(--color-muted)" }}>
              {t.districtTapToEnterHint || "Tap a district to enter"}
            </p>
          </>
        )}
        {selectedDistrictIdx >= 0 && (() => {
          const district = DISTRICTS[selectedDistrictIdx];
          const level = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
          return (
            <div
              className="absolute inset-0 z-10"
              style={{ background: "var(--panel-bg)" }}
            >
              {/* District scene fills the whole shell */}
              <DistrictView districtId={district.id} level={level} />
              <CityFireworks active={fireworksActive} onDone={handleFireworksDone} />

              {/* Back — arrow only, top-left */}
              <button
                onClick={handleCloseDistrict}
                aria-label="Back"
                style={{
                  position: "absolute", top: 10, left: 10, zIndex: 40,
                  width: 40, height: 40, borderRadius: 10,
                  border: "1px solid var(--panel-border)",
                  background: "color-mix(in srgb, var(--panel-bg) 85%, transparent)",
                  backdropFilter: "blur(6px)",
                  color: "var(--color-text)",
                  cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>

              {/* Expand district button — top-right */}
              <button
                onClick={() => setExpandedView("district")}
                aria-label="Expand district"
                style={{
                  position: "absolute", top: 10, right: 10, zIndex: 40,
                  width: 40, height: 40, borderRadius: 10,
                  border: "1px solid var(--panel-border)",
                  background: "color-mix(in srgb, var(--panel-bg) 85%, transparent)",
                  backdropFilter: "blur(6px)",
                  color: "var(--color-text)",
                  cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
                </svg>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Active benefits panel — shown on iso overview (no district selected) */}
      {selectedDistrictIdx < 0 && (
        <div
          className="mt-3"
          style={{
            padding: "14px 16px",
            background: "color-mix(in srgb, var(--panel-bg) 70%, transparent)",
            border: "1px solid var(--panel-border)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
            {t.activeBenefitsLabel || "Active benefits"}
          </span>
          {DISTRICTS.filter((d) => !d.locked).map((d) => {
            const actualIdx = DISTRICTS.findIndex((x) => x.id === d.id);
            const lvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[actualIdx]) || 0)));
            const text = lvl > 0 ? perkText(t, d.id, lvl) : (t.districtNotUpgradedYet || "Not upgraded yet");
            const districtName = t?.[`district${d.id.charAt(0).toUpperCase() + d.id.slice(1)}`] || d.id;
            const unlocked = lvl > 0;

            // Residential — extra timer sub-lines for monthly freeze / vacation
            const timers = [];
            if (d.id === "residential" && unlocked) {
              const fz = residentialFreezeStatus(lvl, monthlyFreezeClaims, nowMs);
              if (fz.cap > 0) {
                if (fz.remaining > 0) {
                  timers.push(tpl(t.residentialFreezeAvailable || "Free freeze ready · {remaining} left this cycle", { remaining: fz.remaining, cap: fz.cap }));
                } else {
                  timers.push(tpl(t.residentialFreezeNextIn || "Next cycle in {days} {dayWord}", { days: fz.nextResetInDays, dayWord: pluralizeDays(fz.nextResetInDays, languageId) }));
                }
              }
              const vac = residentialVacationStatus(lvl, lastVacationAt, vacationEndsAt, nowMs);
              if (vac.unlocked) {
                if (vac.active) {
                  timers.push(tpl(t.residentialVacationActive || "Vacation active · ends in {days} {dayWord}", { days: vac.endsInDays, dayWord: pluralizeDays(vac.endsInDays, languageId) }));
                } else if (vac.availableNow) {
                  timers.push(t.residentialVacationAvailable || "Vacation available");
                } else if (typeof vac.nextAvailableInDays === "number") {
                  timers.push(tpl(t.residentialVacationNextIn || "Next vacation in {days} {dayWord}", { days: vac.nextAvailableInDays, dayWord: pluralizeDays(vac.nextAvailableInDays, languageId) }));
                }
              }
            }

            return (
              <div
                key={`act-${d.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: unlocked
                    ? "color-mix(in srgb, #4fa85e 8%, transparent)"
                    : "transparent",
                  border: unlocked
                    ? "1px solid color-mix(in srgb, #4fa85e 35%, transparent)"
                    : "1px dashed var(--panel-border)",
                  opacity: unlocked ? 1 : 0.6
                }}
              >
                <span
                  style={{
                    width: 24, height: 24, borderRadius: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    color: unlocked ? "#4fa85e" : "var(--color-muted)",
                    background: unlocked
                      ? "color-mix(in srgb, #4fa85e 20%, transparent)"
                      : "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
                    border: `1px solid ${unlocked ? "color-mix(in srgb, #4fa85e 55%, transparent)" : "var(--panel-border)"}`,
                    flexShrink: 0,
                    marginTop: 1
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
                  overflow: "hidden",
                  marginTop: 3
                }}>
                  {districtName}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: unlocked ? "var(--color-text)" : "var(--color-muted)",
                    lineHeight: 1.25
                  }}>
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
                      <span style={{ color: "#5ba0e0", fontSize: 11 }}>⏱</span>
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* District controls — appear BELOW the shell when a district is active */}
      {selectedDistrictIdx >= 0 && (() => {
        const district = DISTRICTS[selectedDistrictIdx];
        const level = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const atMax = level >= DISTRICT_MAX_LEVEL;
        const atMin = level <= 0;
        const districtName = t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id;
        const stepBtnStyle = (disabled, accent) => ({
          width: 48, height: 48, borderRadius: 24,
          border: `1.5px solid ${disabled ? "var(--panel-border)" : accent}`,
          background: disabled
            ? "color-mix(in srgb, var(--panel-bg) 70%, transparent)"
            : `color-mix(in srgb, ${accent} 15%, var(--panel-bg))`,
          color: disabled ? "var(--color-muted)" : accent,
          fontSize: 18, fontWeight: 800, lineHeight: 1,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease", padding: 0
        });
        const nextReq = !atMax ? DISTRICT_UPGRADE_REQS[level] : null;
        const canUpgrade = !atMax && !!nextReq
          && userLevel >= nextReq.level
          && tokens >= nextReq.tokens
          && userStreak >= nextReq.streak;
        return (
          <div className="mt-3 flex flex-col gap-3">
            {/* Top: −1 / name / +1 */}
            <div
              className="flex items-center justify-center gap-4"
              style={{
                padding: "10px 14px",
                background: "color-mix(in srgb, var(--panel-bg) 60%, transparent)",
                border: "1px solid var(--panel-border)",
                borderRadius: 16
              }}
            >
              <button
                onClick={() => handleQuickDowngrade(district.id)}
                disabled={atMin}
                aria-label={`Downgrade ${districtName}`}
                style={stepBtnStyle(atMin, "#e14b5a")}
              >−1</button>
              <div className="text-center" style={{ minWidth: 160 }}>
                <p className="cinzel m-0 font-bold" style={{ color: "var(--color-primary)", fontSize: 15, lineHeight: 1.15 }}>{districtName}</p>
                <p className="m-0" style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 2 }}>
                  {(t.districtLevelLabel || "Level")}: {level}/{DISTRICT_MAX_LEVEL}
                </p>
              </div>
              <button
                onClick={() => handleQuickUpgrade(district.id)}
                disabled={atMax}
                aria-label={`Upgrade ${districtName}`}
                style={stepBtnStyle(atMax, "#4fa85e")}
              >+1</button>
              <button
                onClick={handleGrantStats}
                aria-label={t.devGrantStatsTooltip || "+1 level, +1 token, +1 streak"}
                title={t.devGrantStatsTooltip || "+1 level, +1 token, +1 streak"}
                style={{
                  height: 48,
                  padding: "0 12px",
                  borderRadius: 24,
                  border: "1.5px solid #d9a441",
                  background: "color-mix(in srgb, #d9a441 15%, var(--panel-bg))",
                  color: "#d9a441",
                  fontSize: 14,
                  fontWeight: 800,
                  lineHeight: 1,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transition: "all 0.2s ease"
                }}
              >
                +1 ⭐🪙🔥
              </button>
            </div>

            {/* Benefits + next-upgrade requirements card */}
            <div
              style={{
                padding: "14px 16px",
                background: "color-mix(in srgb, var(--panel-bg) 70%, transparent)",
                border: "1px solid var(--panel-border)",
                borderRadius: 16,
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
                    background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    border: "1px dashed color-mix(in srgb, var(--color-primary) 55%, transparent)",
                    borderRadius: 12
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
                      {tpl(t.districtReqForLevel, { level: level + 1 })}
                    </span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <ReqChip icon="⭐" label={tpl(t.districtReqLevel, { n: nextReq.level })} met={userLevel >= nextReq.level} current={userLevel} />
                      <ReqChip icon="🪙" label={tpl(t.districtReqTokens, { n: nextReq.tokens })} met={tokens >= nextReq.tokens} current={tokens} />
                      {nextReq.streak > 0 && (
                        <ReqChip icon="🔥" label={tpl(t.districtReqStreak, { n: nextReq.streak })} met={userStreak >= nextReq.streak} current={userStreak} />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickUpgrade(district.id)}
                    disabled={!canUpgrade}
                    style={{
                      width: "100%",
                      minHeight: 46,
                      borderRadius: 12,
                      border: `1.5px solid ${canUpgrade ? "#4fa85e" : "var(--panel-border)"}`,
                      background: canUpgrade
                        ? "color-mix(in srgb, #4fa85e 22%, var(--panel-bg))"
                        : "color-mix(in srgb, var(--panel-bg) 70%, transparent)",
                      color: canUpgrade ? "#4fa85e" : "var(--color-muted)",
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: canUpgrade ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {t.districtUpgradeCta || "Upgrade"}
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
                  ✓ {t.districtMaxLevel || "Max level reached"}
                </div>
              )}

              {/* Per-level perks list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
                  {t.districtBenefits || "Benefits"}
                </span>
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const unlocked = level >= lvl;
                  const isNext = !atMax && lvl === level + 1;
                  return (
                    <PerkRow
                      key={lvl}
                      lvl={lvl}
                      levelShort={t.districtLevelShort || "LVL"}
                      text={perkText(t, district.id, lvl)}
                      unlocked={unlocked}
                      isNext={isNext}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Business: Claim daily tokens. Always shown for business district (disabled at lvl 0
          so player sees the future mechanic; shows countdown until next daily reset after claim). */}
      {selectedDistrictIdx >= 0 && DISTRICTS[selectedDistrictIdx]?.id === "business" && (() => {
        const bizLvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const locked = bizLvl < 1;
        const disabled = locked || businessClaimedToday;
        let label;
        if (locked) {
          label = `${t.businessClaimLocked || "Unlock at level 1"}`;
        } else if (businessClaimedToday) {
          label = `${t.businessClaimWait || "Next claim in"} ${msToHMS(msUntilMidnightUtc)}`;
        } else {
          label = `${t.businessClaimBtn || "Collect"} +${bizLvl} 🪙`;
        }
        return (
          <button
            onClick={disabled ? undefined : handleBusinessClaim}
            disabled={disabled}
            className="mt-3"
            style={{
              width: "100%",
              minHeight: 48,
              padding: "12px 14px",
              borderRadius: 14,
              border: `1.5px solid ${disabled ? "var(--panel-border)" : "#d9a441"}`,
              background: disabled
                ? "color-mix(in srgb, var(--panel-bg) 70%, transparent)"
                : "color-mix(in srgb, #d9a441 18%, var(--panel-bg))",
              color: disabled ? "var(--color-muted)" : "#d9a441",
              fontWeight: 800,
              fontSize: 14,
              cursor: disabled ? "not-allowed" : "pointer",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: locked ? 0.7 : 1
            }}
          >
            {label}
          </button>
        );
      })()}

      {/* Residential: Claim monthly freeze + Start vacation */}
      {selectedDistrictIdx >= 0 && DISTRICTS[selectedDistrictIdx]?.id === "residential" && (() => {
        const resLvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const fz = residentialFreezeStatus(resLvl, monthlyFreezeClaims, nowMs);
        const vac = residentialVacationStatus(resLvl, lastVacationAt, vacationEndsAt, nowMs);
        const freezeDisabled = fz.cap === 0 || fz.remaining === 0;
        const vacationDisabled = !vac.unlocked || vac.active || (vac.nextAvailableInDays > 0);
        return (
          <div className="mt-3 flex flex-col gap-2">
            {resLvl >= 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={freezeDisabled ? undefined : handleResidentialFreeze}
                  disabled={freezeDisabled}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1.5px solid ${freezeDisabled ? "var(--panel-border)" : "#5ba0e0"}`,
                    background: freezeDisabled
                      ? "color-mix(in srgb, var(--panel-bg) 70%, transparent)"
                      : "color-mix(in srgb, #5ba0e0 15%, var(--panel-bg))",
                    color: freezeDisabled ? "var(--color-muted)" : "#5ba0e0",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: freezeDisabled ? "not-allowed" : "pointer",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  {t.residentialFreezeBtn || "Claim Free Streak Freeze"}
                </button>
                <span className="text-[11px] text-center" style={{ color: "var(--color-muted)", lineHeight: 1.3 }}>
                  ⏱{" "}
                  {fz.remaining > 0
                    ? tpl(t.residentialFreezeAvailable || "Free freeze ready · {remaining} left this cycle", { remaining: fz.remaining, cap: fz.cap })
                    : tpl(t.residentialFreezeNextIn || "Next cycle in {days} {dayWord}", { days: fz.nextResetInDays, dayWord: pluralizeDays(fz.nextResetInDays, languageId) })}
                </span>
                <span className="text-[10px] text-center" style={{ color: "var(--color-muted)", opacity: 0.7, lineHeight: 1.3 }}>
                  {t.residentialFreezeCycleHint || "30-day cycle · auto-granted to your Profile"}
                </span>
              </div>
            )}
            {resLvl >= 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={vacationDisabled ? undefined : handleStartVacation}
                  disabled={vacationDisabled}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1.5px solid ${vacationDisabled ? "var(--panel-border)" : "#4fa85e"}`,
                    background: vacationDisabled
                      ? "color-mix(in srgb, var(--panel-bg) 70%, transparent)"
                      : "color-mix(in srgb, #4fa85e 15%, var(--panel-bg))",
                    color: vacationDisabled ? "var(--color-muted)" : "#4fa85e",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: vacationDisabled ? "not-allowed" : "pointer",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  {t.residentialVacationBtn || "Start 20-day Vacation"}
                </button>
                <span className="text-[11px] text-center" style={{ color: "var(--color-muted)", lineHeight: 1.3 }}>
                  ⏱{" "}
                  {vac.active
                    ? tpl(t.residentialVacationActive || "Vacation active · ends in {days} {dayWord}", { days: vac.endsInDays, dayWord: pluralizeDays(vac.endsInDays, languageId) })
                    : vac.availableNow
                      ? (t.residentialVacationAvailable || "Available now")
                      : tpl(t.residentialVacationNextIn || "Next vacation in {days} {dayWord}", { days: vac.nextAvailableInDays, dayWord: pluralizeDays(vac.nextAvailableInDays, languageId) })}
                </span>
                <span className="text-[10px] text-center" style={{ color: "var(--color-muted)", opacity: 0.7, lineHeight: 1.3 }}>
                  {t.residentialVacationCycleHint || "365-day cycle · grants 20 charges at once"}
                </span>
              </div>
            )}
          </div>
        );
      })()}

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
            fontWeight: 600
          }}
        >
          {actionMsg}
        </div>
      )}

      {/* Spin Wheel button — always visible inside Park district. Shows as
          disabled at lvl 0 so the player sees the feature; cooldown shortens
          with Park level (24 → 8 h). */}
      {selectedDistrictIdx >= 0 && DISTRICTS[selectedDistrictIdx]?.id === "park" && (() => {
        const parkLvl = Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)));
        const locked = parkLvl < 1;
        const disabled = locked || alreadySpun;
        let label;
        if (locked) {
          label = t.parkSpinLocked || "Unlock at level 1";
        } else if (alreadySpun) {
          label = `${t.spinCooldownLabel || "🎰 Next spin"}: ${msToHMS(cdRemaining)}`;
        } else {
          label = t.launchFireworks || "🎆 Launch Fireworks";
        }
        return (
          <button
            onClick={disabled ? undefined : handleOpenSpin}
            disabled={disabled}
            className="mt-3"
            style={{
              width: "100%",
              padding: "13px 14px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.3px",
              color: disabled ? "var(--color-muted)" : "var(--color-primary)",
              border: "1px solid " + (disabled ? "var(--panel-border)" : "var(--color-primary)"),
              borderRadius: "14px",
              background: disabled
                ? "color-mix(in srgb, var(--panel-bg) 60%, transparent)"
                : "color-mix(in srgb, var(--color-primary) 10%, var(--panel-bg))",
              boxShadow: disabled ? "none" : "0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent)",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: locked ? 0.7 : 1
            }}
          >
            {label}
          </button>
        );
      })()}

      {upgradePopup && (
        <div
          onClick={() => setUpgradePopup(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "var(--card-bg)",
              border: "1.5px solid var(--color-primary)",
              borderRadius: 20,
              padding: "24px 22px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent) inset",
              display: "flex", flexDirection: "column", gap: 14, alignItems: "center"
            }}
          >
            <div
              style={{
                width: 72, height: 72, borderRadius: 36,
                background: "color-mix(in srgb, var(--color-primary) 20%, var(--panel-bg))",
                border: "2px solid var(--color-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36
              }}
            >
              🎉
            </div>
            <h3 className="cinzel m-0" style={{ color: "var(--color-primary)", fontSize: 20, fontWeight: 800, textAlign: "center" }}>
              {t.districtUpgradePopupTitle || "District Upgraded!"}
            </h3>
            <p className="m-0" style={{ color: "var(--color-text)", fontSize: 14, textAlign: "center", lineHeight: 1.4 }}>
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
              onClick={() => setUpgradePopup(null)}
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
        </div>
      )}

      <SpinWheelModal
        open={spinModalOpen}
        username={username}
        t={t}
        onClose={handleSpinModalClose}
        onRewardClaimed={handleRewardClaimed}
      />

      {expandedView !== "none" && (() => {
        const district = selectedDistrictIdx >= 0 ? DISTRICTS[selectedDistrictIdx] : null;
        const level = selectedDistrictIdx >= 0
          ? Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(districtLevels[selectedDistrictIdx]) || 0)))
          : 0;
        return (
          <>
            <div className="city-fullscreen-mode" style={{ backgroundColor: grassBg }}>
              <InteractiveMapWrapper rotated background={grassBg}>
                {expandedView === "iso" ? (
                  <CityIsometricOverview
                    levels={districtLevels}
                    selectedIdx={selectedDistrictIdx}
                    onDistrictClick={(_id, idx) => {
                      setSelectedDistrictIdx(idx);
                      setExpandedView("district");
                    }}
                    t={t}
                  />
                ) : district ? (
                  <DistrictView districtId={district.id} level={level} />
                ) : null}
              </InteractiveMapWrapper>
            </div>
            {/* Close button — fixed to real viewport (not inside rotated element), always visible */}
            <button
              onClick={() => setExpandedView("none")}
              aria-label="Close fullscreen"
              style={{
                position: "fixed",
                bottom: "max(18px, env(safe-area-inset-bottom, 0px))",
                right: "max(18px, env(safe-area-inset-right, 0px))",
                zIndex: 9999999,
                width: 60, height: 60,
                borderRadius: 30,
                border: "2px solid var(--color-primary)",
                background: "rgba(10, 10, 18, 0.88)",
                backdropFilter: "blur(12px)",
                color: "var(--color-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            </button>
          </>
        );
      })()}
    </div>
  );
}
