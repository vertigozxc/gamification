import { useTheme } from "../../ThemeContext";

function FreezeSuccessModal({ open, onClose }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()}>
        <div className="text-5xl mb-2">🧊</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.freezeSuccess}</h2>
        <p className="logout-confirm-msg">
          {t.freezeSuccessDetail}
          <br />
          <span className="cinzel text-xs tracking-widest" style={{ color: "var(--color-accent)" }}>{t.freezeSuccessSub}</span>
        </p>
        <div className="logout-confirm-actions" style={{ justifyContent: "center" }}>
          <button
            className="logout-confirm-proceed cinzel"
            onClick={onClose}
          >
            {t.freezeAck}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FreezeSuccessModal;