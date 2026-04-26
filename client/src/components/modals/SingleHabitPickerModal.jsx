import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";
import { fuzzyMatch } from "../../utils/fuzzySearch";
import QuestGroupCard from "../QuestGroupCard";
import CategoryFilterRow from "../CategoryFilterRow";
import InputWithClear from "../InputWithClear";
import CustomHabitManager from "./CustomHabitManager";
import { groupQuests, availableCategories, matchesCategory } from "../../utils/questGrouping";
import { IconSparkle, IconClose, IconList } from "../icons/Icons";

// Dedicated screen for filling ONE unlocked habit slot (triggered from the
// "New Habit Unlocked" card). Distinct from PinnedReplacementModal which
// replaces ALL pinned habits at once.
//
// Layout mirrors the OnboardingModal's habits picker so the two screens
// read as members of the same family:
//   • Slide bar: PRESETS | CUSTOM
//   • Presets tab — curated quest catalog with category filter +
//     compact search field (smaller padding, fontSize 13).
//   • Custom tab — full CustomHabitManager: lists every existing
//     custom habit the user already created (selectable, deletable),
//     plus the inline form to create a new one. Replaces the old
//     "create-only" tab which only let the user spawn a new habit
//     and offered no way to pick one of their existing customs.
export default function SingleHabitPickerModal({
  open,
  onClose,
  availableQuests = [],
  onPick,
  saving = false,
  errorMessage = "",
  // Custom-habit management surface. Match the OnboardingModal's prop
  // shape so the same handlers from useOnboardingPinned can be wired
  // to both screens without adapters.
  customQuests = [],
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest,
  customSaving = false,
  customError = "",
  onClearCustomError
}) {
  const { t, translateCategory } = useTheme();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sheetAnim, setSheetAnim] = useState(false);
  const [mode, setMode] = useState("presets"); // "presets" | "custom"
  // The CustomHabitManager opens an inline create / edit form that
  // pulls up the iOS keyboard. Mirror OnboardingModal's behaviour and
  // collapse the sticky footer button while it's expanded so the
  // form has the full visible viewport.
  const [customFormExpanded, setCustomFormExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedId(null);
      setSheetAnim(false);
      setMode("presets");
      setCustomFormExpanded(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setSheetAnim(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Presets pool = all curated/non-custom quests from availableQuests.
  // The Custom tab lives inside CustomHabitManager and gets its own
  // raw `customQuests` list — so we explicitly drop isCustom entries
  // here to avoid showing them twice.
  const presetPool = useMemo(
    () => availableQuests.filter((q) => !q?.isCustom),
    [availableQuests]
  );

  const filteredQuests = useMemo(() => {
    const term = search.trim();
    let pool = presetPool;
    if (term) {
      pool = pool.filter((quest) => {
        const hay = `${quest?.title || ""} ${quest?.desc || quest?.description || ""}`;
        return fuzzyMatch(term, hay);
      });
    }
    return pool.filter((q) => matchesCategory(q, categoryFilter));
  }, [presetPool, search, categoryFilter]);

  const categoryOptions = useMemo(() => availableCategories(presetPool), [presetPool]);
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0 };
    const groups = groupQuests(presetPool);
    for (const group of groups) {
      const cat = String(group.representative?.category || "").toUpperCase();
      counts.ALL += 1;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [presetPool]);

  // Single picker starts with no selection; the only sort concern is to
  // keep tapped cards from jumping. Since the first tap snapshots the
  // order anyway (see groupQuests memo — no resort on selection change),
  // we don't sort by selectedId here.
  const questGroups = useMemo(() => groupQuests(filteredQuests), [filteredQuests]);

  const swipeBind = useEdgeSwipeBack(onClose);

  if (!open) return null;

  const heading = t.singleHabitPickerHeading || "Pick a new habit";
  const subtitle = t.singleHabitPickerSubtitle || "One habit fills your newly unlocked slot.";
  const placeholder = t.onboardingSearch || "Search habits…";
  const confirmLabel = t.singleHabitPickerConfirm || "Add habit";
  const empty = t.singleHabitPickerEmpty || "No matching habits.";
  // Reuse the OnboardingModal's i18n keys for tab labels so the
  // wording stays in lock-step ("Presets" / "Custom") across both
  // habit-picking surfaces.
  const presetsTabLabel = t.onboardingTabPresets || "Presets";
  const customTabLabel = t.onboardingTabCustom || "Custom";
  const customCount = Array.isArray(customQuests) ? customQuests.length : 0;

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 86, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.76)" }}
      onClick={onClose}
      {...swipeBind}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--panel-bg)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: sheetAnim ? "translateY(0)" : "translateY(8px)",
          opacity: sheetAnim ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--panel-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 25%, transparent), color-mix(in srgb, var(--color-primary) 12%, transparent))",
                border: "1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20
              }}
            >
              <span style={{ color: "var(--color-primary)", display: "inline-flex" }}><IconSparkle size={20} /></span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel" style={{ color: "var(--color-primary)", fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                {heading}
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.cancelLabel || "Close"}
              className="ui-close-x"
            >
              <IconClose size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* Same segmented slide-bar pattern as OnboardingModal /
              PinnedReplacementModal — Presets vs Custom — so the picker
              reads as part of the same family of habit screens. The
              tab is always rendered (no longer gated on onCreateCustom)
              because the Custom tab is now the canonical place to
              browse existing custom habits, not just create new ones. */}
          <div
            role="tablist"
            className="onb-habits-tabs"
            style={{ "--onb-tabs-count": 2, "--onb-tabs-active": mode === "custom" ? 1 : 0, marginTop: 12 }}
          >
            <div className="onb-habits-tabs-slider" aria-hidden />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "presets"}
              onClick={() => setMode("presets")}
              className="onb-habits-tab cinzel mobile-pressable"
            >
              <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconList size={14} /></span>
              <span className="onb-habits-tab-label">{presetsTabLabel}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "custom"}
              onClick={() => setMode("custom")}
              className="onb-habits-tab cinzel mobile-pressable"
            >
              <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconSparkle size={14} /></span>
              <span className="onb-habits-tab-label">{customTabLabel}</span>
              {customCount > 0 ? (
                <span className="onb-habits-tab-count">{customCount}</span>
              ) : null}
            </button>
          </div>

          {/* Search input — Presets tab only. Style mirrors the
              OnboardingModal's habit search (padding 8/12, fontSize
              13, minHeight 36) so the two screens look like siblings
              instead of one bulky input on the picker and a slim one
              in setup. */}
          {mode === "presets" ? (
            <div style={{ marginTop: 12 }}>
              <InputWithClear
                value={search}
                onChange={setSearch}
                placeholder={placeholder}
                clearAriaLabel={t.clearLabel || "Clear"}
                inputStyle={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid var(--card-border-idle)",
                  color: "#e2e8f0",
                  fontSize: 13,
                  minHeight: 36,
                  outline: "none"
                }}
              />
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 100px" }}>
        {mode === "custom" ? (
          // Custom tab — full CustomHabitManager surface. Existing custom
          // habits are listed and tappable (single-select via the
          // selectedIds adapter below); the "Create new" inline form is
          // baked in. Replaces the old create-only mode that gave the
          // user no way to pick from their own habits.
          <CustomHabitManager
            customQuests={customQuests}
            selectedIds={selectedId ? [selectedId] : []}
            onToggleSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            // Single-pick: there is no per-tap limit. Tapping a different
            // existing custom switches the selection rather than blocking.
            selectionLimitReached={false}
            accentVar="--color-primary"
            allowDelete={true}
            onCreateCustomQuest={onCreateCustomQuest}
            onUpdateCustomQuest={onUpdateCustomQuest}
            onDeleteCustomQuest={onDeleteCustomQuest}
            customSaving={customSaving}
            customError={customError}
            onClearCustomError={onClearCustomError}
            onFormStateChange={({ open: formOpen, hasKeyboard }) => setCustomFormExpanded(formOpen && hasKeyboard)}
          />
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              <CategoryFilterRow
                value={categoryFilter}
                onChange={setCategoryFilter}
                categories={categoryOptions}
                counts={categoryCounts}
                translateCategory={translateCategory}
              />
            </div>
            {questGroups.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 13, marginTop: 24 }}>{empty}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {questGroups.map((group) => {
                  const selectedInGroup = group.variants.find((q) => Number(q.id) === Number(selectedId));
                  return (
                    <QuestGroupCard
                      key={`single-habit-${group.key}`}
                      group={group}
                      selectedVariantId={selectedInGroup?.id ?? null}
                      onPick={(id) => setSelectedId(id)}
                      onUnpick={() => setSelectedId(null)}
                      translateCategory={translateCategory}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--panel-border)",
            background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
            backdropFilter: "blur(8px)",
            // Mirror OnboardingModal: hide the sticky footer while the
            // CustomHabitManager's create/edit form is up so the iOS
            // keyboard doesn't push the Add Habit button off-screen.
            display: customFormExpanded ? "none" : undefined
          }}
        >
          {errorMessage ? (
            <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 8px" }}>{errorMessage}</p>
          ) : null}
          <button
            type="button"
            disabled={!selectedId || saving}
            onClick={() => {
              if (selectedId) onPick?.(selectedId);
            }}
            className="cinzel mobile-pressable"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.08em",
              border: `1px solid color-mix(in srgb, var(--color-primary) ${selectedId ? 65 : 30}%, transparent)`,
              background: selectedId
                ? "var(--color-primary)"
                : "rgba(148,163,184,0.18)",
              color: selectedId ? "#1b1410" : "var(--color-muted)",
              cursor: selectedId ? "pointer" : "not-allowed",
              boxShadow: selectedId ? "0 6px 18px color-mix(in srgb, var(--color-primary) 35%, transparent)" : "none",
              transition: "background 150ms ease, box-shadow 150ms ease"
            }}
          >
            {saving ? (t.onboardingSaving || "Saving…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
