// Inline SVG illustrations for the 10 unlockable achievements.
// Palette: warm gold gradient for rewards, cool violets for magical
// themes (mentor, phoenix, polyglot). Each icon is 96×96 and uses
// stable gradient ids scoped with the code so multiple instances on the
// same page don't collide.
//
// Rendering: when `locked` is true the parent applies grayscale + dim,
// so these SVGs themselves always draw the FULL-color version.

import React from "react";

const GOLD_STOPS = (
  <>
    <stop offset="0%" stopColor="#fde68a" />
    <stop offset="55%" stopColor="#f59e0b" />
    <stop offset="100%" stopColor="#b45309" />
  </>
);
const GOLD_STOPS_DEEP = (
  <>
    <stop offset="0%" stopColor="#fbbf24" />
    <stop offset="100%" stopColor="#78350f" />
  </>
);

function Plate({ id, children }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3b2a12" />
          <stop offset="100%" stopColor="#0f0804" />
        </radialGradient>
        <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
        <linearGradient id={`${id}-ringInner`} x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS_DEEP}</linearGradient>
      </defs>
      <circle cx="48" cy="48" r="44" fill={`url(#${id}-bg)`} />
      <circle cx="48" cy="48" r="44" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="2.5" />
      <circle cx="48" cy="48" r="40" fill="none" stroke={`url(#${id}-ringInner)`} strokeWidth="0.8" opacity="0.55" />
      {children}
    </>
  );
}

function Icon({ code, children, viewBox = "0 0 96 96" }) {
  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <Plate id={code}>{children}</Plate>
    </svg>
  );
}

/* 1. week_warrior — shield with "7" and crossed swords */
export function WeekWarrior() {
  return (
    <Icon code="ww">
      <defs>
        <linearGradient id="ww-shield" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
      </defs>
      <g transform="translate(0,2)">
        <path d="M48 22 L72 30 L72 50 Q72 66 48 76 Q24 66 24 50 L24 30 Z" fill="url(#ww-shield)" stroke="#78350f" strokeWidth="1.5" />
        <path d="M48 22 L72 30 L72 50 Q72 66 48 76 Q24 66 24 50 L24 30 Z" fill="none" stroke="#fef3c7" strokeWidth="0.8" opacity="0.4" />
        <text x="48" y="58" textAnchor="middle" fontFamily="Georgia, serif" fontSize="26" fontWeight="900" fill="#1f2937">7</text>
      </g>
    </Icon>
  );
}

/* 2. month_monk — crescent moon + hooded meditator */
export function MonthMonk() {
  return (
    <Icon code="mm">
      <defs>
        <radialGradient id="mm-moon" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#eab308" />
        </radialGradient>
        <linearGradient id="mm-robe" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
      </defs>
      <circle cx="62" cy="30" r="16" fill="url(#mm-moon)" />
      <circle cx="67" cy="28" r="14" fill="#0f0804" />
      <g>
        <path d="M32 72 Q32 50 48 50 Q64 50 64 72 Z" fill="url(#mm-robe)" stroke="#4c1d95" strokeWidth="1" />
        <circle cx="48" cy="48" r="9" fill="#f5deb3" />
        <path d="M39 46 Q48 34 57 46 L57 50 Q48 46 39 50 Z" fill="url(#mm-robe)" />
      </g>
      <text x="48" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="12" fontWeight="800" fill="#fde68a" opacity="0.9">30</text>
    </Icon>
  );
}

/* 3. hundred_club — laurel wreath around "100" */
export function HundredClub() {
  return (
    <Icon code="hc">
      <defs>
        <linearGradient id="hc-laurel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <g fill="url(#hc-laurel)" stroke="#78350f" strokeWidth="0.6">
        {[0, 25, 50, 75, 100].map((t) => {
          const a = (t / 100) * Math.PI + Math.PI * 0.1;
          const cx = 48 + Math.cos(a + Math.PI) * 24;
          const cy = 60 - Math.sin(a + Math.PI) * 20;
          return <ellipse key={`l-${t}`} cx={cx} cy={cy} rx="6" ry="3" transform={`rotate(${-30 - t} ${cx} ${cy})`} />;
        })}
        {[0, 25, 50, 75, 100].map((t) => {
          const a = (t / 100) * Math.PI + Math.PI * 0.1;
          const cx = 48 - Math.cos(a + Math.PI) * 24;
          const cy = 60 - Math.sin(a + Math.PI) * 20;
          return <ellipse key={`r-${t}`} cx={cx} cy={cy} rx="6" ry="3" transform={`rotate(${30 + t} ${cx} ${cy})`} />;
        })}
      </g>
      <text x="48" y="58" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="900" fill="url(#hc-laurel)" stroke="#78350f" strokeWidth="0.5">100</text>
    </Icon>
  );
}

/* 4. first_handshake — two clasped hands */
export function FirstHandshake() {
  return (
    <Icon code="fh">
      <defs>
        <linearGradient id="fh-skin-l" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="fh-skin-r" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <g transform="translate(0,4)">
        <path d="M14 46 L40 34 L50 46 L50 58 L40 64 L14 58 Z" fill="url(#fh-skin-l)" stroke="#78350f" strokeWidth="1.2" />
        <path d="M82 46 L56 34 L46 46 L46 58 L56 64 L82 58 Z" fill="url(#fh-skin-r)" stroke="#78350f" strokeWidth="1.2" />
        <rect x="40" y="40" width="16" height="18" rx="4" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
        <circle cx="48" cy="49" r="2" fill="#fef3c7" />
      </g>
    </Icon>
  );
}

/* 5. champion — trophy cup with ribbon banner "7d+" */
export function Champion() {
  return (
    <Icon code="ch">
      <defs>
        <linearGradient id="ch-cup" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
        <linearGradient id="ch-ribbon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>
      <path d="M32 22 L64 22 L62 46 Q62 54 48 54 Q34 54 34 46 Z" fill="url(#ch-cup)" stroke="#78350f" strokeWidth="1.4" />
      <path d="M32 26 Q22 26 22 36 Q22 44 32 44" fill="none" stroke="url(#ch-cup)" strokeWidth="4" />
      <path d="M64 26 Q74 26 74 36 Q74 44 64 44" fill="none" stroke="url(#ch-cup)" strokeWidth="4" />
      <rect x="42" y="54" width="12" height="6" fill="url(#ch-cup)" />
      <rect x="36" y="60" width="24" height="6" fill="#78350f" />
      <path d="M22 66 L74 66 L70 78 L52 74 L48 80 L44 74 L26 78 Z" fill="url(#ch-ribbon)" stroke="#450a0a" strokeWidth="0.8" />
      <text x="48" y="76" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="900" fill="#fef3c7">7d+</text>
    </Icon>
  );
}

/* 6. mentor — torch with 3 silhouettes */
export function Mentor() {
  return (
    <Icon code="mt">
      <defs>
        <radialGradient id="mt-flame" cx="50%" cy="80%" r="80%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="40%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
      </defs>
      <path d="M48 14 Q38 24 40 34 Q42 30 48 30 Q54 30 56 34 Q58 24 48 14 Z" fill="url(#mt-flame)" />
      <rect x="45" y="34" width="6" height="18" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
      <rect x="42" y="48" width="12" height="4" fill="#b45309" />
      <g fill="#1f2937" stroke="#fde68a" strokeWidth="0.6">
        <circle cx="28" cy="66" r="5" />
        <path d="M22 82 Q22 70 28 70 Q34 70 34 82 Z" />
        <circle cx="48" cy="62" r="5.5" />
        <path d="M41 82 Q41 68 48 68 Q55 68 55 82 Z" />
        <circle cx="68" cy="66" r="5" />
        <path d="M62 82 Q62 70 68 70 Q74 70 74 82 Z" />
      </g>
    </Icon>
  );
}

/* 7. first_coin — glowing coin with sparkle */
export function FirstCoin() {
  return (
    <Icon code="fc">
      <defs>
        <radialGradient id="fc-coin" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="50" r="26" fill="url(#fc-coin)" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="48" cy="50" r="20" fill="none" stroke="#fef3c7" strokeWidth="0.8" opacity="0.6" />
      <text x="48" y="59" textAnchor="middle" fontFamily="Georgia, serif" fontSize="26" fontWeight="900" fill="#78350f">★</text>
      <g fill="#fef9c3">
        <circle cx="72" cy="26" r="2" />
        <circle cx="24" cy="32" r="1.6" opacity="0.8" />
        <circle cx="76" cy="62" r="1.4" opacity="0.7" />
      </g>
    </Icon>
  );
}

/* 8. high_roller — stack of coins (200) */
export function HighRoller() {
  return (
    <Icon code="hr">
      <defs>
        <linearGradient id="hr-coin" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
      </defs>
      <g>
        {[72, 60, 48, 36, 24].map((y, i) => (
          <g key={y}>
            <ellipse cx="48" cy={y + 4} rx="22" ry="6" fill="#78350f" opacity="0.55" />
            <ellipse cx="48" cy={y} rx="22" ry="6" fill="url(#hr-coin)" stroke="#78350f" strokeWidth="1" />
            {i === 4 && <text x="48" y={y + 3} textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fontWeight="900" fill="#78350f">200</text>}
          </g>
        ))}
      </g>
    </Icon>
  );
}

/* 9. polyglot — globe + speech bubbles */
export function Polyglot() {
  return (
    <Icon code="pg">
      <defs>
        <radialGradient id="pg-globe" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="52" r="22" fill="url(#pg-globe)" stroke="#fde68a" strokeWidth="1.2" />
      <path d="M26 52 Q48 46 70 52" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.7" />
      <path d="M26 52 Q48 58 70 52" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.7" />
      <path d="M48 30 Q40 52 48 74" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.7" />
      <path d="M48 30 Q56 52 48 74" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.7" />
      <g>
        <rect x="16" y="18" width="22" height="16" rx="4" fill="#fde68a" stroke="#78350f" strokeWidth="0.8" />
        <text x="27" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontWeight="900" fill="#78350f">A</text>
        <path d="M22 34 L22 40 L28 34" fill="#fde68a" stroke="#78350f" strokeWidth="0.8" />
      </g>
      <g>
        <rect x="58" y="18" width="22" height="16" rx="4" fill="#fde68a" stroke="#78350f" strokeWidth="0.8" />
        <text x="69" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontWeight="900" fill="#78350f">Я</text>
        <path d="M74 34 L74 40 L68 34" fill="#fde68a" stroke="#78350f" strokeWidth="0.8" />
      </g>
    </Icon>
  );
}

/* 10. phoenix — bird rising from flames */
export function Phoenix() {
  return (
    <Icon code="px">
      <defs>
        <radialGradient id="px-fire" cx="50%" cy="100%" r="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#450a0a" />
        </radialGradient>
        <linearGradient id="px-bird" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>
      <path d="M20 80 Q30 56 48 60 Q66 56 76 80 Z" fill="url(#px-fire)" />
      <g>
        <path d="M48 22 Q42 30 44 40 Q36 38 30 44 Q38 48 44 46 Q40 56 48 62 Q56 56 52 46 Q58 48 66 44 Q60 38 52 40 Q54 30 48 22 Z" fill="url(#px-bird)" stroke="#7f1d1d" strokeWidth="0.8" />
        <circle cx="48" cy="32" r="1.4" fill="#1f2937" />
      </g>
      <g fill="#fef9c3" opacity="0.8">
        <circle cx="30" cy="70" r="1.4" />
        <circle cx="66" cy="72" r="1.2" />
        <circle cx="48" cy="78" r="1.6" />
      </g>
    </Icon>
  );
}

/* 11/12/13. lvl_10 / lvl_30 / lvl_100 — round medallion with the
   threshold number stamped in the middle, surrounded by a stylized
   laurel wreath. Tier metals: bronze (10) → silver (30) → gold (100)
   so the legendary lvl_100 reads as "the big one" at a glance. */
function LevelMedal({ code, number, palette }) {
  const idBase = `lvl${code}`;
  return (
    <Icon code={idBase}>
      <defs>
        <linearGradient id={`${idBase}-metal`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="55%" stopColor={palette[1]} />
          <stop offset="100%" stopColor={palette[2]} />
        </linearGradient>
        <radialGradient id={`${idBase}-glow`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={palette[0]} stopOpacity="0.55" />
          <stop offset="80%" stopColor={palette[2]} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="30" fill={`url(#${idBase}-glow)`} />
      <circle cx="48" cy="48" r="22" fill={`url(#${idBase}-metal)`} stroke={palette[2]} strokeWidth="1.4" />
      <circle cx="48" cy="48" r="18" fill="none" stroke={palette[2]} strokeWidth="0.8" opacity="0.6" />
      {/* Laurel */}
      <g stroke={palette[1]} strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M22 50 Q28 42 32 50 Q28 58 22 50" />
        <path d="M22 50 Q28 38 36 38" />
        <path d="M22 50 Q28 62 36 62" />
        <path d="M74 50 Q68 42 64 50 Q68 58 74 50" />
        <path d="M74 50 Q68 38 60 38" />
        <path d="M74 50 Q68 62 60 62" />
      </g>
      <text
        x="48"
        y="55"
        textAnchor="middle"
        fontSize={number >= 100 ? 16 : 20}
        fontWeight="900"
        fontFamily="serif"
        fill={palette[2]}
        stroke={palette[2]}
        strokeWidth="0.6"
      >
        {number}
      </text>
    </Icon>
  );
}

export function Lvl10() {
  // Bronze: warm copper palette
  return <LevelMedal code="10" number={10} palette={["#fde7c0", "#c9772f", "#7c3a0e"]} />;
}

export function Lvl30() {
  // Silver: cool steel palette
  return <LevelMedal code="30" number={30} palette={["#f5f5f5", "#a8b0bd", "#4b5563"]} />;
}

export function Lvl100() {
  // Gold: legendary palette, brighter highlight + deeper shadow than the
  // standard medallion ring elsewhere in the file
  return <LevelMedal code="100" number={100} palette={["#fff1a8", "#facc15", "#854d0e"]} />;
}

/* 14. scholar — graduation cap on an open scroll, signalling "studied
   the rules and aced the test". Same gold palette as the other
   knowledge-flavoured icons. */
export function Scholar() {
  return (
    <Icon code="sc">
      <defs>
        <linearGradient id="sc-cap" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
        <linearGradient id="sc-scroll" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Open scroll behind */}
      <g transform="translate(0,4)">
        <path d="M22 56 Q24 50 28 50 L68 50 Q72 50 74 56 L74 70 Q72 76 68 76 L28 76 Q24 76 22 70 Z" fill="url(#sc-scroll)" stroke="#92400e" strokeWidth="1" />
        <line x1="32" y1="60" x2="64" y2="60" stroke="#92400e" strokeWidth="1.2" opacity="0.55" />
        <line x1="32" y1="65" x2="60" y2="65" stroke="#92400e" strokeWidth="1.2" opacity="0.45" />
      </g>
      {/* Mortarboard */}
      <g transform="translate(0,-2)">
        <path d="M48 24 L24 34 L48 44 L72 34 Z" fill="url(#sc-cap)" stroke="#7c2d12" strokeWidth="1" />
        <path d="M36 38 L36 50 Q42 54 48 54 Q54 54 60 50 L60 38" fill="none" stroke="url(#sc-cap)" strokeWidth="3" strokeLinecap="round" />
        {/* Tassel */}
        <line x1="60" y1="34" x2="64" y2="48" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="64" cy="50" r="2" fill="#fbbf24" stroke="#7c2d12" strokeWidth="0.6" />
      </g>
      {/* Tiny stars to read as "passed" */}
      <g fill="#fde68a" opacity="0.85">
        <path d="M20 22 l1.2 2.4 l2.6 0.4 l-1.9 1.8 l0.5 2.6 l-2.4 -1.2 l-2.4 1.2 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.4 z" />
        <path d="M76 26 l0.9 1.8 l2 0.3 l-1.5 1.4 l0.4 2 l-1.8 -0.9 l-1.8 0.9 l0.4 -2 l-1.5 -1.4 l2 -0.3 z" />
      </g>
    </Icon>
  );
}

/* 15. referral_ally — two interlocking rings (your circle + your friend's
   circle) with a small spark at their meeting point. Reads as "you're
   bound together" and matches the SF Symbols-style single-weight outline
   spec from CLAUDE.md while still fitting the gold-on-dark plate the
   other icons use. */
export function ReferralAlly() {
  return (
    <Icon code="ra">
      <defs>
        <linearGradient id="ra-ring" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
        <linearGradient id="ra-ring2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <radialGradient id="ra-spark" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Two interlocking rings — left ring is gold (you), right ring is
          violet (your friend). Slight overlap at centre creates the
          "linked" silhouette. */}
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="38" cy="48" r="18" stroke="url(#ra-ring)" />
        <circle cx="58" cy="48" r="18" stroke="url(#ra-ring2)" />
      </g>
      {/* Soft glow halo behind the meeting point */}
      <circle cx="48" cy="48" r="9" fill="url(#ra-spark)" />
      {/* Four-point spark inside the overlap to read as "spark of
          connection" — small, single-colour, no gradient on the
          glyph itself per the SF-Symbols-ish brief. */}
      <g fill="#fde68a">
        <path d="M48 41 l1 5 l5 1 l-5 1 l-1 5 l-1 -5 l-5 -1 l5 -1 z" />
      </g>
    </Icon>
  );
}

/* 16. referral_recruiter — three interlocking rings (you + two
   referees) arranged as a triangle. Reads as "small crew assembled".
   Same single-weight outline language as ReferralAlly so the two
   referral icons feel like a pair when the user sees them side by
   side in the list. */
export function ReferralRecruiter() {
  return (
    <Icon code="rr">
      <defs>
        <linearGradient id="rr-ringTop" x1="0%" y1="0%" x2="0%" y2="100%">{GOLD_STOPS}</linearGradient>
        <linearGradient id="rr-ringL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="rr-ringR" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
        <radialGradient id="rr-spark" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Three rings in a triangular cluster — top centre + bottom-left
          + bottom-right, with mutual overlap zones meeting near the
          centre. Stroke widths match ReferralAlly so the pair reads
          as a series. */}
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="48" cy="36" r="15" stroke="url(#rr-ringTop)" />
        <circle cx="36" cy="58" r="15" stroke="url(#rr-ringL)" />
        <circle cx="60" cy="58" r="15" stroke="url(#rr-ringR)" />
      </g>
      {/* Glow halo at the centre where the three rings meet */}
      <circle cx="48" cy="50" r="9" fill="url(#rr-spark)" />
      {/* Tiny "3" badge sits just above the cluster centre. Small,
          single-colour, no gradient — keeps the icon legible at the
          24-px size that the list renders. */}
      <text
        x="48"
        y="53"
        textAnchor="middle"
        fontSize="9"
        fontWeight="900"
        fontFamily="serif"
        fill="#fde68a"
      >
        3
      </text>
    </Icon>
  );
}

export const ACHIEVEMENT_ICONS = {
  week_warrior: WeekWarrior,
  month_monk: MonthMonk,
  hundred_club: HundredClub,
  lvl_10: Lvl10,
  lvl_30: Lvl30,
  lvl_100: Lvl100,
  first_handshake: FirstHandshake,
  champion: Champion,
  mentor: Mentor,
  first_coin: FirstCoin,
  high_roller: HighRoller,
  polyglot: Polyglot,
  phoenix: Phoenix,
  scholar: Scholar,
  referral_ally: ReferralAlly,
  referral_recruiter: ReferralRecruiter
};
