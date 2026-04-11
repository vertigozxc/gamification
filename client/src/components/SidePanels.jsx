import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";

function SidePanels({ leaderboard, authUser }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5 flex flex-col shadow-2xl" style={{ flex: "7", background: "var(--leaderboard-bg)", border: "2px solid var(--leaderboard-border)" }}>
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "2px solid var(--leaderboard-border)" }}>
          <h2 className="cinzel text-lg text-transparent bg-clip-text uppercase tracking-[0.18em] font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.leaderboard}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {leaderboard.length === 0 ? (
            <p className="cinzel text-slate-500 italic text-sm text-center mt-8">{t.leaderboardEmpty}</p>
          ) : leaderboard.slice(0, 5).map((entry, idx) => {
            const sluggedUid = authUser.uid.toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 24);
            const isMe = entry.username === sluggedUid;
            const rankIcons = ["👑", "🥈", "🥉"];
            const rankColors = ["text-yellow-300", "text-slate-300", "text-orange-400"];
            const totalXp = (() => {
              let total = entry.xp;
              let threshold = 100;
              for (let l = 1; l < entry.level; l++) {
                total += threshold;
                threshold = Math.floor(threshold * 1.2);
              }
              return total;
            })();
            return (
              <div key={entry.username} className={`rounded-xl border p-3 bg-gradient-to-r ${isMe ? "from-yellow-950/40 to-amber-950/20 border-yellow-500/70" : "from-slate-900/80 to-slate-800/70 border-slate-700"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 text-center text-2xl ${rankColors[idx] ?? "text-slate-500"}`}>{rankIcons[idx] ?? `#${idx + 1}`}</div>
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-yellow-900 to-orange-900" style={{ borderColor: isMe ? "#eab308" : "#334155" }}>
                    {entry.photoUrl ? (
                      <img src={entry.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span className="text-yellow-400 text-base">⚔</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`cinzel text-sm font-bold truncate ${isMe ? "text-yellow-300" : "text-slate-100"}`}>{entry.displayName}{isMe ? " ✦" : ""}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{t.totalXpLabel}: <span className="text-purple-300">{totalXp.toLocaleString()}</span></p>
                  </div>
                  <div className="text-right leading-tight">
                    <p className="cinzel text-sm" style={{ color: "var(--color-primary)" }}>{t.levelShort} {entry.level}</p>
                    <p className="text-[10px] text-slate-500">{entry.xp}/{entry.xpNext}</p>
                    <p className="text-[10px] text-orange-400 font-bold mt-1">🔥 {entry.streak ?? 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
  logs: PropTypes.arrayOf(PropTypes.shape({
    msg: PropTypes.string.isRequired,
    classes: PropTypes.string,
    timestamp: PropTypes.string.isRequired
  }))
};

export default SidePanels;
