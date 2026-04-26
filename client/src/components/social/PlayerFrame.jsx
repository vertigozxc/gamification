// Premium animated avatar frames bought as cosmetics.
// Drop-in alternative to <StreakFrame> — same children-as-portrait
// signature so existing render sites can swap it in directly:
//
//   <PlayerFrame variant="cosmic" size={40}>
//     <Avatar … />
//   </PlayerFrame>
//
// Currently exposes a single variant: "cosmic" (warm gold ring with
// breathing glow + nebula core + two counter-rotating star orbits).
// Maps to the catalog cosmetic id `frame_phoenix`.
//
// Other variants (`fantasy`, `neon`) are stubbed but not rendered yet —
// add the matching CosmeticFrame branch below when they ship.
//
// Keyframes (`pf-breathe`, `pf-rotate-cw`, `pf-rotate-ccw`,
// `pf-twinkle`, `pf-nebula`) live in `client/src/styles.css` so the
// animations work even if the component is lazy-loaded.

// Map cosmetic id -> internal variant name. Centralised here so the
// inventory / store / render sites can all ask the same helper.
const COSMETIC_FRAME_VARIANTS = {
  frame_phoenix: "cosmic"
  // future:
  // frame_lightning: "neon",
  // frame_mythic:    "fantasy"
};

export function getCosmeticFrameVariant(cosmeticId) {
  if (!cosmeticId) return null;
  return COSMETIC_FRAME_VARIANTS[cosmeticId] || null;
}

// ---------- shared atoms ----------

// Forged-gold ring built from a conic + radial gradient stack.
// `inset: t` carves the inner well where the avatar (children) sits.
function GoldRing({ size, thickness = 0.11 }) {
  const t = Math.max(2, Math.round(size * thickness));
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background:
          "conic-gradient(from 220deg, #6b4413 0deg, #f7d97a 40deg, #fff4c0 90deg, #d49a2a 150deg, #8a5a18 210deg, #f7d97a 280deg, #c98920 340deg, #6b4413 360deg)",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4)",
        pointerEvents: "none"
      }}
    >
      {/* inner cut-out for the avatar well */}
      <div
        style={{
          position: "absolute",
          inset: t,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 40%, #3a2410 0%, #1a0e05 70%, #0d0703 100%)",
          boxShadow:
            "inset 0 4px 14px rgba(0,0,0,0.8), inset 0 -2px 10px rgba(255,180,80,0.12), 0 0 0 1px rgba(0,0,0,0.4)"
        }}
      />
      {/* highlight band — shiny top edge for forged-metal feel */}
      <div
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: "50%",
          background:
            "linear-gradient(180deg, rgba(255,250,220,0.55) 0%, rgba(255,250,220,0) 35%)",
          mixBlendMode: "screen",
          pointerEvents: "none"
        }}
      />
      {/* inner edge dark line */}
      <div
        style={{
          position: "absolute",
          inset: t - 2,
          borderRadius: "50%",
          boxShadow:
            "inset 0 0 0 2px rgba(0,0,0,0.55), inset 0 0 12px rgba(255,200,90,0.25)",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}

// Soft warm halo behind the whole frame; uses pf-breathe keyframes.
function BreathingGlow({ color = "rgba(255,190,80,0.55)", spread = 36 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: -spread,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 60%)`,
        filter: "blur(2px)",
        pointerEvents: "none",
        animation: "pf-breathe 3.6s ease-in-out infinite"
      }}
    />
  );
}

// Single particle on an orbit. Position is a function of angle/radius;
// the parent applies the rotation animation so all stars on one orbit
// share the same rotation transform.
function Star({ angle, parentSize, radiusFactor = 0.55, small = false, delay = 0 }) {
  const r = parentSize * radiusFactor;
  const rad = (angle * Math.PI) / 180;
  const cx = parentSize / 2 + Math.cos(rad - Math.PI / 2) * r;
  const cy = parentSize / 2 + Math.sin(rad - Math.PI / 2) * r;
  const sz = small ? 4 : 6;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - sz / 2,
        top: cy - sz / 2,
        width: sz,
        height: sz,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, #fff 0%, #ffe7a8 50%, rgba(255,180,60,0) 80%)",
        boxShadow:
          "0 0 6px 2px rgba(255,220,120,0.9), 0 0 12px 4px rgba(255,170,40,0.55)",
        animation: `pf-twinkle 1.6s ease-in-out ${delay}s infinite`
      }}
    />
  );
}

// ---------- variants ----------

// COSMIC — gold ring + breathing glow + nebula core + two
// counter-rotating star orbits.
function CosmicFrame({ size, children }) {
  const particlesA = [0, 55, 130, 210, 295];
  const particlesB = [25, 95, 170, 245, 330];
  const innerInset = Math.round(size * 0.13);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0
      }}
    >
      <BreathingGlow color="rgba(255,190,90,0.5)" spread={Math.max(18, Math.round(size * 0.3))} />
      <GoldRing size={size} thickness={0.105} />
      {/* nebula core inside the avatar well */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: innerInset,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,200,90,0.55) 0%, rgba(255,120,40,0.25) 30%, rgba(80,30,10,0) 60%)",
          mixBlendMode: "screen",
          animation: "pf-nebula 5s ease-in-out infinite",
          pointerEvents: "none",
          filter: "blur(4px)"
        }}
      />
      {/* orbit A — clockwise */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          animation: "pf-rotate-cw 9s linear infinite",
          pointerEvents: "none"
        }}
      >
        {particlesA.map((deg, i) => (
          <Star key={`a${i}`} angle={deg} parentSize={size} radiusFactor={0.54} delay={i * 0.3} />
        ))}
      </div>
      {/* orbit B — counter-clockwise, slightly larger */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          animation: "pf-rotate-ccw 13s linear infinite",
          pointerEvents: "none"
        }}
      >
        {particlesB.map((deg, i) => (
          <Star key={`b${i}`} angle={deg} parentSize={size} radiusFactor={0.6} small delay={i * 0.4} />
        ))}
      </div>
      {/* avatar slot — clipped to a circle, sized to the inner well.
          Flex-centered so children of any intrinsic size land in the
          middle without overflowing the gold ring. */}
      <div
        style={{
          position: "absolute",
          inset: innerInset,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--panel-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------- public ----------

export default function PlayerFrame({ variant = "cosmic", size = 40, ringWidth = 0, children, title }) {
  // ringWidth is accepted for drop-in compatibility with <StreakFrame>
  // (which sums size + 2*ringWidth into total). Premium frames bake the
  // ring into the same `size` box, so the visible diameter matches what
  // streak rings produce when the streak frame is hidden.
  const total = size + ringWidth * 2;
  if (variant === "cosmic") {
    return (
      <div title={title} style={{ display: "inline-flex" }}>
        <CosmicFrame size={total}>{children}</CosmicFrame>
      </div>
    );
  }
  // Unknown / unsupported variant — render children unframed.
  return <>{children}</>;
}
