import usePullToRefresh from "../hooks/usePullToRefresh";
import { useTheme } from "../ThemeContext";

// Fixed-position pull-to-refresh indicator.
//
// Earlier versions translated the whole content wrapper to give a
// native "content drags down" feel. That caused two problems on the
// new iPhones:
//   • the indicator sat at top:0, behind the Dynamic Island
//   • when the refresh finished the content flipped back to translateY
//     0 which read as a jerk up.
//
// The new approach keeps page content completely static and only
// animates a small pill-style indicator from above the safe area into
// view and back out. No layout shift means no jerk; the indicator is
// positioned well below the camera cutout on all iPhones.

const DEFAULT_TOP_OFFSET = 72; // visible drop below the safe-area inset

export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const { t } = useTheme();
  const { state, pullDistance, triggerPx } = usePullToRefresh({
    target: null,
    onRefresh,
    disabled
  });

  const progress = Math.min(1, pullDistance / triggerPx);
  const visible = state !== "idle" && (state === "refreshing" || state === "done" || pullDistance > 0);

  // Indicator translateY: off-screen when idle, tracks the pull up to
  // its resting spot during drag, sticks at the resting spot while the
  // refresh runs, then slides back off-screen on done → idle.
  const maxTravel = DEFAULT_TOP_OFFSET;
  let translateY;
  if (!visible) {
    translateY = -80;
  } else if (state === "refreshing" || state === "done") {
    translateY = 0;
  } else {
    // Drag — follow the pull but capped at 0 (rest position).
    translateY = Math.min(0, -maxTravel + Math.min(pullDistance, maxTravel * 1.5));
  }

  const useTransition = state !== "pulling" && state !== "ready";

  return (
    <>
      <div
        aria-hidden={!visible}
        style={{
          position: "fixed",
          // Push well below the Dynamic Island / camera notch on modern
          // iPhones. safe-area-inset-top gives the system-reported
          // island clearance; we add a fixed 24 px on top so the pill
          // has breathing room even on devices that don't report an
          // inset (Android / landscape).
          top: `calc(env(safe-area-inset-top, 0px) + ${DEFAULT_TOP_OFFSET}px)`,
          left: "50%",
          transform: `translate(-50%, ${translateY}px)`,
          transition: useTransition ? "transform 320ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
          zIndex: 195,
          pointerEvents: "none"
        }}
      >
        <RefreshIndicator state={state} progress={progress} t={t} />
      </div>
      {children}
    </>
  );
}

function RefreshIndicator({ state, progress, t }) {
  const label = state === "refreshing"
    ? (t.pullRefreshing || "Refreshing…")
    : state === "done"
      ? (t.pullDone || "Updated")
      : state === "ready"
        ? (t.pullRelease || "Release to refresh")
        : (t.pullPull || "Pull to refresh");

  const isSpinning = state === "refreshing";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--color-primary) 18%, rgba(15,23,42,0.85))",
        border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "var(--color-text)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)"
      }}
    >
      {isSpinning ? (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.22)",
            borderTopColor: "var(--color-primary)",
            animation: "spin 0.8s linear infinite"
          }}
        />
      ) : state === "done" ? (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b1120",
            fontSize: 10,
            fontWeight: 900
          }}
        >
          ✓
        </span>
      ) : (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            border: `2px solid color-mix(in srgb, var(--color-primary) ${25 + progress * 60}%, transparent)`,
            borderTopColor: "var(--color-primary)",
            background: state === "ready" ? "color-mix(in srgb, var(--color-primary) 25%, transparent)" : "transparent",
            transform: `rotate(${state === "ready" ? 180 : progress * 180}deg)`,
            transition: "transform 160ms ease, border-color 160ms ease, background 160ms ease"
          }}
        />
      )}
      <span>{label}</span>
    </div>
  );
}
