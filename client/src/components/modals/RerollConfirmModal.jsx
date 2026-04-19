import { useState, useEffect } from "react";
import { useTheme } from "../../ThemeContext";

function RerollConfirmModal({ open, onCancel, onConfirm, quests = [], completedIds = [] }) {
  const { t } = useTheme();
  
  const uncompletedQuests = quests.filter(q => !completedIds.includes(q.id));
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedId(prev => {
        const currentValid = quests.filter(q => !completedIds.includes(q.id));
        if (prev && currentValid.some(q => q.id === prev)) {
          return prev;
        }
        return currentValid.length > 0 ? currentValid[0].id : null;
      });
    } else {
      setSelectedId(null);
    }
  }, [open]); // intentionally omitting quests/completedIds so we don't reset on every tick

  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onCancel}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="text-5xl mb-2">🎲</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.rerollTitle}</h2>
        <p className="logout-confirm-msg" style={{ marginBottom: '1rem' }}>
          {t.rerollMessage}
        </p>

        {uncompletedQuests.length > 0 ? (
          <div className="flex flex-col gap-2 mb-4 max-h-[40vh] overflow-y-auto px-1">
            {uncompletedQuests.map((quest) => (
              <label 
                key={quest.id} 
                className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  selectedId === quest.id 
                    ? 'bg-indigo-900/40 border-indigo-400' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="mt-0.5">
                  <input 
                    type="radio" 
                    name="reroll-target" 
                    value={quest.id}
                    checked={selectedId === quest.id}
                    onChange={() => setSelectedId(quest.id)}
                    className="w-4 h-4 text-indigo-500 bg-slate-900 border-slate-600 focus:ring-indigo-600"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">{quest.category}</span>
                    <span className="text-xs font-bold text-yellow-500">+{quest.xp} XP</span>
                  </div>
                  <h4 className="cinzel text-sm text-white font-bold leading-snug">{quest.title}</h4>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm mb-4">{t.rerollNoRemainingDaily}</p>
        )}

        <div className="logout-confirm-actions">
          <button className="logout-confirm-cancel cinzel" onClick={onCancel}>{t.cancelLabel}</button>
          <button
            className="logout-confirm-proceed cinzel"
            disabled={!selectedId}
            style={{ opacity: selectedId ? 1 : 0.5 }}
            onClick={() => onConfirm(selectedId)}
          >
            {t.rerollConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RerollConfirmModal;