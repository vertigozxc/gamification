import { useTheme } from "../../ThemeContext";

function NotesModal({ open, notesDraft, onNotesDraftChange, onClose, onSave }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: "760px", width: "95vw" }}>
        <div className="text-4xl mb-2">📝</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.notesTitle}</h2>
        <p className="logout-confirm-msg">
          {t.notesDesc}
        </p>
        <textarea
          value={notesDraft}
          onChange={(event) => onNotesDraftChange(event.target.value)}
          className="w-full min-h-[260px] mt-3 rounded-xl px-4 py-3 text-slate-200 resize-y"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)" }}
          placeholder={t.notesPlaceholder}
        />
        <div className="logout-confirm-actions mt-4">
          <button className="logout-confirm-cancel cinzel" onClick={onClose}>{t.closeLabel}</button>
          <button
            className="logout-confirm-proceed cinzel"
            onClick={onSave}
          >
            {t.notesSave}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotesModal;