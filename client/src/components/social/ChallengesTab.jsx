import { useCallback, useEffect, useState } from "react";
import { completeChallenge, fetchUserChallenges } from "../../api";
import Avatar from "./Avatar";

const MAX_ACTIVE = 3;

export default function ChallengesTab({ authUser, t, onOpenChallenge, onOpenCreate, onChanged }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Re-fetch when this tab becomes visible again (after returning from a screen)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("social:refresh-challenges", handler);
    return () => window.removeEventListener("social:refresh-challenges", handler);
  }, [refresh]);

  const now = Date.now();
  const active = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const ended = challenges.filter((c) => new Date(c.endsAt).getTime() <= now);
  const canCreateMore = active.length < MAX_ACTIVE;

  async function quickComplete(challengeId) {
    try {
      await completeChallenge(challengeId, meUid);
      await refresh();
      onChanged && onChanged();
    } catch { /* swallow */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        disabled={!canCreateMore}
        onClick={() => onOpenCreate && onOpenCreate()}
        className="btn-primary press"
        style={{ width: "100%" }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
        {canCreateMore
          ? (t.socialCreateChallenge || "Start a new challenge")
          : (t.socialChallengesFull || `Max ${MAX_ACTIVE} active challenges`)}
      </button>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
          <div className="spinner" />
        </div>
      ) : active.length === 0 && ended.length === 0 ? (
        <EmptyChallenges t={t} />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h3 className="section-header">
                🔥 {t.socialActiveChallenges || "Active"} ({active.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {active.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    t={t}
                    onOpen={() => onOpenChallenge && onOpenChallenge(c.id)}
                    onQuickComplete={() => quickComplete(c.id)}
                  />
                ))}
              </div>
            </>
          )}
          {ended.length > 0 && (
            <>
              <h3 className="section-header">
                🏁 {t.socialRecentlyEnded || "Recently ended"} ({ended.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ended.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    t={t}
                    ended
                    onOpen={() => onOpenChallenge && onOpenChallenge(c.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ChallengeCard({ challenge, t, ended, onOpen, onQuickComplete }) {
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  const start = new Date(challenge.startedAt).getTime();
  const end = new Date(challenge.endsAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const active = (challenge.participants || []).filter((p) => !p.leftAt);
  const completedToday = challenge.myLastCompletionDayKey === todayKey();
  const myStreak = Number(challenge.myConsecutiveDays || 0);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", opacity: ended ? 0.7 : 1 }}>
      <button
        type="button"
        onClick={onOpen}
        className="press"
        style={{ background: "transparent", border: "none", padding: 14, textAlign: "left", color: "var(--color-text)", width: "100%", display: "block", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
          <p className="headline" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {challenge.title}
          </p>
          <span className={`pill ${ended ? "" : "pill-accent"}`} style={{ flexShrink: 0 }}>
            {ended
              ? (t.socialChallengeEnded || "Ended")
              : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
          </span>
        </div>
        <p className="caption" style={{ marginTop: 4 }}>🎯 {challenge.questTitle}</p>

        <div style={{ marginTop: 10 }}>
          <div className="progress">
            <div className={`progress-fill${ended ? " ended" : ""}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="caption" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span>{elapsed}/{total} {t.socialDayMany || "days"}</span>
            <span>🔥 {myStreak}</span>
          </div>
        </div>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 14px" }}>
        <button
          type="button"
          onClick={onOpen}
          className="press"
          style={{ background: "transparent", border: "none", padding: "6px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: "var(--color-muted)" }}
        >
          <div style={{ display: "flex" }}>
            {active.slice(0, 5).map((p, i) => (
              <div
                key={p.id}
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid var(--panel-bg)",
                  background: "var(--panel-bg)",
                }}
              >
                <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={22} />
              </div>
            ))}
          </div>
          <span className="caption">{active.length} {t.socialParticipants || "players"}</span>
        </button>

        {!ended && (
          completedToday ? (
            <span className="pill pill-success" style={{ marginLeft: "auto" }}>
              ✓ {t.socialDoneToday || "Done today"}
            </span>
          ) : (
            <button
              type="button"
              onClick={onQuickComplete}
              className="btn-tinted press"
              style={{ marginLeft: "auto", padding: "7px 12px", fontSize: 14 }}
            >
              {t.socialMarkDoneShort || "Mark done"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function EmptyChallenges({ t }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 16 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🤝</div>
      <p className="headline" style={{ marginBottom: 6 }}>
        {t.socialChallengesEmptyTitle || "Ride together, finish together."}
      </p>
      <p className="subhead" style={{ lineHeight: 1.45, maxWidth: 320, margin: "0 auto" }}>
        {t.socialChallengesEmptyBody || "Pick a friend, pick a task, pick a duration. Every day someone ticks it off, everyone earns a token."}
      </p>
    </div>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
