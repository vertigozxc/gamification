import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext";
import WeeklyLeaderboard from "../social/WeeklyLeaderboard";
import FriendsTab from "../social/FriendsTab";
import ChallengesTab from "../social/ChallengesTab";
import PublicProfileModal from "../social/PublicProfileModal";
import { fetchIncomingFriendRequests } from "../../api";

export default function LeaderboardTab({ authUser, t: tProp }) {
  const { t: tTheme, languageId } = useTheme();
  const t = tProp || tTheme;
  const [subTab, setSubTab] = useState("weekly");
  const [profileUsername, setProfileUsername] = useState(null);
  const [requestCount, setRequestCount] = useState(0);

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
      className="flex flex-col gap-3"
      style={{ minHeight: "calc(100svh - var(--mobile-safe-top, 0px) - var(--mobile-footer-offset, 98px) - 90px)" }}
    >
      {/* Hero header */}
      <div
        style={{
          background: "var(--leaderboard-bg)",
          border: "1px solid var(--leaderboard-border)",
          borderRadius: "var(--border-radius-panel)",
          padding: "0.85rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem"
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "0.75rem",
            background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.24), rgba(0,0,0,0.18))",
            border: "1px solid var(--leaderboard-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            flexShrink: 0
          }}
        >
          🌐
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary-dim)" }}>
            {t.socialHeroKicker || "Community"}
          </p>
          <h2
            className="cinzel leading-none text-transparent bg-clip-text"
            style={{ backgroundImage: "var(--heading-gradient)", fontSize: "1.05rem", fontWeight: 700 }}
          >
            {t.socialHeroTitle || "Social"}
          </h2>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "0.3rem",
          padding: "0.25rem",
          background: "rgba(0,0,0,0.28)",
          border: "1px solid var(--panel-border)",
          borderRadius: "0.65rem"
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              flex: 1,
              padding: "0.5rem 0.35rem",
              border: "none",
              background: subTab === tab.id ? "rgba(var(--color-primary-rgb,251,191,36),0.2)" : "transparent",
              color: subTab === tab.id ? "var(--color-primary)" : "var(--color-muted)",
              borderRadius: "0.45rem",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
              position: "relative"
            }}
          >
            <span>{tab.icon}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tab.label}</span>
            {tab.badge ? (
              <span style={{
                position: "absolute",
                top: 2,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: "#ef4444",
                color: "#fff",
                fontSize: "0.58rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {subTab === "weekly" && (
        <WeeklyLeaderboard
          authUser={authUser}
          t={t}
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
