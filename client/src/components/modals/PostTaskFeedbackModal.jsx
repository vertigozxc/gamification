import { useState } from "react";
import { useTheme } from "../../ThemeContext";

function PostTaskFeedbackModal({ open, quest, onClose, onSubmit }) {
  const { t } = useTheme();
  const [rating, setRating] = useState(0);
  const [textNotes, setTextNotes] = useState("");
  const [hovered, setHovered] = useState(0);

  const questionType = t.feedbackQuestionUseful;

  if (!open || !quest) return null;

  const handleSubmit = () => {
    if (rating === 0) {
      alert(t.feedbackRequireRating);
      return;
    }
    onSubmit({ rating, textNotes, questionType });
    setRating(0);
    setTextNotes("");
  };

  const getGradientForRating = (val) => {
    if (val <= 3) return "linear-gradient(135deg, rgba(239,68,68,0.8), rgba(153,27,27,0.8))";   // Red
    if (val <= 6) return "linear-gradient(135deg, rgba(234,179,8,0.8), rgba(133,77,14,0.8))";    // Yellow
    if (val <= 8) return "linear-gradient(135deg, rgba(52,211,153,0.8), rgba(6,95,70,0.8))";     // Green
    return "linear-gradient(135deg, rgba(56,189,248,0.9), rgba(3,105,161,0.9))";                 // Cyan/Blue
  };

  const handleSkip = () => {
    setRating(0);
    setTextNotes("");
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300"
      onClick={handleSkip} 
      style={{ zIndex: 10000 }}
    >
      <div 
        className="relative overflow-hidden rounded-2xl shadow-2xl p-8 transform scale-100 transition-all duration-300" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: "600px", width: "95vw", 
          background: "var(--panel-bg, #0f172a)", 
          border: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.15)"
        }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        <div className="text-5xl mb-4 text-center animate-bounce mt-4">✨</div>
        
        <h2 className="cinzel font-black uppercase tracking-[0.15em] text-center mb-1 text-2xl bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-500">
          {t.feedbackQuestConquered}
        </h2>
        
        <p className="text-center text-sm font-bold opacity-80 decoration-slice uppercase tracking-widest mb-8 text-cyan-100">
          "{quest.title}"
        </p>

        <div className="flex flex-col items-center justify-center gap-2 mb-8 bg-black/30 w-full p-6 rounded-xl border border-white/5">
          <p className="text-xs uppercase tracking-widest mb-3 opacity-70 font-semibold">
            {questionType}
          </p>
          
          <div className="flex gap-2 flex-wrap justify-center w-full max-w-[480px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
              const active = val <= (hovered || rating);
              return (
                <button
                  key={val}
                  onClick={() => setRating(val)}
                  onMouseEnter={() => setHovered(val)}
                  onMouseLeave={() => setHovered(0)}
                  className="w-10 h-12 rounded flex items-center justify-center font-bold text-lg font-mono transition-all duration-150 transform hover:scale-110 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300 shadow-md"
                  style={{
                    background: active ? getGradientForRating(val) : "rgba(255,255,255,0.03)",
                    color: active ? "#fff" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.05)"}`,
                    textShadow: active ? "0 1px 3px rgba(0,0,0,0.5)" : "none",
                  }}
                >
                  {val}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between w-full max-w-[440px] text-[10px] opacity-50 uppercase tracking-[0.2em] mt-3 font-bold text-slate-300">
            <span>{t.feedbackLowValue}</span>
            <span>{t.feedbackHighValue}</span>
          </div>
        </div>

        <div className="mb-8 relative">
          <label className="block text-[11px] font-bold mb-2 uppercase tracking-widest text-slate-400">
            {t.feedbackNotesLabel}
          </label>
          <textarea
            value={textNotes}
            onChange={(e) => setTextNotes(e.target.value)}
            className="w-full min-h-[100px] rounded-xl px-5 py-4 resize-y text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            style={{
              background: "rgba(0,0,0,0.4)",
              color: "var(--text-color, #e2e8f0)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            placeholder={t.feedbackNotesPlaceholder}
          />
        </div>

        <div className="flex gap-4 w-full mt-2">
          <button 
            className="flex-1 py-3.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all hover:bg-white/10 hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
            onClick={handleSkip}
          >
            {t.feedbackSkip}
          </button>
          <button 
            className="flex-[2] py-3.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(56,189,248,0.3)] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed cursor-pointer"
            style={{ 
              background: "linear-gradient(to right, #0ea5e9, #38bdf8)", 
              color: "#000",
              textShadow: "0 1px 2px rgba(255,255,255,0.3)"
            }}
            onClick={handleSubmit}
            disabled={rating === 0}
          >
            {t.feedbackSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostTaskFeedbackModal;