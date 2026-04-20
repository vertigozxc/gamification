import { useTheme } from "../../ThemeContext";

function LogoutConfirmModal({ open, onCancel, onConfirm }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay logout-session-overlay" onClick={onCancel}>
      <div className="logout-confirm-card logout-session-card" onClick={(event) => event.stopPropagation()}>
        <div className="logout-session-halo" aria-hidden="true">
          <div className="logout-confirm-icon logout-session-icon">🚪</div>
        </div>
        <h2 className="cinzel logout-confirm-title logout-session-title">{t.logoutTitle}</h2>
        <p className="logout-confirm-msg logout-session-msg">{t.logoutMessage}</p>
        <div className="logout-confirm-actions logout-session-actions">
          <button className="logout-confirm-cancel logout-session-cancel cinzel" onClick={onCancel}>{t.logoutStay}</button>
          <button className="logout-confirm-proceed logout-session-proceed cinzel" onClick={onConfirm}>{t.logoutConfirm}</button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;