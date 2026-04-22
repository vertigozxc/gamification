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
export default function Screen({ title, subtitle, headerExtra, onClose, children, footer }) {
  const swipeBind = useEdgeSwipeBack(onClose);
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

      <div className="sb-page-body">{children}</div>

      {footer ? <div className="sb-page-footer">{footer}</div> : null}
    </div>
  );
}
