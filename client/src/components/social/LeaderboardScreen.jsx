import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import Screen from "./Screen";

export default function LeaderboardScreen({ meUid, data, t, onClose, onOpenProfile }) {
  const users = data?.users || [];
  const me = data?.me || null;
  const meInShown = me ? users.some((u) => u.username === me.username) : false;

  return (
    <Screen
      title={t.arenaBoardTitle || "Weekly leaderboard"}
      subtitle={t.arenaBoardSubtitle || "Top 100 · XP this week"}
      onClose={onClose}
    >
      {users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔥</div>
          <p className="sb-headline" style={{ marginBottom: 4 }}>
            {t.arenaBoardEmptyTitle || "Quiet week so far"}
          </p>
          <p className="sb-caption">
            {t.arenaBoardEmptyBody || "Complete any task and you will appear on the leaderboard."}
          </p>
        </div>
      ) : (
        <div className="sb-list">
          {users.map((u, i) => (
            <Row
              key={u.username}
              entry={u}
              isMe={u.username === meUid}
              t={t}
              onOpenProfile={onOpenProfile}
              isLast={i === users.length - 1}
            />
          ))}
        </div>
      )}

      {me && !meInShown && (
        <>
          <h3 className="sb-section-title" style={{ margin: "20px 4px 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)" }}>
            {t.arenaYourRankSection || "Your rank"}
          </h3>
          <div className="sb-list">
            <Row entry={me} isMe meHighlight t={t} onOpenProfile={onOpenProfile} isLast />
          </div>
        </>
      )}
    </Screen>
  );
}

function Row({ entry, isMe, meHighlight, t, onOpenProfile, isLast }) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(entry.username)}
      className="sb-list-row press"
      style={{
        background: meHighlight
          ? "rgba(var(--color-primary-rgb,251,191,36),0.14)"
          : isMe
            ? "rgba(var(--color-primary-rgb,251,191,36),0.06)"
            : "transparent",
        borderBottom: isLast ? "none" : undefined,
      }}
    >
      <span
        style={{
          width: 28,
          textAlign: "center",
          fontWeight: 700,
          color: entry.rank && entry.rank <= 3 ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: 13,
          flexShrink: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {entry.rank ? entry.rank : "—"}
      </span>
      <StreakFrame streak={entry.streak} size={40} ringWidth={2}>
        <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={40} />
      </StreakFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {entry.displayName || entry.username}
          {isMe && <span style={{ color: "var(--color-primary)", fontWeight: 600 }}> · {t.arenaYou || "you"}</span>}
        </p>
        <p className="sb-caption" style={{ display: "flex", gap: 8, marginTop: 1 }}>
          <span>{t.arenaLvlShort || "Lv"} {entry.level}</span>
          <span>🔥 {entry.streak}</span>
          {typeof entry.weeklyTasks === "number" && <span>✓ {entry.weeklyTasks}</span>}
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "var(--color-primary)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {entry.weeklyXp}
        </p>
        <p className="sb-caption" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {t.arenaXp || "XP"}
        </p>
      </div>
    </button>
  );
}
