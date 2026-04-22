import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Confirmation alert matching the LogoutConfirmModal visual language.
 * Centered card with halo icon, title, message, and 1-2 buttons.
 *
 * Usage:
 *   <Alert
 *     icon="🗑"
 *     title="Remove this friend?"
 *     message="You can send a new request later."
 *     cancelLabel="Cancel"
 *     confirmLabel="Remove"
 *     destructive
 *     onCancel={() => setOpen(false)}
 *     onConfirm={handleRemove}
 *   />
 */

export default function Alert({
  icon = "❓",
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
      className="social-block sb-alert-overlay"
      onClick={onCancel}
      style={{ opacity: entered ? 1 : 0 }}
    >
      <div
        className="sb-alert-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: entered ? "scale(1)" : "scale(0.88)",
          opacity: entered ? 1 : 0,
        }}
      >
        <div className="sb-alert-halo" aria-hidden="true">
          <div className="sb-alert-icon">{icon}</div>
        </div>
        {title ? <h2 className="sb-alert-title">{title}</h2> : null}
        {message ? <p className="sb-alert-msg">{message}</p> : null}
        <div className="sb-alert-actions">
          {onCancel ? (
            <button type="button" className="sb-alert-btn sb-alert-btn--cancel press" onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
          {onConfirm ? (
            <button
              type="button"
              className={`sb-alert-btn press ${destructive ? "sb-alert-btn--destructive" : "sb-alert-btn--confirm"}`}
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
