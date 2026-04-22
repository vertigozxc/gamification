import { useCallback, useEffect, useState } from "react";
import { completeChallenge, fetchUserChallenges } from "../../api";
import Avatar from "./Avatar";
import CreateChallengeModal from "./CreateChallengeModal";
import ChallengeDetailModal from "./ChallengeDetailModal";

const MAX_ACTIVE = 3;

export default function ChallengesTab({ authUser, t, languageId, onOpenProfile, onChanged }) {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = window.__pendingSocialChallengeId;
    if (pending) {
      setOpenChallengeId(pending);
      try { window.__pendingSocialChallengeId = null; } catch {}
    }
  }, []);

  const now = Date.now();
  const active = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const ended = challenges.filter((c) => new Date(c.endsAt).getTime() <= now);
  const canCreateMore = active.length < MAX_ACTIVE;

  async function quickComplete(challengeId) {
    try {
      await completeChallenge(challengeId, meUid);
      await refresh();
      onChanged && onChanged();
    } catch {
      /* noop: detail modal surfaces errors */
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Info card */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 12
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(var(--color-primary-rgb,251,191,36),0.18)",
            color: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0
          }}
        >
          ⚔️
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="ios-headline" style={{ marginBottom: 2 }}>
            {t.socialChallengesHintShort || "Stay accountable together."}
          </p>
          <p className="ios-caption">
            {(t.socialChallengesHint || "Up to {max} active. +1 token to everyone each day someone completes.").replace("{max}", String(MAX_ACTIVE))}
          </p>
        </div>
      </div>

      {/* Create CTA */}
      <button
        type="button"
        disabled={!canCreateMore}
        onClick={() => setShowCreate(true)}
        className="ios-btn-primary ios-tap"
        style={{ padding: "14px" }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
        {canCreateMore
          ? (t.socialCreateChallenge || "Start a new challenge")
          : (t.socialChallengesFull || `Max ${MAX_ACTIVE} active challenges`)}
      </button>

      {loading ? (
        <p style={{ textAlign: "center", padding: "24px 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
      ) : active.length === 0 && ended.length === 0 ? (
        <EmptyChallenges t={t} />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h3 className="ios-section-header">
                🔥 {t.socialActiveChallenges || "Active"} ({active.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {active.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    t={t}
                    languageId={languageId}
                    meUid={meUid}
                    onOpen={() => setOpenChallengeId(c.id)}
                    onQuickComplete={() => quickComplete(c.id)}
                  />
                ))}
              </div>
            </>
          )}
          {ended.length > 0 && (
            <>
              <h3 className="ios-section-header">
                🏁 {t.socialRecentlyEnded || "Recently ended"} ({ended.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ended.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    t={t}
                    languageId={languageId}
                    meUid={meUid}
                    ended
                    onOpen={() => setOpenChallengeId(c.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showCreate && (
        <CreateChallengeModal
          authUser={authUser}
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); onChanged && onChanged(); }}
        />
      )}

      {openChallengeId && (
        <ChallengeDetailModal
          challengeId={openChallengeId}
          authUser={authUser}
          t={t}
          languageId={languageId}
          onClose={() => { setOpenChallengeId(null); refresh(); onChanged && onChanged(); }}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}

function ChallengeCard({ challenge, t, meUid, ended, onOpen, onQuickComplete }) {
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
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "var(--panel-bg)",
        border: "1px solid var(--panel-border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: ended ? 0.7 : 1
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="ios-tap"
        style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", color: "var(--color-text)" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
          <p className="ios-headline" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {challenge.title}
          </p>
          <span className={`ios-pill ${ended ? "" : "ios-pill-accent"}`} style={{ flexShrink: 0 }}>
            {ended
              ? (t.socialChallengeEnded || "Ended")
              : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
          </span>
        </div>
        <p className="ios-caption" style={{ marginTop: 4 }}>🎯 {challenge.questTitle}</p>

        <div style={{ marginTop: 10 }}>
          <div className="ios-progress">
            <div className={`ios-progress-fill${ended ? " ended" : ""}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="ios-caption" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span>{elapsed}/{total} {t.socialDayMany || "days"}</span>
            <span>🔥 {myStreak}</span>
          </div>
        </div>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onOpen}
          className="ios-tap"
          style={{ background: "transparent", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--color-muted)" }}
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
                  background: "var(--panel-bg)"
                }}
              >
                <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={22} />
              </div>
            ))}
          </div>
          <span className="ios-caption">{active.length} {t.socialParticipants || "players"}</span>
        </button>

        {!ended && (
          completedToday ? (
            <span className="ios-pill ios-pill-success" style={{ marginLeft: "auto" }}>
              ✓ {t.socialDoneToday || "Done today"}
            </span>
          ) : (
            <button
              type="button"
              onClick={onQuickComplete}
              className="ios-btn-tinted ios-tap"
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
      <p className="ios-headline" style={{ marginBottom: 6 }}>
        {t.socialChallengesEmptyTitle || "Ride together, finish together."}
      </p>
      <p className="ios-subhead" style={{ lineHeight: 1.45, maxWidth: 320, margin: "0 auto" }}>
        {t.socialChallengesEmptyBody || "Pick a friend, pick a task, pick a duration. Every day someone ticks it off, everyone earns a token."}
      </p>
    </div>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
