import { useCallback, useEffect, useMemo, useState } from "react";
import { completeChallenge, fetchChallenge, leaveChallenge } from "../../api";
import Avatar from "./Avatar";

export default function ChallengeDetailModal({ challengeId, authUser, t, languageId, onClose, onOpenProfile }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await fetchChallenge(challengeId);
      setChallenge(data?.challenge || null);
    } catch (e) {
      setError(e?.message || t.socialErrorLoad || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [challengeId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleComplete() {
    setBusy(true);
    try {
      await completeChallenge(challengeId, meUid);
      await refresh();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!window.confirm(t.socialConfirmLeave || "Leave this challenge?")) return;
    setBusy(true);
    try {
      await leaveChallenge(challengeId, meUid);
      onClose();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={overlayStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.3rem" }}>
          <button type="button" onClick={onClose} aria-label={t.close || "Close"} style={closeBtnStyle}>✕</button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-muted)", padding: "1.5rem 0" }}>{t.socialLoading || "Loading…"}</p>
        ) : !challenge ? (
          <p style={{ textAlign: "center", color: "var(--color-danger,#f87171)", padding: "1.5rem 0" }}>{error}</p>
        ) : (
          <Body
            challenge={challenge}
            meUid={meUid}
            t={t}
            languageId={languageId}
            busy={busy}
            error={error}
            showActivity={showActivity}
            onToggleActivity={() => setShowActivity((v) => !v)}
            onComplete={handleComplete}
            onLeave={handleLeave}
            onOpenProfile={onOpenProfile}
          />
        )}
      </div>
    </div>
  );
}

function Body({ challenge, meUid, t, languageId, busy, error, showActivity, onToggleActivity, onComplete, onLeave, onOpenProfile }) {
  const participants = challenge.participants || [];
  const active = participants.filter((p) => !p.leftAt);
  const myParticipant = participants.find((p) => p.user.username === meUid);
  const isActive = !!(myParticipant && !myParticipant.leftAt);
  const ended = new Date(challenge.endsAt).getTime() <= Date.now();

  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const start = new Date(challenge.startedAt).getTime();
  const end = new Date(challenge.endsAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const completedToday = myParticipant?.lastCompletionDayKey === todayKey();
  const totalCompletions = participants.reduce((sum, p) => sum + (p.completions || 0), 0);
  const todayAwardGiven = challenge.lastAwardedDayKey === todayKey();

  // Participants ranked by completions descending, then consecutiveDays
  const ranked = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) => {
      if ((b.completions || 0) !== (a.completions || 0)) return (b.completions || 0) - (a.completions || 0);
      return (b.consecutiveDays || 0) - (a.consecutiveDays || 0);
    });
    return copy;
  }, [participants]);

  return (
    <>
      {/* Title + ended/days-left pill */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text)" }}>
            {challenge.title}
          </h2>
          {challenge.description && (
            <p style={{ fontSize: "0.82rem", color: "var(--color-muted)", marginTop: "0.3rem" }}>
              {challenge.description}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: "0.64rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0.2rem 0.55rem",
            borderRadius: 999,
            background: ended ? "rgba(0,0,0,0.35)" : "rgba(var(--color-primary-rgb,251,191,36),0.22)",
            color: ended ? "var(--color-muted)" : "var(--color-primary)",
            flexShrink: 0
          }}
        >
          {ended ? (t.socialChallengeEnded || "Ended") : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
        </span>
      </div>

      {/* Progress bar hero */}
      <div
        style={{
          padding: "0.85rem",
          background: "rgba(0,0,0,0.22)",
          border: "1px solid var(--panel-border)",
          borderRadius: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.55rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
            {t.socialDurationProgress || "Duration progress"}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600 }}>
            {elapsed}/{total} {t.socialDayMany || "days"} · {progressPct}%
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: ended
                ? "linear-gradient(90deg,#9ca3af,#6b7280)"
                : "linear-gradient(90deg, rgba(var(--color-primary-rgb,251,191,36),0.75), rgba(var(--color-primary-rgb,251,191,36),1))"
            }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.45rem", marginTop: "0.2rem" }}>
          <Mini label={t.socialTotalDone || "Total done"} value={totalCompletions} />
          <Mini label={t.socialParticipantsLabel || "Players"} value={active.length} />
          <Mini label={t.socialMyStreakInChallenge || "My streak"} value={`🔥 ${myParticipant?.consecutiveDays || 0}`} />
        </div>
      </div>

      {/* Daily task tile + hero Mark-Done */}
      <div
        style={{
          padding: "0.85rem",
          background: completedToday
            ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(0,0,0,0.22))"
            : "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.14), rgba(0,0,0,0.22))",
          border: `1px solid ${completedToday ? "rgba(34,197,94,0.45)" : "rgba(var(--color-primary-rgb,251,191,36),0.4)"}`,
          borderRadius: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem"
        }}
      >
        <div>
          <p style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
            {t.socialDailyTask || "Daily task"}
          </p>
          <p style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--color-text)", marginTop: 3 }}>
            🎯 {challenge.questTitle}
            {challenge.needsTimer && challenge.timeEstimateMin ? (
              <span style={{ color: "var(--color-muted)", fontWeight: 500 }}> · ⏱ {challenge.timeEstimateMin} {t.minAbbrev || "min"}</span>
            ) : null}
          </p>
          {challenge.questDescription && (
            <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", marginTop: 4 }}>{challenge.questDescription}</p>
          )}
        </div>

        {isActive && !ended && (
          <button
            type="button"
            disabled={busy || completedToday}
            onClick={onComplete}
            style={{
              padding: "0.9rem",
              borderRadius: "0.65rem",
              background: completedToday
                ? "rgba(34,197,94,0.2)"
                : "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.35), rgba(var(--color-primary-rgb,251,191,36),0.2))",
              border: `1px solid ${completedToday ? "rgba(34,197,94,0.55)" : "rgba(var(--color-primary-rgb,251,191,36),0.7)"}`,
              color: "var(--color-text)",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: completedToday ? "default" : "pointer",
              boxShadow: completedToday ? "none" : "0 4px 16px rgba(var(--color-primary-rgb,251,191,36),0.2)"
            }}
          >
            {completedToday
              ? `✓ ${t.socialDoneToday || "Done today"}`
              : (t.socialMarkDone || "Mark done today · +1 🪙 each")}
          </button>
        )}
        {!ended && !todayAwardGiven && (
          <p style={{ fontSize: "0.68rem", color: "var(--color-muted)", textAlign: "center" }}>
            {t.socialTokenNotAwardedYet || "Tokens for today unlock when any participant ticks this off."}
          </p>
        )}
      </div>

      {/* Participants ranked */}
      <section>
        <SectionTitle title={t.socialParticipantsTitle || "Participants"} />
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {ranked.map((p, idx) => (
            <ParticipantRow key={p.id} rank={idx + 1} participant={p} meUid={meUid} t={t} onOpenProfile={onOpenProfile} />
          ))}
        </ul>
      </section>

      {/* Activity (collapsible) */}
      <section>
        <button
          type="button"
          onClick={onToggleActivity}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.7rem",
            background: "rgba(0,0,0,0.18)",
            border: "1px solid var(--panel-border)",
            borderRadius: "0.55rem",
            color: "var(--color-text)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.78rem"
          }}
        >
          <span>📋 {t.socialActivityLog || "Activity"}</span>
          <span style={{ color: "var(--color-muted)" }}>{showActivity ? "▾" : "▸"}</span>
        </button>
        {showActivity && (
          <ul style={{ listStyle: "none", padding: "0.45rem 0 0", margin: 0, display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: 220, overflowY: "auto" }}>
            {(challenge.logs || []).length === 0 && (
              <li style={{ fontSize: "0.78rem", color: "var(--color-muted)", textAlign: "center", padding: "0.5rem 0" }}>
                {t.socialActivityEmpty || "No activity yet."}
              </li>
            )}
            {(challenge.logs || []).map((log) => (
              <li key={log.id} style={{ fontSize: "0.76rem", color: "var(--color-text)", padding: "0.35rem 0.5rem", borderRadius: "0.4rem", background: "rgba(0,0,0,0.18)" }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{log.user.displayName || log.user.username}</span>{" "}
                <span style={{ color: "var(--color-muted)" }}>{logVerb(log.type, t)}</span>
                {" · "}
                <span style={{ color: "var(--color-muted)", fontSize: "0.68rem" }}>{formatRelative(log.createdAt, t)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p style={{ color: "var(--color-danger,#f87171)", fontSize: "0.78rem", textAlign: "center" }}>{error}</p>}

      {isActive && !ended && (
        <button
          type="button"
          onClick={onLeave}
          disabled={busy}
          style={{
            padding: "0.55rem",
            borderRadius: "0.55rem",
            background: "transparent",
            border: "1px dashed rgba(239,68,68,0.45)",
            color: "rgba(239,68,68,0.9)",
            fontWeight: 600,
            fontSize: "0.74rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer"
          }}
        >
          {t.socialLeaveChallenge || "Leave challenge"}
        </button>
      )}
    </>
  );
}

function ParticipantRow({ rank, participant, meUid, t, onOpenProfile }) {
  const isMe = participant.user.username === meUid;
  const left = !!participant.leftAt;
  return (
    <li
      onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        padding: "0.45rem 0.6rem",
        background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.12)" : "rgba(0,0,0,0.2)",
        border: `1px solid ${isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.45)" : "var(--panel-border)"}`,
        borderRadius: "0.5rem",
        cursor: "pointer",
        opacity: left ? 0.55 : 1
      }}
    >
      <span
        style={{
          width: 22,
          textAlign: "center",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          color: "var(--color-muted)",
          fontSize: "0.76rem"
        }}
      >
        {rank}
      </span>
      <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
        <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={30} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {participant.user.displayName || participant.user.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.socialYou || "you"}</span>}
          {left && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> · {t.socialLeft || "left"}</span>}
        </p>
        <p style={{ fontSize: "0.66rem", color: "var(--color-muted)", display: "flex", gap: "0.45rem" }}>
          <span>✓ {participant.completions || 0}</span>
          <span>🔥 {participant.consecutiveDays || 0}</span>
          <span>🪙 {participant.tokensEarned || 0}</span>
        </p>
      </div>
    </li>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-text)", marginTop: 2 }}>
        {value}
      </p>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <h3
      style={{
        fontSize: "0.66rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-primary-dim)",
        fontWeight: 700,
        margin: "0.15rem 0 0.45rem 0.1rem"
      }}
    >
      {title}
    </h3>
  );
}

function logVerb(type, t) {
  if (type === "created") return t.socialLogCreated || "created the challenge";
  if (type === "joined") return t.socialLogJoined || "joined";
  if (type === "left") return t.socialLogLeft || "left";
  if (type === "completed") return t.socialLogCompleted || "completed today's task";
  return type;
}

function formatRelative(value, t) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.socialJustNow || "just now";
  if (m < 60) return `${m} ${t.minAbbrev || "min"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t.hourAbbrev || "h"}`;
  const d = Math.floor(h / 24);
  return `${d} ${t.dayAbbrev || "d"}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(0,0,0,0.72)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  overflowY: "auto",
  padding: "1rem 0.75rem"
};

const sheetStyle = {
  width: "100%",
  maxWidth: 560,
  margin: "auto",
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--border-radius-panel)",
  padding: "1.1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
  maxHeight: "calc(100svh - 2rem)"
};

const closeBtnStyle = {
  background: "rgba(0,0,0,0.3)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 999,
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};
