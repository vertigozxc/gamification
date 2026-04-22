import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Social full-screen primitive. Single unified layout:
 *   ┌──────────────────────────────┐
 *   │  ‹ Back    Title      Action │  ← top bar (52px, blur)
 *   ├──────────────────────────────┤
 *   │                              │
 *   │        scrollable body       │
 *   │                              │
 *   ├──────────────────────────────┤
 *   │    [ Primary action ]        │  ← optional sticky footer
 *   └──────────────────────────────┘
 *
 * Opens with a slide-up animation from the bottom of the viewport.
 * Closed by calling onClose (typically wired to the back button).
 */

export default function Screen({
  title,
  leftLabel = "Back",
  leftAction,       // optional override; defaults to onClose
  rightLabel,       // string or null — shows right-side action button
  rightAction,
  rightDisabled = false,
  rightKind = "default",  // "default" | "primary" | "destructive"
  onClose,
  children,
  footer,
}) {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Close with animation
  const triggerClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => { onClose && onClose(); }, 260);
  };

  const doLeft = () => (leftAction ? leftAction() : triggerClose());

  const content = (
    <div className="social-block" aria-modal="true" role="dialog">
      <div
        className="sb-screen-overlay"
        style={{ opacity: entered && !closing ? 1 : 0 }}
        aria-hidden="true"
      />
      <div
        className="sb-screen"
        style={{
          transform: entered && !closing ? "translateY(0)" : "translateY(100%)",
        }}
      >
        <div className="sb-top-bar">
          <button
            type="button"
            onClick={doLeft}
            className="sb-top-btn sb-top-btn--left press"
            aria-label={leftLabel}
          >
            <span className="sb-chev">‹</span>
            <span className="sb-top-btn-label">{leftLabel}</span>
          </button>
          <div className="sb-top-title" title={typeof title === "string" ? title : undefined}>
            {title}
          </div>
          <div className="sb-top-right">
            {rightLabel ? (
              <button
                type="button"
                onClick={rightAction}
                disabled={rightDisabled}
                className={`sb-top-btn sb-top-btn--right press sb-top-btn--${rightKind}`}
              >
                {rightLabel}
              </button>
            ) : null}
          </div>
        </div>

        <div className="sb-screen-body">{children}</div>

        {footer ? <div className="sb-screen-footer">{footer}</div> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
