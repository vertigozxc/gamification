import { useState, useEffect } from "react";
import { useTheme } from "../../ThemeContext";
import { IconDice } from "../icons/Icons";

function RerollConfirmModal({ open, onCancel, onConfirm, quests = [], completedIds = [] }) {
  const { t } = useTheme();
  
  const uncompletedQuests = quests.filter(q => !completedIds.includes(q.id));
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
    } else {
      setSelectedIds([]);
    }
  }, [open]); // intentionally omitting quests/completedIds so we don't reset on every tick

  function toggleQuestSelection(questId) {
    setSelectedIds((prev) => {
      if (prev.includes(questId)) {
        return prev.filter((id) => id !== questId);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, questId];
    });
  }

  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onCancel}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="mb-2 flex justify-center" style={{ color: "var(--color-accent)" }}><IconDice size={48} /></div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.rerollTitle}</h2>
        <p className="logout-confirm-msg" style={{ marginBottom: '1rem' }}>
          {t.rerollMessage}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300 mb-3">
          {t.rerollWarning}
        </p>

        {uncompletedQuests.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-3 px-1">
              <p className="text-[11px] font-semibold text-slate-300 leading-snug">
                {t.rerollSelectionHint}
              </p>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 whitespace-nowrap">
                {t.rerollSelectionCount.replace('{count}', String(selectedIds.length))}
              </span>
            </div>
            <div className="flex flex-col gap-2 mb-4 max-h-[40vh] overflow-y-auto px-1">
            {uncompletedQuests.map((quest) => {
              const isSelected = selectedIds.includes(quest.id);
              const selectionLimitReached = selectedIds.length >= 3 && !isSelected;

              return (
              <label 
                key={quest.id} 
                className={`reroll-option flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-indigo-900/40 border-indigo-400' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                } ${isSelected ? 'reroll-option-selected' : 'reroll-option-idle'} ${selectionLimitReached ? 'opacity-60' : ''}`}
              >
                <div className="mt-0.5">
                  <input 
                    type="checkbox"
                    name="reroll-target" 
                    value={quest.id}
                    checked={isSelected}
                    disabled={selectionLimitReached}
                    onChange={() => toggleQuestSelection(quest.id)}
                    className="w-4 h-4 text-indigo-500 bg-slate-900 border-slate-600 focus:ring-indigo-600"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="reroll-option-category text-[10px] font-bold tracking-wider uppercase text-slate-400">{quest.category}</span>
                    <span className="reroll-option-xp text-xs font-bold">+{quest.xp} XP</span>
                  </div>
                  <h4 className="cinzel text-sm text-white font-bold leading-snug">{quest.title}</h4>
                </div>
              </label>
              );
            })}
            </div>
          </>
        ) : (
          <p className="text-slate-400 text-sm mb-4">{t.rerollNoRemainingDaily}</p>
        )}

        {uncompletedQuests.length > 0 && selectedIds.length >= 3 ? (
          <p className="text-xs text-slate-400 mb-4">{t.rerollLimitReached}</p>
        ) : null}

        <div className="logout-confirm-actions">
          <button className="logout-confirm-cancel cinzel" onClick={onCancel}>{t.cancelLabel}</button>
          <button
            className="logout-confirm-proceed cinzel"
            disabled={selectedIds.length === 0}
            style={{ opacity: selectedIds.length > 0 ? 1 : 0.5 }}
            onClick={() => onConfirm(selectedIds)}
          >
            {t.rerollConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RerollConfirmModal;