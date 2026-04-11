import { useTheme } from "../../ThemeContext";

function RerollConfirmModal({ open, onCancel, onConfirm }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onCancel}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()}>
        <div className="text-5xl mb-2">🎲</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.rerollTitle}</h2>
        <p className="logout-confirm-msg">
          {t.rerollMessage}
          <br />
          <span className="font-bold cinzel text-xs tracking-widest" style={{ color: "var(--color-accent)" }}>{t.rerollWarning}</span>
        </p>
        <div className="logout-confirm-actions">
          <button className="logout-confirm-cancel cinzel" onClick={onCancel}>{t.cancelLabel}</button>
          <button
            className="logout-confirm-proceed cinzel"
            onClick={onConfirm}
          >
            {t.rerollConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RerollConfirmModal;