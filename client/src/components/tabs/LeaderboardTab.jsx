import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import {
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchUserChallenges,
  fetchWeeklyLeaderboard,
} from "../../api";
import Avatar from "../social/Avatar";
import StreakFrame from "../social/StreakFrame";
import ProfileScreen from "../social/ProfileScreen";
import ChallengeDetailScreen from "../social/ChallengeDetailScreen";
import CreateChallengeScreen from "../social/CreateChallengeScreen";
import SearchScreen from "../social/SearchScreen";
import LeaderboardScreen from "../social/LeaderboardScreen";
import FriendsListScreen from "../social/FriendsListScreen";
import ChallengesListScreen from "../social/ChallengesListScreen";
import "../social/ios.css";

let screenIdSeq = 0;

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;
  const meUid = String(authUser?.uid || "").slice(0, 128);

  const [stack, setStack] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [friends, setFriends] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pending deep-link handling (from dashboard challenge strip)
  const pendingChallengeId =
    typeof window !== "undefined" ? window.__pendingSocialChallengeId || null : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.__pendingSocialSubTab = null;
    } catch {}
    if (pendingChallengeId) {
      try { window.__pendingSocialChallengeId = null; } catch {}
      setTimeout(() => pushChallenge(pendingChallengeId), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!meUid) return;
    try {
      const [lb, fr, ch, req] = await Promise.all([
        fetchWeeklyLeaderboard(meUid).catch(() => null),
        fetchFriends(meUid).catch(() => null),
        fetchUserChallenges(meUid).catch(() => null),
        fetchIncomingFriendRequests(meUid).catch(() => null),
      ]);
      setLeaderboard(lb || null);
      setFriends(fr?.friends || []);
      setChallenges(ch?.challenges || []);
      setRequestCount((req?.requests || []).length);
    } finally {
      setLoading(false);
    }
  }, [meUid]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("social:refresh-challenges", handler);
    return () => window.removeEventListener("social:refresh-challenges", handler);
  }, [refresh]);

  /* --- navigation --- */
  const push = useCallback((entry) => setStack((s) => [...s, { id: `s-${++screenIdSeq}`, ...entry }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const pushProfile = (username) => push({ kind: "profile", props: { targetUsername: username } });
  const pushChallenge = (id) => push({ kind: "challenge", props: { challengeId: id } });
  const pushCreate = () => push({ kind: "create", props: {} });
  const pushSearch = () => push({ kind: "search", props: {} });
  const pushFullLeaderboard = () => push({ kind: "leaderboard", props: {} });
  const pushFullFriends = () => push({ kind: "friends", props: {} });
  const pushFullChallenges = () => push({ kind: "challenges", props: {} });

  /* --- derived values --- */
  const now = Date.now();
  const activeChallenges = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const myRankValue = leaderboard?.me?.rank ?? null;
  const weeklyXp = leaderboard?.me?.weeklyXp ?? 0;
  const myStreak = leaderboard?.me?.streak ?? 0;
  const podium = (leaderboard?.users || []).slice(0, 3);

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <div style={{ padding: "8px 14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Title */}
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--color-primary-dim, var(--color-primary))",
              marginBottom: 2,
            }}
          >
            {t.arenaEyebrow || "Your crew"}
          </p>
          <h1 className="cinzel sb-title-xl"
            style={{
              background: "var(--heading-gradient)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              lineHeight: 1.1,
            }}
          >
            {t.arenaTitle || "Arena"}
          </h1>
        </div>

        {loading && !leaderboard ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : (
          <>
            {/* Pulse card */}
            <PulseCard
              rank={myRankValue}
              weeklyXp={weeklyXp}
              streak={myStreak}
              onOpenLeaderboard={pushFullLeaderboard}
              t={t}
            />

            {/* Quick actions */}
            <div className="sb-quick-row">
              <button
                type="button"
                onClick={pushCreate}
                className="sb-quick-btn press"
              >
                <div className="sb-quick-ico">⚔️</div>
                <div className="sb-quick-label">{t.arenaActionChallengeTitle || "Forge a pact"}</div>
                <div className="sb-quick-hint">{t.arenaActionChallengeHint || "Keep a friend on track"}</div>
              </button>
              <button
                type="button"
                onClick={pushSearch}
                className="sb-quick-btn press"
              >
                <div className="sb-quick-ico">🔍</div>
                <div className="sb-quick-label">{t.arenaActionSearchTitle || "Scout players"}</div>
                <div className="sb-quick-hint">{t.arenaActionSearchHint || "Find by nickname"}</div>
              </button>
            </div>

            {/* Requests banner */}
            {requestCount > 0 && (
              <button
                type="button"
                className="sb-banner press"
                onClick={pushFullFriends}
              >
                <span className="sb-banner-dot" aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sb-banner-title">
                    {(t.arenaRequestsTitle || "{n} new request")
                      .replace("{n}", String(requestCount))}
                    {requestCount !== 1 ? (t.arenaRequestsPlural || "s") : ""}
                  </div>
                  <div className="sb-banner-sub">{t.arenaRequestsHint || "Tap to review and respond"}</div>
                </div>
                <span className="sb-banner-chev">›</span>
              </button>
            )}

            {/* Your pacts */}
            <section>
              <div className="sb-section-head">
                <h2 className="sb-section-title">{t.arenaPactsTitle || "Your pacts"}</h2>
                {activeChallenges.length > 0 && (
                  <button type="button" className="sb-section-link press" onClick={pushFullChallenges}>
                    {t.arenaSeeAll || "See all"} ›
                  </button>
                )}
              </div>
              {activeChallenges.length === 0 ? (
                <PactsEmpty t={t} onStart={pushCreate} />
              ) : (
                <div className="sb-scroll-x">
                  {activeChallenges.slice(0, 6).map((c) => (
                    <ChallengeTile key={c.id} challenge={c} t={t} onClick={() => pushChallenge(c.id)} />
                  ))}
                </div>
              )}
            </section>

            {/* Your circle */}
            <section>
              <div className="sb-section-head">
                <h2 className="sb-section-title">{t.arenaCircleTitle || "Your circle"}</h2>
                {friends.length > 0 && (
                  <button type="button" className="sb-section-link press" onClick={pushFullFriends}>
                    {t.arenaSeeAll || "See all"} ›
                  </button>
                )}
              </div>
              {friends.length === 0 ? (
                <CircleEmpty t={t} onFind={pushSearch} />
              ) : (
                <div className="sb-friends-strip">
                  {friends.slice(0, 10).map((f) => (
                    <button
                      key={f.username}
                      type="button"
                      className="sb-friend-chip press"
                      onClick={() => pushProfile(f.username)}
                    >
                      <StreakFrame streak={f.streak} size={48} ringWidth={2}>
                        <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={48} />
                      </StreakFrame>
                      <span className="sb-friend-name">{f.displayName || f.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* This week's champions */}
            {podium.length > 0 && (
              <section>
                <div className="sb-section-head">
                  <h2 className="sb-section-title">{t.arenaChampionsTitle || "This week's champions"}</h2>
                  <button type="button" className="sb-section-link press" onClick={pushFullLeaderboard}>
                    {t.arenaSeeAll || "See all"} ›
                  </button>
                </div>
                <Champions entries={podium} t={t} meUid={meUid} onOpenProfile={pushProfile} />
              </section>
            )}
          </>
        )}
      </div>

      {/* Screen stack */}
      {stack.map((entry, idx) => {
        if (idx !== stack.length - 1) return null;
        const close = pop;
        if (entry.kind === "profile") {
          return (
            <ProfileScreen
              key={entry.id}
              targetUsername={entry.props.targetUsername}
              meUsername={meUid}
              t={t}
              languageId={languageId}
              onClose={close}
              onChanged={refresh}
            />
          );
        }
        if (entry.kind === "challenge") {
          return (
            <ChallengeDetailScreen
              key={entry.id}
              challengeId={entry.props.challengeId}
              authUser={authUser}
              t={t}
              onClose={close}
              onOpenProfile={pushProfile}
              onChanged={refresh}
            />
          );
        }
        if (entry.kind === "create") {
          return (
            <CreateChallengeScreen
              key={entry.id}
              authUser={authUser}
              t={t}
              onClose={close}
              onCreated={() => { close(); refresh(); }}
            />
          );
        }
        if (entry.kind === "search") {
          return <SearchScreen key={entry.id} meUid={meUid} t={t} onClose={close} onOpenProfile={pushProfile} />;
        }
        if (entry.kind === "leaderboard") {
          return <LeaderboardScreen key={entry.id} meUid={meUid} data={leaderboard} t={t} onClose={close} onOpenProfile={pushProfile} />;
        }
        if (entry.kind === "friends") {
          return <FriendsListScreen key={entry.id} authUser={authUser} t={t} onClose={close} onOpenProfile={pushProfile} onChanged={refresh} />;
        }
        if (entry.kind === "challenges") {
          return <ChallengesListScreen key={entry.id} authUser={authUser} t={t} challenges={challenges} onClose={close} onOpenChallenge={pushChallenge} onOpenCreate={pushCreate} />;
        }
        return null;
      })}
    </div>
  );
}

/* ============================================================================
 * Sub-components (home-only)
 * ========================================================================== */

function PulseCard({ rank, weeklyXp, streak, onOpenLeaderboard, t }) {
  return (
    <div className="sb-pulse">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="sb-pulse-eyebrow">{t.arenaPulseEyebrow || "Week standing"}</p>
          {rank != null ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span className="sb-pulse-rank">#{rank}</span>
              <span className="sb-pulse-rank-unit">{t.arenaRankUnit || "this week"}</span>
            </div>
          ) : (
            <div>
              <span className="sb-pulse-rank">—</span>
              <span className="sb-pulse-rank-unit" style={{ marginLeft: 8 }}>{t.arenaUnrankedHint || "no XP yet this week"}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          aria-label={t.arenaOpenBoard || "Open leaderboard"}
          className="press"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--card-border-idle, rgba(255,255,255,0.12))",
            color: "var(--color-text)",
            flexShrink: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          ›
        </button>
      </div>

      <div className="sb-pulse-stats">
        <div className="sb-pulse-stat">
          <p className="sb-pulse-stat-label">{t.arenaWeekXp || "Week XP"}</p>
          <p className="sb-pulse-stat-value">⚡ {weeklyXp}</p>
        </div>
        <div className="sb-pulse-stat">
          <p className="sb-pulse-stat-label">{t.arenaStreak || "Streak"}</p>
          <p className="sb-pulse-stat-value">🔥 {streak}</p>
        </div>
      </div>
    </div>
  );
}

function ChallengeTile({ challenge: c, t, onClick }) {
  const total = Math.max(1, Number(c.durationDays) || 1);
  const start = new Date(c.startedAt).getTime();
  const elapsed = Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const pct = Math.round((elapsed / total) * 100);
  const done = c.myLastCompletionDayKey === todayKey();
  return (
    <button type="button" onClick={onClick} className="sb-challenge-tile press">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span className="sb-challenge-title">{c.title}</span>
        {done ? (
          <span className="sb-pill sb-pill-success">✓</span>
        ) : (
          <span className="sb-pill">·</span>
        )}
      </div>
      <div style={{ color: "var(--color-muted)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        🎯 {c.questTitle}
      </div>
      <div className="sb-progress">
        <div className={`sb-progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="sb-challenge-meta">
        <span>{elapsed}/{total} {t.arenaDayMany || "days"}</span>
        <span>🔥 {c.myConsecutiveDays || 0}</span>
      </div>
    </button>
  );
}

function PactsEmpty({ t, onStart }) {
  return (
    <div className="sb-card" style={{ textAlign: "center", padding: "18px 18px 16px" }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>🤝</div>
      <p className="sb-headline" style={{ marginBottom: 4 }}>
        {t.arenaPactsEmptyTitle || "No pacts yet"}
      </p>
      <p className="sb-caption" style={{ maxWidth: 280, margin: "0 auto 12px" }}>
        {t.arenaPactsEmptyBody || "Pick a friend and a habit. Every daily tick earns a token for the whole party."}
      </p>
      <button type="button" onClick={onStart} className="sb-tinted-btn press">
        {t.arenaPactsEmptyCta || "Forge your first pact"}
      </button>
    </div>
  );
}

function CircleEmpty({ t, onFind }) {
  return (
    <div className="sb-card" style={{ textAlign: "center", padding: "18px 18px 16px" }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>👋</div>
      <p className="sb-headline" style={{ marginBottom: 4 }}>
        {t.arenaCircleEmptyTitle || "Your circle is quiet"}
      </p>
      <p className="sb-caption" style={{ maxWidth: 280, margin: "0 auto 12px" }}>
        {t.arenaCircleEmptyBody || "Find someone who's building the same habits."}
      </p>
      <button type="button" onClick={onFind} className="sb-tinted-btn press">
        {t.arenaCircleEmptyCta || "Scout players"}
      </button>
    </div>
  );
}

function Champions({ entries, t, meUid, onOpenProfile }) {
  const [first, second, third] = entries;
  const slots = [second, first, third].filter(Boolean);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
        alignItems: "end",
        gap: 8,
        padding: "14px 8px 10px",
        background: "var(--panel-bg)",
        border: "1px solid var(--panel-border)",
        borderRadius: 16,
      }}
    >
      {slots.map((e) => {
        const place = e === first ? 1 : e === second ? 2 : 3;
        const meta = {
          1: { medal: "🥇", accent: "#fbbf24", height: 86 },
          2: { medal: "🥈", accent: "#d1d5db", height: 68 },
          3: { medal: "🥉", accent: "#d97706", height: 54 },
        }[place];
        return (
          <button
            key={e.username}
            type="button"
            onClick={() => onOpenProfile(e.username)}
            className="press"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: 8,
              borderRadius: 12,
              background: "transparent",
              border: "none",
              color: "var(--color-text)",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: place === 1 ? 22 : 18, lineHeight: 1 }}>{meta.medal}</span>
            <StreakFrame streak={e.streak} size={place === 1 ? 52 : 44} ringWidth={3}>
              <Avatar photoUrl={e.photoUrl} displayName={e.displayName} size={place === 1 ? 52 : 44} />
            </StreakFrame>
            <p
              className="sb-body"
              style={{
                fontSize: place === 1 ? 13 : 12,
                fontWeight: 600,
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "center",
                marginTop: -2,
                letterSpacing: "-0.01em",
              }}
            >
              {e.displayName || e.username}
              {e.username === meUid ? ` · ${t.arenaYou || "you"}` : ""}
            </p>
            <div
              style={{
                width: "100%",
                height: meta.height,
                background: `linear-gradient(180deg, ${meta.accent}44, ${meta.accent}10)`,
                border: `1px solid ${meta.accent}66`,
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                gap: 1,
              }}
            >
              <p style={{ fontSize: place === 1 ? 22 : 18, fontWeight: 700, color: meta.accent, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {e.weeklyXp}
              </p>
              <p className="sb-caption" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {t.arenaXp || "XP"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
