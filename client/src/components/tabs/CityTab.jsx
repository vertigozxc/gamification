import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import CityFireworks from "../CityFireworks";
import CityIsometricOverview, { DISTRICTS } from "../CityIsometricOverview";
import DistrictView from "../DistrictView";
import InteractiveMapWrapper from "../InteractiveMapWrapper";
import SpinWheelModal from "../SpinWheelModal";
import { useTheme } from "../../ThemeContext";
import { citySpinStatus, upgradeDistrict, downgradeDistrict } from "../../api";

const DISTRICT_MAX_LEVEL = 5;

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
  onDistrictUpgraded
}) {
  const [fireworksActive, setFireworksActive] = useState(false);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [cdRemaining, setCdRemaining] = useState(0);
  const [selectedDistrictIdx, setSelectedDistrictIdx] = useState(-1);
  const [expandedView, setExpandedView] = useState("none"); // 'none' | 'iso' | 'district'
  const cdIntervalRef = useRef(null);
  const { themeId } = useTheme();
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
    } catch (err) {
      console.warn("[district quick upgrade]", err?.message || err);
    }
  }, [username, onDistrictUpgraded]);

  const handleQuickDowngrade = useCallback(async (districtId) => {
    if (!username) return;
    try {
      const result = await downgradeDistrict(username, districtId);
      onDistrictUpgraded?.(result);
    } catch (err) {
      console.warn("[district quick downgrade]", err?.message || err);
    }
  }, [username, onDistrictUpgraded]);

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

          <div className="city-kpi-chip text-center shrink-0 min-w-[108px]">
            <p className="text-[9px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--color-muted)" }}>
              {t.levelLabel}
            </p>
            <p className="cinzel text-xl font-bold leading-none m-0" style={{ color: "var(--color-primary)" }}>
              {normalizedStage}
            </p>
            <p className="text-[10px] mt-1 mb-0" style={{ color: "var(--color-text)", opacity: 0.78 }}>
              {eraLabel}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>
            <span>{t.cityDevelopment}</span>
            <span>{stageProgress}%</span>
          </div>
          <div className="city-progress-track">
            <div className="city-progress-fill" style={{ width: `${stageProgress}%` }} />
          </div>
          <p className="text-[11px] m-0" style={{ color: "var(--color-text)", opacity: 0.8 }}>
            {t.cityNextMilestoneAt?.replace("{level}", String(nextMilestone))}
          </p>
        </div>

        <div className="relative z-10 mt-3 city-hint-strip">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>
            <span>{t.cityTodayContribution}</span>
            <span>{dailyXpPercent}%</span>
          </div>
          <div className="city-progress-track mt-2">
            <div className="city-progress-fill" style={{ width: `${dailyXpPercent}%` }} />
          </div>
          <p className="text-[11px] m-0 mt-2" style={{ color: "var(--color-text)", opacity: 0.88 }}>
            {t.cityDailyXpLabel}: <strong>{normalizedDailyXp}</strong> / {dailyXpCap} XP
          </p>
        </div>
      </div>

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
        return (
          <div
            className="mt-3 flex items-center justify-center gap-4"
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
          </div>
        );
      })()}

      {selectedDistrictIdx < 0 && (
        <button
          onClick={handleOpenSpin}
          disabled={alreadySpun}
          style={{
            width: "100%",
            padding: "13px 14px",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.3px",
            color: alreadySpun ? "var(--color-muted)" : "var(--color-primary)",
            border: "1px solid " + (alreadySpun ? "var(--panel-border)" : "var(--color-primary)"),
            borderRadius: "14px",
            background: alreadySpun
              ? "color-mix(in srgb, var(--panel-bg) 60%, transparent)"
              : "color-mix(in srgb, var(--color-primary) 10%, var(--panel-bg))",
            boxShadow: alreadySpun ? "none" : "0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent)",
            cursor: alreadySpun ? "default" : "pointer",
            transition: "all 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {alreadySpun
            ? `${t.spinCooldownLabel || "🎰 Next spin"}: ${msToHMS(cdRemaining)}`
            : (t.launchFireworks || "🎆 Launch Fireworks")}
        </button>
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
