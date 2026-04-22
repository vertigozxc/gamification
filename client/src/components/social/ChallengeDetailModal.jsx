import { useCallback, useEffect, useState } from "react";
import { fetchChallenge, completeChallenge, leaveChallenge } from "../../api";
import Avatar from "./Avatar";

export default function ChallengeDetailModal({ challengeId, authUser, t, languageId, onClose, onOpenProfile }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    if (!window.confirm(t.socialConfirmLeave || "Leave this challenge? Your progress will stay but you won't earn more tokens.")) return;
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        overflowY: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "auto",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          borderRadius: "var(--border-radius-panel)",
          padding: "1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} aria-label={t.close || "Close"} style={closeBtn}>✕</button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
        ) : !challenge ? (
          <p style={{ textAlign: "center", color: "var(--color-danger,#f87171)" }}>{error}</p>
        ) : (
          <ChallengeBody
            challenge={challenge}
            meUid={meUid}
            t={t}
            languageId={languageId}
            onComplete={handleComplete}
            onLeave={handleLeave}
            onOpenProfile={onOpenProfile}
            busy={busy}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function ChallengeBody({ challenge, meUid, t, languageId, onComplete, onLeave, onOpenProfile, busy, error }) {
  const activeParticipants = (challenge.participants || []).filter((p) => !p.leftAt);
  const myParticipant = challenge.participants.find((p) => p.userId && p.user.username === meUid);
  const isActive = myParticipant && !myParticipant.leftAt;
  const ended = new Date(challenge.endsAt) <= new Date();
  const completedToday = myParticipant?.lastCompletionDayKey === todayKey();
  const totalCompletions = challenge.participants.reduce((sum, p) => sum + (p.completions || 0), 0);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));

  return (
    <>
      <div>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)" }}>
          {challenge.title}
        </h2>
        {challenge.description && (
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
            {challenge.description}
          </p>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0.45rem",
        padding: "0.7rem",
        background: "rgba(0,0,0,0.22)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.6rem"
      }}>
        <Mini label={t.socialDaysLeftLabel || "Days left"} value={ended ? "0" : daysLeft} />
        <Mini label={t.socialParticipantsLabel || "Players"} value={activeParticipants.length} />
        <Mini label={t.socialTotalDone || "Total done"} value={totalCompletions} />
      </div>

      <div style={{
        padding: "0.6rem 0.75rem",
        background: "rgba(0,0,0,0.18)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.55rem"
      }}>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
          {t.socialDailyTask || "Daily task"}
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--color-text)", fontWeight: 600, marginTop: 3 }}>
          🎯 {challenge.questTitle}
          {challenge.needsTimer && challenge.timeEstimateMin ? ` · ⏱ ${challenge.timeEstimateMin} ${t.minAbbrev || "min"}` : ""}
        </p>
      </div>

      {isActive && !ended && (
        <button
          type="button"
          disabled={busy || completedToday}
          onClick={onComplete}
          style={{
            padding: "0.8rem",
            borderRadius: "0.65rem",
            background: completedToday ? "rgba(34,197,94,0.18)" : "rgba(var(--color-primary-rgb,251,191,36),0.22)",
            border: `1px solid ${completedToday ? "rgba(34,197,94,0.55)" : "rgba(var(--color-primary-rgb,251,191,36),0.6)"}`,
            color: "var(--color-text)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: completedToday ? "default" : "pointer"
          }}
        >
          {completedToday ? `✓ ${t.socialDoneToday || "Done today"}` : (t.socialMarkDone || "Mark done today · +1 🪙")}
        </button>
      )}

      <section>
        <h3 style={sectionTitleStyle}>{t.socialParticipantsTitle || "Participants"}</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {challenge.participants.map((p) => (
            <li
              key={p.id}
              onClick={() => onOpenProfile && onOpenProfile(p.user.username)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.45rem 0.55rem",
                background: p.leftAt ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.22)",
                border: "1px solid var(--panel-border)",
                borderRadius: "0.5rem",
                opacity: p.leftAt ? 0.55 : 1,
                cursor: "pointer"
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
                <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={32} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.user.displayName || p.user.username}
                  {p.leftAt && <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", fontWeight: 400 }}> · {t.socialLeft || "left"}</span>}
                </p>
                <p style={{ fontSize: "0.66rem", color: "var(--color-muted)" }}>
                  {t.socialCompletionsShort || "Done"}: {p.completions} · 🔥 {p.consecutiveDays} · 🪙 {p.tokensEarned}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={sectionTitleStyle}>{t.socialActivityLog || "Activity"}</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: 220, overflowY: "auto" }}>
          {(challenge.logs || []).length === 0 && (
            <li style={{ fontSize: "0.78rem", color: "var(--color-muted)", textAlign: "center", padding: "0.5rem 0" }}>
              {t.socialActivityEmpty || "No activity yet."}
            </li>
          )}
          {(challenge.logs || []).map((log) => (
            <li key={log.id} style={{ fontSize: "0.76rem", color: "var(--color-text)", padding: "0.35rem 0.5rem", borderRadius: "0.4rem", background: "rgba(0,0,0,0.18)" }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{log.user.displayName || log.user.username}</span>
              {" "}
              <span style={{ color: "var(--color-muted)" }}>{logVerb(log.type, t)}</span>
              {" · "}
              <span style={{ color: "var(--color-muted)", fontSize: "0.68rem" }}>{formatRelative(log.createdAt, languageId, t)}</span>
            </li>
          ))}
        </ul>
      </section>

      {error && <p style={{ color: "var(--color-danger,#f87171)", fontSize: "0.78rem" }}>{error}</p>}

      {isActive && !ended && (
        <button
          type="button"
          onClick={onLeave}
          disabled={busy}
          style={{
            padding: "0.6rem",
            borderRadius: "0.55rem",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "var(--color-text)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
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

function Mini({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--font-heading)", marginTop: 2 }}>
        {value}
      </p>
    </div>
  );
}

function logVerb(type, t) {
  if (type === "created") return t.socialLogCreated || "created the challenge";
  if (type === "joined") return t.socialLogJoined || "joined";
  if (type === "left") return t.socialLogLeft || "left";
  if (type === "completed") return t.socialLogCompleted || "completed today's task";
  return type;
}

function formatRelative(value, languageId, t) {
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

const sectionTitleStyle = {
  fontSize: "0.64rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-primary-dim)",
  fontWeight: 700,
  margin: "0 0 0.45rem 0.1rem"
};

const closeBtn = {
  background: "rgba(0,0,0,0.3)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 999,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};
