import PropTypes from "prop-types";
import { useState } from "react";

function formatMs(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function pct(elapsedMs, targetMinutes) {
  const target = Math.max(1, Number(targetMinutes || 0) * 60 * 1000);
  return Math.min(200, Math.round((elapsedMs / target) * 100));
}

export default function QuestTimerControls({ quest, session, elapsedMs, onStart, onPause, onResume, onStop }) {
  const [busy, setBusy] = useState(false);
  const targetMin = Number(quest?.timeEstimateMin || 0);
  const running = session && session.status === "running";
  const paused = session && session.status === "paused";
  const percent = pct(elapsedMs, targetMin);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  // Before any session exists: single prominent Start button.
  if (!session) {
    return (
      <div className="qt-panel" style={panelStyle}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={metaStyle}>⏱ {targetMin} min target</span>
          <span style={hintStyle}>Finish at 100% for streak credit</span>
        </div>
        <button type="button" disabled={busy} onClick={() => run(() => onStart(quest.id))} style={primaryBtn}>
          Start
        </button>
      </div>
    );
  }

  const percentColor = percent >= 100 ? "#4ade80" : percent >= 75 ? "#facc15" : percent >= 50 ? "#fb923c" : "#94a3b8";

  return (
    <div className="qt-panel" style={panelStyle}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ ...timeStyle, color: percentColor }}>
          {formatMs(elapsedMs)} <span style={metaStyle}>/ {targetMin}:00</span>
        </span>
        <span style={metaStyle}>
          {percent}% · {percent >= 100 ? "100% XP" : percent >= 75 ? "75% XP" : percent >= 50 ? "50% XP" : "no XP yet"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {running ? (
          <button type="button" disabled={busy} onClick={() => run(() => onPause(quest.id))} style={secondaryBtn}>
            Pause
          </button>
        ) : null}
        {paused ? (
          <button type="button" disabled={busy} onClick={() => run(() => onResume(quest.id))} style={primaryBtn}>
            Resume
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => run(() => onStop(quest.id))} style={stopBtn}>
          Stop
        </button>
      </div>
    </div>
  );
}

const panelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(2, 6, 23, 0.55)",
  border: "1px solid rgba(250, 204, 21, 0.35)"
};

const primaryBtn = {
  padding: "6px 14px",
  borderRadius: 8,
  background: "linear-gradient(135deg, rgba(34,197,94,0.45), rgba(16,185,129,0.25))",
  border: "1px solid rgba(34,197,94,0.6)",
  color: "#bbf7d0",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.05em",
  cursor: "pointer"
};

const secondaryBtn = {
  padding: "6px 12px",
  borderRadius: 8,
  background: "rgba(148,163,184,0.12)",
  border: "1px solid rgba(148,163,184,0.4)",
  color: "#e2e8f0",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer"
};

const stopBtn = {
  padding: "6px 12px",
  borderRadius: 8,
  background: "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(185,28,28,0.3))",
  border: "1px solid rgba(239,68,68,0.55)",
  color: "#fecaca",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer"
};

const timeStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 18,
  fontWeight: 700,
  lineHeight: 1.1,
  color: "#f8fafc"
};

const metaStyle = {
  fontSize: 11,
  color: "rgba(226,232,240,0.7)",
  letterSpacing: "0.03em"
};

const hintStyle = {
  fontSize: 10,
  color: "rgba(226,232,240,0.5)"
};

QuestTimerControls.propTypes = {
  quest: PropTypes.shape({
    id: PropTypes.number,
    timeEstimateMin: PropTypes.number
  }).isRequired,
  session: PropTypes.shape({
    status: PropTypes.string,
    startedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    totalPausedMs: PropTypes.number,
    elapsedMs: PropTypes.number
  }),
  elapsedMs: PropTypes.number,
  onStart: PropTypes.func.isRequired,
  onPause: PropTypes.func.isRequired,
  onResume: PropTypes.func.isRequired,
  onStop: PropTypes.func.isRequired
};
