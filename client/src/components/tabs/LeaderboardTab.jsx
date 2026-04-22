import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext";
import WeeklyLeaderboard from "../social/WeeklyLeaderboard";
import FriendsTab from "../social/FriendsTab";
import ChallengesTab from "../social/ChallengesTab";
import ProfileScreen from "../social/ProfileScreen";
import ChallengeDetailScreen from "../social/ChallengeDetailScreen";
import CreateChallengeScreen from "../social/CreateChallengeScreen";
import { fetchIncomingFriendRequests } from "../../api";
import "../social/ios.css";

let screenIdSeq = 0;

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;

  const pendingSubTab = (typeof window !== "undefined" && window.__pendingSocialSubTab) || null;
  const pendingChallengeId = (typeof window !== "undefined" && window.__pendingSocialChallengeId) || null;

  const [subTab, setSubTab] = useState(pendingSubTab || "weekly");
  const [requestCount, setRequestCount] = useState(0);
  // Stack of screens; top of stack is visible. Each entry: { id, kind, props }
  const [stack, setStack] = useState([]);

  const meUid = String(authUser?.uid || "").slice(0, 128);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.__pendingSocialSubTab = null; } catch {}

    if (pendingChallengeId) {
      try { window.__pendingSocialChallengeId = null; } catch {}
      // Push challenge detail after initial render
      setTimeout(() => pushChallengeDetail(pendingChallengeId), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    function tick() {
      if (!meUid) return;
      fetchIncomingFriendRequests(meUid)
        .then((d) => { if (!cancelled) setRequestCount((d?.requests || []).length); })
        .catch(() => {});
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [meUid]);

  function pushScreen(entry) {
    setStack((prev) => [...prev, { id: `s-${++screenIdSeq}`, ...entry }]);
  }
  function popScreen() {
    setStack((prev) => prev.slice(0, -1));
  }

  function pushProfile(username) {
    pushScreen({ kind: "profile", props: { targetUsername: username } });
  }
  function pushChallengeDetail(challengeId) {
    pushScreen({ kind: "challenge", props: { challengeId } });
  }
  function pushCreateChallenge() {
    pushScreen({ kind: "create", props: {} });
  }

  const tabs = [
    { id: "weekly", label: t.socialTabWeekly || "Active", icon: "🔥" },
    { id: "challenges", label: t.socialTabChallenges || "Challenges", icon: "⚔️" },
    { id: "friends", label: t.socialTabFriends || "Friends", icon: "🤝", badge: requestCount },
  ];
  const selectedIdx = tabs.findIndex((tab) => tab.id === subTab);

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
        {/* Large title */}
        <div style={{ padding: "4px 2px 0" }}>
          <p className="subhead" style={{ fontWeight: 600, color: "var(--color-primary)", letterSpacing: 0 }}>
            {t.socialHeroKicker || "Community"}
          </p>
          <h1 className="title-large" style={{ marginTop: 2 }}>
            {t.socialHeroTitle || "Social"}
          </h1>
        </div>

        {/* Segmented control with sliding indicator */}
        <div role="tablist" className="segmented" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          <div
            className="segmented-slider"
            style={{
              width: `calc((100% - 6px) / ${tabs.length})`,
              transform: `translateX(calc(100% * ${selectedIdx}))`,
            }}
            aria-hidden="true"
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              onClick={() => setSubTab(tab.id)}
              className="segmented-option press"
            >
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge ? <span className="badge" style={{ marginLeft: 2 }}>{tab.badge}</span> : null}
            </button>
          ))}
        </div>

        {subTab === "weekly" && (
          <WeeklyLeaderboard authUser={authUser} t={t} languageId={languageId} onOpenProfile={pushProfile} />
        )}
        {subTab === "challenges" && (
          <ChallengesTab
            authUser={authUser}
            t={t}
            onOpenChallenge={pushChallengeDetail}
            onOpenCreate={pushCreateChallenge}
            onChanged={() => window.dispatchEvent(new Event("social:refresh-challenges"))}
          />
        )}
        {subTab === "friends" && (
          <FriendsTab authUser={authUser} t={t} onOpenProfile={pushProfile} onSwitchToWeekly={() => setSubTab("weekly")} />
        )}
      </div>

      {/* Screen stack — only top screen is visible; the rest are torn down on pop */}
      {stack.map((entry, idx) => {
        const isTop = idx === stack.length - 1;
        if (!isTop) return null; // simple model: only render top
        const closeThis = popScreen;
        if (entry.kind === "profile") {
          return (
            <ProfileScreen
              key={entry.id}
              targetUsername={entry.props.targetUsername}
              meUsername={meUid}
              t={t}
              languageId={languageId}
              backLabel={t.back || "Back"}
              onClose={closeThis}
              onChanged={() => {}}
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
              backLabel={t.back || "Back"}
              onClose={closeThis}
              onOpenProfile={(u) => pushProfile(u)}
              onChanged={() => window.dispatchEvent(new Event("social:refresh-challenges"))}
            />
          );
        }
        if (entry.kind === "create") {
          return (
            <CreateChallengeScreen
              key={entry.id}
              authUser={authUser}
              t={t}
              onClose={closeThis}
              onCreated={() => {
                closeThis();
                window.dispatchEvent(new Event("social:refresh-challenges"));
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
