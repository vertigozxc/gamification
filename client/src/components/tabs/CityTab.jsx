import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function PerkRow({ lvl, levelShort = "LVL", text, unlocked, isCurrent }) {
  const marker = unlocked ? "✓" : "🔒";
  const markerColor = unlocked ? "#4fa85e" : "var(--color-muted)";
  const textColor = unlocked ? "var(--color-text)" : "var(--color-muted)";
  const bg = isCurrent
    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
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
        border: isCurrent
          ? "1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent)"
          : "1px solid transparent",
        boxShadow: isCurrent
          ? "0 0 14px color-mix(in srgb, var(--color-primary) 22%, transparent)"
          : "none",
        opacity: unlocked ? 1 : 0.72
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
            : "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
          border: `1px solid ${unlocked ? "color-mix(in srgb, #4fa85e 55%, transparent)" : "var(--panel-border)"}`
        }}
      >
        {marker}
      </span>
      <span
        style={{
          fontSize: 10,
          color: isCurrent ? "var(--color-primary)" : "var(--color-muted)",
          fontWeight: isCurrent ? 800 : 700,
          letterSpacing: "0.08em",
          minWidth: 36,
          textShadow: isCurrent ? "0 0 6px color-mix(in srgb, var(--color-primary) 45%, transparent)" : "none"
        }}
      >
        {levelShort}&nbsp;{lvl}
      </span>
      <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, color: textColor, flex: 1, lineHeight: 1.25 }}>
        {text}
      </span>
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
              <InteractiveMapWrapper background={grassBg} initialScale={1.35}>
                <CityIsometricOverview
                  levels={districtLevels}
                  selectedIdx={selectedDistrictIdx}
                  onDistrictClick={handleDistrictClick}
                  t={t}
                />
              </InteractiveMapWrapper>
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
            gap: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", paddingBottom: 6, borderBottom: "1px solid var(--panel-border)" }}>
            <span style={{ fontSize: 14 }}>✨</span>
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
            <span style={{ fontSize: 14 }}>✨</span>
          </div>
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
                  opacity: unlocked ? 1 : 0.6
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
        const districtName = t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id;
        const nextReq = !atMax ? DISTRICT_UPGRADE_REQS[level] : null;
        const canUpgrade = !atMax && !!nextReq
          && userLevel >= nextReq.level
          && tokens >= nextReq.tokens
          && userStreak >= nextReq.streak;
        return (
          <div className="mt-3 flex flex-col gap-3">
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
                      <ReqChip icon="⭐" label={`${t.districtReqLevelPrefix || "Lvl"} ${userLevel} / ${nextReq.level}`} met={userLevel >= nextReq.level} current={userLevel} />
                      <ReqChip icon="🪙" label={`${tokens} / ${nextReq.tokens}`} met={tokens >= nextReq.tokens} current={tokens} />
                      {nextReq.streak > 0 && (
                        <ReqChip icon="🔥" label={`${userStreak} / ${nextReq.streak}`} met={userStreak >= nextReq.streak} current={userStreak} />
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
                  const isCurrent = level > 0 && lvl === level;
                  return (
                    <PerkRow
                      key={lvl}
                      lvl={lvl}
                      levelShort={t.districtLevelShort || "LVL"}
                      text={perkText(t, district.id, lvl)}
                      unlocked={unlocked}
                      isCurrent={isCurrent}
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

      {upgradePopup && createPortal(
        <div
          className="logout-confirm-overlay"
          onClick={() => setUpgradePopup(null)}
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
              onClick={() => setUpgradePopup(null)}
              className="cinzel"
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

    </div>
  );
}
