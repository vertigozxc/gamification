import { useState } from "react";
import PropTypes from "prop-types";
import { devGrantXp, devGrantTokens } from "../api";

const DEV_TEST_USER_ID = "C0x6GY9LeyVhY12L1yF5QRHp3DP2";

export function isDevTestUser(uid) {
  return String(uid || "").trim() === DEV_TEST_USER_ID;
}

export default function DevTestPanel({ username, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!isDevTestUser(username)) {
    return null;
  }

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (typeof onRefresh === "function") await onRefresh();
    } catch (err) {
      // Intentionally silent — dev-only panel; errors surface via network logs.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: "calc(var(--mobile-footer-offset, 98px) + 8px)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        pointerEvents: "auto"
      }}
    >
      {expanded ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 6,
            borderRadius: 12,
            background: "rgba(2, 6, 23, 0.78)",
            border: "1px solid rgba(250, 204, 21, 0.4)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)"
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => devGrantXp(username, 500))}
            style={buttonStyle}
          >
            +500 XP
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => devGrantTokens(username, 5))}
            style={buttonStyle}
          >
            +5 🪙
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{ ...buttonStyle, padding: "6px 10px", opacity: 0.7 }}
            aria-label="Hide dev panel"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(2, 6, 23, 0.78)",
            border: "1px solid rgba(250, 204, 21, 0.4)",
            color: "#fde68a",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em"
          }}
        >
          DEV
        </button>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: "6px 12px",
  borderRadius: 8,
  background: "linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(2, 6, 23, 0.5))",
  border: "1px solid rgba(250, 204, 21, 0.55)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  cursor: "pointer"
};

DevTestPanel.propTypes = {
  username: PropTypes.string,
  onRefresh: PropTypes.func
};
