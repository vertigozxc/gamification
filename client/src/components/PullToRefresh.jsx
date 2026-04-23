import usePullToRefresh from "../hooks/usePullToRefresh";

// Native iOS-style pull-to-refresh.
// Content translates down with the finger (rubber-banded by the hook),
// a small spinner sits in the gap that opens above it. No text. On
// release under the threshold the content springs back; past the
// threshold it's held at REST_HEIGHT while onRefresh runs, then
// everything glides back together. All transforms live on a single
// wrapper so there's no layout shift / jerk at any point.

const REST_HEIGHT = 56;

export default function PullToRefresh({ onRefresh, disabled = false, target = null, variant = "native", children }) {
  const { state, pullDistance, triggerPx } = usePullToRefresh({
    target,
    onRefresh,
    disabled
  });

  const progress = Math.min(1, pullDistance / triggerPx);

  // "overlay" mode keeps the content completely static and only shows a
  // floating spinner overlay at the top. Used on panels that are themselves
  // absolutely positioned (social Screen) — dragging their container around
  // looks buggy, so we strip the translation entirely.
  if (variant === "overlay") {
    return <OverlayPTR state={state} progress={progress}>{children}</OverlayPTR>;
  }
  // Resolve translate target per state. During an active drag we track
  // the finger 1:1 (no transition); in every other phase we animate.
  let offset;
  let animate;
  if (state === "pulling" || state === "ready") {
    offset = pullDistance;
    animate = false;
  } else if (state === "refreshing") {
    offset = REST_HEIGHT;
    animate = true;
  } else {
    // idle | done — always glide back to 0.
    offset = 0;
    animate = true;
  }

  return (
    <div
      style={{
        position: "relative",
        transform: `translateY(${offset}px)`,
        transition: animate ? "transform 340ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
        willChange: "transform"
      }}
    >
      <SpinnerCap offset={offset} state={state} progress={progress} />
      {children}
    </div>
  );
}

function SpinnerCap({ offset, state, progress }) {
  // Caps the space above the content so the spinner is only visible
  // while the refresh gesture is in flight. Negative-positioned so it
  // doesn't occupy layout when at rest.
  if (offset <= 0 && state !== "refreshing") return null;
  const opacity = state === "refreshing" || state === "done"
    ? 1
    : Math.max(0, Math.min(1, progress * 1.5));
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: -REST_HEIGHT,
        left: 0,
        right: 0,
        height: REST_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity
      }}
    >
      {state === "refreshing" ? <Spinner /> : <Arc progress={progress} />}
    </div>
  );
}

function OverlayPTR({ state, progress, children }) {
  const visible = state === "refreshing" || state === "done" || (state !== "idle" && progress > 0.12);
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 56px)",
          left: "50%",
          transform: `translateX(-50%) translateY(${visible ? 0 : -40}px)`,
          transition: "transform 280ms cubic-bezier(0.2,0.8,0.2,1), opacity 200ms ease",
          opacity: visible ? 1 : 0,
          zIndex: 200,
          pointerEvents: "none",
          padding: "6px 10px",
          borderRadius: 999,
          background: "color-mix(in srgb, var(--color-primary) 22%, rgba(15,23,42,0.85))",
          border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
        }}
      >
        {state === "refreshing" ? <Spinner /> : state === "done" ? (
          <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0b1120", fontSize: 12, fontWeight: 900 }}>✓</span>
        ) : <Arc progress={progress} />}
      </div>
      {children}
    </>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        border: "2.5px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
        borderTopColor: "var(--color-primary)",
        animation: "spin 0.8s linear infinite",
        display: "inline-block"
      }}
    />
  );
}

function Arc({ progress }) {
  // A circle that fills in and rotates as the user pulls further down.
  const angle = Math.round(360 * Math.min(1, progress));
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        display: "inline-block",
        background: `conic-gradient(var(--color-primary) ${angle}deg, color-mix(in srgb, var(--color-primary) 20%, transparent) ${angle}deg 360deg)`,
        mask: "radial-gradient(circle, transparent 6px, #000 7px)",
        WebkitMask: "radial-gradient(circle, transparent 6px, #000 7px)"
      }}
    />
  );
}
