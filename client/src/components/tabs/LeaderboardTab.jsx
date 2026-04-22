import { useCallback, useEffect, useState } from "react";
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
const MAX_ACTIVE_PACTS = 3;

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

  const pendingChallengeId =
    typeof window !== "undefined" ? window.__pendingSocialChallengeId || null : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.__pendingSocialSubTab = null; } catch {}
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
    const h = () => refresh();
    window.addEventListener("social:refresh-challenges", h);
    return () => window.removeEventListener("social:refresh-challenges", h);
  }, [refresh]);

  /* nav */
  const push = useCallback((entry) => setStack((s) => [...s, { id: `s-${++screenIdSeq}`, ...entry }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const pushProfile = (u) => push({ kind: "profile", props: { targetUsername: u } });
  const pushChallenge = (id) => push({ kind: "challenge", props: { challengeId: id } });
  const pushCreate = () => push({ kind: "create", props: {} });
  const pushSearch = () => push({ kind: "search", props: {} });
  const pushFullBoard = () => push({ kind: "leaderboard", props: {} });
  const pushFullFriends = () => push({ kind: "friends", props: {} });
  const pushFullPacts = () => push({ kind: "pacts", props: {} });

  const now = Date.now();
  const activePacts = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const myRank = leaderboard?.me?.rank ?? null;
  const totalRanked = leaderboard?.totalRanked ?? 0;
  const weeklyXp = leaderboard?.me?.weeklyXp ?? 0;
  const myStreak = leaderboard?.me?.streak ?? 0;
  const topFive = (leaderboard?.users || []).slice(0, 5);

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <div style={{ padding: "10px 14px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* ── Large title ── */}
        <header className="hh-title-strip">
          <p className="hh-eyebrow">{t.hallEyebrow || "Guild"}</p>
          <h1 className="cinzel hh-title">{t.hallTitle || "Heroes' Hall"}</h1>
          <p className="hh-lede">{t.hallLede || "The road is better with company at your side."}</p>
        </header>

        {loading && !leaderboard ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : (
          <>
            {/* ── Hero rank ribbon ── */}
            <RankRibbon
              rank={myRank}
              total={totalRanked}
              xp={weeklyXp}
              streak={myStreak}
              t={t}
              onOpen={pushFullBoard}
            />

            {/* ── Quick actions ── */}
            <div className="hh-quick-row">
              <button type="button" onClick={pushCreate} className="hh-quick-btn press">
                <div className="hh-quick-ico">⚔️</div>
                <div className="hh-quick-label">{t.hallActionPact || "Forge a quest"}</div>
                <div className="hh-quick-hint">{t.hallActionPactHint || "Pick a habit, invite allies"}</div>
              </button>
              <button type="button" onClick={pushSearch} className="hh-quick-btn press">
                <div className="hh-quick-ico">🔎</div>
                <div className="hh-quick-label">{t.hallActionScout || "Find a hero"}</div>
                <div className="hh-quick-hint">{t.hallActionScoutHint || "Search by name"}</div>
              </button>
            </div>

            {/* ── Incoming requests ── */}
            {requestCount > 0 && (
              <button type="button" className="hh-banner press" onClick={pushFullFriends}>
                <span className="hh-banner-dot" aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hh-banner-title">
                    {(t.hallRequestsTitle || "{n} hero wants to join you").replace("{n}", String(requestCount))}
                  </div>
                  <div className="hh-banner-sub">{t.hallRequestsSub || "Tap to review and answer"}</div>
                </div>
                <span style={{ color: "var(--color-muted)", fontSize: 20 }}>›</span>
              </button>
            )}

            {/* ── Champions this week ── */}
            <section className="hh-section">
              <div className="hh-section-head">
                <h2 className="cinzel hh-section-title">
                  {t.hallChampionsTitle || "Champions this week"}
                  {totalRanked > 0 && <span className="count">· {totalRanked}</span>}
                </h2>
                {topFive.length > 0 && (
                  <button type="button" className="hh-section-action press" onClick={pushFullBoard} aria-label={t.hallOpenBoard || "Open board"}>
                    ›
                  </button>
                )}
              </div>
              <div className="hh-divider" />
              {topFive.length === 0 ? (
                <EmptyChampions t={t} />
              ) : (
                <div className="hh-podium">
                  {topFive.map((u, i) => (
                    <PodiumRow
                      key={u.username}
                      rank={u.rank ?? i + 1}
                      user={u}
                      isMe={u.username === meUid}
                      t={t}
                      onClick={() => pushProfile(u.username)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Your allies ── */}
            <section className="hh-section">
              <div className="hh-section-head">
                <h2 className="cinzel hh-section-title">
                  {t.hallAlliesTitle || "Your allies"}
                  {friends.length > 0 && <span className="count">· {friends.length}</span>}
                </h2>
                {friends.length > 0 && (
                  <button type="button" className="hh-section-action press" onClick={pushFullFriends} aria-label={t.hallOpenAllies || "Open allies"}>
                    ›
                  </button>
                )}
              </div>
              <div className="hh-divider" />
              {friends.length === 0 ? (
                <EmptyAllies t={t} onFind={pushSearch} />
              ) : (
                <div className="hh-allies">
                  {friends.slice(0, 5).map((f) => (
                    <AllyRow key={f.username} friend={f} t={t} onClick={() => pushProfile(f.username)} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Active pacts ── */}
            <section className="hh-section">
              <div className="hh-section-head">
                <h2 className="cinzel hh-section-title">
                  {t.hallPactsTitle || "Co-op quests"}
                  {activePacts.length > 0 && <span className="count">· {activePacts.length}</span>}
                </h2>
                {activePacts.length > 0 && (
                  <button type="button" className="hh-section-action press" onClick={pushFullPacts} aria-label={t.hallOpenPacts || "Open pacts"}>
                    ›
                  </button>
                )}
              </div>
              <div className="hh-divider" />
              {activePacts.length === 0 ? (
                <EmptyPacts t={t} onStart={pushCreate} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activePacts.slice(0, 3).map((c) => (
                    <PactCard key={c.id} challenge={c} t={t} onClick={() => pushChallenge(c.id)} />
                  ))}
                  {activePacts.length < MAX_ACTIVE_PACTS && (
                    <button type="button" onClick={pushCreate} className="sb-tinted-btn press" style={{ padding: 12 }}>
                      ＋ {t.hallForgeAnother || "Forge another"}
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Stack */}
      {stack.map((entry, idx) => {
        if (idx !== stack.length - 1) return null;
        const close = pop;
        if (entry.kind === "profile") {
          return <ProfileScreen key={entry.id} targetUsername={entry.props.targetUsername} meUsername={meUid} t={t} languageId={languageId} onClose={close} onChanged={refresh} />;
        }
        if (entry.kind === "challenge") {
          return <ChallengeDetailScreen key={entry.id} challengeId={entry.props.challengeId} authUser={authUser} t={t} onClose={close} onOpenProfile={pushProfile} onChanged={refresh} />;
        }
        if (entry.kind === "create") {
          return <CreateChallengeScreen key={entry.id} authUser={authUser} t={t} onClose={close} onCreated={() => { close(); refresh(); }} />;
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
        if (entry.kind === "pacts") {
          return <ChallengesListScreen key={entry.id} authUser={authUser} t={t} challenges={challenges} onClose={close} onOpenChallenge={pushChallenge} onOpenCreate={pushCreate} />;
        }
        return null;
      })}
    </div>
  );
}

/* ============================================================================
 * Home subcomponents
 * ========================================================================== */

function RankRibbon({ rank, total, xp, streak, t, onOpen }) {
  const hasRank = rank != null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hh-rank press"
      style={{ border: "1px solid color-mix(in srgb, var(--color-primary) 36%, transparent)", width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}
    >
      <p className="hh-rank-eyebrow">{t.hallRankEyebrow || "Your week standing"}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="hh-rank-number">{hasRank ? `#${rank}` : "—"}</span>
        <span className="hh-rank-context">
          {hasRank
            ? (t.hallRankContext || "of {n} heroes").replace("{n}", String(total || 1))
            : (t.hallRankContextUnranked || "start a quest to enter the board")}
        </span>
      </div>
      <div className="hh-rank-hr" />
      <div className="hh-rank-stats">
        <div>
          <p className="hh-rank-stat-label">{t.hallWeekXp || "Week XP"}</p>
          <p className="hh-rank-stat-value">⚡ {xp}</p>
        </div>
        <div>
          <p className="hh-rank-stat-label">{t.hallStreak || "Streak"}</p>
          <p className="hh-rank-stat-value">🔥 {streak}</p>
        </div>
      </div>
    </button>
  );
}

function PodiumRow({ rank, user, isMe, t, onClick }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hh-podium-row press"
      style={{ background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.08)" : "transparent" }}
    >
      <span
        className="hh-podium-rank"
        style={{ color: rank <= 3 ? "var(--color-primary)" : "var(--color-muted)" }}
      >
        {medal || rank}
      </span>
      <StreakFrame streak={user.streak} size={38} ringWidth={2}>
        <Avatar photoUrl={user.photoUrl} displayName={user.displayName} size={38} />
      </StreakFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="hh-podium-name">
          {user.displayName || user.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.hallYou || "you"}</span>}
        </p>
        <p className="hh-podium-meta" style={{ display: "flex", gap: 8 }}>
          <span>{t.hallLvlShort || "Lv"} {user.level}</span>
          <span>🔥 {user.streak}</span>
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p className="hh-podium-xp">{user.weeklyXp}</p>
        <p className="hh-podium-xp-label">{t.hallXp || "XP"}</p>
      </div>
    </button>
  );
}

function AllyRow({ friend: f, t, onClick }) {
  return (
    <button type="button" onClick={onClick} className="hh-ally-row press">
      <StreakFrame streak={f.streak} size={42} ringWidth={2}>
        <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={42} />
      </StreakFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {f.displayName || f.username}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-muted)", display: "flex", gap: 8, marginTop: 2 }}>
          <span>{t.hallLvlShort || "Lv"} {f.level}</span>
          <span>🔥 {f.streak}</span>
          {typeof f.weeklyXp === "number" && <span>⚡ {f.weeklyXp}</span>}
        </p>
      </div>
      <span style={{ color: "var(--color-muted)", fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}

function PactCard({ challenge: c, t, onClick }) {
  const total = Math.max(1, Number(c.durationDays) || 1);
  const start = new Date(c.startedAt).getTime();
  const end = new Date(c.endsAt).getTime();
  const elapsed = Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const pct = Math.round((elapsed / total) * 100);
  const done = c.myLastCompletionDayKey === todayKey();
  const participants = (c.participants || []).filter((p) => !p.leftAt);

  return (
    <button type="button" onClick={onClick} className="hh-pact press">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p className="hh-pact-title">{c.title}</p>
        <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
          {(t.hallDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
        </span>
      </div>
      <p className="hh-pact-quest">🎯 {c.questTitle}</p>
      <div className="sb-progress">
        <div className={`sb-progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex" }}>
          {participants.slice(0, 5).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--panel-bg)", background: "var(--panel-bg)" }}>
              <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={22} />
            </div>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
          {elapsed}/{total} {t.hallDayMany || "days"}
        </span>
        <span
          className={`sb-pill ${done ? "sb-pill-success" : ""}`}
          style={{ marginLeft: "auto" }}
        >
          {done ? `✓ ${t.hallDone || "today"}` : `🔥 ${c.myConsecutiveDays || 0}`}
        </span>
      </div>
    </button>
  );
}

/* ---------- Empty-state cards --------------------------------------------- */

function EmptyChampions({ t }) {
  return (
    <div className="hh-empty">
      <div className="hh-empty-icon">🏔</div>
      <p className="hh-empty-title">{t.hallChampionsEmptyTitle || "The board is empty"}</p>
      <p className="hh-empty-body">{t.hallChampionsEmptyBody || "Complete a daily quest to claim a spot this week."}</p>
    </div>
  );
}

function EmptyAllies({ t, onFind }) {
  return (
    <div className="hh-empty">
      <div className="hh-empty-icon">🤝</div>
      <p className="hh-empty-title">{t.hallAlliesEmptyTitle || "Traveling alone"}</p>
      <p className="hh-empty-body">{t.hallAlliesEmptyBody || "Invite a friend by name and bring them along."}</p>
      <button type="button" onClick={onFind} className="sb-tinted-btn press">
        {t.hallAlliesEmptyCta || "Find a hero"}
      </button>
    </div>
  );
}

function EmptyPacts({ t, onStart }) {
  return (
    <div className="hh-empty">
      <div className="hh-empty-icon">⚔️</div>
      <p className="hh-empty-title">{t.hallPactsEmptyTitle || "No co-op quests yet"}</p>
      <p className="hh-empty-body">{t.hallPactsEmptyBody || "Team up on a daily habit. Every tick earns a token for the whole party."}</p>
      <button type="button" onClick={onStart} className="sb-tinted-btn press">
        {t.hallPactsEmptyCta || "Forge your first quest"}
      </button>
    </div>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
