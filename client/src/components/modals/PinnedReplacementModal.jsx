import { useTheme } from "../../ThemeContext";

function PinnedReplacementModal({
  open,
  onClose,
  replacePinnedSearch,
  onReplacePinnedSearchChange,
  filteredReplacePinnedQuests,
  replacePinnedQuestIds,
  onToggleReplacePinnedQuest,
  replacePinnedError,
  replacePinnedSaving,
  tokens,
  isFreePinnedReroll,
  onBuy
}) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div className="logout-confirm-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: "900px", width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="text-4xl mb-2">🧩</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>{t.replacePinnedHeading}</h2>
        <p className="logout-confirm-msg">
          {t.replaceDetail}
          <br />
          <span className="cinzel text-xs tracking-widest" style={{ color: "var(--color-accent)" }}>
            {isFreePinnedReroll ? t.replacePinnedFreeCost : t.replacePinnedCost}
          </span>
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="cinzel text-xs tracking-widest uppercase" style={{ color: "var(--color-accent)" }}>{t.replacePinnedTitle}</label>
          </div>
          <input
            type="text"
            value={replacePinnedSearch}
            onChange={(event) => onReplacePinnedSearchChange(event.target.value)}
            className="w-full mb-2 rounded-lg px-3 py-2 text-slate-200"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)" }}
            placeholder={t.replacePinnedSearchPlaceholder}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredReplacePinnedQuests.map((quest) => {
              const isSelected = replacePinnedQuestIds.includes(quest.id);
              const blocked = !isSelected && replacePinnedQuestIds.length >= 4;
              return (
                <button
                  key={"replace-" + quest.id}
                  type="button"
                  onClick={() => onToggleReplacePinnedQuest(quest.id)}
                  disabled={blocked}
                  className="text-left rounded-lg border p-3 transition"
                  style={isSelected ? { borderColor: "var(--color-accent)", background: "var(--color-accent-dim)" } : blocked ? { borderColor: "var(--card-border-idle)", background: "var(--card-bg)", opacity: 0.4, cursor: "not-allowed" } : { borderColor: "var(--card-border-idle)", background: "var(--card-bg)" }}
                >
                  <p className="cinzel text-sm text-slate-100 font-bold">{quest.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{quest.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {replacePinnedError ? <p className="text-red-400 text-sm mt-3 font-bold">{replacePinnedError}</p> : null}

        <div className="logout-confirm-actions mt-4">
          <button className="logout-confirm-cancel cinzel" onClick={onClose}>{t.cancelLabel}</button>
          <button
            className="logout-confirm-proceed cinzel"
            onClick={onBuy}
            disabled={replacePinnedSaving || (!isFreePinnedReroll && tokens < 7)}
            style={{
              opacity: replacePinnedSaving || (!isFreePinnedReroll && tokens < 7) ? 0.6 : 1,
              cursor: replacePinnedSaving || (!isFreePinnedReroll && tokens < 7) ? "not-allowed" : "pointer"
            }}
          >
            {replacePinnedSaving ? t.onboardingSaving : isFreePinnedReroll ? t.rerollFree : tokens < 7 ? t.notEnough : t.customizePrefix + " 7 " + t.tokenPlural.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PinnedReplacementModal;