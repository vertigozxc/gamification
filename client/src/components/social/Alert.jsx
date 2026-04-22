import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Confirmation alert matching LogoutConfirmModal / DeleteProfileConfirmModal
 * visual language (halo icon + cinzel title + message + Cancel/Proceed).
 */
export default function Alert({
  icon = "?",
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel = "OK",
  destructive = false,
  onCancel,
  onConfirm,
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const content = (
    <div
      className="logout-confirm-overlay logout-session-overlay social-block"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel && onCancel(); }}
      style={{ zIndex: 90 }}
    >
      <div
        className="logout-confirm-card logout-session-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: entered ? "scale(1)" : "scale(0.94)",
          opacity: entered ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32,0.72,0,1), opacity 180ms ease",
        }}
      >
        <div className="logout-session-halo" aria-hidden="true">
          <div className="logout-confirm-icon logout-session-icon">{icon}</div>
        </div>
        {title ? <h2 className="cinzel logout-confirm-title logout-session-title">{title}</h2> : null}
        {message ? <p className="logout-confirm-msg logout-session-msg">{message}</p> : null}
        <div className="logout-confirm-actions logout-session-actions">
          {onCancel ? (
            <button
              type="button"
              className="logout-confirm-cancel logout-session-cancel cinzel press"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          ) : null}
          {onConfirm ? (
            <button
              type="button"
              className={`logout-confirm-proceed logout-session-proceed cinzel press ${destructive ? "sb-destructive-btn" : ""}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
