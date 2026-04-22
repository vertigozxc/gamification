// Avatar ring that signals a user's streak tier.
// Tiers: 10+ bronze, 21+ silver, 60+ gold, 100+ diamond.
// Each tier has a distinct ring, glow, and corner badge icon.

const TIERS = [
  {
    min: 100,
    name: "diamond",
    label: "Diamond",
    icon: "💎",
    ringColors: ["#a5f3fc", "#7dd3fc", "#c4b5fd", "#f0abfc", "#a5f3fc"],
    glow: "rgba(165,243,252,0.55)",
    badgeBg: "linear-gradient(135deg,#a5f3fc,#c4b5fd)"
  },
  {
    min: 60,
    name: "gold",
    label: "Gold",
    icon: "👑",
    ringColors: ["#fde68a", "#fbbf24", "#d97706", "#fbbf24", "#fde68a"],
    glow: "rgba(251,191,36,0.55)",
    badgeBg: "linear-gradient(135deg,#fde68a,#d97706)"
  },
  {
    min: 21,
    name: "silver",
    label: "Silver",
    icon: "🥈",
    ringColors: ["#e5e7eb", "#9ca3af", "#d1d5db", "#9ca3af", "#e5e7eb"],
    glow: "rgba(209,213,219,0.45)",
    badgeBg: "linear-gradient(135deg,#e5e7eb,#9ca3af)"
  },
  {
    min: 10,
    name: "bronze",
    label: "Bronze",
    icon: "🥉",
    ringColors: ["#fed7aa", "#d97706", "#92400e", "#d97706", "#fed7aa"],
    glow: "rgba(217,119,6,0.45)",
    badgeBg: "linear-gradient(135deg,#fed7aa,#92400e)"
  },
  { min: 0, name: "none", label: "", icon: "", ringColors: null, glow: null, badgeBg: null }
];

export function getStreakTier(streak) {
  const n = Number(streak) || 0;
  return TIERS.find((t) => n >= t.min) || TIERS[TIERS.length - 1];
}

export default function StreakFrame({ children, streak, size = 44, ringWidth = 3, title }) {
  const tier = getStreakTier(streak);
  const total = size + ringWidth * 2;

  if (!tier.ringColors) {
    return (
      <div
        style={{
          width: total,
          height: total,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)"
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  const ringBg = `conic-gradient(from 180deg, ${tier.ringColors.join(", ")})`;

  return (
    <div
      title={title || tier.label}
      style={{
        position: "relative",
        width: total,
        height: total,
        borderRadius: "50%",
        background: ringBg,
        padding: ringWidth,
        boxShadow: `0 0 ${ringWidth * 3}px ${tier.glow}`,
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--panel-bg)",
          border: "1px solid rgba(0,0,0,0.3)"
        }}
      >
        {children}
      </div>
    </div>
  );
}
