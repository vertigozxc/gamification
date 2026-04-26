import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { IconTimer } from "./icons/Icons";

function formatMs(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Floor (not round) so the displayed percent stays consistent with the
// server's tier check, which uses a raw float < 50/75/100 comparison.
// With Math.round, a rawPercent of 49.5 already showed as "50%" and
// users tapped Complete — but the server saw 49.5 < 50 and returned
// completed:false, killing the session without firing the popup. Floor
// guarantees displayed 50% means actual rawPercent ≥ 50.
function pct(elapsedMs, targetMinutes) {
  const target = Math.max(1, Number(targetMinutes || 0) * 60 * 1000);
  return Math.min(200, Math.floor((elapsedMs / target) * 100));
}

export default function QuestTimerControls({ quest, session, elapsedMs, onStart, onPause, onResume, onStop }) {
  const [busy, setBusy] = useState(false);
  const targetMin = Number(quest?.timeEstimateMin || 0);
  const running = session && session.status === "running";
  const paused = session && session.status === "paused";
  const percent = pct(elapsedMs, targetMin);
  // Guard against the auto-stop effect firing repeatedly while the server
  // round-trip is in flight.
  const autoStopFiredRef = useRef(false);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  // Auto-finalize when a running timer crosses 100%. We only fire for
  // status=running so a paused timer that ticked past target still waits
  // for the user to resume or stop. Resets the guard whenever the session
  // goes away so a re-started session can auto-stop again later.
  useEffect(() => {
    if (!session) {
      autoStopFiredRef.current = false;
      return;
    }
    if (running && targetMin > 0 && percent >= 100 && !autoStopFiredRef.current && !busy) {
      autoStopFiredRef.current = true;
      run(() => onStop(quest.id));
    }
  }, [session, running, targetMin, percent, busy, onStop, quest?.id]);

  // Before any session exists: single prominent Start button.
  if (!session) {
    return (
      <div className="qt-panel" style={panelStyle}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...metaStyle, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconTimer size={12} /> {targetMin} min target
          </span>
          <span style={hintStyle}>Finish at 100% for streak credit</span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); run(() => onStart(quest.id)); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="qt-btn"
          style={primaryBtn}
        >
          Start
        </button>
      </div>
    );
  }

  const percentColor = percent >= 100 ? "#4ade80" : percent >= 75 ? "#facc15" : percent >= 50 ? "#fb923c" : "#94a3b8";
  const percentGlow = percent >= 100
    ? "rgba(74, 222, 128, 0.22)"
    : percent >= 75
      ? "rgba(250, 204, 21, 0.22)"
      : percent >= 50
        ? "rgba(251, 146, 60, 0.22)"
        : "rgba(148, 163, 184, 0.18)";
  const fillWidth = `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <div className="qt-panel" style={{ ...panelStyle, position: "relative", overflow: "hidden" }}>
      {/* Progress fill — tier-colored wash across the panel. Transitions
          smoothly as elapsed ticks, turns green at 100%. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: fillWidth,
          background: `linear-gradient(to right, ${percentGlow}, ${percentGlow} 70%, transparent)`,
          transition: "width 900ms linear, background 400ms ease",
          pointerEvents: "none"
        }}
      />
      {/* Thin accent bar at the very bottom so the percent is legible
          even when the wash is faint. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 3,
          width: fillWidth,
          background: percentColor,
          boxShadow: `0 0 10px ${percentColor}`,
          transition: "width 900ms linear, background 400ms ease",
          pointerEvents: "none"
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, position: "relative", zIndex: 1 }}>
        <span style={{ ...timeStyle, color: percentColor }}>
          {formatMs(elapsedMs)} <span style={metaStyle}>/ {targetMin}:00</span>
        </span>
        <span style={metaStyle}>
          {percent}% · {percent >= 100 ? "100% XP" : percent >= 75 ? "75% XP" : percent >= 50 ? "50% XP" : "no XP yet"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        {running ? (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); run(() => onPause(quest.id)); }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="qt-btn"
            style={secondaryBtn}
          >
            Pause
          </button>
        ) : null}
        {paused ? (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); run(() => onResume(quest.id)); }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="qt-btn"
            style={primaryBtn}
          >
            Resume
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); run(() => onStop(quest.id)); }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="qt-btn"
          style={percent >= 50 ? completeBtn : stopBtn}
        >
          {percent >= 50 ? "Complete" : "Stop"}
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
  padding: "8px 18px",
  minWidth: 78,
  borderRadius: 10,
  background: "linear-gradient(135deg, rgba(34,197,94,0.45), rgba(16,185,129,0.25))",
  border: "1px solid rgba(34,197,94,0.6)",
  color: "#bbf7d0",
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: "0.05em",
  cursor: "pointer",
  transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
  touchAction: "manipulation"
};

const secondaryBtn = {
  padding: "8px 16px",
  minWidth: 76,
  borderRadius: 10,
  background: "rgba(148,163,184,0.14)",
  border: "1px solid rgba(148,163,184,0.45)",
  color: "#e2e8f0",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
  transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
  touchAction: "manipulation"
};

const stopBtn = {
  padding: "8px 16px",
  minWidth: 76,
  borderRadius: 10,
  background: "linear-gradient(135deg, rgba(239,68,68,0.4), rgba(185,28,28,0.32))",
  border: "1px solid rgba(239,68,68,0.6)",
  color: "#fecaca",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
  transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
  touchAction: "manipulation"
};

const completeBtn = {
  padding: "8px 20px",
  minWidth: 96,
  borderRadius: 10,
  background: "linear-gradient(135deg, rgba(34,197,94,0.7), rgba(16,185,129,0.55))",
  border: "1px solid rgba(34,197,94,0.85)",
  color: "#f0fdf4",
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: "0.04em",
  cursor: "pointer",
  boxShadow: "0 0 14px rgba(34,197,94,0.35)",
  transition: "transform 120ms ease, background 120ms ease, box-shadow 120ms ease",
  touchAction: "manipulation"
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
