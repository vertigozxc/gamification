import PropTypes from "prop-types";
import { useEffect } from "react";
import { useTheme } from "../ThemeContext";

// Shown when a timer quest auto-finishes at 100% (or the user Stops it at 100%).
// Confirms XP award + streak credit so the user knows the session counted.
export default function QuestCompletePopup({ show, onClose, title, awardedXp, streakCounted, tokensAwarded = 0 }) {
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
  const streakNote = streakCounted
    ? (t.questCompletePopupStreakYes || "Counts toward your streak")
    : (t.questCompletePopupStreakNo || "Finished without a streak credit");
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
            className="inline-flex flex-wrap justify-center items-center gap-3 bg-black/40 border border-emerald-500/50 rounded-xl px-6 py-4 mb-2 shadow-[inset_0_0_15px_rgba(74,222,128,0.12)]"
            style={{ animation: "fadeInUp 1.2s ease-out" }}
          >
            {awardedXp > 0 ? (
              <span className="text-2xl font-black text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]">
                +{awardedXp} {xpLabel}
              </span>
            ) : null}
            {tokensAwarded > 0 ? (
              <span className="text-2xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]">
                +{tokensAwarded} {tokenIcon}
              </span>
            ) : null}
          </div>

          <p
            style={{
              fontSize: "0.82rem",
              color: streakCounted ? "#fbbf24" : "#94a3b8",
              margin: "0.5rem 0 1.5rem",
              letterSpacing: "0.04em"
            }}
          >
            {streakCounted ? `${streakIcon} ${streakNote}` : streakNote}
          </p>

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
  awardedXp: PropTypes.number,
  streakCounted: PropTypes.bool,
  tokensAwarded: PropTypes.number
};
