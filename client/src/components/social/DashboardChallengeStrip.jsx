import { useCallback, useEffect, useRef, useState } from "react";
import { completeChallenge, fetchUserChallenges, joinChallenge, leaveChallenge } from "../../api";
import { IconSwords, IconEnvelope, IconHourglass, IconTarget, IconTimer, IconCheck } from "../icons/Icons";
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
  const [optimisticDone, setOptimisticDone] = useState(() => new Set());

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

  const handleComplete = useCallback(async (id) => {
    setBusyId(id);
    // Optimistic update — flip the card to its Done-pill state instantly
    // so the button doesn't flash between "complete" and "done" while the
    // server round-trip is in flight.
    setOptimisticDone((prev) => new Set(prev).add(id));
    try {
      await completeChallenge(id, meUid);
      await refresh();
    } catch {
      // Rollback optimistic state if the server rejects.
      setOptimisticDone((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }, [meUid, refresh]);

  const handleAccept = useCallback(async (id) => {
    setBusyId(id);
    try {
      await joinChallenge(id, meUid);
      await refresh();
    } catch { /* silent */ } finally { setBusyId(null); }
  }, [meUid, refresh]);

  const handleDecline = useCallback(async (id) => {
    setBusyId(id);
    try {
      await leaveChallenge(id, meUid);
      await refresh();
    } catch { /* silent */ } finally { setBusyId(null); }
  }, [meUid, refresh]);

  if (!loaded || active.length === 0) return null;

  const tKey = todayKey();
  // Count only challenges the user has accepted for the progress pill —
  // pending invites don't contribute to the "done today" ratio.
  const accepted = active.filter((c) => c.myAcceptedAt);
  const doneToday = accepted.filter((c) => c.myLastCompletionDayKey === tKey || optimisticDone.has(c.id)).length;
  const pendingCount = active.length - accepted.length;

  return (
    <div
      className="social-block dash-chal-strip"
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="dash-chal-header"
        aria-expanded={expanded}
      >
        <span className="dash-chal-header-ico" style={{ display: "inline-flex", alignItems: "center" }}><IconSwords size={18} /></span>
        <span className="dash-chal-header-title">{t.arenaDashStripTitle || "Your pacts"}</span>
        {pendingCount > 0 && (
          <span className="dash-chal-pending-badge" aria-label={t.arenaPendingBadge || "Pending invite"}>
            {pendingCount}
          </span>
        )}
        <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
          {doneToday}/{accepted.length || active.length}
        </span>
        <span className="dash-chal-chevron" aria-hidden="true">›</span>
      </button>

      <div className="dash-chal-body" aria-hidden={!expanded}>
        <div className="dash-chal-body-inner">
          {active.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              meUid={meUid}
              t={t}
              busy={busyId === c.id}
              optimisticDone={optimisticDone.has(c.id)}
              onComplete={() => handleComplete(c.id)}
              onAccept={() => handleAccept(c.id)}
              onDecline={() => handleDecline(c.id)}
              onOpen={() => onOpenSocial && onOpenSocial(c.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({ challenge, meUid, t, busy, optimisticDone, onComplete, onAccept, onDecline, onOpen }) {
  const tKey = todayKey();
  const completedToday = optimisticDone || challenge.myLastCompletionDayKey === tKey;
  const ended = new Date(challenge.endsAt).getTime() <= Date.now();
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));
  const elapsedDays = Math.min(total, Math.max(0, total - daysLeft));
  const pct = Math.round((elapsedDays / total) * 100);
  // Creator is implicitly accepted — never show Accept/Decline on their
  // own challenge, even if the response momentarily misses myAcceptedAt.
  const isCreator = !!(challenge.creator?.username && challenge.creator.username === meUid);
  const myAccepted = isCreator || !!challenge.myAcceptedAt;
  const isActivated = typeof challenge.isActivated === "boolean"
    ? challenge.isActivated
    : (challenge.participants || []).filter((p) => p.acceptedAt && !p.leftAt).length >= 2;

  const pending = !myAccepted;
  const waiting = myAccepted && !isActivated;

  return (
    <div
      className={`dash-chal-card${pending ? " pending" : ""}${waiting ? " waiting" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="dash-chal-card-head press"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="sb-body" style={{ fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                {challenge.title}
              </span>
              {pending ? (
                <span className="sb-pill" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(var(--color-primary-rgb,251,191,36),0.18)", color: "var(--color-primary)" }}>
                  <IconEnvelope size={11} /> {t.arenaPendingBadge || "Pending"}
                </span>
              ) : waiting ? (
                <span className="sb-pill" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconHourglass size={11} /> {t.arenaWaitingBadge || "Waiting"}
                </span>
              ) : (
                <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
                  {(t.communityDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
                </span>
              )}
            </div>
            <span className="sb-caption" style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <IconTarget size={11} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{challenge.questTitle}</span>
              {challenge.needsTimer && challenge.timeEstimateMin ? (
                <>
                  <span>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconTimer size={11} /> {challenge.timeEstimateMin} {t.arenaMinAbbrev || "min"}</span>
                </>
              ) : null}
            </span>
          </div>
          <span aria-hidden="true" style={{ color: "var(--color-muted)", fontSize: 18, flexShrink: 0, lineHeight: 1 }}>›</span>
        </div>
      </button>

      {!pending && !waiting && (
        <div className="sb-progress" style={{ height: 5 }}>
          <div className="sb-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {pending ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button type="button" disabled={busy} onClick={onAccept} className="sb-primary-btn press" style={{ padding: 10, fontSize: 13 }}>
            {t.arenaAcceptInvite || "Accept invite"}
          </button>
          <button type="button" disabled={busy} onClick={onDecline} className="press" style={{ padding: 10, border: "1px solid var(--card-border-idle)", borderRadius: 10, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            {t.arenaDeclineInvite || "Decline"}
          </button>
        </div>
      ) : waiting ? (
        <p className="sb-caption" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
          <IconHourglass size={12} /> {t.arenaWaitingForPlayers || "Waiting for at least one more player to accept"}
        </p>
      ) : completedToday ? (
        <div className="sb-pill sb-pill-success" style={{ alignSelf: "flex-start", padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconCheck size={11} strokeWidth={2.4} /> {t.arenaDoneTodayFull || "Done for today"}
        </div>
      ) : challenge.needsTimer && challenge.timeEstimateMin ? (
        <ChallengeTimerInline
          challengeId={challenge.id}
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
          {busy ? "…" : (t.arenaTickOff || "Mark as completed")}
        </button>
      )}
    </div>
  );
}

/**
 * Inline challenge timer. State persists in localStorage so closing the
 * app, backgrounding the tab, or collapsing the strip does NOT reset it —
 * same contract as the quest-board timers. Elapsed counts real wall-clock
 * minus time spent paused.
 */
function ChallengeTimerInline({ challengeId, targetMinutes, busy, t, onComplete }) {
  const targetMs = Math.max(0, Number(targetMinutes) || 0) * 60 * 1000;
  const storageKey = `challenge-timer:${challengeId}`;

  const [timerState, setTimerState] = useState(() => readTimer(storageKey));
  const [, setTick] = useState(0);
  const firedRef = useRef(false);

  // Persist every state change.
  useEffect(() => {
    writeTimer(storageKey, timerState);
  }, [storageKey, timerState]);

  // Re-read on mount in case another tab / component wrote changes.
  useEffect(() => {
    const fresh = readTimer(storageKey);
    setTimerState(fresh);
  }, [storageKey]);

  // Tick while running.
  useEffect(() => {
    if (timerState.status !== "running") return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timerState.status]);

  const elapsedMs = (() => {
    const s = timerState;
    if (s.status === "idle" || !s.startedAt) return 0;
    const anchor = s.status === "paused" && s.pausedAt ? s.pausedAt : Date.now();
    return Math.max(0, anchor - s.startedAt - (s.totalPausedMs || 0));
  })();
  const pct = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  // Auto-complete at 100%.
  useEffect(() => {
    if (timerState.status !== "running") return;
    if (targetMs <= 0 || elapsedMs < targetMs) return;
    if (firedRef.current || busy) return;
    firedRef.current = true;
    setTimerState((s) => ({ ...s, status: "finishing" }));
    Promise.resolve(onComplete()).finally(() => {
      firedRef.current = false;
      // On success the card swaps to Done-pill via optimistic flag, so we
      // also clear the persisted timer so it doesn't linger.
      clearTimer(storageKey);
      setTimerState(defaultTimer());
    });
  }, [timerState.status, elapsedMs, targetMs, busy, onComplete, storageKey]);

  const start = () => {
    firedRef.current = false;
    setTimerState({ status: "running", startedAt: Date.now(), totalPausedMs: 0, pausedAt: 0 });
  };
  const pause = () => {
    if (timerState.status !== "running") return;
    setTimerState((s) => ({ ...s, status: "paused", pausedAt: Date.now() }));
  };
  const resume = () => {
    if (timerState.status !== "paused") return;
    setTimerState((s) => ({
      ...s,
      status: "running",
      totalPausedMs: (s.totalPausedMs || 0) + Math.max(0, Date.now() - (s.pausedAt || Date.now())),
      pausedAt: 0,
    }));
  };
  const stop = () => {
    firedRef.current = false;
    clearTimer(storageKey);
    setTimerState(defaultTimer());
  };

  if (timerState.status === "idle") {
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

  const running = timerState.status === "running";
  const paused = timerState.status === "paused";
  const finishing = timerState.status === "finishing";
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

function defaultTimer() {
  return { status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 };
}

function readTimer(key) {
  if (typeof window === "undefined") return defaultTimer();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultTimer();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultTimer();
    // Sanitize.
    return {
      status: ["running", "paused", "finishing", "idle"].includes(parsed.status) ? parsed.status : "idle",
      startedAt: Number(parsed.startedAt) || 0,
      totalPausedMs: Number(parsed.totalPausedMs) || 0,
      pausedAt: Number(parsed.pausedAt) || 0,
    };
  } catch {
    return defaultTimer();
  }
}

function writeTimer(key, state) {
  if (typeof window === "undefined") return;
  try {
    if (!state || state.status === "idle") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch { /* quota / private mode — ignore */ }
}

function clearTimer(key) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
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
