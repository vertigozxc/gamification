import { useEffect } from "react";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";

/**
 * Plain inline full-screen layout. Not a modal — the caller renders
 * EITHER this or the previous page, never both. No portal, no overlay.
 *
 *   ┌──────────────────────────────────┐
 *   │  Title                       ✕   │
 *   │  subtitle                        │
 *   ├──────────────────────────────────┤
 *   │       scrollable body            │
 *   ├──────────────────────────────────┤
 *   │       optional sticky footer     │
 *   └──────────────────────────────────┘
 */
export default function Screen({ title, subtitle, headerExtra, onClose, children, footer, bodyRef }) {
  const swipeBind = useEdgeSwipeBack(onClose);

  // Mark the document while a social Screen is open so PullToRefresh
  // (which listens at document level) pauses — otherwise swiping
  // vertically inside the challenge / profile / search panels would
  // nudge the background a few pixels up-and-down through PTR's
  // rubber-band.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const el = document.documentElement;
    const prev = Number(el.dataset.socialScreenCount || 0);
    el.dataset.socialScreenCount = String(prev + 1);
    el.dataset.socialScreenOpen = "1";
    return () => {
      const now = Math.max(0, Number(el.dataset.socialScreenCount || 1) - 1);
      el.dataset.socialScreenCount = String(now);
      if (now === 0) delete el.dataset.socialScreenOpen;
    };
  }, []);

  return (
    <div className="sb-page" {...swipeBind}>
      <div className="sb-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cinzel sb-page-title">{title}</h2>
            {subtitle ? <p className="sb-page-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-close-x"
          >
            ✕
          </button>
        </div>
        {headerExtra ? <div style={{ marginTop: 12 }}>{headerExtra}</div> : null}
      </div>

      <div className="sb-page-body" ref={bodyRef}>{children}</div>

      {footer ? <div className="sb-page-footer">{footer}</div> : null}
    </div>
  );
}
