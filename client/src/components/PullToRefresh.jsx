import usePullToRefresh from "../hooks/usePullToRefresh";
import { useTheme } from "../ThemeContext";

// Whole-page pull-to-refresh. Hook listens on document-level touch
// events (no scrollable wrapper required), and this component just
// paints a floating indicator near the top of the viewport that
// tracks the pull progress.
export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const { t } = useTheme();
  const { state, pullDistance, triggerPx } = usePullToRefresh({
    target: null,
    onRefresh,
    disabled
  });

  const showIndicator = state !== "idle" && pullDistance > 0;
  const progress = Math.min(1, pullDistance / triggerPx);

  return (
    <>
      <div
        aria-hidden={!showIndicator}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 6px)",
          left: "50%",
          transform: `translateX(-50%) translateY(${showIndicator ? Math.min(36, pullDistance * 0.35) : -48}px)`,
          transition: state === "refreshing" || state === "idle" || state === "done" ? "transform 220ms ease" : "none",
          zIndex: 190,
          padding: "6px 12px",
          borderRadius: 999,
          background: "color-mix(in srgb, var(--color-primary) 22%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
          backdropFilter: "blur(10px)",
          color: "var(--color-text)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          pointerEvents: "none",
          opacity: showIndicator ? 1 : 0
        }}
      >
        {state === "refreshing" ? (
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              border: "2px solid rgba(255,255,255,0.25)",
              borderTopColor: "var(--color-primary)",
              animation: "spin 0.8s linear infinite"
            }}
          />
        ) : (
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              border: `2px solid color-mix(in srgb, var(--color-primary) ${20 + progress * 70}%, transparent)`,
              background: state === "ready" || state === "done"
                ? "var(--color-primary)"
                : "transparent",
              transition: "background 160ms ease"
            }}
          />
        )}
        <span>
          {state === "refreshing"
            ? (t.pullRefreshing || "Refreshing…")
            : state === "done"
              ? (t.pullDone || "Updated")
              : state === "ready"
                ? (t.pullRelease || "Release to refresh")
                : (t.pullPull || "Pull to refresh")}
        </span>
      </div>

      {children}
    </>
  );
}
