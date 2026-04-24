import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import CustomHabitManager from "./CustomHabitManager";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";
import QuestGroupCard from "../QuestGroupCard";
import CategoryFilterRow from "../CategoryFilterRow";
import InputWithClear from "../InputWithClear";
import { groupQuests, availableCategories, matchesCategory } from "../../utils/questGrouping";

const TOKEN_COST = 7;

function PinnedReplacementModal({
  open,
  onClose,
  replacePinnedSearch,
  onReplacePinnedSearchChange,
  filteredReplacePinnedQuests,
  allEligibleQuestOptions,
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
  onDeleteCustomQuest,
  selectionLimit = 2
}) {
  const { t, tf, translateCategory } = useTheme();
  const SELECTION_LIMIT = Math.max(1, Number(selectionLimit) || 2);
  const [sheetAnim, setSheetAnim] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [habitsTab, setHabitsTab] = useState("presets");
  // Snapshot of which quest IDs were selected when the picker opened.
  // Sort + filter pin those groups to the top and keep them visible
  // regardless of search/category — so subsequent taps never cause the
  // tapped card to "jump" away and the user always sees their prior
  // picks above the search results.
  const [initialSelectedIds, setInitialSelectedIds] = useState([]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setSheetAnim(true));
      setInitialSelectedIds(Array.isArray(replacePinnedQuestIds) ? [...replacePinnedQuestIds] : []);
      return () => cancelAnimationFrame(id);
    }
    setSheetAnim(false);
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nonCustomQuests = useMemo(
    () =>
      Array.isArray(filteredReplacePinnedQuests)
        ? filteredReplacePinnedQuests.filter((q) => !q.isCustom)
        : [],
    [filteredReplacePinnedQuests]
  );

  const categoryOptions = useMemo(() => availableCategories(nonCustomQuests), [nonCustomQuests]);
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0 };
    const groups = groupQuests(nonCustomQuests);
    for (const group of groups) {
      const cat = String(group.representative?.category || "").toUpperCase();
      counts.ALL += 1;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [nonCustomQuests]);
  const filteredByCategory = useMemo(
    () => nonCustomQuests.filter((q) => matchesCategory(q, categoryFilter)),
    [nonCustomQuests, categoryFilter]
  );
  const questGroups = useMemo(() => {
    const filteredGroups = groupQuests(filteredByCategory);
    const initialSet = new Set(initialSelectedIds);

    // When the user picks a specific category, honour the filter
    // strictly — only show quests that match. (Previously we also
    // surfaced already-picked habits from other categories, which
    // made the filter feel broken.) For ALL, we still bring back
    // initial picks that a search term might otherwise drop.
    let combined;
    if (categoryFilter === "ALL") {
      const fullPool = Array.isArray(allEligibleQuestOptions)
        ? allEligibleQuestOptions.filter((q) => !q.isCustom)
        : nonCustomQuests;
      const initialGroupsFromFullPool = groupQuests(fullPool).filter(
        (g) => g.variants.some((q) => initialSet.has(q.id))
      );
      const filteredKeys = new Set(filteredGroups.map((g) => g.key));
      const missingInitialGroups = initialGroupsFromFullPool.filter(
        (g) => !filteredKeys.has(g.key)
      );
      combined = [...missingInitialGroups, ...filteredGroups];
    } else {
      combined = filteredGroups;
    }

    // Sort: groups with any initially-selected quest first. Uses the
    // open-time snapshot, not live selection, so tapping a card during
    // the session never reorders the list under the user's finger.
    return combined.slice().sort((a, b) => {
      const aSelected = a.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      const bSelected = b.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredByCategory, nonCustomQuests, initialSelectedIds, allEligibleQuestOptions, categoryFilter]);

  const selectedCount = Array.isArray(replacePinnedQuestIds) ? replacePinnedQuestIds.length : 0;
  const selectionComplete = selectedCount === SELECTION_LIMIT;
  const hasEnoughTokens = (Number(tokens) || 0) >= TOKEN_COST;
  const canAfford = isFreePinnedReroll || hasEnoughTokens;
  const primaryDisabled = replacePinnedSaving || !selectionComplete || !canAfford;

  const swipeBind = useEdgeSwipeBack(onClose);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const progressPct = Math.min(100, Math.round((selectedCount / SELECTION_LIMIT) * 100));

  return (
    <div
      className="logout-confirm-overlay"
      onClick={handleOverlayClick}
      {...swipeBind}
      style={{
        zIndex: 85,
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
        <div style={{ padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 14px) 16px 12px", borderBottom: "1px solid var(--card-border-idle)" }}>
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
                {tf("replacePinnedTitle", { pinned: SELECTION_LIMIT })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.cancelLabel}
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
          {/* Segmented slide bar: Presets ↔ Custom. Same pattern as the
              first-setup habit picker. */}
          <div
            role="tablist"
            className="onb-habits-tabs"
            style={{ "--onb-tabs-count": 2, "--onb-tabs-active": habitsTab === "custom" ? 1 : 0 }}
          >
            <div className="onb-habits-tabs-slider" aria-hidden />
            <button
              type="button"
              role="tab"
              aria-selected={habitsTab === "presets"}
              onClick={() => setHabitsTab("presets")}
              className="onb-habits-tab cinzel mobile-pressable"
            >
              <span className="onb-habits-tab-ico" aria-hidden>📋</span>
              <span className="onb-habits-tab-label">{t.onboardingTabPresets || "Presets"}</span>
              <span className="onb-habits-tab-count">{questGroups.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={habitsTab === "custom"}
              onClick={() => setHabitsTab("custom")}
              className="onb-habits-tab cinzel mobile-pressable"
            >
              <span className="onb-habits-tab-ico" aria-hidden>✨</span>
              <span className="onb-habits-tab-label">{t.onboardingTabCustom || "Custom"}</span>
              <span className="onb-habits-tab-count">{Array.isArray(customQuests) ? customQuests.length : 0}</span>
            </button>
          </div>

          {habitsTab === "presets" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 10 }}>
                <CategoryFilterRow
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  categories={categoryOptions}
                  counts={categoryCounts}
                  translateCategory={translateCategory}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <InputWithClear
                  value={replacePinnedSearch}
                  onChange={onReplacePinnedSearchChange}
                  placeholder={t.replacePinnedSearchPlaceholder || t.onboardingSearch}
                  clearAriaLabel={t.clearLabel || "Clear"}
                  inputStyle={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid var(--card-border-idle)",
                    color: "#e2e8f0",
                    fontSize: 14,
                    minHeight: 44,
                    outline: "none"
                  }}
                />
              </div>
              {questGroups.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                    {t.onboardingNoMatch}
                  </p>
                  {(replacePinnedSearch || categoryFilter !== "ALL") ? (
                    <button
                      type="button"
                      onClick={() => {
                        onReplacePinnedSearchChange("");
                        setCategoryFilter("ALL");
                      }}
                      className="cinzel mobile-pressable"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--color-primary)",
                        background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                        color: "var(--color-primary)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "pointer"
                      }}
                    >
                      {t.clearFiltersLabel || "Clear filters"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {questGroups.map((group) => {
                    const selectedInGroup = group.variants.find((q) => replacePinnedQuestIds.includes(q.id));
                    const blocked = !selectedInGroup && selectedCount >= SELECTION_LIMIT;
                    return (
                      <QuestGroupCard
                        key={`replace-group-${group.key}`}
                        group={group}
                        selectedVariantId={selectedInGroup?.id ?? null}
                        disabled={blocked}
                        onPick={(id) => onToggleReplacePinnedQuest(id)}
                        onUnpick={(id) => onToggleReplacePinnedQuest(id)}
                        translateCategory={translateCategory}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <CustomHabitManager
                customQuests={customQuests}
                selectedIds={replacePinnedQuestIds}
                onToggleSelect={onToggleReplacePinnedQuest}
                selectionLimitReached={selectedCount >= SELECTION_LIMIT}
                accentVar="--color-primary"
                onCreateCustomQuest={onCreateCustomQuest}
                onUpdateCustomQuest={onUpdateCustomQuest}
                onDeleteCustomQuest={onDeleteCustomQuest}
                customSaving={customSaving}
                customError={customError}
                onClearCustomError={onClearCustomError}
              />
            </div>
          )}
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
              className="cinzel mobile-pressable"
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
              className="cinzel mobile-pressable"
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
