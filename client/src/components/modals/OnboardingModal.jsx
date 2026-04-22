import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import CustomHabitManager from "./CustomHabitManager";

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
  onComplete,
  customQuests,
  customSaving,
  customError,
  onClearCustomError,
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest,
  selectionLimit = 2,
  randomQuestCount = 2
}) {
  const SELECTION_LIMIT = Math.max(1, Number(selectionLimit) || 2);
  const RANDOM_COUNT = Math.max(1, Number(randomQuestCount) || 2);
  const { t, tf } = useTheme();
  const [showWarning, setShowWarning] = useState(false);
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
    () => (Array.isArray(filteredOnboardingQuests) ? filteredOnboardingQuests.filter((q) => !q.isCustom) : []),
    [filteredOnboardingQuests]
  );

  const selectedCount = Array.isArray(onboardingQuestIds) ? onboardingQuestIds.length : 0;
  const selectionComplete = selectedCount === SELECTION_LIMIT;
  const primaryDisabled = onboardingSaving || !onboardingName.trim() || !selectionComplete;
  const progressPct = Math.min(100, Math.round((selectedCount / SELECTION_LIMIT) * 100));

  const handleStartRequest = () => {
    if (onboardingName.trim() === "" || selectedCount !== SELECTION_LIMIT) {
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
      style={{
        zIndex: 84,
        alignItems: "stretch",
        justifyContent: "stretch",
        padding: 0,
        background: "rgba(0,0,0,0.72)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxWidth: "100vw",
          maxHeight: "100dvh",
          background: "var(--card-bg, #0f172a)",
          border: "none",
          borderRadius: 0,
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          transform: sheetAnim ? "translateY(0)" : "translateY(16px)",
          opacity: sheetAnim ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 16px) 16px 12px", borderBottom: "1px solid var(--card-border-idle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                className="cinzel"
                style={{
                  color: "var(--color-primary)",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {t.onboardingTitle}
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", whiteSpace: "pre-line" }}>
                {tf("onboardingIntro", { pinned: SELECTION_LIMIT, random: RANDOM_COUNT })}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseClick}
              title={t.cancelAndLogout}
              aria-label={t.cancelAndLogout}
              className="ui-close-x"
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
                    background: selectionComplete ? "var(--color-accent)" : "var(--color-primary)",
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
                color: "#cbd5e1",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                fontSize: 12
              }}
            >
              <span style={{ fontSize: 14 }}>🧭</span>
              <span className="cinzel" style={{ fontWeight: 700 }}>
                {tf("onboardingPick", { pinned: SELECTION_LIMIT })}
              </span>
            </div>
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
          <label
            className="cinzel"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-primary)"
            }}
          >
            {t.onboardingNickname}
          </label>
          <input
            type="text"
            value={onboardingName}
            onChange={(event) => onOnboardingNameChange(event.target.value)}
            maxLength={32}
            className="cinzel"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid var(--card-border-idle)",
              color: "#e2e8f0",
              fontSize: 16,
              minHeight: 44,
              outline: "none"
            }}
            placeholder={t.onboardingNicknamePlaceholder}
          />

          <div style={{ marginTop: 14 }}>
            <input
              type="text"
              value={onboardingQuestSearch}
              onChange={(event) => onOnboardingQuestSearchChange(event.target.value)}
              placeholder={t.onboardingSearch}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--card-border-idle)",
                color: "#e2e8f0",
                fontSize: 16,
                minHeight: 44,
                outline: "none"
              }}
            />
          </div>

          <CustomHabitManager
            customQuests={customQuests}
            selectedIds={onboardingQuestIds}
            onToggleSelect={onToggleOnboardingQuest}
            selectionLimitReached={selectedCount >= SELECTION_LIMIT}
            accentVar="--color-primary"
            allowDelete={true}
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
                  color: "var(--color-primary)"
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
                  const isSelected = onboardingQuestIds.includes(quest.id);
                  const blocked = !isSelected && selectedCount >= SELECTION_LIMIT;
                  return (
                    <button
                      key={`onboarding-${quest.id}`}
                      type="button"
                      onClick={() => onToggleOnboardingQuest(quest.id)}
                      disabled={blocked}
                      style={{
                        position: "relative",
                        textAlign: "left",
                        padding: "12px 44px 12px 14px",
                        borderRadius: 12,
                        minHeight: 56,
                        border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--card-border-idle)",
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
                          border: `2px solid ${isSelected ? "var(--color-primary)" : "rgba(255,255,255,0.2)"}`,
                          background: isSelected ? "var(--color-primary)" : "transparent",
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
          {onboardingError ? (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 8px", textAlign: "center", fontWeight: 600 }}>
              {onboardingError}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleCloseClick}
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
              {t.logOutAndCancel || t.cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleStartRequest}
              disabled={primaryDisabled}
              className="cinzel"
              style={{
                flex: 2,
                minHeight: 48,
                borderRadius: 12,
                background: primaryDisabled
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                border: "none",
                color: primaryDisabled ? "#64748b" : "#0b1120",
                fontSize: 13,
                fontWeight: 800,
                cursor: primaryDisabled ? "not-allowed" : "pointer",
                letterSpacing: "0.05em",
                boxShadow: primaryDisabled ? "none" : "0 8px 20px rgba(56,189,248,0.2)"
              }}
            >
              {onboardingSaving ? t.onboardingSaving : t.onboardingBegin}
            </button>
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="logout-confirm-overlay" style={{ zIndex: 100, background: "rgba(0,0,0,0.6)" }}>
          <div className="logout-confirm-card" style={{ maxWidth: 400 }}>
            <div className="text-4xl mt-1 mb-4 text-center">⚠️</div>
            <h2 className="cinzel text-center text-2xl mb-4" style={{ color: "var(--color-primary)" }}>{t.confirmTitle}</h2>
            <div className="mb-5 px-3 py-2 text-center">
              <p className="text-lg text-slate-100 font-medium leading-relaxed mb-3">
                {tf("confirmPinnedMessage", { pinned: SELECTION_LIMIT })}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t.confirmPinnedSub}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                className="cinzel"
                onClick={() => setShowWarning(false)}
                style={{
                  minHeight: 44,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--card-border-idle)",
                  background: "transparent",
                  color: "#cbd5e1",
                  cursor: "pointer"
                }}
              >
                {t.cancelLabel}
              </button>
              <button
                className="cinzel"
                style={{
                  minHeight: 44,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                  color: "#0b1120",
                  fontWeight: 800,
                  cursor: "pointer"
                }}
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
