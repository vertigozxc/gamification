import themes, { themeIds } from "../themeConfig";
import { IconPalette, IconCheck } from "./icons/Icons";

export default function ThemePickerModal({ open, onClose, themeId, onThemeChange, getThemeMeta, t }) {
  if (!open) return null;
  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div className="logout-confirm-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
        <div className="mb-2 flex justify-center" style={{ color: "var(--color-primary)" }}><IconPalette size={36} /></div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>{t.chooseThemeTitle}</h2>
        <div className="flex flex-col gap-3 mt-4">
          {themeIds.map((id) => (
            <button
              key={id}
              className="flex items-center gap-3 w-full rounded-xl border-2 p-4 transition-all cinzel font-bold text-left"
              style={{
                background: id === themeId ? "var(--color-accent-dim)" : "var(--card-bg)",
                borderColor: id === themeId ? "var(--color-primary)" : "var(--card-border-idle)",
                color: id === themeId ? "var(--color-primary)" : "var(--color-text)"
              }}
              onClick={() => onThemeChange(id)}
            >
              <span className="text-2xl">{themes[id].icon}</span>
              <div>
                <div className="text-sm">{getThemeMeta(id).label}</div>
                <div className="text-xs font-normal opacity-60">{getThemeMeta(id).description}</div>
              </div>
              {id === themeId && <span className="ml-auto" style={{ display: "inline-flex" }}><IconCheck size={16} strokeWidth={2.4} /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
