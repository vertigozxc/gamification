import CityIllustration from "../CityIllustration";
import InteractiveMapWrapper from "../InteractiveMapWrapper";

export default function CityTab({ stage, t, cityFullscreen, setCityFullscreen }) {
  return (
    <div className="relative flex flex-col gap-4" style={{ minHeight: "calc(100dvh - var(--mobile-footer-offset, 98px) - 120px)" }}>
      <div className="flex flex-row justify-between items-center gap-3 backdrop-blur-md rounded-2xl p-5 border shadow-xl mobile-card" style={{ borderColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)" }}>
        <div className="flex-1">
          <h3 className="cinzel text-xl font-bold tracking-wide mb-2 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <span>🏙</span> {t.landingGrowCityTitle || "Your City"}
          </h3>
          <p className="text-sm leading-relaxed m-0" style={{ color: "var(--color-text)", opacity: 0.85 }}>
            {t.cityExpansionText || "Level up by completing quests to expand and upgrade your city."}
          </p>
        </div>
        <div className="backdrop-blur-xl px-4 py-3 rounded-2xl shadow-lg border text-center shrink-0" style={{ background: "rgba(10, 10, 18, 0.4)", borderColor: "var(--panel-border)" }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--color-text)", opacity: 0.7 }}>{t.mobileCityLabel}</p>
          <p className="cinzel text-xl font-bold m-0 flex items-center justify-center gap-1" style={{ color: "var(--color-primary)" }}>
            <span className="text-[12px] uppercase opacity-80">{t.levelShort || t.levelLabel}</span> {stage}
          </p>
        </div>
      </div>

      <div className="w-full relative rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-fade-in transition-all duration-500 flex-1" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--panel-border)", borderWidth: 1, minHeight: "calc(100dvh - var(--mobile-footer-offset, 98px) - 250px)", maxHeight: "none" }}>
        {!cityFullscreen && (
          <>
            <button
              onClick={() => setCityFullscreen(true)}
              className="absolute bottom-4 right-4 z-50 rounded-full w-12 h-12 flex items-center justify-center border shadow-xl transition-all"
              style={{ background: "rgba(10, 10, 18, 0.65)", borderColor: "var(--panel-border)", backdropFilter: "blur(12px)", color: "var(--color-primary)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
              </svg>
            </button>
            <InteractiveMapWrapper>
              <CityIllustration height="100%" stage={stage} />
            </InteractiveMapWrapper>
          </>
        )}
      </div>
    </div>
  );
}
