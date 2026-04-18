import CityIllustration from "../CityIllustration";
import InteractiveMapWrapper from "../InteractiveMapWrapper";

export default function CityTab({ stage, t, cityFullscreen, setCityFullscreen }) {
  const normalizedStage = Math.max(1, Number(stage) || 1);
  const stageCap = 20;
  const stageProgress = Math.min(100, Math.round((normalizedStage / stageCap) * 100));
  const nextMilestone = Math.min(stageCap, Math.ceil(normalizedStage / 4) * 4);
  const eraLabel =
    normalizedStage <= 3
      ? "Outpost"
      : normalizedStage <= 7
      ? "Settlement"
      : normalizedStage <= 12
      ? "District"
      : normalizedStage <= 16
      ? "Skyline"
      : "Metropolis";

  return (
    <div className="mobile-tab-panel flex flex-col gap-4" style={{ minHeight: "calc(100dvh - var(--mobile-footer-offset, 98px) - 100px)" }}>
      <div className="city-hero-surface mobile-card p-4">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: "var(--color-muted)" }}>
              {t.mobileCityLabel || "City"}
            </p>
            <h3 className="cinzel text-[1.15rem] font-bold tracking-wide leading-tight m-0 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
              <span>🏙</span>
              <span className="truncate">{t.landingGrowCityTitle || "Your City"}</span>
            </h3>
            <p className="text-xs leading-relaxed mt-2 mb-0" style={{ color: "var(--color-text)", opacity: 0.88 }}>
              {t.cityExpansionText || "Level up by completing quests to expand and upgrade your city."}
            </p>
          </div>

          <div className="city-kpi-chip text-center shrink-0 min-w-[108px]">
            <p className="text-[9px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--color-muted)" }}>
              {t.levelLabel || "Level"}
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
            <span>Development</span>
            <span>{stageProgress}%</span>
          </div>
          <div className="city-progress-track">
            <div className="city-progress-fill" style={{ width: `${stageProgress}%` }} />
          </div>
          <p className="text-[11px] m-0" style={{ color: "var(--color-text)", opacity: 0.8 }}>
            Next milestone at level {nextMilestone}
          </p>
        </div>
      </div>

      <div className="city-canvas-shell animate-fade-in transition-all duration-500">
        {!cityFullscreen && (
          <>
            <button
              onClick={() => setCityFullscreen(true)}
              className="city-action-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
              </svg>
              <span>Expand</span>
            </button>
            <InteractiveMapWrapper>
              <CityIllustration height="100%" stage={stage} />
            </InteractiveMapWrapper>
          </>
        )}
        {cityFullscreen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6" style={{ background: "color-mix(in srgb, var(--panel-bg) 84%, transparent)" }}>
            <p className="city-hint-strip text-center text-xs" style={{ color: "var(--color-text)" }}>
              City view is open in fullscreen mode.
            </p>
          </div>
        )}
      </div>

      <div className="city-hint-strip flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
        <span>Pinch to zoom</span>
        <span>Drag to explore</span>
        <span>Tap Expand for fullscreen</span>
      </div>
    </div>
  );
}
