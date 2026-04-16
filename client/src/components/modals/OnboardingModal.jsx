import { useTheme } from "../../ThemeContext";
import { useState, useMemo } from "react";

function OnboardingModal({
  open,
  onClose,
  onboardingName,
  onOnboardingNameChange,
  onboardingQuestIds,
  onboardingQuestSearch,
  onOnboardingQuestSearchChange,
  filteredOnboardingQuests,
  onToggleOnboardingQuest,
  onboardingError,
  onboardingSaving,
  onComplete
}) {
  const { t } = useTheme();
  const [showWarning, setShowWarning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  const categories = useMemo(() => {
    const grouped = {};
    filteredOnboardingQuests.forEach(q => {
      const cat = q.category || 'UNCATEGORIZED';
      if(!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(q);
    });
    return grouped;
  }, [filteredOnboardingQuests]);

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({...prev, [cat]: !prev[cat]}));
  };

  const handleStartRequest = () => {
    if (onboardingName.trim() === "" || onboardingQuestIds.length !== 3) {
      onComplete(); // let parent show error
    } else {
      setShowWarning(true);
    }
  };

  const handleCloseClick = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div 
      className="logout-confirm-overlay" 
      style={{ zIndex: 80 }}
      onClick={(e) => {
        // Close only if clicking on overlay background, not the card
        if (e.target === e.currentTarget) {
          handleCloseClick();
        }
      }}
    >
      <div className="logout-confirm-card relative" style={{ maxWidth: "900px", width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>

        <button
          onClick={handleCloseClick}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          style={{ background: "transparent", border: "none", padding: "8px", cursor: "pointer", fontSize: "20px" }}
          title={t.cancelAndLogout}
        >
          ✕
        </button>

        <div className="text-4xl mb-2">🧭</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>{t.onboardingTitle}</h2>
        <p className="logout-confirm-msg" style={{ whiteSpace: "pre-line" }}>{t.onboardingIntro}</p>

        <div className="mt-4">
          <label className="cinzel text-xs tracking-widest uppercase block mb-2" style={{ color: "var(--color-primary)" }}>{t.onboardingNickname}</label>
          <input
            type="text"
            value={onboardingName}
            onChange={(event) => onOnboardingNameChange(event.target.value)}
            maxLength={32}
            className="w-full rounded-lg px-3 py-2 cinzel"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)", color: "var(--color-primary)" }}
            placeholder={t.onboardingNicknamePlaceholder}
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <label className="cinzel text-xs tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.onboardingPick}</label>
            <span className="cinzel text-xs text-slate-300">{onboardingQuestIds.length} / 3 {t.onboardingSelected}</span>
          </div>
          <input
            type="text"
            value={onboardingQuestSearch}
            onChange={(event) => onOnboardingQuestSearchChange(event.target.value)}
            className="w-full mb-2 rounded-lg px-3 py-2 text-slate-200"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)" }}
            placeholder={t.onboardingSearch}
          />
          <div className="max-h-64 overflow-y-auto pr-1">
            {Object.keys(categories).length === 0 && (
              <p className="text-xs text-slate-500 mt-2">{t.onboardingNoMatch}</p>
            )}
            {Object.keys(categories).map(cat => (
              <div key={cat} className="mb-2 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--card-border-idle)' }}>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="w-full text-left p-3 font-bold cinzel text-sm flex justify-between items-center"
                  style={{ background: 'var(--card-bg)', color: 'var(--color-primary)' }}
                >
                  <span>{cat} ({categories[cat].length})</span>
                  <span>{expandedCategories[cat] ? '▲' : '▼'}</span>
                </button>
                {expandedCategories[cat] && (
                  <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {categories[cat].map(quest => {
                      const isSelected = onboardingQuestIds.includes(quest.id);
                      const blocked = !isSelected && onboardingQuestIds.length >= 3;
                      return (
                        <button
                          key={quest.id}
                          type="button"
                          onClick={() => onToggleOnboardingQuest(quest.id)}
                          disabled={blocked}
                          className="text-left rounded-lg border p-3 transition h-full"
                          style={isSelected ? { borderColor: "var(--color-primary)", background: "var(--color-accent-dim)" } : blocked ? { borderColor: "var(--card-border-idle)", background: "var(--card-bg)", opacity: 0.4, cursor: "not-allowed" } : { borderColor: "var(--card-border-idle)", background: "var(--card-bg)" }}
                        >
                          <p className="cinzel text-sm text-slate-100 font-bold">{quest.title}</p>
                          <p className="text-xs text-slate-400 mt-1">{quest.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {onboardingError ? <p className="text-red-400 text-sm mt-3 font-bold">{onboardingError}</p> : null}

        <div className="logout-confirm-actions mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            className="logout-confirm-proceed cinzel"
            onClick={handleStartRequest}
            disabled={onboardingSaving}
            style={{
              opacity: onboardingSaving ? 0.6 : 1,
              cursor: onboardingSaving ? "not-allowed" : "pointer"
            }}
          >
            {onboardingSaving ? t.onboardingSaving : t.onboardingBegin}
          </button>

          <button
            className="text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            onClick={handleCloseClick}
            type="button"
            style={{ padding: "8px 16px" }}
          >
            ← {t.logOutAndCancel}
          </button>
        </div>
      </div>

      {showWarning && (
        <div className="logout-confirm-overlay" style={{ zIndex: 100 }}>
          <div className="logout-confirm-card" style={{ maxWidth: "400px" }}>
            <div className="text-4xl mt-1 mb-5 text-center">⚠️</div>
            <h2 className="cinzel text-center text-2xl mb-5" style={{ color: "var(--color-primary)" }}>{t.confirmTitle}</h2>
            <div className="mb-7 px-3 py-4  text-center" style={{ borderColor: "var(--card-border-idle)",  }}>
              <p className="text-lg text-slate-100 font-medium leading-relaxed mb-3">
                {t.confirmPinnedMessage}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t.confirmPinnedSub}
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                className="px-4 py-2 rounded border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                onClick={() => setShowWarning(false)}
              >
                {t.cancelLabel}
              </button>
              <button
                className="px-4 py-2 rounded cinzel font-bold text-slate-900 transition"
                style={{ background: "var(--color-primary)" }}
                onClick={() => {
                  setShowWarning(false);
                  onComplete();
                }}
              >
                {t.continueLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingModal;
