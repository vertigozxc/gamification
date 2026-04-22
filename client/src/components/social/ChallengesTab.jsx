import { useCallback, useEffect, useState } from "react";
import { fetchUserChallenges } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import CreateChallengeModal from "./CreateChallengeModal";
import ChallengeDetailModal from "./ChallengeDetailModal";

const MAX_ACTIVE = 3;

export default function ChallengesTab({ authUser, t, languageId, onOpenProfile }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openChallengeId, setOpenChallengeId] = useState(null);

  const refresh = useCallback(async () => {
    if (!meUid) return;
    try {
      const data = await fetchUserChallenges(meUid);
      setChallenges(data?.challenges || []);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [meUid]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeOnly = challenges.filter((c) => new Date(c.endsAt) > new Date());
  const canCreateMore = activeOnly.length < MAX_ACTIVE;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{
        padding: "0.7rem 0.8rem",
        background: "rgba(0,0,0,0.18)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.65rem",
        display: "flex",
        alignItems: "center",
        gap: "0.65rem"
      }}>
        <span style={{ fontSize: "1.15rem" }}>⚔️</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
            {t.socialChallengesTitle || "Group challenges"}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 1 }}>
            {(t.socialChallengesHint || "Up to {max} active at once. Every daily completion awards +1 token to every participant.").replace("{max}", String(MAX_ACTIVE))}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!canCreateMore}
        onClick={() => setShowCreate(true)}
        style={{
          padding: "0.75rem",
          border: "1px dashed rgba(var(--color-primary-rgb,251,191,36),0.5)",
          background: canCreateMore ? "rgba(var(--color-primary-rgb,251,191,36),0.1)" : "rgba(0,0,0,0.15)",
          color: "var(--color-text)",
          borderRadius: "0.65rem",
          cursor: canCreateMore ? "pointer" : "not-allowed",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: canCreateMore ? 1 : 0.55
        }}
      >
        {canCreateMore ? (t.socialCreateChallenge || "+ Start a new challenge") : (t.socialChallengesFull || `Max ${MAX_ACTIVE} active challenges`)}
      </button>

      {loading ? (
        <p style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
      ) : challenges.length === 0 ? (
        <p style={{ textAlign: "center", padding: "1.5rem 0.75rem", color: "var(--color-muted)" }}>
          {t.socialChallengesEmpty || "You are not in any group challenges yet."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              t={t}
              languageId={languageId}
              meUid={meUid}
              onClick={() => setOpenChallengeId(c.id)}
            />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateChallengeModal
          authUser={authUser}
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {openChallengeId && (
        <ChallengeDetailModal
          challengeId={openChallengeId}
          authUser={authUser}
          t={t}
          languageId={languageId}
          onClose={() => { setOpenChallengeId(null); refresh(); }}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}

function ChallengeCard({ challenge, t, languageId, onClick }) {
  const ended = new Date(challenge.endsAt) <= new Date();
  const activeParticipants = (challenge.participants || []).filter((p) => !p.leftAt);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));
  const completedToday = challenge.myLastCompletionDayKey === todayKey();

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          padding: "0.75rem",
          borderRadius: "0.7rem",
          background: ended ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.2)",
          border: `1px solid ${ended ? "var(--panel-border)" : "rgba(var(--color-primary-rgb,251,191,36),0.3)"}`,
          color: "var(--color-text)",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
          opacity: ended ? 0.65 : 1
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.92rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
            {challenge.title}
          </p>
          <span style={{ fontSize: "0.66rem", color: "var(--color-muted)", flexShrink: 0, fontWeight: 600 }}>
            {ended
              ? (t.socialChallengeEnded || "Ended")
              : (t.socialDaysLeft || "{n} d left").replace("{n}", String(daysLeft))}
          </span>
        </div>
        <p style={{ fontSize: "0.74rem", color: "var(--color-muted)" }}>
          🎯 {challenge.questTitle}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <div style={{ display: "flex" }}>
            {activeParticipants.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: "2px solid var(--panel-bg)", width: 28, height: 28, overflow: "hidden" }}>
                <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={24} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
            {activeParticipants.length} {t.socialParticipants || "participants"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "0.66rem", color: completedToday ? "#22c55e" : "var(--color-muted)", fontWeight: 600 }}>
            {completedToday ? "✓ " + (t.socialDoneToday || "Done today") : (t.socialStreakInChallenge || "{n} days in a row").replace("{n}", String(challenge.myConsecutiveDays || 0))}
          </span>
        </div>
      </button>
    </li>
  );
}

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
