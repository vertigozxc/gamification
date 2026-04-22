// Visual ring around an avatar that signals the owner's streak tier.
// Tiers per spec: 10+ bronze, 21+ silver, 60+ gold, 100+ diamond.

const TIERS = [
  { min: 100, name: "diamond", ringColors: ["#a5f3fc", "#7dd3fc", "#c4b5fd", "#f0abfc"], glow: "rgba(165,243,252,0.55)" },
  { min: 60,  name: "gold",    ringColors: ["#fde68a", "#fbbf24", "#d97706", "#fbbf24"], glow: "rgba(251,191,36,0.55)" },
  { min: 21,  name: "silver",  ringColors: ["#e5e7eb", "#9ca3af", "#d1d5db", "#9ca3af"], glow: "rgba(209,213,219,0.45)" },
  { min: 10,  name: "bronze",  ringColors: ["#fed7aa", "#d97706", "#92400e", "#d97706"], glow: "rgba(217,119,6,0.45)" },
  { min: 0,   name: "none",    ringColors: null, glow: null }
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
      <div style={{ width: total, height: total, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "var(--panel-bg)" }}>
          {children}
        </div>
      </div>
    );
  }

  const [c1, c2, c3, c4] = tier.ringColors;
  return (
    <div
      title={title}
      style={{
        width: total,
        height: total,
        borderRadius: "50%",
        background: `conic-gradient(from 0deg, ${c1}, ${c2}, ${c3}, ${c4}, ${c1})`,
        padding: ringWidth,
        boxShadow: `0 0 ${ringWidth * 3}px ${tier.glow}`,
        flexShrink: 0
      }}
    >
      <div style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "var(--panel-bg)",
        border: "1px solid rgba(0,0,0,0.25)"
      }}>
        {children}
      </div>
    </div>
  );
}
