import { useTheme } from "../../ThemeContext";
import { pluralizeCharges } from "../../i18nConfig";

// Surfaces an auto-granted Residential perk delivered by the server.
// `grant` is null when nothing to show, or
// `{ freeze: number, vacation: number }` when one (or both) cycles
// elapsed and the server credited the user. Vacation > 0 means the
// 365-day cooldown produced a 20-charge bundle; freeze > 0 means the
// 30-day cycle produced 1–2 charges (lvl 2–3 = 1, lvl 4–5 = 2 per cycle,
// possibly stacked across multiple elapsed cycles in one shot).
function ResidentialAutoGrantModal({ grant, onClose }) {
  const { t, languageId } = useTheme();
  if (!grant) return null;
  const freeze = Math.max(0, Number(grant.freeze) || 0);
  const vacation = Math.max(0, Number(grant.vacation) || 0);
  const total = freeze + vacation;
  if (total === 0) return null;

  const fill = (template, vars) =>
    String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));

  const icon = vacation > 0 ? "🏖️" : "❄️";
  const title = t.residentialAutoGrantTitle || "Streak Freeze charges added";
  let body;
  if (vacation > 0 && freeze > 0) {
    body = fill(
      t.residentialAutoGrantBodyBoth || "Vacation unlocked: +{vacation} charges. Monthly cycle: +{freeze}. All in your Profile.",
      { vacation, freeze }
    );
  } else if (vacation > 0) {
    body = fill(
      t.residentialAutoGrantBodyVacation || "Vacation perk unlocked — {amount} Streak Freeze charges added to your Profile.",
      { amount: vacation }
    );
  } else {
    body = fill(
      t.residentialAutoGrantBodyFreeze || "+{amount} Streak Freeze {chargeWord} added to your Profile.",
      { amount: freeze, chargeWord: pluralizeCharges(freeze, languageId) }
    );
  }

  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div
        className="logout-confirm-card"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          border: "2px solid color-mix(in srgb, #5ba0e0 60%, transparent)",
          boxShadow: "0 0 40px color-mix(in srgb, #5ba0e0 22%, transparent), 0 25px 50px rgba(0, 0, 0, 0.5)"
        }}
      >
        <div className="logout-confirm-icon">{icon}</div>
        <h2
          className="cinzel logout-confirm-title"
          style={{ color: "#5ba0e0" }}
        >
          {title}
        </h2>
        <p className="logout-confirm-msg">{body}</p>
        <div className="logout-confirm-actions" style={{ justifyContent: "center" }}>
          <button
            className="logout-confirm-proceed cinzel mobile-pressable"
            onClick={onClose}
            style={{
              borderColor: "color-mix(in srgb, #5ba0e0 70%, transparent)",
              background: "linear-gradient(135deg, color-mix(in srgb, #5ba0e0 30%, transparent), color-mix(in srgb, #4fa85e 25%, transparent))",
              color: "#dbeafe"
            }}
          >
            {t.proceedLabel || t.freezeAck || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResidentialAutoGrantModal;
