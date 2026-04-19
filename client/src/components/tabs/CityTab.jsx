import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import CityIllustration from "../CityIllustration";
import CityFireworks from "../CityFireworks";
import InteractiveMapWrapper from "../InteractiveMapWrapper";

const FIREWORKS_CD_KEY = "city_fireworks_last_ts";
const COOLDOWN_MS = 60 * 60 * 1000;

function formatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CityTab({ stage, t, cityFullscreen, setCityFullscreen, dailyXpToday = 0 }) {
  const [fireworksActive, setFireworksActive] = useState(false);
  const [cdRemaining, setCdRemaining] = useState(0);
  const cdIntervalRef = useRef(null);

  function readCdRemaining() {
    try {
      const ts = Number(localStorage.getItem(FIREWORKS_CD_KEY) || 0);
      if (!ts) return 0;
      return Math.max(0, ts + COOLDOWN_MS - Date.now());
    } catch { return 0; }
  }

  useEffect(() => {
    setCdRemaining(readCdRemaining());
  }, []);

  useEffect(() => {
    if (cdRemaining <= 0) {
      if (cdIntervalRef.current) clearInterval(cdIntervalRef.current);
      return;
    }
    cdIntervalRef.current = setInterval(() => {
      const r = readCdRemaining();
      setCdRemaining(r);
      if (r <= 0) clearInterval(cdIntervalRef.current);
    }, 1000);
    return () => clearInterval(cdIntervalRef.current);
  }, [cdRemaining > 0]);

  const handleLaunch = useCallback(() => {
    if (cdRemaining > 0 || fireworksActive) return;
    try { localStorage.setItem(FIREWORKS_CD_KEY, String(Date.now())); } catch {}
    setCdRemaining(COOLDOWN_MS);
    setFireworksActive(true);
  }, [cdRemaining, fireworksActive]);

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
          onClick={handleLaunch}
          disabled={cdRemaining > 0 || fireworksActive}
          style={{
            width: "100%",
            padding: "13px 14px",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.3px",
            color: cdRemaining > 0 ? "var(--color-muted)" : "var(--color-primary)",
            border: "1px solid " + (cdRemaining > 0 ? "var(--panel-border)" : "var(--color-primary)"),
            borderRadius: "14px",
            background: cdRemaining > 0
              ? "color-mix(in srgb, var(--panel-bg) 60%, transparent)"
              : "color-mix(in srgb, var(--color-primary) 10%, var(--panel-bg))",
            boxShadow: cdRemaining > 0 ? "none" : "0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent)",
            cursor: cdRemaining > 0 ? "default" : "pointer",
            transition: "all 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {cdRemaining > 0
            ? (t.fireworksCooldown || "Next in {time}").replace("{time}", formatCountdown(cdRemaining))
            : (t.launchFireworks || "🎆 Launch Fireworks")}
        </button>
      )}
    </div>
  );
}
