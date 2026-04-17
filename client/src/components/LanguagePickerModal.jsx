export default function LanguagePickerModal({ open, onClose, languageId, languageIds, getLanguageMeta, onLanguageChange, t }) {
  if (!open) return null;
  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div className="logout-confirm-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
        <div className="text-4xl mb-2">🌐</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>{t.chooseLanguageTitle}</h2>
        <div className="flex flex-col gap-3 mt-4">
          {languageIds.map((id) => {
            const language = getLanguageMeta(id);
            return (
              <button
                key={id}
                className="flex items-center gap-3 w-full rounded-xl border-2 p-4 transition-all cinzel font-bold text-left"
                style={{
                  background: id === languageId ? "var(--color-accent-dim)" : "var(--card-bg)",
                  borderColor: id === languageId ? "var(--color-primary)" : "var(--card-border-idle)",
                  color: id === languageId ? "var(--color-primary)" : "var(--color-text)"
                }}
                onClick={() => onLanguageChange(id)}
              >
                <span className="text-xl">🌐</span>
                <div>
                  <div className="text-sm">{language.nativeLabel}</div>
                  <div className="text-xs font-normal opacity-60">{language.label}</div>
                </div>
                {id === languageId && <span className="ml-auto text-lg">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
