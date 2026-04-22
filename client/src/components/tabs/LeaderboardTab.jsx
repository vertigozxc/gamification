import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";
import WeeklyLeaderboard from "../social/WeeklyLeaderboard";
import FriendsTab from "../social/FriendsTab";
import ChallengesTab from "../social/ChallengesTab";
import PublicProfileScreen from "../social/PublicProfileScreen";
import ChallengeDetailScreen from "../social/ChallengeDetailScreen";
import { fetchIncomingFriendRequests } from "../../api";
import { IosNavStack, useIosNav, haptic } from "../social/iosNav";
import "../social/ios.css";

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;

  return (
    <div className="social-block" style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}>
      <IosNavStack rootTitle={t.socialHeroTitle || "Social"}>
        <SocialRoot authUser={authUser} t={t} languageId={languageId} />
      </IosNavStack>
    </div>
  );
}

function SocialRoot({ authUser, t, languageId }) {
  const nav = useIosNav();
  const pendingSubTab = (typeof window !== "undefined" && window.__pendingSocialSubTab) || null;
  const pendingChallengeId = (typeof window !== "undefined" && window.__pendingSocialChallengeId) || null;

  const [subTab, setSubTab] = useState(pendingSubTab || "weekly");
  const [requestCount, setRequestCount] = useState(0);

  const meUid = String(authUser?.uid || "").slice(0, 128);

  // Clear the deep-link flags after consumption
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.__pendingSocialSubTab = null; } catch {}
  }, []);

  // Auto-open a specific challenge once, when deep-linked from Dashboard strip
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (pendingChallengeId && subTab === "challenges") {
      autoOpenedRef.current = true;
      try { window.__pendingSocialChallengeId = null; } catch {}
      // Push the challenge detail after a tick so the root is mounted first
      setTimeout(() => {
        openChallenge(pendingChallengeId);
      }, 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, pendingChallengeId]);

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

  function openProfile(username) {
    nav.push({
      title: t.socialProfileLabel || "Profile",
      content: (
        <PublicProfileScreen
          targetUsername={username}
          meUsername={meUid}
          t={t}
          languageId={languageId}
          onRemoved={() => { /* list refresh handled by tab's own focus logic */ }}
        />
      )
    });
  }

  function openChallenge(challengeId) {
    nav.push({
      title: t.socialChallengeSheetTitle || "Challenge",
      content: (
        <ChallengeDetailScreen
          challengeId={challengeId}
          authUser={authUser}
          t={t}
          languageId={languageId}
          onOpenProfile={openProfile}
        />
      )
    });
  }

  const tabs = [
    { id: "weekly", label: t.socialTabWeekly || "Active", icon: "🔥" },
    { id: "challenges", label: t.socialTabChallenges || "Challenges", icon: "⚔️" },
    { id: "friends", label: t.socialTabFriends || "Friends", icon: "🤝", badge: requestCount }
  ];
  const selectedIdx = tabs.findIndex((tab) => tab.id === subTab);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
      {/* Large title */}
      <div style={{ padding: "4px 2px 0" }}>
        <p className="ios-subhead" style={{ fontWeight: 600, color: "var(--color-primary)", letterSpacing: 0 }}>
          {t.socialHeroKicker || "Community"}
        </p>
        <h1 className="ios-large-title" style={{ marginTop: 2 }}>
          {t.socialHeroTitle || "Social"}
        </h1>
      </div>

      {/* Segmented control with sliding indicator */}
      <div role="tablist" className="ios-segmented" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        <div
          className="ios-segmented-slider"
          style={{
            width: `calc((100% - 6px) / ${tabs.length})`,
            transform: `translateX(calc((100% + 0px) * ${selectedIdx}))`
          }}
          aria-hidden="true"
        />
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            onClick={() => { haptic("light"); setSubTab(tab.id); }}
            className="ios-segmented-option ios-tap"
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge ? <span className="ios-badge" style={{ marginLeft: 2 }}>{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {subTab === "weekly" && (
        <WeeklyLeaderboard authUser={authUser} t={t} languageId={languageId} onOpenProfile={openProfile} />
      )}
      {subTab === "challenges" && (
        <ChallengesTab
          authUser={authUser}
          t={t}
          languageId={languageId}
          onOpenProfile={openProfile}
          onOpenChallenge={openChallenge}
        />
      )}
      {subTab === "friends" && (
        <FriendsTab authUser={authUser} t={t} onOpenProfile={openProfile} onSwitchToWeekly={() => setSubTab("weekly")} />
      )}
    </div>
  );
}
