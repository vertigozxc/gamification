import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";
import { fuzzyMatch } from "../../utils/fuzzySearch";
import QuestGroupCard from "../QuestGroupCard";
import CategoryFilterRow from "../CategoryFilterRow";
import { groupQuests, availableCategories, matchesCategory } from "../../utils/questGrouping";

// Dedicated screen for filling ONE unlocked habit slot (triggered from the
// "New Habit Unlocked" card). Distinct from PinnedReplacementModal which
// replaces ALL pinned habits at once.
export default function SingleHabitPickerModal({
  open,
  onClose,
  availableQuests = [],
  onPick,
  saving = false,
  errorMessage = "",
  onCreateCustom,
  createSaving = false,
  createError = ""
}) {
  const { t, themeId, translateCategory } = useTheme();
  const isLight = themeId === "light";
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sheetAnim, setSheetAnim] = useState(false);
  const [mode, setMode] = useState("pick"); // "pick" | "create"
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newNeedsTimer, setNewNeedsTimer] = useState(false);
  const [newMinutes, setNewMinutes] = useState("30");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedId(null);
      setSheetAnim(false);
      setMode("pick");
      setNewTitle("");
      setNewDesc("");
      setNewNeedsTimer(false);
      setNewMinutes("30");
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

  const filteredQuests = useMemo(() => {
    const term = search.trim();
    let pool = availableQuests;
    if (term) {
      pool = pool.filter((quest) => {
        const hay = `${quest?.title || ""} ${quest?.desc || quest?.description || ""}`;
        return fuzzyMatch(term, hay);
      });
    }
    return pool.filter((q) => matchesCategory(q, categoryFilter));
  }, [availableQuests, search, categoryFilter]);

  const categoryOptions = useMemo(() => availableCategories(availableQuests), [availableQuests]);
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0 };
    const groups = groupQuests(availableQuests);
    for (const group of groups) {
      const cat = String(group.representative?.category || "").toUpperCase();
      counts.ALL += 1;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [availableQuests]);

  const questGroups = useMemo(() => {
    const groups = groupQuests(filteredQuests);
    if (selectedId == null) return groups;
    return groups.slice().sort((a, b) => {
      const aSelected = a.variants.some((q) => Number(q.id) === Number(selectedId)) ? 0 : 1;
      const bSelected = b.variants.some((q) => Number(q.id) === Number(selectedId)) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredQuests, selectedId]);

  const swipeBind = useEdgeSwipeBack(onClose);

  if (!open) return null;

  const heading = t.singleHabitPickerHeading || "Pick a new habit";
  const subtitle = t.singleHabitPickerSubtitle || "One habit fills your newly unlocked slot.";
  const placeholder = t.onboardingSearch || "Search habits…";
  const confirmLabel = t.singleHabitPickerConfirm || "Add habit";
  const empty = t.singleHabitPickerEmpty || "No matching habits.";
  const pickTabLabel = t.singleHabitPickerTabPick || "Pick from list";
  const createTabLabel = t.singleHabitPickerTabCreate || "Create new";
  const createTitleLabel = t.customHabitTitleLabel || "Title";
  const createDescLabel = t.customHabitDescLabel || "Description";
  const createTimerLabel = t.customHabitUseTimer || "Use a timer";
  const createMinutesLabel = t.customHabitMinutesLabel || "Session length (minutes)";
  const createXpExplain = t.customHabitXpExplain
    || "Up to 39 min → 30 XP · 40–49 min → 40 XP · 50+ min → 50 XP";
  const createConfirmLabel = t.singleHabitPickerCreateConfirm || "Create & add";

  const newMinutesNum = Math.max(0, parseInt(newMinutes, 10) || 0);
  const previewXp = !newNeedsTimer ? 30 : newMinutesNum >= 50 ? 50 : newMinutesNum >= 40 ? 40 : 30;

  const handleCreate = async () => {
    if (!onCreateCustom) return;
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) return;
    const minutes = newNeedsTimer ? Math.max(1, Math.min(480, newMinutesNum)) : 0;
    await onCreateCustom({
      title: cleanTitle,
      description: newDesc.trim(),
      needsTimer: newNeedsTimer,
      timeEstimateMin: minutes
    });
  };

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
                background: "linear-gradient(135deg, rgba(74,222,128,0.25), rgba(16,185,129,0.12))",
                border: "1px solid rgba(74,222,128,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20
              }}
            >
              ✨
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel" style={{ color: "#bbf7d0", fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
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
              ✕
            </button>
          </div>

          {onCreateCustom ? (
            <div style={{ display: "flex", gap: 6, marginTop: 12, padding: 3, borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="cinzel"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "none",
                  background: mode === "pick" ? "color-mix(in srgb, #4ade80 18%, transparent)" : "transparent",
                  color: mode === "pick" ? "#bbf7d0" : "var(--color-muted)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  cursor: "pointer"
                }}
              >
                {pickTabLabel}
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className="cinzel"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "none",
                  background: mode === "create" ? "color-mix(in srgb, #4ade80 18%, transparent)" : "transparent",
                  color: mode === "create" ? "#bbf7d0" : "var(--color-muted)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  cursor: "pointer"
                }}
              >
                + {createTabLabel}
              </button>
            </div>
          ) : null}

          {mode === "pick" ? (
            <div style={{ marginTop: 12 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
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
          ) : null}
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 100px" }}>
        {mode === "create" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="cinzel" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)", display: "block", marginBottom: 6 }}>
                {createTitleLabel}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value.slice(0, 40))}
                maxLength={40}
                placeholder={t.customHabitTitlePlaceholder || "e.g. Morning meditation"}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  background: "rgba(0,0,0,0.35)", border: "1px solid var(--card-border-idle)",
                  color: "#e2e8f0", fontSize: 16, minHeight: 44, outline: "none"
                }}
              />
            </div>
            <div>
              <label className="cinzel" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)", display: "block", marginBottom: 6 }}>
                {createDescLabel}
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value.slice(0, 120))}
                maxLength={120}
                rows={2}
                placeholder={t.customHabitDescPlaceholder || "Optional note"}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  background: "rgba(0,0,0,0.35)", border: "1px solid var(--card-border-idle)",
                  color: "#e2e8f0", fontSize: 14, resize: "vertical", outline: "none"
                }}
              />
            </div>
            <div style={{ borderRadius: 12, border: "1px solid var(--panel-border)", padding: 12, background: "rgba(0,0,0,0.22)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newNeedsTimer}
                  onChange={(e) => setNewNeedsTimer(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <span className="cinzel" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-primary)" }}>
                  {createTimerLabel}
                </span>
              </label>
              {newNeedsTimer ? (
                <div style={{ marginTop: 10 }}>
                  <label className="cinzel" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                    {createMinutesLabel}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={480}
                      value={newMinutes}
                      onChange={(e) => setNewMinutes(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                      placeholder="30"
                      style={{
                        width: 100, padding: "10px 12px", borderRadius: 10,
                        background: "rgba(0,0,0,0.35)", border: "1px solid var(--card-border-idle)",
                        color: "#e2e8f0", fontSize: 15, minHeight: 42
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                      → <strong style={{ color: "#4ade80" }}>+{previewXp} XP</strong>
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.45 }}>
                    {createXpExplain}
                  </p>
                </div>
              ) : null}
            </div>
            {createError ? (
              <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{createError}</p>
            ) : null}
          </div>
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
            backdropFilter: "blur(8px)"
          }}
        >
          {errorMessage ? (
            <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 8px" }}>{errorMessage}</p>
          ) : null}
          <button
            type="button"
            disabled={mode === "create" ? (!newTitle.trim() || createSaving) : (!selectedId || saving)}
            onClick={() => {
              if (mode === "create") {
                handleCreate();
              } else if (selectedId) {
                onPick?.(selectedId);
              }
            }}
            className="cinzel"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.08em",
              border: "1px solid rgba(34,197,94,0.65)",
              background: (mode === "create" ? Boolean(newTitle.trim()) : Boolean(selectedId))
                ? "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.7))"
                : "rgba(148,163,184,0.18)",
              color: (mode === "create" ? Boolean(newTitle.trim()) : Boolean(selectedId)) ? "#ffffff" : "#94a3b8",
              cursor: (mode === "create" ? Boolean(newTitle.trim()) : Boolean(selectedId)) ? "pointer" : "not-allowed",
              boxShadow: (mode === "create" ? Boolean(newTitle.trim()) : Boolean(selectedId)) ? "0 6px 18px rgba(22,163,74,0.35)" : "none",
              transition: "background 150ms ease, box-shadow 150ms ease"
            }}
          >
            {mode === "create"
              ? (createSaving ? (t.onboardingSaving || "Saving…") : createConfirmLabel)
              : (saving ? (t.onboardingSaving || "Saving…") : confirmLabel)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
