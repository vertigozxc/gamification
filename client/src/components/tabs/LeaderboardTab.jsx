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
const MAX_ACTIVE_CHALLENGES = 3;

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;
  const meUid = String(authUser?.uid || "").slice(0, 128);

  const [tab, setTab] = useState("activity"); // "activity" | "challenges" | "friends"
  const [stack, setStack] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [friends, setFriends] = useState([]);
  const [challenges, setChallenges] = useState([]);
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
  const activeChallenges = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const endedChallenges = challenges.filter((c) => new Date(c.endsAt).getTime() <= now);
  const canCreate = activeChallenges.length < MAX_ACTIVE_CHALLENGES;

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
    { id: "challenges", label: t.communityTabChallenges || "Challenges", icon: "⚔️" },
    { id: "friends", label: t.communityTabFriends || "Friends", icon: "🤝", badge: requests.length },
  ];
  const selectedIdx = tabs.findIndex((tb) => tb.id === tab);

  /* Swipe-to-switch between tabs (iOS-native feel) */
  const onSwipeStart = (e) => {
    const tch = e.touches ? e.touches[0] : e;
    swipeRef.current = { x: tch.clientX, y: tch.clientY, t: Date.now(), moved: false, locked: null };
  };
  const onSwipeMove = (e) => {
    const s = swipeRef.current;
    if (!s) return;
    const tch = e.touches ? e.touches[0] : e;
    const dx = tch.clientX - s.x;
    const dy = tch.clientY - s.y;
    if (s.locked == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      s.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  };
  const onSwipeEnd = (e) => {
    const s = swipeRef.current;
    if (!s) return;
    swipeRef.current = null;
    const tch = e.changedTouches ? e.changedTouches[0] : e;
    const dx = tch.clientX - s.x;
    const dy = tch.clientY - s.y;
    const dt = Date.now() - s.t;
    if (s.locked !== "x") return;
    if (Math.abs(dx) < 50 || Math.abs(dy) > 70 || dt > 600) return;
    const dir = dx < 0 ? 1 : -1;
    const next = selectedIdx + dir;
    if (next < 0 || next >= tabs.length) return;
    setTab(tabs[next].id);
  };

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <div style={{ padding: "10px 14px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Title */}
        <header style={{ padding: "4px 2px 0" }}>
          <h1 className="cinzel sb-title-xl" style={{
            fontFamily: "var(--font-heading)",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            background: "var(--heading-gradient)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
          }}>
            {t.communityTitle || "Community"}
          </h1>
        </header>

        {/* Big tab switcher */}
        <div role="tablist" className="cm-tabs">
          <div
            className="cm-tabs-slider"
            aria-hidden="true"
            style={{
              width: `calc((100% - 8px) / ${tabs.length})`,
              transform: `translateX(calc(100% * ${selectedIdx}))`,
            }}
          />
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className="cm-tab press"
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
          <div
            onTouchStart={onSwipeStart}
            onTouchMove={onSwipeMove}
            onTouchEnd={onSwipeEnd}
            style={{ display: "flex", flexDirection: "column", gap: 12, touchAction: "pan-y" }}
          >
            {tab === "activity" && (
              <ActivityTab leaderboard={leaderboard} meUid={meUid} t={t} onOpenProfile={pushProfile} />
            )}
            {tab === "challenges" && (
              <ChallengesInlineTab
                activeChallenges={activeChallenges}
                endedChallenges={endedChallenges}
                canCreate={canCreate}
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

function ChallengesInlineTab({ activeChallenges, endedChallenges, canCreate, t, onOpenChallenge, onOpenCreate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="cm-intro">
        <p className="cm-intro-title">{t.communityChallengesIntroTitle || "Group challenges"}</p>
        <p className="cm-intro-body">
          {t.communityChallengesIntroBody || "Team up with a friend on a daily habit. Every completion earns a token for every participant. Up to 3 active challenges."}
        </p>
      </div>

      {activeChallenges.length === 0 && endedChallenges.length === 0 && (
        <div className="cm-empty">
          <div className="cm-empty-icon">⚔️</div>
          <p className="cm-empty-title">{t.communityChallengesEmptyTitle || "No group challenges yet"}</p>
        </div>
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
        disabled={!canCreate}
        onClick={onOpenCreate}
        className="cm-primary-btn press"
        style={{ marginTop: 4 }}
      >
        ＋ {canCreate
          ? (t.communityCreateChallenge || "Create challenge")
          : (t.communityChallengesFull || "3 active · limit reached")}
      </button>
    </div>
  );
}

function ChallengeCard({ challenge: c, ended, t, onOpen }) {
  const total = Math.max(1, Number(c.durationDays) || 1);
  const start = new Date(c.startedAt).getTime();
  const end = new Date(c.endsAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const pct = Math.round((elapsed / total) * 100);
  const done = c.myLastCompletionDayKey === todayKey();
  const participants = (c.participants || []).filter((p) => !p.leftAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="cm-challenge press"
      style={{ opacity: ended ? 0.7 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p className="cm-challenge-title">{c.title}</p>
        <span className={`cm-pill ${ended ? "" : "cm-pill-accent"}`} style={{ flexShrink: 0 }}>
          {ended ? (t.communityEnded || "ended") : (t.communityDaysLeft || "{n}d left").replace("{n}", String(daysLeft))}
        </span>
      </div>
      <p className="cm-challenge-quest">🎯 {c.questTitle}</p>
      <div className="cm-progress">
        <div className={`cm-progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
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
        {!ended && (
          <span className={`cm-pill ${done ? "cm-pill-success" : ""}`} style={{ marginLeft: "auto" }}>
            {done ? `✓ ${t.communityDone || "today"}` : `🔥 ${c.myConsecutiveDays || 0}`}
          </span>
        )}
      </div>
    </button>
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

      <button type="button" onClick={onOpenSearch} className="cm-primary-btn press" style={{ marginTop: 4 }}>
        ＋ {t.communityAddFriend || "Add a friend"}
      </button>
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
        className="press"
        aria-label={t.communityRemove || "Remove"}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid var(--card-border-idle, rgba(255,255,255,0.12))",
          color: "var(--color-muted)",
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
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
