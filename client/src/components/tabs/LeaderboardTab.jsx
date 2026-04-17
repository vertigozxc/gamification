import SidePanels from "../SidePanels";

export default function LeaderboardTab({ leaderboard, authUser, logs, t }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="mobile-card">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mobile-section-kicker">{t.mobileLeaderboardLabel}</p>
            <h2 className="cinzel text-2xl mt-1 text-transparent bg-clip-text" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.leaderboard}</h2>
          </div>
          
        </div>
      </div>
      <SidePanels leaderboard={leaderboard} authUser={authUser} logs={logs} compact />
    </div>
  );
}
