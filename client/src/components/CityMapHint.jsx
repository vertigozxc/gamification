import { useTheme } from "../ThemeContext";

// Subtle hint badge placed in the top-left corner of the isometric city map.
// Tells a first-time viewer that the canvas is drag- and pinch-interactive.
// The icon is deliberately theme-aware (uses --color-primary) because the
// chrome around the procedural city IS meant to follow the active theme,
// per the CLAUDE.md exception — only the procedural SVG inside the map
// stays theme-agnostic.
export default function CityMapHint() {
  const { t } = useTheme();
  const label = t.cityMapHintLabel || "Drag and pinch to zoom";

  return (
    <div className="city-map-hint" role="img" aria-label={label}>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Four directional arrows — conveys "drag / pan in any direction" */}
        <path d="M12 4 V8" />
        <path d="M10 6 L12 4 L14 6" />
        <path d="M12 20 V16" />
        <path d="M10 18 L12 20 L14 18" />
        <path d="M4 12 H8" />
        <path d="M6 10 L4 12 L6 14" />
        <path d="M20 12 H16" />
        <path d="M18 10 L20 12 L18 14" />
        {/* Center: circle with a "+" to convey zoom */}
        <circle cx="12" cy="12" r="2.4" />
        <path d="M10.8 12 H13.2" />
        <path d="M12 10.8 V13.2" />
      </svg>
    </div>
  );
}
