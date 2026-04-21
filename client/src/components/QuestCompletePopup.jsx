import PropTypes from "prop-types";
import { useEffect } from "react";
import { useTheme } from "../ThemeContext";

// Shown when a timer quest auto-finishes at 100% (or the user Stops it at 100%).
// Confirms XP award + streak credit so the user knows the session counted.
// XP is shown as separate chips — the quest's own XP matches what the card
// displayed, with milestone / sport bonuses called out individually so the
// user can see where each number came from.
export default function QuestCompletePopup({
  show,
  onClose,
  title,
  questXp = 0,
  milestoneXp = 0,
  sportXp = 0,
  tokensAwarded = 0,
  streakCounted = false
}) {
  const { t } = useTheme();

  useEffect(() => {
    if (!show || typeof window === "undefined") return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === "Enter") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  const heading = t.questCompletePopupHeading || "Quest complete!";
  const praise = t.questCompletePopupPraise || "Nice work — keep the momentum going.";
  const xpLabel = t.xpLabel || "XP";
  const tokenIcon = t.tokenIcon || "🪙";
  const streakIcon = t.streakIcon || "🔥";
  const milestoneLabel = t.questCompletePopupMilestoneLabel || "Milestone";
  const sportLabel = t.questCompletePopupSportLabel || "Sport bonus";
  const streakYesTitle = t.questCompletePopupStreakYesTitle || "Counts toward your streak";
  const streakYesHint = t.questCompletePopupStreakYesHint
    || "Finish 4 quests at 100% today to grow your streak — this one counts.";
  const streakNoTitle = t.questCompletePopupStreakNoTitle || "Doesn't count toward streak";
  const streakNoHint = t.questCompletePopupStreakNoHint
    || "Only 100% finishes grow the streak. Partial finishes still fill the daily board.";
  const proceed = t.proceedLabel || "PROCEED";

  return (
    <div
      className={`levelup-popup ${show ? "show" : "hidden"}`}
      aria-live="assertive"
      style={{ backdropFilter: "blur(8px)", background: "rgba(5, 20, 10, 0.82)" }}
    >
      <div
        className="levelup-popup-card relative flex flex-col items-center justify-center p-8 md:p-12 w-[90vw] md:w-[600px] overflow-hidden"
        style={{
          borderRadius: "2rem",
          border: "2px solid rgba(74, 222, 128, 0.65)",
          background: "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(5,20,10,0.99))",
          boxShadow: "0 0 50px rgba(74, 222, 128, 0.2), inset 0 0 30px rgba(74,222,128,0.12)"
        }}
      >
        <div
          className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]"
        />

        <div className="relative z-10 w-full text-center">
          <p
            className="levelup-popup-subtitle cinzel"
            style={{
              fontSize: "1.1rem",
              letterSpacing: "4px",
              color: "#bbf7d0",
              textShadow: "0 0 15px rgba(74,222,128,0.65)",
              margin: "0 0 0.5rem 0",
              animation: "fadeInDown 0.6s ease-out"
            }}
          >
            {heading}
          </p>
          <h2
            className="levelup-popup-title cinzel"
            style={{
              fontSize: "2.2rem",
              margin: "0 0 1rem 0",
              color: "#4ade80",
              borderBottom: "1px solid rgba(74,222,128,0.35)",
              paddingBottom: "0.75rem",
              lineHeight: 1.15,
              filter: "drop-shadow(0 0 20px rgba(74,222,128,0.6))",
              animation: "levelUpPulseSoft 2s infinite",
              wordBreak: "break-word"
            }}
          >
            {title || "Quest"}
          </h2>

          <p
            className="levelup-popup-message"
            style={{
              fontSize: "1rem",
              fontStyle: "italic",
              opacity: 0.95,
              margin: "0 0 1rem 0",
              color: "#e2e8f0",
              animation: "fadeInUp 0.8s ease-out"
            }}
          >
            {praise}
          </p>

          <div
            className="flex flex-col items-center gap-2 mb-3"
            style={{ animation: "fadeInUp 1.2s ease-out" }}
          >
            {questXp > 0 ? (
              <div
                className="inline-flex justify-center items-center gap-2 bg-black/40 border border-emerald-500/60 rounded-xl px-5 py-2 shadow-[inset_0_0_12px_rgba(74,222,128,0.15)]"
              >
                <span className="text-2xl font-black text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]">
                  +{questXp} {xpLabel}
                </span>
              </div>
            ) : null}
            {(milestoneXp > 0 || sportXp > 0 || tokensAwarded > 0) ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {milestoneXp > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 bg-cyan-900/40 border border-cyan-500/50 rounded-lg px-3 py-1 text-sm font-bold text-cyan-200"
                    title={milestoneLabel}
                  >
                    🏅 +{milestoneXp} {xpLabel}
                  </span>
                ) : null}
                {sportXp > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 bg-sky-900/40 border border-sky-500/50 rounded-lg px-3 py-1 text-sm font-bold text-sky-200"
                    title={sportLabel}
                  >
                    🏃 +{sportXp} {xpLabel}
                  </span>
                ) : null}
                {tokensAwarded > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-500/50 rounded-lg px-3 py-1 text-sm font-bold text-amber-200"
                  >
                    +{tokensAwarded} {tokenIcon}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${streakCounted ? "rgba(251,191,36,0.45)" : "rgba(148,163,184,0.3)"}`,
              background: streakCounted ? "rgba(251,191,36,0.08)" : "rgba(148,163,184,0.06)",
              margin: "0 0 1.25rem",
              textAlign: "left"
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
              {streakCounted ? streakIcon : "•"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: streakCounted ? "#fbbf24" : "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.3
                }}
              >
                {streakCounted ? streakYesTitle : streakNoTitle}
              </p>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "#94a3b8",
                  margin: "3px 0 0",
                  lineHeight: 1.45
                }}
              >
                {streakCounted ? streakYesHint : streakNoHint}
              </p>
            </div>
          </div>

          <div style={{ animation: "fadeInUp 1.4s ease-out" }}>
            <button
              type="button"
              onClick={onClose}
              className="cinzel font-bold tracking-widest text-lg px-10 py-3 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
              style={{
                background: "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)",
                color: "#fff",
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                border: "1px solid #86efac",
                boxShadow: "0 5px 20px rgba(22,163,74,0.4), inset 0 1px 1px rgba(255,255,255,0.6)"
              }}
            >
              {proceed}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

QuestCompletePopup.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  questXp: PropTypes.number,
  milestoneXp: PropTypes.number,
  sportXp: PropTypes.number,
  tokensAwarded: PropTypes.number,
  streakCounted: PropTypes.bool
};
