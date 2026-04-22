import { useCallback, useEffect, useMemo, useState } from "react";
import { completeChallenge, fetchChallenge, leaveChallenge } from "../../api";
import Avatar from "./Avatar";
import { haptic, useIosNav } from "./iosNav";

export default function ChallengeDetailScreen({ challengeId, authUser, t, languageId, onOpenProfile, onChanged }) {
  const nav = useIosNav();
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
    haptic("success");
    try { await completeChallenge(challengeId, meUid); await refresh(); onChanged && onChanged(); }
    catch (e) { haptic("warning"); setError(e?.message || t.socialErrorGeneric || "Action failed"); }
    finally { setBusy(false); }
  }
  async function handleLeave() {
    if (!window.confirm(t.socialConfirmLeave || "Leave this challenge?")) return;
    setBusy(true);
    haptic("warning");
    try { await leaveChallenge(challengeId, meUid); onChanged && onChanged(); nav.pop(); }
    catch (e) { setError(e?.message || t.socialErrorGeneric || "Action failed"); setBusy(false); }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
        <div className="ios-spinner" />
      </div>
    );
  }
  if (!challenge) {
    return <p style={{ textAlign: "center", color: "#ff453a", padding: "40px 16px" }}>{error}</p>;
  }

  return (
    <Body
      challenge={challenge}
      meUid={meUid}
      t={t}
      busy={busy}
      error={error}
      showActivity={showActivity}
      onToggleActivity={() => { haptic("light"); setShowActivity((v) => !v); }}
      onComplete={handleComplete}
      onLeave={handleLeave}
      onOpenProfile={onOpenProfile}
    />
  );
}

function Body({ challenge, meUid, t, busy, error, showActivity, onToggleActivity, onComplete, onLeave, onOpenProfile }) {
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

  const ranked = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) => {
      if ((b.completions || 0) !== (a.completions || 0)) return (b.completions || 0) - (a.completions || 0);
      return (b.consecutiveDays || 0) - (a.consecutiveDays || 0);
    });
    return copy;
  }, [participants]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ios-title">{challenge.title}</h2>
          {challenge.description && (
            <p className="ios-subhead" style={{ marginTop: 4 }}>{challenge.description}</p>
          )}
        </div>
        <span className={`ios-pill ${ended ? "" : "ios-pill-accent"}`} style={{ flexShrink: 0 }}>
          {ended ? (t.socialChallengeEnded || "Ended") : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
        </span>
      </div>

      <div style={{ padding: 14, background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="ios-caption" style={{ fontWeight: 600 }}>{t.socialDurationProgress || "Duration progress"}</span>
          <span className="ios-caption">{elapsed}/{total} {t.socialDayMany || "days"} · {progressPct}%</span>
        </div>
        <div className="ios-progress" style={{ height: 8 }}>
          <div className={`ios-progress-fill${ended ? " ended" : ""}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <Mini label={t.socialTotalDone || "Total done"} value={totalCompletions} />
          <Mini label={t.socialParticipantsLabel || "Players"} value={active.length} />
          <Mini label={t.socialMyStreakInChallenge || "My streak"} value={`🔥 ${myParticipant?.consecutiveDays || 0}`} />
        </div>
      </div>

      <div
        style={{
          padding: 14,
          background: completedToday ? "rgba(48,209,88,0.12)" : "var(--panel-bg)",
          border: `1px solid ${completedToday ? "rgba(48,209,88,0.4)" : "var(--panel-border)"}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        <div>
          <p className="ios-caption" style={{ fontWeight: 600 }}>{t.socialDailyTask || "Daily task"}</p>
          <p className="ios-headline" style={{ marginTop: 3, fontSize: 17 }}>
            🎯 {challenge.questTitle}
            {challenge.needsTimer && challenge.timeEstimateMin ? (
              <span style={{ color: "var(--color-muted)", fontWeight: 500 }}> · ⏱ {challenge.timeEstimateMin} {t.minAbbrev || "min"}</span>
            ) : null}
          </p>
          {challenge.questDescription && (
            <p className="ios-subhead" style={{ marginTop: 4 }}>{challenge.questDescription}</p>
          )}
        </div>

        {isActive && !ended && (
          completedToday ? (
            <div className="ios-pill ios-pill-success" style={{ justifyContent: "center", padding: "10px 12px", fontSize: 15 }}>
              ✓ {t.socialDoneToday || "Done today"}
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={onComplete} className="ios-btn-primary ios-tap" style={{ padding: 14, fontSize: 16 }}>
              {t.socialMarkDone || "Mark done today · +1 🪙 each"}
            </button>
          )
        )}
        {!ended && !todayAwardGiven && !completedToday && (
          <p className="ios-caption" style={{ textAlign: "center" }}>
            {t.socialTokenNotAwardedYet || "Tokens for today unlock when any participant ticks this off."}
          </p>
        )}
      </div>

      <div>
        <h3 className="ios-section-header" style={{ margin: "0 6px 8px" }}>{t.socialParticipantsTitle || "Participants"}</h3>
        <div className="ios-list">
          {ranked.map((p, i) => (
            <ParticipantRow
              key={p.id}
              rank={i + 1}
              participant={p}
              meUid={meUid}
              t={t}
              onOpenProfile={onOpenProfile}
              isLast={i === ranked.length - 1}
            />
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onToggleActivity}
          className="ios-list-row ios-tap"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12 }}
        >
          <span style={{ fontSize: 16 }}>📋</span>
          <span className="ios-body" style={{ flex: 1, fontWeight: 600 }}>{t.socialActivityLog || "Activity"}</span>
          <span style={{ color: "var(--color-muted)", transition: "transform 200ms cubic-bezier(0.32,0.72,0,1)", transform: showActivity ? "rotate(90deg)" : "none" }}>›</span>
        </button>
        {showActivity && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(challenge.logs || []).length === 0 && (
              <p className="ios-caption" style={{ textAlign: "center", padding: "8px 0" }}>{t.socialActivityEmpty || "No activity yet."}</p>
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
        <button type="button" onClick={onLeave} disabled={busy} className="ios-btn-destructive ios-tap">
          {t.socialLeaveChallenge || "Leave challenge"}
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
      className="ios-list-row ios-tap"
      style={{
        background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.08)" : "transparent",
        borderBottom: isLast ? "none" : undefined,
        opacity: left ? 0.55 : 1
      }}
    >
      <span style={{ width: 20, textAlign: "center", fontWeight: 700, color: "var(--color-muted)", fontSize: 13, flexShrink: 0 }}>
        {rank}
      </span>
      <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
        <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={34} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="ios-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {participant.user.displayName || participant.user.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.socialYou || "you"}</span>}
          {left && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> · {t.socialLeft || "left"}</span>}
        </p>
        <p className="ios-caption" style={{ display: "flex", gap: 8 }}>
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
      <p className="ios-caption" style={{ fontSize: 11, fontWeight: 600 }}>{label}</p>
      <p className="ios-headline" style={{ marginTop: 2, fontSize: 17 }}>{value}</p>
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
