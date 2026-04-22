import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen modal screen that matches PinnedReplacementModal visual
 * language (edge-to-edge card background, cinzel title, subtitle line,
 * round ✕ button top-right, slide-up entry).
 *
 *   ┌──────────────────────────────────┐
 *   │  Title                       ✕   │   ← cinzel accent
 *   │  subtitle                        │
 *   ├──────────────────────────────────┤
 *   │                                  │
 *   │          scrollable body         │
 *   │                                  │
 *   ├──────────────────────────────────┤
 *   │        optional footer row       │
 *   └──────────────────────────────────┘
 */
export default function Screen({
  title,
  subtitle,
  leftSlot,        // optional custom slot to the left of the close button
  headerExtra,     // optional extra element rendered under title/subtitle
  onClose,
  children,
  footer,
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const content = (
    <div
      className="social-block sb-sheet-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
    >
      <div
        className="sb-sheet"
        style={{
          transform: entered ? "translateY(0)" : "translateY(16px)",
          opacity: entered ? 1 : 0,
        }}
      >
        <div className="sb-sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {leftSlot ? <div style={{ flexShrink: 0 }}>{leftSlot}</div> : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel sb-sheet-title">{title}</h2>
              {subtitle ? <p className="sb-sheet-subtitle">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="sb-sheet-close press"
            >
              ✕
            </button>
          </div>
          {headerExtra ? <div style={{ marginTop: 12 }}>{headerExtra}</div> : null}
        </div>

        <div className="sb-sheet-body">{children}</div>

        {footer ? <div className="sb-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
