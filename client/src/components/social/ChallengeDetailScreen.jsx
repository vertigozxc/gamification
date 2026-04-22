import { useCallback, useEffect, useMemo, useState } from "react";
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

  const footer = !loading && challenge && isActive && !ended ? (
    completedToday ? (
      <div className="sb-pill sb-pill-success" style={{ justifyContent: "center", padding: 14, fontSize: 15, width: "100%", display: "flex" }}>
        ✓ {t.arenaDoneTodayFull || "Done for today"}
      </div>
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
      {challenge.description && (
        <p className="sb-body" style={{ color: "var(--color-muted)" }}>{challenge.description}</p>
      )}

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
