// Levels that unlock a new habit slot + a new daily-quest slot.
const SLOT_UNLOCK_LEVELS = new Set([5, 20]);

export default function LevelUpPopup({ show, onClose, level, t }) {
  const unlocksSlot = SLOT_UNLOCK_LEVELS.has(Number(level));
  return (
    <div className={`levelup-popup ${show ? "show" : "hidden"}`} aria-live="assertive" style={{ backdropFilter: "blur(8px)", background: "rgba(5, 10, 20, 0.85)" }}>
      <div className="levelup-popup-card relative flex flex-col items-center justify-center p-5 md:p-8 w-[90vw] md:w-[600px] max-h-[85vh] overflow-hidden" style={{ borderRadius: "2rem", border: "2px solid rgba(251, 191, 36, 0.6)", background: "linear-gradient(160deg, rgba(30,41,59,0.98), rgba(5,10,20,0.99))", boxShadow: "0 0 50px rgba(251, 191, 36, 0.2), inset 0 0 30px rgba(251,191,36,0.1)" }}>
        {/* Animated Background Rays */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
          <div className="w-[150%] h-[150%] animate-[spin_20s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.2) 20deg, transparent 40deg, rgba(251,191,36,0.2) 60deg, transparent 80deg, rgba(251,191,36,0.2) 100deg, transparent 120deg, rgba(251,191,36,0.2) 140deg, transparent 160deg, rgba(251,191,36,0.2) 180deg, transparent 200deg, rgba(251,191,36,0.2) 220deg, transparent 240deg, rgba(251,191,36,0.2) 260deg, transparent 280deg, rgba(251,191,36,0.2) 300deg, transparent 320deg, rgba(251,191,36,0.2) 340deg, transparent 360deg)" }} />
        </div>
        <div className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]" />
        
        <div className="relative z-10 w-full text-center">
          <p className="levelup-popup-subtitle cinzel" style={{ fontSize: "1.2rem", letterSpacing: "5px", color: "#fef08a", textShadow: "0 0 15px rgba(251,191,36,0.7)", margin: "0 0 0.25rem 0", animation: "fadeInDown 0.6s ease-out" }}>
            {t.levelUpTitle}
          </p>
          <h2 className="levelup-popup-title cinzel" style={{ fontSize: "4rem", margin: "0 0 0.75rem 0", color: "#fbbf24", borderBottom: "1px solid rgba(251,191,36,0.3)", paddingBottom: "0.5rem", lineHeight: "1", filter: "drop-shadow(0 0 20px rgba(251,191,36,0.6))", animation: "levelUpPulseSoft 2s infinite" }}>
            {t.levelUpPrefix} {level}
          </h2>

          <p className="levelup-popup-message" style={{ fontSize: "1.1rem", fontStyle: "italic", opacity: 0.9, margin: "0 0 0.5rem 0", color: "#e2e8f0", animation: "fadeInUp 0.8s ease-out" }}>
            "{t.levelUpMessage}"
          </p>
          <div className="mx-auto w-12 h-[2px] bg-yellow-600/50 mb-2" />
          <p className="text-sm text-amber-200/80 mb-4 px-4" style={{ animation: "fadeInUp 1s ease-out" }}>
            {t.cityExpansionText}
          </p>

          <div className="inline-flex justify-center items-center gap-3 bg-black/40 border border-yellow-700/50 rounded-xl px-5 py-3 mb-5 shadow-[inset_0_0_15px_rgba(251,191,36,0.1)]" style={{ animation: "fadeInUp 1.2s ease-out" }}>
            <span className="text-xl text-yellow-100 uppercase tracking-widest text-[0.85rem] font-bold">{t.rewardClaimLabel}</span>
            <span className="text-3xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
              +{level > 10 ? 2 : 1} <span className="text-4xl px-1">{t.tokenIcon}</span>
            </span>
          </div>

          {unlocksSlot ? (
            <div
              className="mx-auto mb-5 px-4 py-3 rounded-xl text-left"
              style={{
                maxWidth: 420,
                background: "rgba(74, 222, 128, 0.08)",
                border: "1px solid rgba(74, 222, 128, 0.5)",
                boxShadow: "inset 0 0 14px rgba(74, 222, 128, 0.12)",
                animation: "fadeInUp 1.3s ease-out"
              }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>✨</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="cinzel"
                    style={{
                      fontSize: "0.85rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#bbf7d0",
                      fontWeight: 700,
                      margin: 0,
                      lineHeight: 1.2
                    }}
                  >
                    {t.levelUpSlotUnlockTitle || "New slot unlocked!"}
                  </p>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      color: "#dcfce7",
                      margin: "4px 0 0",
                      lineHeight: 1.4
                    }}
                  >
                    {t.levelUpSlotUnlockMessage || "You can now add +1 habit and +1 daily quest — speed up your growth."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ animation: "fadeInUp 1.4s ease-out" }}>
            <button 
              onClick={onClose}
              className="cinzel font-bold tracking-widest text-lg px-10 py-3 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
              style={{ background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)", border: "1px solid #fef08a", boxShadow: "0 5px 20px rgba(217,119,6,0.4), inset 0 1px 1px rgba(255,255,255,0.6)" }}
            >
              {t.proceedLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
