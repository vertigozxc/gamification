import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";
import {
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchUserChallenges,
  fetchWeeklyLeaderboard,
  removeFriend,
  respondToFriendRequest,
} from "../../api";
import Avatar from "../social/Avatar";
import StreakFrame from "../social/StreakFrame";
import ProfileScreen from "../social/ProfileScreen";
import ChallengeDetailScreen from "../social/ChallengeDetailScreen";
import CreateChallengeScreen from "../social/CreateChallengeScreen";
import SearchScreen from "../social/SearchScreen";
import Alert from "../social/Alert";
import "../social/ios.css";

let screenIdSeq = 0;
// Mirrors server-side MAX_ACTIVE_CHALLENGES_PER_USER (see server/src/index.js).
// If this ever drifts from the server, create will appear to succeed
// client-side but POST /api/challenges will 409 on submit.
const MAX_ACTIVE_CHALLENGES = 2;

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Weekly leaderboard window on the server runs Mon 00:00 UTC → Sun 23:59 UTC
// (see `currentWeekDayKeys` in server/src/index.js). Reset fires at the next
// Monday 00:00 UTC.
function nextWeekResetMs(nowMs) {
  const d = new Date(nowMs);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(utcMidnight).getUTCDay();
  const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
  return utcMidnight + daysUntilMonday * 86_400_000;
}

function formatResetCountdown(remainingMs, t) {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const day = (n) => (t.communityTimeDays || "{n}d").replace("{n}", String(n));
  const hour = (n) => (t.communityTimeHours || "{n}h").replace("{n}", String(n));
  const min = (n) => (t.communityTimeMins || "{n}m").replace("{n}", String(n));
  if (days > 0) return `${day(days)} ${hour(hours)}`;
  if (hours > 0) return `${hour(hours)} ${min(mins)}`;
  return min(Math.max(1, mins));
}

function formatThousands(n) {
  return Math.floor(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;
  const meUid = String(authUser?.uid || "").slice(0, 128);

  const [tab, setTab] = useState("activity"); // "activity" | "challenges" | "friends"
  const [stack, setStack] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [friends, setFriends] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [createdToday, setCreatedToday] = useState(0);
  const [dailyCreateLimit, setDailyCreateLimit] = useState(2);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const swipeRef = useRef(null);

  const pendingChallengeId =
    typeof window !== "undefined" ? window.__pendingSocialChallengeId || null : null;
  const pendingSubTab =
    typeof window !== "undefined" ? window.__pendingSocialSubTab || null : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pendingSubTab === "challenges") setTab("challenges");
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
      if (ch) {
        setCreatedToday(Number(ch.createdToday || 0));
        setDailyCreateLimit(Number(ch.dailyCreateLimit || 2));
      }
      setRequests(req?.requests || []);
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

  /* ── If a screen is pushed, render ONLY it ── */
  const topEntry = stack.length > 0 ? stack[stack.length - 1] : null;
  if (topEntry) {
    const close = pop;
    return (
      <div
        className="social-block"
        style={{
          minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 40px)",
          padding: "8px 14px",
        }}
      >
        {topEntry.kind === "profile" && (
          <ProfileScreen targetUsername={topEntry.props.targetUsername} meUsername={meUid} t={t} languageId={languageId} onClose={close} onChanged={refresh} />
        )}
        {topEntry.kind === "challenge" && (
          <ChallengeDetailScreen challengeId={topEntry.props.challengeId} authUser={authUser} t={t} onClose={close} onOpenProfile={pushProfile} onChanged={refresh} />
        )}
        {topEntry.kind === "create" && (
          <CreateChallengeScreen authUser={authUser} t={t} onClose={close} onCreated={() => { close(); refresh(); }} />
        )}
        {topEntry.kind === "search" && (
          <SearchScreen meUid={meUid} t={t} onClose={close} onOpenProfile={pushProfile} />
        )}
      </div>
    );
  }

  /* ── Home with 3 tabs ── */
  const now = Date.now();
  // Invites the user hasn't accepted yet — surfaced as a Pending bucket
  // so they don't quietly mix into the active list. An invite only
  // moves to Active once the user taps Accept on the challenge screen.
  const pendingChallenges = challenges.filter((c) => !c.myAcceptedAt && new Date(c.endsAt).getTime() > now);
  const activeChallenges = challenges.filter((c) => c.myAcceptedAt && new Date(c.endsAt).getTime() > now);
  const endedChallenges = challenges.filter((c) => new Date(c.endsAt).getTime() <= now);
  const hitDailyCreate = createdToday >= dailyCreateLimit;
  const hitActiveCap = activeChallenges.length >= MAX_ACTIVE_CHALLENGES;
  const canCreate = !hitActiveCap && !hitDailyCreate;
  // Reason the Create button would block — drives the popup copy.
  const blockReason = hitActiveCap ? "active" : hitDailyCreate ? "daily" : null;

  async function handleRespond(requestId, response) {
    setBusy(true);
    try {
      await respondToFriendRequest(meUid, requestId, response);
      await refresh();
    } finally { setBusy(false); }
  }

  async function doRemove(username) {
    setBusy(true);
    try {
      await removeFriend(meUid, username);
      await refresh();
    } finally { setBusy(false); setConfirmRemove(null); }
  }

  const tabs = [
    { id: "activity", label: t.communityTabActivity || "Activity", icon: "⚡" },
    { id: "challenges", label: t.communityTabChallenges || "Challenges", icon: "⚔️", badge: pendingChallenges.length },
    { id: "friends", label: t.communityTabFriends || "Friends", icon: "🤝", badge: requests.length },
  ];
  const selectedIdx = tabs.findIndex((tb) => tb.id === tab);

  /* Swipe-to-switch between tabs. Thresholds: 40px horizontal, <60px vertical
   * drift, within 700ms. Works with vertical list scrolling because we check
   * only at touchend. */
  const onSwipeStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeRef.current = null; return; }
    const tch = e.touches[0];
    swipeRef.current = { x: tch.clientX, y: tch.clientY, t: Date.now() };
  };
  const onSwipeEnd = (e) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const tch = (e.changedTouches && e.changedTouches[0]) || null;
    if (!tch) return;
    const dx = tch.clientX - s.x;
    const dy = tch.clientY - s.y;
    const dt = Date.now() - s.t;
    if (dt > 700) return;
    if (Math.abs(dx) < 40) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.75) return;
    const dir = dx < 0 ? 1 : -1;
    const next = selectedIdx + dir;
    if (next < 0 || next >= tabs.length) return;
    setTab(tabs[next].id);
  };

  return (
    <div
      className="social-block"
      onTouchStart={onSwipeStart}
      onTouchEnd={onSwipeEnd}
      onTouchCancel={onSwipeEnd}
      style={{
        minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)",
        touchAction: "pan-y",
      }}
    >
      <div style={{ paddingBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <CommunityHero t={t} leaderboard={leaderboard} meUid={meUid} />

        <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* iOS segmented control */}
          <div data-tour="community-tabs" role="tablist" className="cm-tabs" style={{ "--count": tabs.length }}>
            <div
              className="cm-tabs-slider"
              aria-hidden="true"
              style={{ transform: `translateX(${selectedIdx * 100}%)` }}
            />
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={tab === tb.id}
                onClick={() => setTab(tb.id)}
                className="cm-tab"
                data-tour={tb.id === "challenges" ? "cm-challenges" : undefined}
              >
                <span className="cm-tab-ico">{tb.icon}</span>
                <span className="cm-tab-label">{tb.label}</span>
                {tb.badge ? <span className="cm-tab-badge">{tb.badge}</span> : null}
              </button>
            ))}
          </div>

          {loading && !leaderboard ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
              <div className="sb-spinner" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tab === "activity" && (
                <ActivityTab leaderboard={leaderboard} meUid={meUid} t={t} onOpenProfile={pushProfile} />
              )}
              {tab === "challenges" && (
                <ChallengesInlineTab
                  pendingChallenges={pendingChallenges}
                  activeChallenges={activeChallenges}
                  endedChallenges={endedChallenges}
                  canCreate={canCreate}
                  blockReason={blockReason}
                  dailyCreateLimit={dailyCreateLimit}
                  t={t}
                  onOpenChallenge={pushChallenge}
                  onOpenCreate={pushCreate}
                />
              )}
              {tab === "friends" && (
                <FriendsInlineTab
                  friends={friends}
                  requests={requests}
                  busy={busy}
                  t={t}
                  onOpenProfile={pushProfile}
                  onOpenSearch={pushSearch}
                  onRespond={handleRespond}
                  onRemoveRequest={(f) => setConfirmRemove({ username: f.username, displayName: f.displayName || f.username })}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {confirmRemove && (
        <Alert
          icon="🗑"
          title={(t.communityConfirmRemoveTitle || "Remove {name}?").replace("{name}", confirmRemove.displayName)}
          message={t.communityConfirmRemoveBody || "They will disappear from your friends list. You can send a new request later."}
          cancelLabel={t.communityCancel || "Cancel"}
          confirmLabel={t.communityRemove || "Remove"}
          destructive
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => doRemove(confirmRemove.username)}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * Community hero — framed card matching City hero (same width, same frame).
 * Shows weekly reset countdown + the player's rank + XP earned this week.
 * ========================================================================== */

function CommunityHero({ t, leaderboard, meUid }) {
  const users = Array.isArray(leaderboard?.users) ? leaderboard.users : [];
  const meFromList = meUid ? users.find((u) => u.username === meUid) : null;
  const me = leaderboard?.me || meFromList || null;
  const myRank = me?.rank ?? null;
  const totalRanked = Number(leaderboard?.totalRanked) || 0;
  const totalWeeklyXp = Number(leaderboard?.totalWeeklyXp) || 0;

  const now = useNow(60_000);
  const resetAt = nextWeekResetMs(now);
  const countdown = formatResetCountdown(resetAt - now, t);

  return (
    <div className="city-hero-surface mobile-card top-screen-block p-4">
      <div className="relative z-10">
        <h3
          className="cinzel text-[1.35rem] font-bold tracking-wide leading-tight m-0"
          style={{ color: "var(--color-primary)" }}
        >
          {t.communityTitle || "Community"}
        </h3>
        <p
          className="text-xs leading-relaxed mt-2 mb-0"
          style={{ color: "var(--color-text)", opacity: 0.88 }}
        >
          <span style={{ opacity: 0.72 }}>{t.communityWeekResetLabel || "Week resets in"} </span>
          <span style={{ color: "var(--color-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {countdown}
          </span>
        </p>
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
        <div className="community-kpi-tile">
          <p className="community-kpi-label">
            {t.communityYourRankLabel || "Your rank"}
          </p>
          <p
            className="cinzel community-kpi-value"
            style={{ color: "var(--color-primary)" }}
          >
            {myRank ? `#${myRank}` : (t.communityUnranked || "—")}
          </p>
          {myRank && totalRanked > 0 ? (
            <p className="community-kpi-sub">
              {(t.communityRankOfPlayers || "of {total}").replace("{total}", formatThousands(totalRanked))}
            </p>
          ) : null}
        </div>

        <div className="community-kpi-tile">
          <p className="community-kpi-label">
            {t.communityEarnedByAllLabel || "Community earned"}
          </p>
          <p
            className="cinzel community-kpi-value"
            style={{ color: "var(--color-primary)" }}
          >
            ⚡ {formatThousands(totalWeeklyXp)}
            <span style={{ fontSize: "0.65em", fontWeight: 700, marginLeft: 4, opacity: 0.75 }}>XP</span>
          </p>
          <p className="community-kpi-sub">
            {t.communityEarnedByAllHint || "this week"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Activity tab — weekly leaderboard (top by XP)
 * ========================================================================== */

function ActivityTab({ leaderboard, meUid, t, onOpenProfile }) {
  const users = leaderboard?.users || [];
  const me = leaderboard?.me || null;
  const meInShown = me ? users.some((u) => u.username === me.username) : false;

  if (users.length === 0) {
    return (
      <div className="cm-empty">
        <div className="cm-empty-icon">⚡</div>
        <p className="cm-empty-title">{t.communityActivityEmptyTitle || "No active players this week"}</p>
        <p className="cm-empty-body">{t.communityActivityEmptyBody || "Complete any daily task and you'll appear on the leaderboard."}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="cm-section-lead">
        {t.communityActivityLead || "Players ranked by XP earned this week."}
      </p>

      <div className="cm-list">
        {users.map((u) => (
          <PlayerRow key={u.username} entry={u} isMe={u.username === meUid} t={t} onOpenProfile={onOpenProfile} />
        ))}
      </div>

      {me && !meInShown && (
        <>
          <h3 className="cm-section-label">{t.communityYourRank || "Your rank"}</h3>
          <div className="cm-list">
            <PlayerRow entry={me} isMe meHighlight t={t} onOpenProfile={onOpenProfile} />
          </div>
        </>
      )}
    </div>
  );
}

function PlayerRow({ entry, isMe, meHighlight, t, onOpenProfile }) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(entry.username)}
      className="cm-row press"
      style={{
        background: meHighlight
          ? "rgba(var(--color-primary-rgb,251,191,36),0.14)"
          : isMe
            ? "rgba(var(--color-primary-rgb,251,191,36),0.06)"
            : "transparent",
      }}
    >
      <span className="cm-row-rank" style={{ color: entry.rank && entry.rank <= 3 ? "var(--color-primary)" : "var(--color-muted)" }}>
        {entry.rank ? entry.rank : "—"}
      </span>
      <StreakFrame streak={entry.streak} size={40} ringWidth={2}>
        <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={40} />
      </StreakFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="cm-row-name">
          {entry.displayName || entry.username}
          {isMe && <span style={{ color: "var(--color-primary)", fontWeight: 600 }}> · {t.communityYou || "you"}</span>}
        </p>
        <p className="cm-row-meta">
          <span>{t.communityLvl || "Lv"} {entry.level}</span>
          <span>🔥 {entry.streak}</span>
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p className="cm-row-xp">{entry.weeklyXp}</p>
        <p className="cm-row-xp-label">XP</p>
      </div>
    </button>
  );
}

/* ============================================================================
 * Challenges tab
 * ========================================================================== */

function ChallengesInlineTab({ pendingChallenges = [], activeChallenges, endedChallenges, canCreate, blockReason, dailyCreateLimit = 2, t, onOpenChallenge, onOpenCreate }) {
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="cm-intro">
        <p className="cm-intro-title">{t.communityChallengesIntroTitle || "Group challenges"}</p>
        <p className="cm-intro-body">
          {t.communityChallengesIntroBody || "Team up with a friend on a daily habit. Every completion earns a token for every participant. Up to 3 active challenges."}
        </p>
      </div>

      {activeChallenges.length === 0 && endedChallenges.length === 0 && pendingChallenges.length === 0 && (
        <div className="cm-empty">
          <div className="cm-empty-icon">⚔️</div>
          <p className="cm-empty-title">{t.communityChallengesEmptyTitle || "No group challenges yet"}</p>
        </div>
      )}

      {pendingChallenges.length > 0 && (
        <>
          <h3 className="cm-section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--color-primary)" }}>●</span>
            {t.communityPending || "Pending invites"}
            <span
              style={{
                fontSize: 10,
                padding: "1px 7px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--color-primary) 22%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
                color: "var(--color-primary)",
                fontWeight: 800,
                letterSpacing: "0.06em"
              }}
            >
              {pendingChallenges.length}
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingChallenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} t={t} onOpen={() => onOpenChallenge(c.id)} pending />
            ))}
          </div>
        </>
      )}

      {activeChallenges.length > 0 && (
        <>
          <h3 className="cm-section-label">{t.communityActive || "Active"}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeChallenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} t={t} onOpen={() => onOpenChallenge(c.id)} />
            ))}
          </div>
        </>
      )}

      {endedChallenges.length > 0 && (
        <>
          <h3 className="cm-section-label">{t.communityRecentlyEnded || "Recently ended"}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {endedChallenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} ended t={t} onOpen={() => onOpenChallenge(c.id)} />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          if (canCreate) {
            onOpenCreate?.();
          } else {
            setShowLimitAlert(true);
          }
        }}
        className="cm-primary-btn press"
        style={{ marginTop: 4, opacity: canCreate ? 1 : 0.9 }}
      >
        ＋ {t.communityCreateChallenge || "Create challenge"}
      </button>

      {showLimitAlert && (
        <Alert
          icon={blockReason === "daily" ? "⏳" : "🚧"}
          title={blockReason === "daily"
            ? (t.arenaPactDailyLimitTitle || "Daily limit reached")
            : (t.arenaPactLimitTitle || "Max challenges reached")}
          message={blockReason === "daily"
            ? (t.arenaPactDailyLimitBody || "You can start up to {max} group challenges per day. Come back tomorrow — the counter resets at midnight UTC.").replace("{max}", String(dailyCreateLimit))
            : (t.arenaPactLimitBody || "You can run up to {max} group challenges at once. Finish or leave one to start a new pact.").replace("{max}", String(MAX_ACTIVE_CHALLENGES))}
          confirmLabel={t.arenaPactLimitConfirm || "Got it"}
          onConfirm={() => setShowLimitAlert(false)}
        />
      )}
    </div>
  );
}

function ChallengeCard({ challenge: c, ended, pending, t, onOpen }) {
  const total = Math.max(1, Number(c.durationDays) || 1);
  const end = new Date(c.endsAt).getTime();
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  // Progress bar now tracks the GROUP completion counter, not calendar
  // elapsed days — so a challenge where people kept skipping stays at
  // a low % even if half the duration has passed.
  const groupDays = Math.max(0, Math.min(total, Number(c.groupDaysCompleted) || 0));
  const pct = Math.round((groupDays / total) * 100);
  const today = todayKey();
  const doneToday = c.myLastCompletionDayKey === today;
  const participants = (c.participants || []).filter((p) => !p.leftAt);
  const acceptedParticipants = participants.filter((p) => p.acceptedAt);
  const allDoneToday = acceptedParticipants.length >= 2
    && acceptedParticipants.every((p) => p.lastCompletionDayKey === today);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="cm-challenge press"
      style={{ opacity: ended ? 0.7 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p className="cm-challenge-title">{c.title}</p>
        {pending ? (
          <span
            className="cm-pill"
            style={{
              flexShrink: 0,
              background: "color-mix(in srgb, var(--color-primary) 22%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
              color: "var(--color-primary)",
              fontWeight: 800
            }}
          >
            ✉ {t.communityInviteBadge || "invite"}
          </span>
        ) : (
          <span className={`cm-pill ${ended ? "" : "cm-pill-accent"}`} style={{ flexShrink: 0 }}>
            {ended ? (t.communityEnded || "ended") : (t.communityDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
          </span>
        )}
      </div>
      <p className="cm-challenge-quest">🎯 {c.questTitle}</p>

      {/* Completion progress bar (group days / total days) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11 }}>
        <span className="cm-caption">
          {t.communityCompletion || "Completion"} · {groupDays}/{total}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            color: allDoneToday ? "#6ee7b7" : "var(--color-muted)"
          }}
        >
          {pct}%
        </span>
      </div>
      <div className="cm-progress">
        <div
          className={`cm-progress-fill${allDoneToday ? " done" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex" }}>
          {participants.slice(0, 5).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--panel-bg)", background: "var(--panel-bg)" }}>
              <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={20} />
            </div>
          ))}
        </div>
        <span className="cm-caption">{participants.length} {t.communityPlayers || "players"}</span>
        {!ended && !pending ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <MiniBadge
              ok={doneToday}
              okLabel={t.communityYouDone || "you ✓"}
              nokLabel={t.communityYouPending || "you ·"}
            />
            <MiniBadge
              ok={allDoneToday}
              okLabel={t.communityAllDone || "all ✓"}
              nokLabel={t.communityAllPending || "all ·"}
              green
            />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function MiniBadge({ ok, okLabel, nokLabel, green = false }) {
  const bg = ok
    ? (green ? "color-mix(in srgb, #10b981 22%, transparent)" : "color-mix(in srgb, var(--color-primary) 22%, transparent)")
    : "rgba(148,163,184,0.14)";
  const border = ok
    ? (green ? "rgba(16,185,129,0.5)" : "color-mix(in srgb, var(--color-primary) 55%, transparent)")
    : "var(--card-border-idle)";
  const color = ok
    ? (green ? "#6ee7b7" : "var(--color-primary)")
    : "var(--color-muted)";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        padding: "2px 7px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap"
      }}
    >
      {ok ? okLabel : nokLabel}
    </span>
  );
}

/* ============================================================================
 * Friends tab
 * ========================================================================== */

function FriendsInlineTab({ friends, requests, busy, t, onOpenProfile, onOpenSearch, onRespond, onRemoveRequest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="cm-intro">
        <p className="cm-intro-title">{t.communityFriendsIntroTitle || "Your friends"}</p>
        <p className="cm-intro-body">
          {t.communityFriendsIntroBody || "Friends help you stay accountable — you can see their streaks, cheer their wins, and invite them to group challenges."}
        </p>
      </div>

      {requests.length > 0 && (
        <>
          <h3 className="cm-section-label">
            📬 {t.communityRequests || "Friend requests"} ({requests.length})
          </h3>
          <div className="cm-list">
            {requests.map((r) => (
              <RequestRow
                key={r.requestId}
                request={r}
                busy={busy}
                t={t}
                onOpenProfile={onOpenProfile}
                onRespond={onRespond}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onOpenSearch}
        className="cm-find-friend press"
        aria-label={t.communityAddFriend || "Add a friend"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 8.5v5M8.5 11h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>{t.communityFindFriend || "Find a friend"}</span>
      </button>

      <h3 className="cm-section-label">
        🤝 {t.communityFriends || "Friends"} ({friends.length})
      </h3>

      {friends.length === 0 ? (
        <div className="cm-empty">
          <div className="cm-empty-icon">🌱</div>
          <p className="cm-empty-title">{t.communityFriendsEmptyTitle || "No friends yet"}</p>
        </div>
      ) : (
        <div className="cm-list">
          {friends.map((f) => (
            <FriendRow
              key={f.username}
              friend={f}
              busy={busy}
              t={t}
              onOpenProfile={onOpenProfile}
              onRemove={() => onRemoveRequest(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request: r, busy, t, onOpenProfile, onRespond }) {
  return (
    <div className="cm-row">
      <button type="button" onClick={() => onOpenProfile(r.from.username)} className="press" style={btnReset}>
        <StreakFrame streak={r.from.streak} size={40} ringWidth={2}>
          <Avatar photoUrl={r.from.photoUrl} displayName={r.from.displayName} size={40} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="press"
        style={{ ...btnReset, flex: 1, minWidth: 0, textAlign: "left", padding: "4px 6px", borderRadius: 8 }}
      >
        <p className="cm-row-name">{r.from.displayName || r.from.username}</p>
        <p className="cm-row-meta">
          <span>{t.communityLvl || "Lv"} {r.from.level}</span>
          <span>🔥 {r.from.streak}</span>
        </p>
      </button>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button type="button" disabled={busy} onClick={() => onRespond(r.requestId, "accept")} className="press" style={circleBtn("accept")} aria-label={t.communityAccept || "Accept"}>✓</button>
        <button type="button" disabled={busy} onClick={() => onRespond(r.requestId, "decline")} className="press" style={circleBtn("decline")} aria-label={t.communityDecline || "Decline"}>✕</button>
      </div>
    </div>
  );
}

function FriendRow({ friend: f, busy, t, onOpenProfile, onRemove }) {
  return (
    <div className="cm-row">
      <button type="button" onClick={() => onOpenProfile(f.username)} className="press" style={btnReset}>
        <StreakFrame streak={f.streak} size={40} ringWidth={2}>
          <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={40} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(f.username)}
        className="press"
        style={{ ...btnReset, flex: 1, minWidth: 0, textAlign: "left", padding: "4px 6px", borderRadius: 8 }}
      >
        <p className="cm-row-name">{f.displayName || f.username}</p>
        <p className="cm-row-meta">
          <span>{t.communityLvl || "Lv"} {f.level}</span>
          <span>🔥 {f.streak}</span>
          {typeof f.weeklyXp === "number" && <span>⚡ {f.weeklyXp}</span>}
        </p>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="cm-remove-friend"
        aria-label={t.communityRemove || "Remove"}
      >
        ✕
      </button>
    </div>
  );
}

const btnReset = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "var(--color-text)",
  fontFamily: "inherit",
  cursor: "pointer",
};

function circleBtn(kind) {
  const isAccept = kind === "accept";
  return {
    width: 34,
    height: 34,
    borderRadius: "50%",
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    background: isAccept ? "rgba(48,209,88,0.18)" : "rgba(255,69,58,0.14)",
    color: isAccept ? "#30d158" : "#ff6a63",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
