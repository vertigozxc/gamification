import usePullToRefresh from "../hooks/usePullToRefresh";
import { useTheme } from "../ThemeContext";

// iOS-style pull-to-refresh:
//   • content translates down with the finger (rubber-banded by the hook)
//   • an indicator lives in the gap that opens above the content, so
//     the spinner/arrow is "revealed" as the user pulls
//   • while refreshing, the content stays held ~56 px below its rest
//     position with the spinner visible; both release back together
//     once onRefresh() resolves.

const INDICATOR_HEIGHT = 56;

export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const { t } = useTheme();
  const { state, pullDistance, triggerPx } = usePullToRefresh({
    target: null,
    onRefresh,
    disabled
  });

  const progress = Math.min(1, pullDistance / triggerPx);
  // During refresh, hold the content 56 px down regardless of where the
  // finger ends so the spinner is visible while the refresh resolves.
  const heldOffset = state === "refreshing" ? INDICATOR_HEIGHT : pullDistance;
  // Smooth release; during the drag the transform tracks the finger 1:1.
  const transition = state === "idle" || state === "refreshing" || state === "done"
    ? "transform 260ms cubic-bezier(0.2,0.8,0.2,1)"
    : "none";

  const showContent = state !== "idle" || pullDistance > 0;

  return (
    <div style={{ position: "relative" }}>
      {showContent ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(heldOffset, 0),
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 12,
            pointerEvents: "none",
            zIndex: 1
          }}
        >
          <RefreshIndicator state={state} progress={progress} t={t} />
        </div>
      ) : null}

      <div
        style={{
          transform: `translateY(${heldOffset}px)`,
          transition,
          willChange: "transform"
        }}
      >
        {children}
      </div>
    </div>
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
  const showArrow = !isSpinning && state !== "done";
  const arrowRotation = state === "ready" ? 180 : progress * 180;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        opacity: state === "refreshing" || state === "done" ? 1 : Math.max(0.4, progress),
        transition: "opacity 140ms ease"
      }}
    >
      {isSpinning ? (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "2.5px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
            borderTopColor: "var(--color-primary)",
            animation: "spin 0.8s linear infinite"
          }}
        />
      ) : state === "done" ? (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b1120",
            fontSize: 13,
            fontWeight: 900
          }}
        >
          ✓
        </span>
      ) : (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            border: `2.5px solid color-mix(in srgb, var(--color-primary) ${25 + progress * 60}%, transparent)`,
            borderTopColor: "var(--color-primary)",
            transform: `rotate(${arrowRotation}deg)`,
            transition: "transform 160ms ease, border-color 160ms ease"
          }}
        />
      )}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-muted)"
        }}
      >
        {label}
      </span>
    </div>
  );
}
