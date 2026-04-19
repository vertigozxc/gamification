import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import CustomHabitManager from "./CustomHabitManager";

const SELECTION_LIMIT = 3;
const TOKEN_COST = 7;

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
  onBuy,
  customQuests,
  customSaving,
  customError,
  onClearCustomError,
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest
}) {
  const { t } = useTheme();
  const [sheetAnim, setSheetAnim] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setSheetAnim(true));
      return () => cancelAnimationFrame(id);
    }
    setSheetAnim(false);
    return undefined;
  }, [open]);

  const nonCustomQuests = useMemo(
    () =>
      Array.isArray(filteredReplacePinnedQuests)
        ? filteredReplacePinnedQuests.filter((q) => !q.isCustom)
        : [],
    [filteredReplacePinnedQuests]
  );

  const selectedCount = Array.isArray(replacePinnedQuestIds) ? replacePinnedQuestIds.length : 0;
  const selectionComplete = selectedCount === SELECTION_LIMIT;
  const hasEnoughTokens = (Number(tokens) || 0) >= TOKEN_COST;
  const canAfford = isFreePinnedReroll || hasEnoughTokens;
  const primaryDisabled = replacePinnedSaving || !selectionComplete || !canAfford;

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const progressPct = Math.min(100, Math.round((selectedCount / SELECTION_LIMIT) * 100));

  return (
    <div
      className="logout-confirm-overlay"
      onClick={handleOverlayClick}
      style={{
        zIndex: 85,
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
        background: "rgba(0,0,0,0.55)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "92dvh",
          background: "var(--card-bg, #0f172a)",
          border: "1px solid var(--card-border-idle)",
          borderBottom: "none",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          transform: sheetAnim ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
        </div>

        <div style={{ padding: "4px 16px 12px", borderBottom: "1px solid var(--card-border-idle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                className="cinzel"
                style={{
                  color: "var(--color-accent)",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {t.replacePinnedHeading}
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
                {t.replacePinnedTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.cancelLabel}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--card-border-idle)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#cbd5e1" }}>
                  {t.onboardingSelected
                    ? `${selectedCount} / ${SELECTION_LIMIT} ${t.onboardingSelected}`
                    : `${selectedCount} / ${SELECTION_LIMIT}`}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: selectionComplete ? "var(--color-accent)" : "var(--color-primary, #8b5cf6)",
                    transition: "width 200ms ease"
                  }}
                />
              </div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid var(--card-border-idle)",
                background: "rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: 14 }}>🪙</span>
              <span className="cinzel" style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>
                {Number(tokens) || 0}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: isFreePinnedReroll
                ? "linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${isFreePinnedReroll ? "rgba(16,185,129,0.35)" : "var(--card-border-idle)"}`,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <span style={{ fontSize: 16 }}>{isFreePinnedReroll ? "🎁" : "🪙"}</span>
            <span style={{ fontSize: 12, color: isFreePinnedReroll ? "#6ee7b7" : "#e2e8f0" }}>
              {isFreePinnedReroll
                ? t.replacePinnedFreeCost
                : t.replacePinnedCost}
            </span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "12px 16px 16px"
          }}
        >
          <input
            type="text"
            value={replacePinnedSearch}
            onChange={(e) => onReplacePinnedSearchChange(e.target.value)}
            placeholder={t.replacePinnedSearchPlaceholder || t.onboardingSearch}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid var(--card-border-idle)",
              color: "#e2e8f0",
              fontSize: 14,
              minHeight: 44,
              outline: "none"
            }}
          />

          <CustomHabitManager
            customQuests={customQuests}
            selectedIds={replacePinnedQuestIds}
            onToggleSelect={onToggleReplacePinnedQuest}
            selectionLimitReached={selectedCount >= SELECTION_LIMIT}
            accentVar="--color-accent"
            onCreateCustomQuest={onCreateCustomQuest}
            onUpdateCustomQuest={onUpdateCustomQuest}
            onDeleteCustomQuest={onDeleteCustomQuest}
            customSaving={customSaving}
            customError={customError}
            onClearCustomError={onClearCustomError}
          />

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                className="cinzel"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)"
                }}
              >
                {t.browseHabitsSection}
              </span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{nonCustomQuests.length}</span>
            </div>
            {nonCustomQuests.length === 0 ? (
              <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", padding: "16px 0" }}>
                {t.onboardingNoMatch}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nonCustomQuests.map((quest) => {
                  const isSelected = replacePinnedQuestIds.includes(quest.id);
                  const blocked = !isSelected && selectedCount >= SELECTION_LIMIT;
                  return (
                    <button
                      key={"replace-" + quest.id}
                      type="button"
                      onClick={() => onToggleReplacePinnedQuest(quest.id)}
                      disabled={blocked}
                      style={{
                        position: "relative",
                        textAlign: "left",
                        padding: "12px 44px 12px 14px",
                        borderRadius: 12,
                        minHeight: 56,
                        border: isSelected ? "1px solid var(--color-accent)" : "1px solid var(--card-border-idle)",
                        background: isSelected ? "var(--color-accent-dim)" : "rgba(255,255,255,0.03)",
                        color: "#e2e8f0",
                        cursor: blocked ? "not-allowed" : "pointer",
                        opacity: blocked ? 0.45 : 1,
                        transition: "background 150ms ease, border-color 150ms ease"
                      }}
                    >
                      <p
                        className="cinzel"
                        style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.3 }}
                      >
                        {quest.title}
                      </p>
                      {quest.desc ? (
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.35 }}>
                          {quest.desc}
                        </p>
                      ) : null}
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: "50%",
                          right: 12,
                          transform: "translateY(-50%)",
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: `2px solid ${isSelected ? "var(--color-accent)" : "rgba(255,255,255,0.2)"}`,
                          background: isSelected ? "var(--color-accent)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#0f172a",
                          fontSize: 12,
                          fontWeight: 900
                        }}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--card-border-idle)",
            background: "rgba(0,0,0,0.35)"
          }}
        >
          {replacePinnedError ? (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 8px", textAlign: "center", fontWeight: 600 }}>
              {replacePinnedError}
            </p>
          ) : null}
          {!canAfford && !replacePinnedError ? (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 8px", textAlign: "center", fontWeight: 600 }}>
              {t.notEnough}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="cinzel"
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                background: "transparent",
                border: "1px solid var(--card-border-idle)",
                color: "#cbd5e1",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.05em"
              }}
            >
              {t.cancelLabel}
            </button>
            <button
              type="button"
              onClick={onBuy}
              disabled={primaryDisabled}
              className="cinzel"
              style={{
                flex: 2,
                minHeight: 48,
                borderRadius: 12,
                background: primaryDisabled
                  ? "rgba(255,255,255,0.08)"
                  : isFreePinnedReroll
                    ? "linear-gradient(90deg, #10b981, #059669)"
                    : "linear-gradient(90deg, var(--color-accent), #f97316)",
                border: "none",
                color: primaryDisabled ? "#64748b" : "#0b1120",
                fontSize: 13,
                fontWeight: 800,
                cursor: primaryDisabled ? "not-allowed" : "pointer",
                letterSpacing: "0.05em",
                boxShadow: primaryDisabled ? "none" : "0 8px 20px rgba(249,115,22,0.25)"
              }}
            >
              {replacePinnedSaving
                ? t.onboardingSaving
                : isFreePinnedReroll
                  ? t.rerollFree
                  : `${t.customizePrefix} · ${TOKEN_COST} 🪙`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PinnedReplacementModal;
