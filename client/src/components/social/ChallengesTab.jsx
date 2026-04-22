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

  // Deep-link from the Dashboard strip: auto-open the requested challenge.
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
      // fall through — detail modal will surface the precise error
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Info banner */}
      <div
        style={{
          padding: "0.8rem",
          background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.1), rgba(0,0,0,0.22))",
          border: "1px solid var(--panel-border)",
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.7rem"
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>⚔️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text)", marginBottom: 2 }}>
            {t.socialChallengesHintShort || "Stay accountable together."}
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
            {(t.socialChallengesHint || "Up to {max} active. +1 token to everyone each day someone completes.").replace("{max}", String(MAX_ACTIVE))}
          </p>
        </div>
      </div>

      {/* Create CTA */}
      <button
        type="button"
        disabled={!canCreateMore}
        onClick={() => setShowCreate(true)}
        style={{
          padding: "0.85rem",
          border: "1px dashed rgba(var(--color-primary-rgb,251,191,36),0.55)",
          background: canCreateMore ? "rgba(var(--color-primary-rgb,251,191,36),0.12)" : "rgba(0,0,0,0.15)",
          color: "var(--color-text)",
          borderRadius: "0.7rem",
          cursor: canCreateMore ? "pointer" : "not-allowed",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "0.8rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: canCreateMore ? 1 : 0.55,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem"
        }}
      >
        <span>{canCreateMore ? "＋" : "⏳"}</span>
        {canCreateMore
          ? (t.socialCreateChallenge || "Start a new challenge")
          : (t.socialChallengesFull || `Max ${MAX_ACTIVE} active challenges`)}
      </button>

      {/* Content */}
      {loading ? (
        <p style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
      ) : active.length === 0 && ended.length === 0 ? (
        <EmptyChallenges t={t} />
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <SectionTitle icon="🔥" title={`${t.socialActiveChallenges || "Active"} · ${active.length}`} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
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
              </ul>
            </section>
          )}
          {ended.length > 0 && (
            <section>
              <SectionTitle icon="🏁" title={`${t.socialRecentlyEnded || "Recently ended"} · ${ended.length}`} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
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
              </ul>
            </section>
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
    <li>
      <div
        style={{
          padding: "0.75rem 0.8rem",
          borderRadius: "0.75rem",
          background: ended ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.22)",
          border: `1px solid ${ended ? "var(--panel-border)" : "rgba(var(--color-primary-rgb,251,191,36),0.35)"}`,
          display: "flex",
          flexDirection: "column",
          gap: "0.55rem",
          opacity: ended ? 0.7 : 1
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "var(--color-text)" }}
        >
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", justifyContent: "space-between" }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {challenge.title}
            </p>
            <span
              style={{
                flexShrink: 0,
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
                background: ended ? "rgba(0,0,0,0.35)" : "rgba(var(--color-primary-rgb,251,191,36),0.2)",
                color: ended ? "var(--color-muted)" : "var(--color-primary)"
              }}
            >
              {ended
                ? (t.socialChallengeEnded || "Ended")
                : (t.socialDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
            </span>
          </div>

          <p style={{ fontSize: "0.76rem", color: "var(--color-muted)", marginTop: 2 }}>
            🎯 {challenge.questTitle}
          </p>

          {/* Progress bar */}
          <div style={{ marginTop: "0.55rem" }}>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.35)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: ended
                    ? "rgba(var(--color-muted-rgb,156,163,175),0.8)"
                    : "linear-gradient(90deg, rgba(var(--color-primary-rgb,251,191,36),0.7), rgba(var(--color-primary-rgb,251,191,36),1))",
                  transition: "width 200ms"
                }}
              />
            </div>
            <p style={{ fontSize: "0.62rem", color: "var(--color-muted)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <span>{elapsed}/{total} {t.socialDayMany || "days"}</span>
              <span>🔥 {myStreak} {t.socialDayMany || "days"}</span>
            </p>
          </div>
        </button>

        {/* Footer: participants + action */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <button type="button" onClick={onOpen} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
            <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
              {active.length} {t.socialParticipants || "players"}
            </span>
          </button>

          {!ended && (
            completedToday ? (
              <span
                style={{
                  marginLeft: "auto",
                  padding: "0.35rem 0.6rem",
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.5)",
                  borderRadius: "0.5rem",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#22c55e",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase"
                }}
              >
                ✓ {t.socialDoneToday || "Done today"}
              </span>
            ) : (
              <button
                type="button"
                onClick={onQuickComplete}
                style={{
                  marginLeft: "auto",
                  padding: "0.42rem 0.75rem",
                  background: "rgba(var(--color-primary-rgb,251,191,36),0.22)",
                  border: "1px solid rgba(var(--color-primary-rgb,251,191,36),0.6)",
                  borderRadius: "0.5rem",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {t.socialMarkDoneShort || "Mark done"}
              </button>
            )
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyChallenges({ t }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2rem 1rem 2.25rem",
        background: "rgba(0,0,0,0.18)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.8rem"
      }}
    >
      <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>🤝</div>
      <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--color-text)", marginBottom: "0.35rem" }}>
        {t.socialChallengesEmptyTitle || "Ride together, finish together."}
      </p>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", lineHeight: 1.45, maxWidth: 320, margin: "0 auto" }}>
        {t.socialChallengesEmptyBody || "Pick a friend, pick a task, pick a duration. Every day someone ticks it off, everyone earns a token."}
      </p>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <h3
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.68rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--color-primary-dim)",
        fontWeight: 700,
        margin: "0.25rem 0 0.5rem 0.1rem"
      }}
    >
      <span>{icon}</span>
      <span>{title}</span>
    </h3>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
