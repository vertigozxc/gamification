import { useTheme } from "../ThemeContext";

// Subtle hint badge placed in the top-left corner of the isometric city map.
// Tells a first-time viewer that the canvas is drag- and pinch-interactive.
// The icon is deliberately theme-aware (uses --color-primary) because the
// chrome around the procedural city IS meant to follow the active theme,
// per the CLAUDE.md exception — only the procedural SVG inside the map
// stays theme-agnostic.
//
// The glyph itself is a stylised hand with a pinch/spread gesture — the
// earlier 4-way arrow + "+" centre read as a "fullscreen" button to too
// many users and did not communicate "you can drag and zoom this map".
export default function CityMapHint() {
  const { t } = useTheme();
  const label = t.cityMapHintLabel || "Drag to pan · pinch to zoom";

  return (
    <div className="city-map-hint" role="img" aria-label={label}>
      <svg
        viewBox="0 0 24 24"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Hand (pan gesture) — fingers folded, thumb out, sits slightly
            lower-left so the pinch arc has room in the upper-right. */}
        <path d="M7 13.5V8a1.4 1.4 0 0 1 2.8 0V12" />
        <path d="M9.8 12V6.5a1.4 1.4 0 0 1 2.8 0V12" />
        <path d="M12.6 12V7a1.4 1.4 0 0 1 2.8 0v5" />
        <path d="M15.4 12.2V8.5a1.4 1.4 0 0 1 2.8 0v6a5.5 5.5 0 0 1-5.5 5.5h-1.2a5 5 0 0 1-4.35-2.53L4.5 14a1.3 1.3 0 0 1 2.15-1.45L8 14" />
        {/* Pinch / zoom arcs (two small diverging ticks top-right) to
            hint at the pinch-to-zoom gesture. */}
        <path d="M18.2 4.2l1.6-1.6" />
        <path d="M17.2 2.6h2.6v2.6" />
        <path d="M22 6.2l-1.6 1.6" />
      </svg>
    </div>
  );
}
