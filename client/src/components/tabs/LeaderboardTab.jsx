import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext";
import WeeklyLeaderboard from "../social/WeeklyLeaderboard";
import FriendsTab from "../social/FriendsTab";
import ChallengesTab from "../social/ChallengesTab";
import PublicProfileModal from "../social/PublicProfileModal";
import { fetchIncomingFriendRequests } from "../../api";
import "../social/ios.css";

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;

  const pendingSubTab = (typeof window !== "undefined" && window.__pendingSocialSubTab) || null;

  const [subTab, setSubTab] = useState(pendingSubTab || "weekly");
  const [profileUsername, setProfileUsername] = useState(null);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.__pendingSocialSubTab = null; } catch {}
  }, []);

  const meUid = String(authUser?.uid || "").slice(0, 128);

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

  const tabs = [
    { id: "weekly", label: t.socialTabWeekly || "Active", icon: "🔥" },
    { id: "challenges", label: t.socialTabChallenges || "Challenges", icon: "⚔️" },
    { id: "friends", label: t.socialTabFriends || "Friends", icon: "🤝", badge: requestCount }
  ];

  return (
    <div
      className="social-block flex flex-col gap-3"
      style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}
    >
      {/* Large title — iOS-style navigation header */}
      <div style={{ padding: "6px 4px 4px" }}>
        <p className="ios-subhead" style={{ fontWeight: 600, color: "var(--color-primary)", letterSpacing: 0 }}>
          {t.socialHeroKicker || "Community"}
        </p>
        <h1 className="ios-large-title" style={{ marginTop: 2 }}>
          {t.socialHeroTitle || "Social"}
        </h1>
      </div>

      {/* Segmented control */}
      <div
        role="tablist"
        className="ios-segmented"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            onClick={() => setSubTab(tab.id)}
            className="ios-segmented-option ios-tap"
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge ? <span className="ios-badge" style={{ marginLeft: 2 }}>{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {subTab === "weekly" && (
        <WeeklyLeaderboard
          authUser={authUser}
          t={t}
          languageId={languageId}
          onOpenProfile={(username) => setProfileUsername(username)}
        />
      )}
      {subTab === "challenges" && (
        <ChallengesTab
          authUser={authUser}
          t={t}
          languageId={languageId}
          onOpenProfile={(username) => setProfileUsername(username)}
        />
      )}
      {subTab === "friends" && (
        <FriendsTab
          authUser={authUser}
          t={t}
          onOpenProfile={(username) => setProfileUsername(username)}
          onSwitchToWeekly={() => setSubTab("weekly")}
        />
      )}

      {profileUsername && (
        <PublicProfileModal
          targetUsername={profileUsername}
          meUsername={meUid}
          t={t}
          languageId={languageId}
          onClose={() => setProfileUsername(null)}
        />
      )}
    </div>
  );
}
