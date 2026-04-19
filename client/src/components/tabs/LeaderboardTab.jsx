import SidePanels from "../SidePanels";

export default function LeaderboardTab({ leaderboard, authUser, logs, t }) {
  const sluggedUid = String(authUser?.uid || "").trim().slice(0, 128);
  const userRank = leaderboard.findIndex((entry) => entry.username === sluggedUid) + 1;
  const rankLabel = userRank > 0 ? `#${userRank}` : "—";
  const userEntry = leaderboard.find((e) => e.username === sluggedUid);
  const userLevel = userEntry?.level ?? "—";
  const userStreak = userEntry?.streak ?? 0;
  const totalPlayers = leaderboard.length;
  const currentRankLabel = t.mobileCurrentRankLabel || "Your current rank";
  const boardTitle = (t.leaderboard || "🏆 Leaderboard").replace(/^🏆\s*/, "");

  const statDivider = (
    <div style={{ width: 1, alignSelf: "stretch", background: "var(--leaderboard-border)", opacity: 0.35, margin: "0 0.25rem" }} />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Hero banner card ── */}
      <div
        className="overflow-hidden top-screen-block"
        style={{
          background: "var(--leaderboard-bg)",
          borderRadius: "var(--border-radius-panel)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        }}
      >
        {/* Top strip: icon + title */}
        <div
          className="flex items-center gap-3"
          style={{
            padding: "1rem 1.25rem 0.875rem",
            borderBottom: "1px solid var(--leaderboard-border)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "0.875rem",
              background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.18), rgba(0,0,0,0.1))",
              border: "1px solid var(--leaderboard-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "1.4rem",
            }}
          >
            🏆
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--color-primary-dim)",
                marginBottom: "0.2rem",
              }}
            >
              {t.mobileLeaderboardLabel || "Hall of Heroes"}
            </p>
            <h2
              className="cinzel leading-none text-transparent bg-clip-text"
              style={{ backgroundImage: "var(--heading-gradient)", fontSize: "1.15rem", fontWeight: 700 }}
            >
              {boardTitle}
            </h2>
          </div>
          {/* Player count pill */}
          {totalPlayers > 0 && (
            <div
              style={{
                padding: "0.2rem 0.65rem",
                borderRadius: "999px",
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--leaderboard-border)",
                fontSize: "0.65rem",
                fontWeight: 600,
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {totalPlayers} {window.i18nLanguage === "ru" ? "игроков" : "players"}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center" style={{ padding: "1rem 1.25rem" }}>
          {/* Rank */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.59rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-primary-dim)",
              }}
            >
              {currentRankLabel}
            </p>
            <p
              className="cinzel text-transparent bg-clip-text leading-none"
              style={{
                backgroundImage: "var(--heading-gradient)",
                fontSize: "2.25rem",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {rankLabel}
            </p>

          </div>

          {statDivider}

          {/* Level */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.59rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-primary-dim)",
              }}
            >
              {t.levelShort || "Level"}
            </p>
            <p
              className="cinzel text-transparent bg-clip-text leading-none"
              style={{
                backgroundImage: "var(--heading-gradient)",
                fontSize: "2.25rem",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {userLevel}
            </p>
          </div>

          {statDivider}

          {/* Streak */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.59rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-primary-dim)",
              }}
            >
              {t.streakUnit || "Streak"}
            </p>
            <p
              className="cinzel text-transparent bg-clip-text leading-none"
              style={{
                backgroundImage: "var(--heading-gradient)",
                fontSize: "2.25rem",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {userStreak}
            </p>
          </div>
        </div>


      </div>

      <SidePanels leaderboard={leaderboard} authUser={authUser} logs={logs} compact />
    </div>
  );
}
