import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";

function SidePanels({ leaderboard, authUser, compact = false }) {
  const { t } = useTheme();
  const sluggedUid = String(authUser?.uid || "").trim().slice(0, 128);
  const userRank = leaderboard.findIndex((entry) => entry.username === sluggedUid) + 1;
  const rankLabel = userRank > 0 ? `#${userRank}` : "#-";

  const renderEntry = (entry, idx) => {
    const isMe = entry.username === sluggedUid;
    const rankIcons = ["👑", "🥈", "🥉"];
    const rankColors = ["var(--color-primary)", "var(--color-text)", "var(--color-primary)"];
    const totalXp = (() => {
      let total = entry.xp;
      let threshold = 100;
      for (let l = 1; l < entry.level; l++) {
        total += threshold;
        threshold = Math.floor(threshold * 1.2);
      }
      return total;
    })();

    if (compact) {
      return (
        <div key={entry.username} className={`mobile-card ${isMe ? "relative" : ""}`} style={isMe ? { borderColor: "var(--color-primary)", boxShadow: "0 0 18px var(--color-primary-glow)", background: "var(--panel-bg)" } : { background: "var(--card-bg)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 text-center text-xl font-bold" style={{ color: rankColors[idx] || "var(--color-muted)" }}>{rankIcons[idx] ?? `#${idx + 1}`}</div>
            <div className="w-11 h-11 rounded-2xl overflow-hidden border flex-shrink-0 flex items-center justify-center" style={{ background: "var(--card-bg)", borderColor: isMe ? "var(--color-primary)" : "var(--card-border-idle)" }}>
              {entry.photoUrl ? (
                <img src={entry.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="text-sm" style={{ color: "var(--color-primary)" }}>🎯</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="cinzel text-sm font-bold truncate" style={{ color: isMe ? "var(--color-primary)" : "var(--color-text)" }}>{entry.displayName}{isMe ? " ✦" : ""}</p>
                <span className="cinzel text-[11px] shrink-0" style={{ color: "var(--color-primary)" }}>{t.levelShort} {entry.level}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[11px] truncate opacity-80" style={{ color: "var(--color-text)" }}>{t.totalXpLabel}: <span style={{ color: "var(--color-text)" }}>{totalXp.toLocaleString()}</span></p>
                <p className="text-[11px] font-bold shrink-0" style={{ color: "var(--color-primary)" }}>🔥 {entry.streak ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={entry.username} className="rounded-xl border p-3" style={isMe ? { background: "var(--panel-bg)", borderColor: "var(--color-primary)" } : { background: "var(--card-bg)", borderColor: "var(--card-border-idle)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 text-center text-2xl font-bold" style={{ color: rankColors[idx] || "var(--color-muted)" }}>{rankIcons[idx] ?? `#${idx + 1}`}</div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 flex items-center justify-center" style={{ background: "var(--card-bg)", borderColor: isMe ? "var(--color-primary)" : "var(--card-border-idle)" }}>
            {entry.photoUrl ? (
              <img src={entry.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="text-base" style={{ color: "var(--color-primary)" }}>🎯</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="cinzel text-sm font-bold truncate" style={{ color: isMe ? "var(--color-primary)" : "var(--color-text)" }}>{entry.displayName}{isMe ? " ✦" : ""}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-80" style={{ color: "var(--color-text)" }}>{t.totalXpLabel}: <span style={{ color: "var(--color-text)" }}>{totalXp.toLocaleString()}</span></p>
          </div>
          <div className="text-right leading-tight">
            <p className="cinzel text-sm" style={{ color: "var(--color-primary)" }}>{t.levelShort} {entry.level}</p>
            <p className="text-[10px] text-slate-500">{entry.xp}/{entry.xpNext}</p>
            <p className="text-[10px] font-bold mt-1" style={{ color: "var(--color-primary)" }}>🔥 {entry.streak ?? 0}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {compact ? (
        <div className="flex flex-col gap-3">
          {leaderboard.length === 0 ? (
            <p className="cinzel italic text-sm text-center mt-8" style={{ color: "var(--color-muted)" }}>{t.leaderboardEmpty}</p>
          ) : leaderboard.slice(0, 10).map(renderEntry)}
        </div>
      ) : (
        <div className="rounded-2xl flex flex-col shadow-2xl p-5" style={{ flex: "7", background: "var(--leaderboard-bg)", border: "2px solid var(--leaderboard-border)" }}>
          <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "2px solid var(--leaderboard-border)" }}>
            <h2 className="cinzel text-lg text-transparent bg-clip-text uppercase tracking-[0.18em] font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.leaderboard} · {rankLabel}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {leaderboard.length === 0 ? (
              <p className="cinzel italic text-sm text-center mt-8" style={{ color: "var(--color-muted)" }}>{t.leaderboardEmpty}</p>
            ) : leaderboard.slice(0, 5).map(renderEntry)}
          </div>
        </div>
      )}
    </div>
  );
}

SidePanels.propTypes = {
  leaderboard: PropTypes.arrayOf(PropTypes.shape({
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string,
    level: PropTypes.number.isRequired,
    xp: PropTypes.number.isRequired,
    xpNext: PropTypes.number.isRequired,
    streak: PropTypes.number,
    photoUrl: PropTypes.string
  })).isRequired,
  authUser: PropTypes.shape({
    uid: PropTypes.string.isRequired
  }).isRequired,
  compact: PropTypes.bool,
  logs: PropTypes.arrayOf(PropTypes.shape({
    msg: PropTypes.string.isRequired,
    classes: PropTypes.string,
    timestamp: PropTypes.string.isRequired
  }))
};

export default SidePanels;
