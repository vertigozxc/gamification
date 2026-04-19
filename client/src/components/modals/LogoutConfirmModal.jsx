import { useTheme } from "../../ThemeContext";

function LogoutConfirmModal({ open, onCancel, onConfirm }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onCancel}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()}>
        <div className="logout-confirm-icon">🚪</div>
        <h2 className="cinzel logout-confirm-title">{t.logoutTitle}</h2>
        <p className="logout-confirm-msg">{t.logoutMessage}</p>
        <div className="logout-confirm-actions">
          <button className="logout-confirm-cancel cinzel" onClick={onCancel}>{t.logoutStay}</button>
          <button className="logout-confirm-proceed cinzel" onClick={onConfirm}>{t.logoutConfirm}</button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;