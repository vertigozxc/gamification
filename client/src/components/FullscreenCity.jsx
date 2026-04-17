import CityIllustration from "./CityIllustration";
import InteractiveMapWrapper from "./InteractiveMapWrapper";

export default function FullscreenCity({ stage, onClose }) {
  return (
    <div className="city-fullscreen-mode" style={{ backgroundColor: "var(--bg-body)", zIndex: 99999 }}>
      <button
        onClick={onClose}
        className="absolute bottom-6 right-6 z-[99999] rounded-full w-14 h-14 flex items-center justify-center border shadow-2xl transition-all"
        style={{ background: "rgba(10, 10, 18, 0.8)", borderColor: "var(--color-primary)", backdropFilter: "blur(12px)", color: "var(--color-primary)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <InteractiveMapWrapper>
        <CityIllustration height="100%" stage={stage} />
      </InteractiveMapWrapper>
    </div>
  );
}
