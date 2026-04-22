import { useCallback, useEffect, useMemo, useState } from "react";
import { completeChallenge, fetchChallenge, leaveChallenge } from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";
import Alert from "./Alert";

export default function ChallengeDetailScreen({
  challengeId,
  authUser,
  t,
  backLabel,
  onClose,
  onOpenProfile,
  onChanged,
}) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

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
      onChanged && onChanged();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
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
      setError(e?.message || t.socialErrorGeneric || "Action failed");
      setBusy(false);
    }
  }

  const participants = challenge?.participants || [];
  const active = participants.filter((p) => !p.leftAt);
  const myParticipant = participants.find((p) => p.user.username === meUid);
  const isActive = !!(myParticipant && !myParticipant.leftAt);
  const ended = challenge ? new Date(challenge.endsAt).getTime() <= Date.now() : false;
  const completedToday = myParticipant?.lastCompletionDayKey === todayKey();

  const footer = !loading && challenge && isActive && !ended ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {completedToday ? (
        <div className="pill pill-success" style={{ justifyContent: "center", padding: "12px", fontSize: 15 }}>
          ✓ {t.socialDoneToday || "Done today"}
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={handleComplete} className="btn-primary press" style={{ padding: 14 }}>
          {t.socialMarkDone || "Mark done today · +1 🪙 each"}
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <Screen
        title={challenge?.title || (t.socialChallengeSheetTitle || "Challenge")}
        leftLabel={backLabel || t.back || "Back"}
        onClose={onClose}
        footer={footer}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div className="spinner" />
          </div>
        ) : !challenge ? (
          <p style={{ textAlign: "center", color: "#ff453a", padding: "40px 16px" }}>{error}</p>
        ) : (
          <Body
            challenge={challenge}
            meUid={meUid}
            t={t}
            busy={busy}
            error={error}
            ended={ended}
            isActive={isActive}
            showActivity={showActivity}
            onToggleActivity={() => setShowActivity((v) => !v)}
            onOpenProfile={onOpenProfile}
            onLeaveClick={() => setConfirmLeave(true)}
            myParticipant={myParticipant}
            activeParticipants={active}
          />
        )}
      </Screen>
      {confirmLeave && (
        <Alert
          icon="🚪"
          title={t.socialConfirmLeaveTitle || "Leave this challenge?"}
          message={t.socialConfirmLeave || "Your progress stays, but you won't earn more tokens."}
          cancelLabel={t.cancel || "Cancel"}
          confirmLabel={t.socialLeaveChallenge || "Leave"}
          destructive
          onCancel={() => setConfirmLeave(false)}
          onConfirm={doLeave}
        />
      )}
    </>
  );
}

function Body({ challenge, meUid, t, busy, error, ended, isActive, showActivity, onToggleActivity, onOpenProfile, onLeaveClick, myParticipant, activeParticipants }) {
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const start = new Date(challenge.startedAt).getTime();
  const end = new Date(challenge.endsAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const totalCompletions = (challenge.participants || []).reduce((sum, p) => sum + (p.completions || 0), 0);
  const todayAwardGiven = challenge.lastAwardedDayKey === todayKey();
  const completedToday = myParticipant?.lastCompletionDayKey === todayKey();

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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {challenge.description && (
            <p className="subhead" style={{ marginTop: 2 }}>{challenge.description}</p>
          )}
        </div>
        <span className={`pill ${ended ? "" : "pill-accent"}`} style={{ flexShrink: 0 }}>
          {ended ? (t.socialChallengeEnded || "Ended") : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
        </span>
      </div>

      {/* Progress */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="caption" style={{ fontWeight: 600 }}>{t.socialDurationProgress || "Duration progress"}</span>
          <span className="caption">{elapsed}/{total} {t.socialDayMany || "days"} · {progressPct}%</span>
        </div>
        <div className="progress" style={{ height: 8 }}>
          <div className={`progress-fill${ended ? " ended" : ""}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <Mini label={t.socialTotalDone || "Total done"} value={totalCompletions} />
          <Mini label={t.socialParticipantsLabel || "Players"} value={activeParticipants.length} />
          <Mini label={t.socialMyStreakInChallenge || "My streak"} value={`🔥 ${myParticipant?.consecutiveDays || 0}`} />
        </div>
      </div>

      {/* Task */}
      <div
        className="card"
        style={{
          background: completedToday ? "rgba(48,209,88,0.1)" : "var(--panel-bg)",
          borderColor: completedToday ? "rgba(48,209,88,0.4)" : "var(--panel-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <p className="caption" style={{ fontWeight: 600 }}>{t.socialDailyTask || "Daily task"}</p>
        <p className="headline" style={{ fontSize: 17 }}>
          🎯 {challenge.questTitle}
          {challenge.needsTimer && challenge.timeEstimateMin ? (
            <span style={{ color: "var(--color-muted)", fontWeight: 500 }}> · ⏱ {challenge.timeEstimateMin} {t.minAbbrev || "min"}</span>
          ) : null}
        </p>
        {challenge.questDescription && (
          <p className="subhead">{challenge.questDescription}</p>
        )}
        {!ended && !todayAwardGiven && !completedToday && (
          <p className="caption">
            {t.socialTokenNotAwardedYet || "Tokens for today unlock when any participant ticks this off."}
          </p>
        )}
      </div>

      {/* Participants */}
      <div>
        <h3 className="section-header" style={{ margin: "0 6px 8px" }}>{t.socialParticipantsTitle || "Participants"}</h3>
        <div className="list">
          {ranked.map((p, i) => (
            <ParticipantRow
              key={p.id}
              rank={i + 1}
              participant={p}
              meUid={meUid}
              t={t}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      </div>

      {/* Activity toggle */}
      <div>
        <button
          type="button"
          onClick={onToggleActivity}
          className="list-row press"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12 }}
        >
          <span style={{ fontSize: 16 }}>📋</span>
          <span className="body" style={{ flex: 1, fontWeight: 600 }}>{t.socialActivityLog || "Activity"}</span>
          <span style={{ color: "var(--color-muted)", transition: "transform 200ms cubic-bezier(0.32,0.72,0,1)", transform: showActivity ? "rotate(90deg)" : "none", display: "inline-block" }}>›</span>
        </button>
        {showActivity && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(challenge.logs || []).length === 0 && (
              <p className="caption" style={{ textAlign: "center", padding: "8px 0" }}>{t.socialActivityEmpty || "No activity yet."}</p>
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

      {error && <p style={{ color: "#ff453a", fontSize: 14, textAlign: "center" }}>{error}</p>}

      {isActive && !ended && (
        <button type="button" onClick={onLeaveClick} disabled={busy} className="btn-destructive press" style={{ marginTop: 4 }}>
          {t.socialLeaveChallenge || "Leave challenge"}
        </button>
      )}
    </div>
  );
}

function ParticipantRow({ rank, participant, meUid, t, onOpenProfile }) {
  const isMe = participant.user.username === meUid;
  const left = !!participant.leftAt;
  return (
    <button
      type="button"
      onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
      className="list-row press"
      style={{
        background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.08)" : "transparent",
        opacity: left ? 0.55 : 1,
      }}
    >
      <span style={{ width: 20, textAlign: "center", fontWeight: 700, color: "var(--color-muted)", fontSize: 13, flexShrink: 0 }}>
        {rank}
      </span>
      <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
        <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={34} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {participant.user.displayName || participant.user.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.socialYou || "you"}</span>}
          {left && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> · {t.socialLeft || "left"}</span>}
        </p>
        <p className="caption" style={{ display: "flex", gap: 8 }}>
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
      <p className="caption" style={{ fontSize: 11, fontWeight: 600 }}>{label}</p>
      <p className="headline" style={{ marginTop: 2, fontSize: 17 }}>{value}</p>
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
