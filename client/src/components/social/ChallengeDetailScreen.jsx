import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { completeChallenge, fetchChallenge, leaveChallenge } from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";
import Alert from "./Alert";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function ChallengeDetailScreen({ challengeId, authUser, t, onClose, onOpenProfile, onChanged }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Local timer state for timed challenges. Not persisted — starts fresh each
  // time the screen mounts. Status: "idle" | "running" | "paused" | "finishing".
  const [timer, setTimer] = useState({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
  const [tick, setTick] = useState(0);
  const autoCompleteFired = useRef(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await fetchChallenge(challengeId);
      setChallenge(data?.challenge || null);
    } catch (e) {
      setError(e?.message || t.arenaLoadError || "Could not load");
    } finally {
      setLoading(false);
    }
  }, [challengeId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleComplete() {
    setBusy(true);
    try {
      await completeChallenge(challengeId, meUid);
      setTimer({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
      autoCompleteFired.current = false;
      await refresh();
      onChanged && onChanged();
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function doLeave() {
    setConfirmLeave(false);
    setBusy(true);
    try {
      await leaveChallenge(challengeId, meUid);
      onChanged && onChanged();
      onClose();
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not leave");
      setBusy(false);
    }
  }

  const participants = challenge?.participants || [];
  const active = participants.filter((p) => !p.leftAt);
  const me = participants.find((p) => p.user.username === meUid);
  const isActive = !!(me && !me.leftAt);
  const ended = challenge ? new Date(challenge.endsAt).getTime() <= Date.now() : false;
  const completedToday = me?.lastCompletionDayKey === todayKey();
  const daysLeft = challenge && !ended ? Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000)) : 0;

  // Tick the clock while the timer is running so the UI updates each second.
  useEffect(() => {
    if (timer.status !== "running") return undefined;
    const h = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [timer.status]);

  // Compute live elapsed time. Paused time is excluded.
  const targetMs = Math.max(0, Number(challenge?.timeEstimateMin || 0)) * 60 * 1000;
  const elapsedMs = (() => {
    if (timer.status === "idle" || !timer.startedAt) return 0;
    const now = timer.status === "paused" && timer.pausedAt ? timer.pausedAt : Date.now();
    return Math.max(0, now - timer.startedAt - (timer.totalPausedMs || 0));
  })();
  const timerPct = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  // Auto-complete when the timer crosses 100% while running.
  useEffect(() => {
    if (!challenge?.needsTimer) return;
    if (completedToday || ended || !isActive) return;
    if (timer.status !== "running") return;
    if (targetMs <= 0 || elapsedMs < targetMs) return;
    if (autoCompleteFired.current || busy) return;
    autoCompleteFired.current = true;
    setTimer((s) => ({ ...s, status: "finishing" }));
    handleComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.status, elapsedMs, targetMs, completedToday, ended, isActive, busy, challenge?.needsTimer]);

  const startTimer = () => {
    autoCompleteFired.current = false;
    setTimer({ status: "running", startedAt: Date.now(), totalPausedMs: 0, pausedAt: 0 });
  };
  const pauseTimer = () => {
    if (timer.status !== "running") return;
    setTimer((s) => ({ ...s, status: "paused", pausedAt: Date.now() }));
  };
  const resumeTimer = () => {
    if (timer.status !== "paused") return;
    setTimer((s) => ({ ...s, status: "running", pausedAt: 0, totalPausedMs: s.totalPausedMs + (Date.now() - s.pausedAt) }));
  };
  const stopTimer = () => {
    autoCompleteFired.current = false;
    setTimer({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
  };
  // Expose `tick` to keep the eslint exhaustive-deps linter happy about
  // reading `Date.now()` inside elapsedMs (we intentionally re-render via tick).
  void tick;

  const footer = !loading && challenge && isActive && !ended ? (
    completedToday ? (
      <div className="sb-pill sb-pill-success" style={{ justifyContent: "center", padding: 14, fontSize: 15, width: "100%", display: "flex" }}>
        ✓ {t.arenaDoneTodayFull || "Done for today"}
      </div>
    ) : challenge.needsTimer && targetMs > 0 ? (
      <ChallengeTimerPanel
        status={timer.status}
        elapsedMs={elapsedMs}
        targetMs={targetMs}
        percent={timerPct}
        busy={busy}
        t={t}
        onStart={startTimer}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onStop={stopTimer}
      />
    ) : (
      <button type="button" disabled={busy} onClick={handleComplete} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
        {t.arenaTickOff || "Mark done today · +1 🪙 each"}
      </button>
    )
  ) : null;

  return (
    <>
      <Screen
        title={challenge?.title || (t.arenaPactTitle || "Challenge")}
        subtitle={
          challenge
            ? (ended
                ? (t.arenaPactEndedWord || "ended")
                : (t.arenaDaysLeftLong || "{n} days left").replace("{n}", String(daysLeft)))
            : (t.arenaLoadingShort || "Loading")
        }
        onClose={onClose}
        footer={footer}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : !challenge ? (
          <p style={{ textAlign: "center", color: "#ff6a63", padding: "40px 16px" }}>{error}</p>
        ) : (
          <Body
            challenge={challenge}
            meUid={meUid}
            me={me}
            active={active}
            ended={ended}
            completedToday={completedToday}
            isActive={isActive}
            t={t}
            error={error}
            showActivity={showActivity}
            onToggleActivity={() => setShowActivity((v) => !v)}
            onOpenProfile={onOpenProfile}
            onLeave={() => setConfirmLeave(true)}
            busy={busy}
          />
        )}
      </Screen>

      {confirmLeave && (
        <Alert
          icon="🚪"
          title={t.arenaConfirmLeaveTitle || "Leave this challenge?"}
          message={t.arenaConfirmLeaveBody || "Your progress here stops. You can come back if the others invite you again."}
          cancelLabel={t.arenaCancel || "Cancel"}
          confirmLabel={t.arenaStepOut || "Leave challenge"}
          destructive
          onCancel={() => setConfirmLeave(false)}
          onConfirm={doLeave}
        />
      )}
    </>
  );
}

function Body({ challenge, meUid, me, active, ended, completedToday, isActive, t, error, showActivity, onToggleActivity, onOpenProfile, onLeave, busy }) {
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const start = new Date(challenge.startedAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const pct = Math.round((elapsed / total) * 100);
  const totalCompletions = (challenge.participants || []).reduce((s, p) => s + (p.completions || 0), 0);
  const todayAward = challenge.lastAwardedDayKey === todayKey();

  const ranked = useMemo(() => {
    const copy = [...(challenge.participants || [])];
    copy.sort((a, b) => {
      if ((b.completions || 0) !== (a.completions || 0)) return (b.completions || 0) - (a.completions || 0);
      return (b.consecutiveDays || 0) - (a.consecutiveDays || 0);
    });
    return copy;
  }, [challenge.participants]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Progress */}
      <div className="sb-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="sb-caption" style={{ fontWeight: 600 }}>{t.arenaDurationProgress || "Duration progress"}</span>
          <span className="sb-caption">{elapsed}/{total} · {pct}%</span>
        </div>
        <div className="sb-progress" style={{ height: 8 }}>
          <div className={`sb-progress-fill${ended ? " done" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <Mini label={t.arenaTotalDone || "Total"} value={totalCompletions} />
          <Mini label={t.arenaPlayers || "Players"} value={active.length} />
          <Mini label={t.arenaMyStreak || "My streak"} value={`🔥 ${me?.consecutiveDays || 0}`} />
        </div>
      </div>

      {/* Daily task */}
      <div
        className="sb-card"
        style={{
          background: completedToday ? "rgba(48,209,88,0.1)" : "var(--panel-bg)",
          borderColor: completedToday ? "rgba(48,209,88,0.4)" : "var(--panel-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <p className="sb-caption" style={{ fontWeight: 600 }}>{t.arenaDailyRitual || "Daily task"}</p>
        <p className="sb-headline" style={{ fontSize: 17 }}>
          🎯 {challenge.questTitle}
          {challenge.needsTimer && challenge.timeEstimateMin ? (
            <span style={{ color: "var(--color-muted)", fontWeight: 500 }}> · ⏱ {challenge.timeEstimateMin} {t.arenaMinAbbrev || "min"}</span>
          ) : null}
        </p>
        {challenge.questDescription && <p className="sb-caption">{challenge.questDescription}</p>}
        {!ended && !todayAward && !completedToday && (
          <p className="sb-caption">{t.arenaTokensUnlockHint || "Tokens for today unlock when any participant marks it done."}</p>
        )}
      </div>

      {/* Participants */}
      <div>
        <h3 className="sb-section-title" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", margin: "4px 4px 8px" }}>
          {t.arenaCrew || "Participants"}
        </h3>
        <div className="sb-list">
          {ranked.map((p, i) => (
            <ParticipantRow key={p.id} rank={i + 1} participant={p} meUid={meUid} t={t} onOpenProfile={onOpenProfile} isLast={i === ranked.length - 1} />
          ))}
        </div>
      </div>

      {/* Activity */}
      <div>
        <button type="button" onClick={onToggleActivity} className="sb-list-row press" style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span className="sb-body" style={{ flex: 1, fontWeight: 600 }}>{t.arenaActivity || "Activity"}</span>
          <span style={{ color: "var(--color-muted)", transition: "transform 200ms cubic-bezier(0.32,0.72,0,1)", transform: showActivity ? "rotate(90deg)" : "none", display: "inline-block" }}>›</span>
        </button>
        {showActivity && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(challenge.logs || []).length === 0 && (
              <p className="sb-caption" style={{ textAlign: "center", padding: "8px 0" }}>{t.arenaActivityEmpty || "No activity yet."}</p>
            )}
            {(challenge.logs || []).map((log) => (
              <div key={log.id} style={{ fontSize: 13, color: "var(--color-text)", padding: "6px 10px", borderRadius: 8, background: "rgba(120,120,128,0.12)" }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{log.user.displayName || log.user.username}</span>{" "}
                <span style={{ color: "var(--color-muted)" }}>{logVerb(log.type, t)}</span>
                {" · "}
                <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{formatRelative(log.createdAt, t)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ color: "#ff6a63", fontSize: 14, textAlign: "center" }}>{error}</p>}

      {isActive && !ended && (
        <button type="button" onClick={onLeave} disabled={busy} className="sb-destructive-btn press" style={{ marginTop: 4 }}>
          {t.arenaStepOut || "Leave challenge"}
        </button>
      )}
    </div>
  );
}

function ParticipantRow({ rank, participant, meUid, t, onOpenProfile, isLast }) {
  const isMe = participant.user.username === meUid;
  const left = !!participant.leftAt;
  return (
    <button
      type="button"
      onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
      className="sb-list-row press"
      style={{
        background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.08)" : "transparent",
        borderBottom: isLast ? "none" : undefined,
        opacity: left ? 0.55 : 1,
      }}
    >
      <span style={{ width: 22, textAlign: "center", fontWeight: 700, color: "var(--color-muted)", fontSize: 13, flexShrink: 0 }}>{rank}</span>
      <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
        <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={34} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {participant.user.displayName || participant.user.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.arenaYou || "you"}</span>}
          {left && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> · {t.arenaStepped || "left"}</span>}
        </p>
        <p className="sb-caption" style={{ display: "flex", gap: 8 }}>
          <span>✓ {participant.completions || 0}</span>
          <span>🔥 {participant.consecutiveDays || 0}</span>
          <span>🪙 {participant.tokensEarned || 0}</span>
        </p>
      </div>
    </button>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p className="sb-caption" style={{ fontSize: 11, fontWeight: 600 }}>{label}</p>
      <p className="sb-headline" style={{ marginTop: 2, fontSize: 17 }}>{value}</p>
    </div>
  );
}

function ChallengeTimerPanel({ status, elapsedMs, targetMs, percent, busy, t, onStart, onPause, onResume, onStop }) {
  if (status === "idle") {
    return (
      <button type="button" disabled={busy} onClick={onStart} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
        ⏱ {t.arenaTimerStart || "Start timer"} · {Math.round(targetMs / 60000)} {t.arenaMinAbbrev || "min"}
      </button>
    );
  }

  const running = status === "running";
  const paused = status === "paused";
  const finishing = status === "finishing";
  const fillColor = percent >= 100 ? "#30d158" : "var(--color-primary)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid var(--panel-border)",
        background: "var(--panel-bg)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${percent}%`,
          background: `linear-gradient(90deg, color-mix(in srgb, ${fillColor} 16%, transparent), color-mix(in srgb, ${fillColor} 6%, transparent))`,
          transition: "width 600ms linear",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0, bottom: 0,
          width: `${percent}%`,
          height: 3,
          background: fillColor,
          boxShadow: `0 0 10px ${fillColor}`,
          transition: "width 600ms linear",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 22, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {formatClockMs(elapsedMs)}
            <span className="sb-caption" style={{ marginLeft: 6, fontSize: 13 }}>
              / {formatClockMs(targetMs)}
            </span>
          </p>
          <p className="sb-caption" style={{ marginTop: 2 }}>
            {finishing ? (t.arenaTimerCompleting || "Finishing…") : `${percent}% · ${t.arenaTimerTargetHint || "Finish at 100% to claim today."}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {running && (
            <button type="button" disabled={busy || finishing} onClick={onPause} className="press" style={timerSecondaryBtn}>
              {t.arenaTimerPause || "Pause"}
            </button>
          )}
          {paused && (
            <button type="button" disabled={busy || finishing} onClick={onResume} className="press" style={timerPrimaryBtn}>
              {t.arenaTimerResume || "Resume"}
            </button>
          )}
          <button type="button" disabled={busy || finishing} onClick={onStop} className="press" style={timerStopBtn}>
            {t.arenaTimerStop || "Stop"}
          </button>
        </div>
      </div>
    </div>
  );
}

const timerPrimaryBtn = {
  padding: "10px 14px",
  minWidth: 72,
  borderRadius: 10,
  background: "var(--color-primary)",
  border: "none",
  color: "#1b1410",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const timerSecondaryBtn = {
  padding: "10px 14px",
  minWidth: 72,
  borderRadius: 10,
  background: "rgba(120,120,128,0.22)",
  border: "1px solid var(--panel-border)",
  color: "var(--color-text)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const timerStopBtn = {
  padding: "10px 14px",
  minWidth: 68,
  borderRadius: 10,
  background: "rgba(255,59,48,0.16)",
  border: "1px solid rgba(255,59,48,0.4)",
  color: "#ff6a63",
  fontWeight: 600,
  fontSize: 13,
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

function logVerb(type, t) {
  if (type === "created") return t.arenaLogCreated || "started the challenge";
  if (type === "joined") return t.arenaLogJoined || "joined";
  if (type === "left") return t.arenaLogLeft || "left";
  if (type === "completed") return t.arenaLogCompleted || "completed today's task";
  return type;
}

function formatRelative(value, t) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.arenaJustNow || "just now";
  if (m < 60) return `${m} ${t.arenaMinAbbrev || "min"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t.arenaHourAbbrev || "h"}`;
  const d = Math.floor(h / 24);
  return `${d} ${t.arenaDayAbbrev || "d"}`;
}
