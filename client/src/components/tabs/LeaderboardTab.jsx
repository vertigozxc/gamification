import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext";
import WeeklyLeaderboard from "../social/WeeklyLeaderboard";
import FriendsTab from "../social/FriendsTab";
import ChallengesTab from "../social/ChallengesTab";
import ProfileScreen from "../social/ProfileScreen";
import ChallengeDetailScreen from "../social/ChallengeDetailScreen";
import CreateChallengeScreen from "../social/CreateChallengeScreen";
import SearchScreen from "../social/SearchScreen";
import { fetchIncomingFriendRequests } from "../../api";
import "../social/ios.css";

let screenIdSeq = 0;

const MAX_ACTIVE_CHALLENGES = 3;

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;

  const pendingSubTab = (typeof window !== "undefined" && window.__pendingSocialSubTab) || null;
  const pendingChallengeId = (typeof window !== "undefined" && window.__pendingSocialChallengeId) || null;

  const [subTab, setSubTab] = useState(pendingSubTab || "weekly");
  const [requestCount, setRequestCount] = useState(0);
  const [stack, setStack] = useState([]);

  const meUid = String(authUser?.uid || "").slice(0, 128);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.__pendingSocialSubTab = null; } catch {}
    if (pendingChallengeId) {
      try { window.__pendingSocialChallengeId = null; } catch {}
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
  const popScreen = () => setStack((prev) => prev.slice(0, -1));

  function pushProfile(username) { pushScreen({ kind: "profile", props: { targetUsername: username } }); }
  function pushChallengeDetail(challengeId) { pushScreen({ kind: "challenge", props: { challengeId } }); }
  function pushCreateChallenge() { pushScreen({ kind: "create", props: {} }); }
  function pushSearch() { pushScreen({ kind: "search", props: {} }); }

  const tabs = [
    { id: "weekly", label: t.socialTabWeekly || "Active", icon: "🔥", sub: t.socialHeaderSubActive || "Active players this week" },
    { id: "challenges", label: t.socialTabChallenges || "Challenges", icon: "⚔️", sub: t.socialHeaderSubChallenges || "Stay accountable together" },
    { id: "friends", label: t.socialTabFriends || "Friends", icon: "🤝", sub: t.socialHeaderSubFriends || "Your inner circle", badge: requestCount },
  ];
  const selectedIdx = tabs.findIndex((tab) => tab.id === subTab);
  const current = tabs[selectedIdx] || tabs[0];

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
        {/* Framed header — matches Dashboard/City/Profile visual language */}
        <div className="dash-hero top-screen-block">
          <div className="dash-hero-top" style={{ alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-primary-dim)", marginBottom: "0.2rem" }}>
                {t.socialCommunityTitle || "Community page"}
              </p>
              <h2
                className="cinzel"
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  background: "var(--heading-gradient)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  lineHeight: 1.15,
                }}
              >
                {current.icon} {current.sub}
              </h2>
            </div>
            {subTab === "weekly" && (
              <button
                type="button"
                onClick={pushSearch}
                aria-label={t.socialSearchTitle || "Find players"}
                className="press"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid var(--panel-border)",
                  background: "rgba(var(--color-primary-rgb,251,191,36),0.14)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                🔍
              </button>
            )}
          </div>
        </div>

        {/* Bigger mobile-native tab switcher */}
        <div role="tablist" className="sb-tabs" aria-label="Community sections">
          <div
            className="sb-tabs-slider"
            aria-hidden="true"
            style={{ width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(calc(100% * ${selectedIdx}))` }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              onClick={() => setSubTab(tab.id)}
              className="sb-tab press"
            >
              <span className="sb-tab-icon">{tab.icon}</span>
              <span className="sb-tab-label">{tab.label}</span>
              {tab.badge ? <span className="badge" style={{ position: "absolute", top: 6, right: 10 }}>{tab.badge}</span> : null}
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

      {/* Screen stack (only top screen renders) */}
      {stack.map((entry, idx) => {
        const isTop = idx === stack.length - 1;
        if (!isTop) return null;
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
              onCreated={() => { closeThis(); window.dispatchEvent(new Event("social:refresh-challenges")); }}
            />
          );
        }
        if (entry.kind === "search") {
          return (
            <SearchScreen
              key={entry.id}
              meUid={meUid}
              t={t}
              onClose={closeThis}
              onOpenProfile={pushProfile}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
