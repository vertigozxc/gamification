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
  silverAwarded = 0,
  streakCounted = false,
  streakRemaining,
  completionPercent = 100
}) {
  const { t, tf } = useTheme();
  const isPartial = Number(completionPercent) < 100;
  const percentTier = Number(completionPercent) >= 75 ? 75 : Number(completionPercent) >= 50 ? 50 : 0;

  useEffect(() => {
    if (!show || typeof window === "undefined") return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === "Enter") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  const heading = isPartial
    ? (t.questCompletePopupHeadingPartial || "Quest stopped early")
    : (t.questCompletePopupHeading || "Quest complete!");
  const praise = isPartial
    ? (tf("questCompletePopupPartialPraise", { percent: percentTier })
        || `You pushed through ${percentTier}% of the session — that's real effort, not nothing.`)
    : (t.questCompletePopupPraise || "Nice work — keep the momentum going.");
  const silverIcon = t.silverIcon || "🪙";
  const streakIcon = t.streakIcon || "🔥";
  const streakYesTitle = t.questCompletePopupStreakYesTitle || "Counts toward your streak";
  const remaining = Number.isFinite(Number(streakRemaining)) ? Math.max(0, Number(streakRemaining)) : null;
  let streakYesHint;
  if (remaining === null) {
    streakYesHint = t.questCompletePopupStreakYesHint || "Keep it up — you're on track.";
  } else if (remaining === 0) {
    streakYesHint = t.questCompletePopupStreakSecured || "Your streak grew today — great work, keep going.";
  } else {
    const dynamic = tf("questCompletePopupStreakYesHintDynamic", { n: remaining });
    streakYesHint = dynamic || `${remaining} more to grow your streak — keep it up!`;
  }
  const streakNoTitle = isPartial
    ? (t.questCompletePopupPartialStreakTitle || "Not counted in the streak")
    : (t.questCompletePopupStreakNoTitle || "Doesn't count toward streak");
  const streakNoHint = isPartial
    ? (tf("questCompletePopupPartialStreakHint", { percent: percentTier })
        || `You earned ${percentTier}% XP, but this one doesn't add to the streak. Finish the next at 100% to claim it.`)
    : (t.questCompletePopupStreakNoHint
        || "Only 100% finishes grow the streak. Partial finishes still fill the daily board.");
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

          {silverAwarded > 0 ? (
            <div
              className="flex items-center justify-center mb-3"
              style={{ animation: "fadeInUp 1.2s ease-out" }}
            >
              <span className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-500/50 rounded-xl px-4 py-2 text-xl font-black text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                +{silverAwarded} <span className="text-2xl">{tokenIcon}</span>
              </span>
            </div>
          ) : null}

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
  silverAwarded: PropTypes.number,
  streakCounted: PropTypes.bool,
  streakRemaining: PropTypes.number,
  completionPercent: PropTypes.number
};
