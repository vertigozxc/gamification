// SF-Symbols-style icon library.
// All icons are 24×24 viewBox, single 1.75 stroke, rounded caps and joins,
// `currentColor` so they inherit the parent text colour and theme cleanly.
// Pass `size={24}` (or any number) to scale.

function Icon({ size = 18, className, style, strokeWidth = 1.75, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ─── Status / actions ─────────────────────────────────────────────

export function IconCheck(props) {
  return (
    <Icon {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  );
}

export function IconClose(props) {
  return (
    <Icon {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  );
}

export function IconArrowRight(props) {
  return (
    <Icon {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </Icon>
  );
}

export function IconRefresh(props) {
  return (
    <Icon {...props}>
      <polyline points="21 4 21 9 16 9" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <polyline points="3 20 3 15 8 15" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </Icon>
  );
}

export function IconWarning(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l10 17H2L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconTrash(props) {
  return (
    <Icon {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Icon>
  );
}

// ─── Time / clocks ────────────────────────────────────────────────

export function IconClock(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 15 15" />
      <path d="M5.5 4.5l2-2M18.5 4.5l-2-2" />
    </Icon>
  );
}

export function IconTimer(props) {
  return (
    <Icon {...props}>
      <line x1="10" y1="3" x2="14" y2="3" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="7.5" />
    </Icon>
  );
}

export function IconHourglass(props) {
  return (
    <Icon {...props}>
      <line x1="5" y1="2" x2="19" y2="2" />
      <line x1="5" y1="22" x2="19" y2="22" />
      <path d="M17 2v4.17a2 2 0 0 1-.59 1.41L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" />
      <path d="M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
    </Icon>
  );
}

export function IconCalendar(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Icon>
  );
}

// ─── Stars / sparkles / energy ────────────────────────────────────

export function IconStar(props) {
  return (
    <Icon {...props}>
      <polygon points="12 2.6 14.85 8.7 21.4 9.5 16.4 13.95 17.85 20.4 12 17 6.15 20.4 7.6 13.95 2.6 9.5 9.15 8.7 12 2.6" />
    </Icon>
  );
}

export function IconSparkle(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.6 5.4 5.4 1.6-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
      <path d="M19 4v3M20.5 5.5h-3M5 18v3M6.5 19.5h-3" />
    </Icon>
  );
}

export function IconSpark(props) {
  return (
    <Icon {...props}>
      <path d="M12 4l1.6 6.4L20 12l-6.4 1.6L12 20l-1.6-6.4L4 12l6.4-1.6z" />
    </Icon>
  );
}

export function IconBolt(props) {
  return (
    <Icon {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
  );
}

export function IconFlame(props) {
  // Solid flame — fills with currentColor so it reads as a real flame
  // (not a hollow outline). The inner highlight stroke gives it shape
  // without making the silhouette feel cluttered.
  return (
    <Icon {...props}>
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="currentColor"
        stroke="currentColor"
      />
    </Icon>
  );
}

export function IconSupernova(props) {
  return (
    <Icon {...props}>
      <polygon points="12 6 13.4 10.6 18 12 13.4 13.4 12 18 10.6 13.4 6 12 10.6 10.6 12 6" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </Icon>
  );
}

export function IconCrown(props) {
  return (
    <Icon {...props}>
      <path d="M3 18h18" />
      <path d="M3 8l4 5 5-7 5 7 4-5v10H3V8z" />
    </Icon>
  );
}

export function IconGem(props) {
  return (
    <Icon {...props}>
      <polygon points="12 3 19 9 12 21 5 9 12 3" />
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="9" y1="9" x2="12" y2="21" />
      <line x1="15" y1="9" x2="12" y2="21" />
    </Icon>
  );
}

// ─── Targets / goals ──────────────────────────────────────────────

export function IconTarget(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconTrophy(props) {
  return (
    <Icon {...props}>
      <path d="M6 4h12v5a6 6 0 1 1-12 0V4z" />
      <path d="M6 6H4a2 2 0 0 0 0 4h2.4" />
      <path d="M18 6h2a2 2 0 0 1 0 4h-2.4" />
      <path d="M9 16h6v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3z" />
      <line x1="7.5" y1="22" x2="16.5" y2="22" />
    </Icon>
  );
}

// ─── Tabs / nav ───────────────────────────────────────────────────

export function IconHabitsPin(props) {
  return (
    <Icon {...props}>
      <path d="M14 3l7 7-2.5 2.5L16 11l-4 4 1.5 2.5L11 20l-7-7 2.5-2.5L9 12l4-4-1.5-2.5z" />
    </Icon>
  );
}

export function IconDice(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconSwords(props) {
  return (
    <Icon {...props}>
      <path d="M14.5 17.5l4 4L21 19l-4-4" />
      <path d="M3 3l8 8 3-3-7-7-4 0z" />
      <path d="M9.5 17.5l-4 4L3 19l4-4" />
      <path d="M21 3l-8 8-3-3 7-7 4 0z" />
      <line x1="11" y1="11" x2="13" y2="13" />
    </Icon>
  );
}

// ─── Mail / list / book ───────────────────────────────────────────

export function IconEnvelope(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </Icon>
  );
}

export function IconList(props) {
  return (
    <Icon {...props}>
      <rect x="6" y="4" width="12" height="18" rx="2" />
      <path d="M9 4V3h6v1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </Icon>
  );
}

export function IconBook(props) {
  return (
    <Icon {...props}>
      <path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4z" />
      <path d="M20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6V4z" />
    </Icon>
  );
}

// ─── Shopping / store ─────────────────────────────────────────────

export function IconShoppingBag(props) {
  return (
    <Icon {...props}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  );
}

export function IconPuzzle(props) {
  return (
    <Icon {...props}>
      <path d="M14 4a2 2 0 1 0-4 0v2H4v6h2a2 2 0 1 1 0 4H4v4h6v-2a2 2 0 1 1 4 0v2h6v-6h-2a2 2 0 1 1 0-4h2V6h-6V4z" />
    </Icon>
  );
}

export function IconHouse(props) {
  return (
    <Icon {...props}>
      <path d="M3 11l5-4 5 4v9H3z" />
      <path d="M13 14l4-3 4 3v6h-8" />
      <line x1="7" y1="20" x2="7" y2="15" />
      <line x1="17" y1="20" x2="17" y2="17" />
    </Icon>
  );
}

export function IconTag(props) {
  return (
    <Icon {...props}>
      <path d="M21 12l-9 9-9-9V3h9z" />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

// ─── People / profile ─────────────────────────────────────────────

export function IconCamera(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 5L8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  );
}

export function IconUsers(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7" />
      <path d="M21 21v-1c0-2.2-1.5-4-3.5-5" />
    </Icon>
  );
}

export function IconHandshake(props) {
  // Two hands gripping — adapted from Lucide's handshake glyph.
  return (
    <Icon {...props}>
      <path d="M11 17l2 2a1 1 0 1 0 3-3" />
      <path d="M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="M21 3l1 11h-2" />
      <path d="M3 3l-1 11 6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </Icon>
  );
}

export function IconMuscle(props) {
  // Dumbbell — clean, reads as "fitness / body"
  return (
    <Icon {...props}>
      <rect x="2.5" y="9" width="3" height="6" rx="1" />
      <rect x="18.5" y="9" width="3" height="6" rx="1" />
      <rect x="5.5" y="10.5" width="2" height="3" rx="0.5" />
      <rect x="16.5" y="10.5" width="2" height="3" rx="0.5" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" />
    </Icon>
  );
}

export function IconBrain(props) {
  return (
    <Icon {...props}>
      <path d="M12 4a3 3 0 0 0-3 3 2.5 2.5 0 0 0-2.5 2.5c0 .8.4 1.5 1 2-.6.5-1 1.2-1 2A2.5 2.5 0 0 0 9 16a3 3 0 0 0 3 3z" />
      <path d="M12 4a3 3 0 0 1 3 3 2.5 2.5 0 0 1 2.5 2.5c0 .8-.4 1.5-1 2 .6.5 1 1.2 1 2A2.5 2.5 0 0 1 15 16a3 3 0 0 1-3 3z" />
      <line x1="12" y1="4" x2="12" y2="19" />
    </Icon>
  );
}

export function IconMoon(props) {
  return (
    <Icon {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  );
}

// ─── Theme / design ───────────────────────────────────────────────

export function IconPalette(props) {
  return (
    <Icon {...props}>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.4-.2-.8-.4-1.1-.2-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" />
      <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="9" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconGlobe(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </Icon>
  );
}

// ─── Currencies ───────────────────────────────────────────────────
// Coin family: same outer circle (r=9) so the two currencies read as a
// matched pair. Differ only by the central glyph. Stroke-only, no fill,
// inherits currentColor — the surrounding chip can glow but the glyph
// itself stays clean per the project's icon style guide.

export function IconSilver(props) {
  // Stylized "S" formed by two cubic bezier curves (top arc curls left,
  // bottom arc curls right) — reads as a coin face without resorting
  // to fill text.
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 10C13 8.5 9.5 9 9.5 11.5C9.5 13.5 14.5 12.5 14.5 14.5C14.5 16.5 11 17 9.5 15.5" />
    </Icon>
  );
}

export function IconGold(props) {
  // 5-point star inside the coin (outer radius 4, inner radius 1.6 from
  // center 12,12). Scaled-down sibling of IconStar so the two read as
  // visually related when placed next to each other.
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12 8 12.9 10.7 15.8 10.8 13.5 12.5 14.4 15.2 12 13.6 9.6 15.2 10.5 12.5 8.2 10.8 11.1 10.7" />
    </Icon>
  );
}
