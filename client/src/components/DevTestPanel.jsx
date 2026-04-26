import { useState } from "react";
import PropTypes from "prop-types";
import { devGrantXp, devGrantSilver, devGrantGold, devResetMe, devGrantStreak } from "../api";
import { IconSilver, IconGold } from "./icons/Icons";

const LEGACY_DEV_TEST_USER_ID = "C0x6GY9LeyVhY12L1yF5QRHp3DP2";

export default function DevTestPanel({ username, onRefresh, onLogout, xp = 0, xpNext = 250, isDevTester = false }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Show for the legacy hardcoded UID or any user the admin flagged as a
  // dev-tester via /admin. Both cases are accepted by the server-side gate.
  const visible = isDevTester || String(username || "").trim() === LEGACY_DEV_TEST_USER_ID;
  if (!visible) {
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
            onClick={() => {
              // Award exactly the XP required to hit the next level — same
              // path the normal quest completion would take if a quest
              // happened to pay out (xpNext - xp) XP.
              const needed = Math.max(1, Number(xpNext) - Number(xp));
              run(() => devGrantXp(username, needed));
            }}
            style={buttonStyle}
            title={`+${Math.max(1, Number(xpNext) - Number(xp))} XP`}
          >
            +1 LVL
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => devGrantStreak(username, 1))}
            style={buttonStyle}
          >
            +S 🔥
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => devGrantSilver(username, 20))}
            style={buttonStyle}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              +20 <IconSilver size={14} />
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => devGrantGold(username, 10))}
            style={buttonStyle}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              +10 <IconGold size={14} />
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Full reset? (wipes progress, completions, pins, city, timers — then logs you out)")) return;
              if (busy) return;
              setBusy(true);
              try {
                // Wipe account → sign out. Onboarding re-runs on next login
                // because the server also clears onboardingSkippedAt. We
                // intentionally bypass the `run()` wrapper so onRefresh
                // doesn't fire a /game-state fetch in the middle of the
                // auth state flipping to null — that race can strand the
                // shell on the loading screen.
                await devResetMe(username);
              } catch {
                /* silent — log out anyway so the tester isn't stranded */
              }
              try {
                if (typeof onLogout === "function") {
                  await onLogout();
                } else if (typeof window !== "undefined") {
                  window.location.reload();
                }
              } finally {
                setBusy(false);
              }
            }}
            style={{ ...buttonStyle, borderColor: "rgba(239,68,68,0.6)", color: "#fecaca", background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(2,6,23,0.5))" }}
          >
            RESET
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
  onRefresh: PropTypes.func,
  onLogout: PropTypes.func,
  xp: PropTypes.number,
  xpNext: PropTypes.number,
  isDevTester: PropTypes.bool
};
