export default function HabitMilestonePopup({ show, onClose, title, tokens, t, tf }) {
  return (
    <div className={`levelup-popup ${show ? "show" : "hidden"}`} aria-live="assertive" style={{ backdropFilter: "blur(8px)", background: "rgba(5, 20, 10, 0.82)" }}>
      <div className="levelup-popup-card relative flex flex-col items-center justify-center p-8 md:p-12 w-[90vw] md:w-[600px] overflow-hidden" style={{ borderRadius: "2rem", border: "2px solid rgba(74, 222, 128, 0.65)", background: "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(5,20,10,0.99))", boxShadow: "0 0 50px rgba(74, 222, 128, 0.2), inset 0 0 30px rgba(74,222,128,0.12)" }}>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
          <div className="w-[150%] h-[150%] animate-[spin_20s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(74,222,128,0.2) 20deg, transparent 40deg, rgba(74,222,128,0.2) 60deg, transparent 80deg, rgba(74,222,128,0.2) 100deg, transparent 120deg, rgba(74,222,128,0.2) 140deg, transparent 160deg, rgba(74,222,128,0.2) 180deg, transparent 200deg, rgba(74,222,128,0.2) 220deg, transparent 240deg, rgba(74,222,128,0.2) 260deg, transparent 280deg, rgba(74,222,128,0.2) 300deg, transparent 320deg, rgba(74,222,128,0.2) 340deg, transparent 360deg)" }} />
        </div>
        <div className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]" />

        <div className="relative z-10 w-full text-center">
          <p className="levelup-popup-subtitle cinzel" style={{ fontSize: "1.25rem", letterSpacing: "4px", color: "#bbf7d0", textShadow: "0 0 15px rgba(74,222,128,0.65)", margin: "0 0 0.5rem 0", animation: "fadeInDown 0.6s ease-out" }}>
            {t.habitMilestoneTitle}
          </p>
          <h2 className="levelup-popup-title cinzel" style={{ fontSize: "4.2rem", margin: "0 0 1.5rem 0", color: "#4ade80", borderBottom: "1px solid rgba(74,222,128,0.35)", paddingBottom: "1rem", lineHeight: "1", filter: "drop-shadow(0 0 20px rgba(74,222,128,0.6))", animation: "levelUpPulseSoft 2s infinite" }}>
            21/21+
          </h2>

          <p className="levelup-popup-message" style={{ fontSize: "1.2rem", fontStyle: "italic", opacity: 0.95, margin: "0 0 1rem 0", color: "#e2e8f0", animation: "fadeInUp 0.8s ease-out" }}>
            {tf("habitMilestoneMessage", { title: title || t.pinnedSection })}
          </p>

          <div className="inline-flex justify-center items-center gap-3 bg-black/40 border border-emerald-500/50 rounded-xl px-6 py-4 mb-8 shadow-[inset_0_0_15px_rgba(74,222,128,0.12)]" style={{ animation: "fadeInUp 1.2s ease-out" }}>
            <span className="text-xl text-emerald-100 uppercase tracking-widest text-[0.85rem] font-bold">{t.rewardClaimLabel}</span>
            <span className="text-3xl font-black text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]">
              +{tokens} <span className="text-4xl px-1">{t.tokenIcon}</span>
            </span>
          </div>

          <div style={{ animation: "fadeInUp 1.4s ease-out" }}>
            <button
              onClick={onClose}
              className="cinzel font-bold tracking-widest text-lg px-10 py-3 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
              style={{ background: "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)", border: "1px solid #86efac", boxShadow: "0 5px 20px rgba(22,163,74,0.4), inset 0 1px 1px rgba(255,255,255,0.6)" }}
            >
              {t.proceedLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
