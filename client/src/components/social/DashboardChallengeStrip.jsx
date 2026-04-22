import { useCallback, useEffect, useRef, useState } from "react";
import { completeChallenge, fetchUserChallenges } from "../../api";
import "./ios.css";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function DashboardChallengeStrip({ authUser, t, onOpenSocial }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [active, setActive] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!meUid) return;
    try {
      const data = await fetchUserChallenges(meUid);
      const now = Date.now();
      setActive((data?.challenges || []).filter((c) => new Date(c.endsAt).getTime() > now));
    } catch {
      setActive([]);
    } finally {
      setLoaded(true);
    }
  }, [meUid]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("social:refresh-challenges", h);
    return () => window.removeEventListener("social:refresh-challenges", h);
  }, [refresh]);

  async function handleComplete(id) {
    setBusyId(id);
    try {
      await completeChallenge(id, meUid);
      await refresh();
    } catch { /* silent */ } finally { setBusyId(null); }
  }

  if (!loaded || active.length === 0) return null;

  const tKey = todayKey();
  const doneToday = active.filter((c) => c.myLastCompletionDayKey === tKey).length;

  return (
    <div
      className="social-block"
      style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14, overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="press"
        aria-expanded={expanded}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          color: "var(--color-text)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⚔️</span>
        <span className="sb-body" style={{ fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>
          {t.arenaDashStripTitle || "Your pacts"}
        </span>
        <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
          {doneToday}/{active.length}
        </span>
        <span
          aria-hidden="true"
          style={{
            color: "var(--color-muted)",
            fontSize: 18,
            display: "inline-block",
            transition: "transform 220ms cubic-bezier(0.32,0.72,0,1)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
            marginLeft: 2,
          }}
        >
          ›
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--panel-border)", padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              t={t}
              busy={busyId === c.id}
              onComplete={() => handleComplete(c.id)}
              onOpen={() => onOpenSocial && onOpenSocial(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ challenge, t, busy, onComplete, onOpen }) {
  const tKey = todayKey();
  const completedToday = challenge.myLastCompletionDayKey === tKey;
  const ended = new Date(challenge.endsAt).getTime() <= Date.now();
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));
  const elapsedDays = Math.min(total, Math.max(0, total - daysLeft));
  const pct = Math.round((elapsedDays / total) * 100);

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--panel-bg) 60%, transparent)",
        border: "1px solid var(--panel-border)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="press"
        style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", color: "var(--color-text)", fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="sb-body" style={{ fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
            {challenge.title}
          </span>
          <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
            {(t.communityDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
          </span>
        </div>
        <span className="sb-caption" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          🎯 {challenge.questTitle}
          {challenge.needsTimer && challenge.timeEstimateMin ? ` · ⏱ ${challenge.timeEstimateMin} ${t.arenaMinAbbrev || "min"}` : ""}
        </span>
      </button>

      <div className="sb-progress" style={{ height: 5 }}>
        <div className="sb-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {completedToday ? (
        <div className="sb-pill sb-pill-success" style={{ alignSelf: "flex-start", padding: "4px 12px" }}>
          ✓ {t.arenaDoneTodayFull || "Done for today"}
        </div>
      ) : challenge.needsTimer && challenge.timeEstimateMin ? (
        <ChallengeTimerInline
          targetMinutes={challenge.timeEstimateMin}
          busy={busy}
          t={t}
          onComplete={onComplete}
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onComplete}
          className="sb-tinted-btn press"
          style={{ alignSelf: "flex-start", padding: "8px 16px", fontSize: 13 }}
        >
          {busy ? "…" : (t.arenaDashTick || "Tick")}
        </button>
      )}
    </div>
  );
}

// Local-state timer for a challenge card. State resets if the user
// navigates away from the dashboard — matches the lightweight quest-card
// inline-timer UX. Completion fires ONLY when elapsed >= target.
function ChallengeTimerInline({ targetMinutes, busy, t, onComplete }) {
  const targetMs = Math.max(0, Number(targetMinutes) || 0) * 60 * 1000;
  const [status, setStatus] = useState("idle"); // idle | running | paused | finishing
  const [startedAt, setStartedAt] = useState(0);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const [, setTick] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (status !== "running") return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [status]);

  const elapsedMs = (() => {
    if (status === "idle" || !startedAt) return 0;
    const now = status === "paused" && pausedAt ? pausedAt : Date.now();
    return Math.max(0, now - startedAt - totalPausedMs);
  })();
  const pct = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  useEffect(() => {
    if (status !== "running") return;
    if (targetMs <= 0 || elapsedMs < targetMs) return;
    if (firedRef.current || busy) return;
    firedRef.current = true;
    setStatus("finishing");
    Promise.resolve(onComplete()).finally(() => {
      firedRef.current = false;
    });
  }, [status, elapsedMs, targetMs, busy, onComplete]);

  const start = () => {
    firedRef.current = false;
    setStartedAt(Date.now());
    setTotalPausedMs(0);
    setPausedAt(0);
    setStatus("running");
  };
  const pause = () => {
    if (status !== "running") return;
    setPausedAt(Date.now());
    setStatus("paused");
  };
  const resume = () => {
    if (status !== "paused") return;
    setTotalPausedMs((m) => m + Math.max(0, Date.now() - pausedAt));
    setPausedAt(0);
    setStatus("running");
  };
  const stop = () => {
    firedRef.current = false;
    setStatus("idle");
    setStartedAt(0);
    setTotalPausedMs(0);
    setPausedAt(0);
  };

  if (status === "idle") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="sb-tinted-btn press"
        style={{ alignSelf: "flex-start", padding: "8px 16px", fontSize: 13 }}
      >
        ⏱ {t.arenaTimerStart || "Start timer"}
      </button>
    );
  }

  const running = status === "running";
  const paused = status === "paused";
  const finishing = status === "finishing";
  const fillColor = pct >= 100 ? "#30d158" : "var(--color-primary)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 10,
        border: "1px solid var(--panel-border)",
        background: "rgba(2,6,23,0.35)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${fillColor} 18%, transparent), transparent)`, transition: "width 600ms linear", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${pct}%`, background: fillColor, boxShadow: `0 0 10px ${fillColor}`, transition: "width 600ms linear", pointerEvents: "none" }} />

      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <p style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 18, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {formatClockMs(elapsedMs)}
          <span className="sb-caption" style={{ marginLeft: 6, fontSize: 12 }}>/ {formatClockMs(targetMs)}</span>
        </p>
        <p className="sb-caption" style={{ marginTop: 2, fontSize: 11 }}>
          {finishing ? (t.arenaTimerCompleting || "Finishing…") : `${pct}%`}
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1 }}>
        {running && (
          <button type="button" disabled={busy || finishing} onClick={pause} className="press" style={miniSecondary}>
            {t.arenaTimerPause || "Pause"}
          </button>
        )}
        {paused && (
          <button type="button" disabled={busy || finishing} onClick={resume} className="press" style={miniPrimary}>
            {t.arenaTimerResume || "Resume"}
          </button>
        )}
        <button type="button" disabled={busy || finishing} onClick={stop} className="press" style={miniStop}>
          {t.arenaTimerStop || "Stop"}
        </button>
      </div>
    </div>
  );
}

const miniPrimary = {
  padding: "7px 12px",
  minWidth: 62,
  borderRadius: 8,
  background: "var(--color-primary)",
  border: "none",
  color: "#1b1410",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const miniSecondary = {
  padding: "7px 12px",
  minWidth: 62,
  borderRadius: 8,
  background: "rgba(120,120,128,0.22)",
  border: "1px solid var(--panel-border)",
  color: "var(--color-text)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const miniStop = {
  padding: "7px 12px",
  minWidth: 56,
  borderRadius: 8,
  background: "rgba(255,59,48,0.16)",
  border: "1px solid rgba(255,59,48,0.4)",
  color: "#ff6a63",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};

function formatClockMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
