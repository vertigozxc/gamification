import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext";

// Two-path SF-Symbols-style outline flame: an outer flame contour and
// a small inner ember. `currentColor` so the icon picks up its
// container's color in every theme without hardcoding.
function FlameIcon({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 C 9.5 7 6.5 9 6.5 14 C 6.5 18 9 21 12 21 C 15 21 17.5 18 17.5 14 C 17.5 10.5 15.5 9 13.5 7.2 C 12.8 8.6 12.2 10.2 12 12" />
      <path d="M12 13.5 C 11.2 15 10.5 16 10.5 17.5 C 10.5 19 11.2 20 12 20 C 12.8 20 13.5 19 13.5 17.5 C 13.5 16 12.8 15 12 13.5" />
    </svg>
  );
}

export default function StreakBurnedDialog({ open, onClose }) {
  const { t } = useTheme();
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    if (!open) {
      setEnter(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="streak-burned-overlay"
      data-enter={enter ? "in" : "out"}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.streakBurnedTitle}
    >
      <div
        className="streak-burned-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="streak-burned-icon" aria-hidden="true">
          <FlameIcon size={44} />
        </div>
        <h2 className="streak-burned-title">{t.streakBurnedTitle}</h2>
        <p className="streak-burned-body">{t.streakBurnedBody}</p>
        <button
          type="button"
          className="streak-burned-cta mobile-pressable"
          onClick={onClose}
        >
          {t.streakBurnedCta}
        </button>
      </div>
    </div>
  );
}
