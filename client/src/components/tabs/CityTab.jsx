import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import CityIllustration from "../CityIllustration";
import CityFireworks from "../CityFireworks";
import InteractiveMapWrapper from "../InteractiveMapWrapper";
import SpinWheelModal from "../SpinWheelModal";

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

export default function CityTab({ stage, t, cityFullscreen, setCityFullscreen, dailyXpToday = 0, username }) {
  const [fireworksActive, setFireworksActive] = useState(false);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [cdRemaining, setCdRemaining] = useState(0);
  const cdIntervalRef = useRef(null);

  // Check localStorage cache on mount
  useEffect(() => {
    const cache = readSpinCache();
    if (cache && cache.dateKey === getTodayKey() && cache.nextSpinAt) {
      setAlreadySpun(true);
      const ms = Math.max(0, new Date(cache.nextSpinAt) - Date.now());
      setCdRemaining(ms);
    }
  }, []);

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
    // Celebrate with fireworks
    setFireworksActive(true);
  }, []);

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
        {!cityFullscreen && (
          <>
            <button
              onClick={() => {
                startTransition(() => {
                  setCityFullscreen(true);
                });
              }}
              className="city-action-btn"
            >
              <span className="city-action-btn__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
                </svg>
              </span>
              <span className="city-action-btn__label">{t.cityExpand}</span>
            </button>
            <div className="city-canvas-inner" style={{ position: "relative" }}>
              <InteractiveMapWrapper>
                <CityIllustration height="100%" stage={stage} />
              </InteractiveMapWrapper>
              <CityFireworks active={fireworksActive} onDone={handleFireworksDone} />
            </div>
          </>
        )}
        {cityFullscreen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6" style={{ background: "color-mix(in srgb, var(--panel-bg) 84%, transparent)" }}>
            <p className="city-hint-strip text-center text-xs" style={{ color: "var(--color-text)" }}>
              {t.cityFullscreenHint}
            </p>
          </div>
        )}
      </div>

      {!cityFullscreen && (
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
    </div>
  );
}
