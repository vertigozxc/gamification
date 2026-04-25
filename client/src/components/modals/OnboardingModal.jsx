import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";
import CustomHabitManager from "./CustomHabitManager";
import QuestGroupCard from "../QuestGroupCard";
import CategoryFilterRow from "../CategoryFilterRow";
import InputWithClear from "../InputWithClear";
import { groupQuests, availableCategories, matchesCategory } from "../../utils/questGrouping";
import { suggestHandle as apiSuggestHandle, checkHandle as apiCheckHandle } from "../../api";
import { IconCheck, IconClose, IconList, IconSparkle, IconWarning } from "../icons/Icons";

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;

function normalizeHandleLocal(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX_LENGTH);
}

function OnboardingModal({
  open,
  onClose,
  onboardingName,
  onOnboardingNameChange,
  onboardingQuestIds,
  onboardingQuestSearch,
  onOnboardingQuestSearchChange,
  filteredOnboardingQuests,
  allEligibleQuestOptions,
  onToggleOnboardingQuest,
  onboardingError,
  onboardingSaving,
  onComplete,
  onSkip,
  customQuests,
  customSaving,
  customError,
  onClearCustomError,
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest,
  selectionLimit = 2,
  randomQuestCount = 2,
  authUsername = "",
  wizardStep = 0,
  onWizardStepChange,
  // When the animated tour hasn't reached the "Ready?" step yet, lock
  // the Begin button so the user can't submit and accidentally cut
  // the tour short.
  lockBegin = false,
  // Tour may drive the habit picker tab so highlighted sections are
  // on-screen when the tour stops on them. Null = user controls.
  forcedHabitsTab = null
}) {
  const TOTAL_STEPS = 2;
  const setStep = (n) => {
    const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, n));
    if (typeof onWizardStepChange === "function") onWizardStepChange(clamped);
  };
  // Touch swipe state for sliding between wizard pages.
  const swipeRef = useRef({ startX: 0, startY: 0, active: false });
  const SELECTION_LIMIT = Math.max(1, Number(selectionLimit) || 2);
  const RANDOM_COUNT = Math.max(1, Number(randomQuestCount) || 2);
  const { t, tf, translateCategory } = useTheme();
  const [showWarning, setShowWarning] = useState(false);
  const [sheetAnim, setSheetAnim] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  // See PinnedReplacementModal — snapshot at open so tapping doesn't
  // cause the selected card to jump out from under the user's finger.
  const [initialSelectedIds, setInitialSelectedIds] = useState([]);
  // @handle: local state. Server is the source of truth for uniqueness —
  // we just mirror it here for typing + an availability badge. On modal
  // open we seed an initial value from /api/handle/suggest so the user
  // can tap Skip/Begin in one step without touching this input.
  const [handleInput, setHandleInput] = useState("");
  const [handleStatus, setHandleStatus] = useState("idle"); // idle | checking | available | taken | invalid | short
  const [handleTouched, setHandleTouched] = useState(false);
  const checkReqRef = useRef(0);
  // When the CustomHabitManager's inline create/edit form is open AND
  // the iOS keyboard is up, collapse the modal's own header + footer
  // so the form gets the full screen to breathe.
  const [customFormExpanded, setCustomFormExpanded] = useState(false);
  // Segmented tab for the habit picker (wizard page 1): "presets" shows
  // the curated catalog, "custom" shows the user's own habit list.
  const [habitsTab, setHabitsTab] = useState("presets");
  useEffect(() => {
    if (forcedHabitsTab === "presets" || forcedHabitsTab === "custom") {
      setHabitsTab(forcedHabitsTab);
    }
  }, [forcedHabitsTab]);
  // iOS keyboard handling: 100dvh doesn't always shrink with the
  // software keyboard inside a WebView, so we mirror the visualViewport
  // height ourselves and apply it to the sheet. Without this, focusing
  // the nickname / custom-habit inputs pushed the whole modal
  // off-screen.
  const [sheetHeight, setSheetHeight] = useState(() => (
    typeof window !== "undefined"
      ? (window.visualViewport?.height || window.innerHeight || 0)
      : 0
  ));
  const [sheetTop, setSheetTop] = useState(0);
  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const readViewport = () => {
      const vv = window.visualViewport;
      const h = vv?.height || window.innerHeight || 0;
      const top = vv?.offsetTop || 0;
      if (h) setSheetHeight(h);
      setSheetTop(top);
    };
    readViewport();
    window.addEventListener("resize", readViewport);
    window.addEventListener("orientationchange", readViewport);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", readViewport);
      vv.addEventListener("scroll", readViewport);
    }
    return () => {
      window.removeEventListener("resize", readViewport);
      window.removeEventListener("orientationchange", readViewport);
      if (vv) {
        vv.removeEventListener("resize", readViewport);
        vv.removeEventListener("scroll", readViewport);
      }
    };
  }, [open]);

  // Freeze the document while the modal is mounted. Without this, iOS
  // scrolls the page up when an input is focused and the sheet drifts
  // above the viewport.
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevScroll = window.scrollY || 0;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${prevScroll}px`;
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = "";
      body.style.width = prevBodyWidth;
      documentElement.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, prevScroll);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setSheetAnim(true));
      setInitialSelectedIds(Array.isArray(onboardingQuestIds) ? [...onboardingQuestIds] : []);
      return () => cancelAnimationFrame(id);
    }
    setSheetAnim(false);
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Seed the @handle input once per modal opening. Uses the name we
  // already have (Google displayName, typically) as the server-side
  // suggestion seed so the initial value is likely to read nicely.
  useEffect(() => {
    if (!open) return undefined;
    setHandleTouched(false);
    setHandleStatus("idle");
    let cancelled = false;
    const seedName = (onboardingName || "").trim();
    apiSuggestHandle(seedName)
      .then((resp) => {
        if (cancelled) return;
        const suggested = normalizeHandleLocal(resp?.handle || "");
        if (suggested) {
          setHandleInput(suggested);
          setHandleStatus("available"); // server guarantees it was free at this moment
        } else {
          setHandleInput("");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Offline / slow — fall back to a local slug of the name. The
        // server will still uniqueness-check on submit.
        setHandleInput(normalizeHandleLocal(seedName) || "");
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced availability check whenever the user edits the handle.
  useEffect(() => {
    if (!open) return undefined;
    if (!handleTouched) return undefined;
    const value = normalizeHandleLocal(handleInput);
    if (value.length < HANDLE_MIN_LENGTH) {
      setHandleStatus("short");
      return undefined;
    }
    setHandleStatus("checking");
    const req = ++checkReqRef.current;
    const timer = setTimeout(() => {
      apiCheckHandle(value, authUsername || undefined)
        .then((resp) => {
          // Only apply result if this is still the latest request.
          if (req !== checkReqRef.current) return;
          if (!resp) return;
          if (resp.available) setHandleStatus("available");
          else if (resp.reason === "too_short") setHandleStatus("short");
          else if (resp.reason === "invalid") setHandleStatus("invalid");
          else setHandleStatus("taken");
        })
        .catch(() => {
          if (req !== checkReqRef.current) return;
          // Network error — let the user submit anyway; server revalidates.
          setHandleStatus("idle");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [handleInput, handleTouched, open, authUsername]);

  const nonCustomQuests = useMemo(
    () => (Array.isArray(filteredOnboardingQuests) ? filteredOnboardingQuests.filter((q) => !q.isCustom) : []),
    [filteredOnboardingQuests]
  );

  const categoryOptions = useMemo(() => availableCategories(nonCustomQuests), [nonCustomQuests]);
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0 };
    const seenGroups = new Set();
    // Count groups, not raw variants, so the pill counts reflect what the
    // user actually sees (one card per family).
    const groups = groupQuests(nonCustomQuests);
    for (const group of groups) {
      const cat = String(group.representative?.category || "").toUpperCase();
      counts.ALL += 1;
      counts[cat] = (counts[cat] || 0) + 1;
      seenGroups.add(group.key);
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

    // A specific category filter should honour the filter strictly;
    // previously selected habits from other categories must NOT leak
    // back in. Only ALL brings missing initial picks back (so search
    // can't drop them).
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
    return combined.slice().sort((a, b) => {
      const aSelected = a.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      const bSelected = b.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredByCategory, nonCustomQuests, initialSelectedIds, allEligibleQuestOptions, categoryFilter]);

  const selectedCount = Array.isArray(onboardingQuestIds) ? onboardingQuestIds.length : 0;
  const selectionComplete = selectedCount === SELECTION_LIMIT;
  // Block submit on handle states the server will reject. "checking" is
  // allowed through — the server revalidates on the mutation call.
  const handleBlocksSubmit = handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "short";
  const primaryDisabled = onboardingSaving || !onboardingName.trim() || !selectionComplete || handleBlocksSubmit || lockBegin;
  // Wizard page 0 → 1 gate: nickname filled and handle isn't failing.
  // "checking" is allowed through so typing the handle doesn't block
  // forward progress on a slow network.
  const canAdvanceFromStep0 = Boolean(onboardingName.trim()) && !handleBlocksSubmit && !onboardingSaving;
  const progressPct = Math.min(100, Math.round((selectedCount / SELECTION_LIMIT) * 100));
  const normalizedHandle = normalizeHandleLocal(handleInput);

  const handleStartRequest = () => {
    // No confirm step — tapping Begin submits directly. The parent
    // still validates name + selection count and surfaces any error.
    onComplete(normalizedHandle);
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
        background: "var(--card-bg, #0f172a)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          // Follow visualViewport.offsetTop so the sheet stays anchored
          // to the visible area when iOS scrolls the layout to make
          // room for the keyboard.
          top: sheetTop ? `${sheetTop}px` : 0,
          left: 0,
          right: 0,
          width: "100vw",
          // Shrink with the visualViewport so the iOS keyboard pushes
          // the bottom of the sheet, not scrolls the top off-screen.
          height: sheetHeight ? `${sheetHeight}px` : "100dvh",
          maxWidth: "100vw",
          maxHeight: sheetHeight ? `${sheetHeight}px` : "100dvh",
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
        <div style={{ padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 16px) 16px 12px", borderBottom: "1px solid var(--card-border-idle)", display: customFormExpanded ? "none" : undefined }}>
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
              <IconClose size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* Step wizard progress — "Step N of 2" with a fill that
              advances as the user moves between pages. The old
              "N/2 selected" chip moves inside the habits page. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#cbd5e1" }}>
                  {tf
                    ? tf("onboardingStepOf", { current: wizardStep + 1, total: TOTAL_STEPS })
                    : `Step ${wizardStep + 1} / ${TOTAL_STEPS}`}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.round(((wizardStep + 1) / TOTAL_STEPS) * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                    transition: "width 260ms cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative"
          }}
        >
          <div
            style={{
              display: "flex",
              width: "200%",
              height: "100%",
              transform: `translateX(-${wizardStep * 50}%)`,
              transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          >
          <section
            aria-hidden={wizardStep !== 0}
            style={{
              width: "50%",
              height: "100%",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              padding: "12px 16px 16px"
            }}
          >
          <div data-tour="setup-name">
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
            <InputWithClear
              value={onboardingName}
              onChange={onOnboardingNameChange}
              maxLength={32}
              placeholder={t.onboardingNicknamePlaceholder}
              clearAriaLabel={t.clearLabel || "Clear"}
              inputStyle={{
                padding: "9px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--card-border-idle)",
                color: "#e2e8f0",
                fontSize: 14,
                minHeight: 38,
                outline: "none",
                fontFamily: "var(--font-heading)"
              }}
            />
            <p style={{ margin: "6px 2px 0", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.4 }}>
              {t.onboardingNameHint || "Enter your name — it will be publicly visible to other players."}
            </p>
          </div>

          {/* @handle — public username, auto-assigned on open. Read-only.
              Rendered as a static "tag chip" (no border, dim background)
              so it doesn't read as an editable input. */}
          <div data-tour="setup-handle">
          <label
            className="cinzel"
            style={{
              display: "block",
              marginTop: 14,
              marginBottom: 6,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-primary)"
            }}
          >
            {t.onboardingHandleLabel || "Username"}
          </label>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
              color: "var(--color-primary)",
              border: "none",
              userSelect: "none",
              cursor: "default"
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 14,
                fontWeight: 700,
                opacity: 0.8
              }}
            >@</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit"
              }}
            >
              {normalizedHandle || handleInput}
            </span>
          </div>
          </div>
          </section>

          <section
            aria-hidden={wizardStep !== 1}
            style={{
              width: "50%",
              height: "100%",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              padding: "12px 16px 16px"
            }}
          >
          <div data-tour="setup-habits">
          {/* Section-start header for the habit picker. */}
          <div style={{ marginTop: 18, marginBottom: 10 }}>
            <h3
              className="cinzel"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "var(--color-primary)",
                textTransform: "uppercase",
                lineHeight: 1.25
              }}
            >
              {tf("onboardingPick", { pinned: SELECTION_LIMIT })}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-muted)", lineHeight: 1.4 }}>
              {t.onboardingPickSubtitle || "Pick from the existing list or create your own"}
            </p>
          </div>

          {/* habits-picker — wraps the slide bar, the sticky counter
              and the active tab content. This is the region the tour
              spotlights on habits-custom / habits-browse steps. The
              min-height keeps the spotlight from shrinking when the
              Custom tab is empty; Presets is usually taller. */}
          <div data-tour="habits-picker" style={{ minHeight: "60vh" }}>
          {/* Segmented slide bar: Presets ↔ Custom. Active tab slides
              under the labels like an iOS control. */}
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
              <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconList size={14} /></span>
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
              <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconSparkle size={14} /></span>
              <span className="onb-habits-tab-label">{t.onboardingTabCustom || "Custom"}</span>
              <span className="onb-habits-tab-count">{Array.isArray(customQuests) ? customQuests.length : 0}</span>
            </button>
          </div>

          {/* HABITS SELECTED progress chip — sits directly under the
              slide bar, sticks to the top of the scrollable body so
              the count stays visible while the user browses habits. */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 4,
              marginTop: 8,
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--card-bg, #0f172a)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10 }}>
              <span
                className="cinzel"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-primary)"
                }}
              >
                {selectedCount} / {SELECTION_LIMIT}{" "}
                <span style={{ color: "var(--color-muted)", fontWeight: 700 }}>
                  {t.onboardingHabitsSelected || "habits selected"}
                </span>
              </span>
              <span
                className="cinzel"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--color-accent) 22%, transparent)",
                  color: "var(--color-accent)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 55%, transparent)",
                  visibility: selectionComplete ? "visible" : "hidden",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <IconCheck size={11} strokeWidth={2.6} /> {t.onboardingReady || "ready"}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
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

          {habitsTab === "presets" ? (
            <div data-tour="browse-habits" style={{ marginTop: 12 }}>
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
                  value={onboardingQuestSearch}
                  onChange={onOnboardingQuestSearchChange}
                  placeholder={t.onboardingSearch}
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

              {questGroups.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                    {t.onboardingNoMatch}
                  </p>
                  {(onboardingQuestSearch || categoryFilter !== "ALL") ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOnboardingQuestSearchChange("");
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
                    const selectedInGroup = group.variants.find((q) => onboardingQuestIds.includes(q.id));
                    const blocked = !selectedInGroup && selectedCount >= SELECTION_LIMIT;
                    return (
                      <QuestGroupCard
                        key={`onboarding-group-${group.key}`}
                        group={group}
                        selectedVariantId={selectedInGroup?.id ?? null}
                        disabled={blocked}
                        onPick={(id) => onToggleOnboardingQuest(id)}
                        onUnpick={(id) => onToggleOnboardingQuest(id)}
                        translateCategory={translateCategory}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div data-tour="my-custom-habits" style={{ marginTop: 12 }}>
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
                onFormStateChange={({ open, hasKeyboard }) => setCustomFormExpanded(open && hasKeyboard)}
              />
            </div>
          )}
          </div>
          </div>
          </section>
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--card-border-idle)",
            background: "rgba(0,0,0,0.35)",
            display: customFormExpanded ? "none" : undefined
          }}
        >
          {onboardingError ? (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 8px", textAlign: "center", fontWeight: 600 }}>
              {onboardingError}
            </p>
          ) : null}
          {wizardStep === 0 ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                data-tour="setup-continue"
                onClick={() => {
                  if (!canAdvanceFromStep0) return;
                  setStep(1);
                }}
                disabled={!canAdvanceFromStep0 || onboardingSaving}
                className="cinzel mobile-pressable"
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: (!canAdvanceFromStep0)
                    ? "rgba(255,255,255,0.08)"
                    : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                  border: "none",
                  color: (!canAdvanceFromStep0) ? "#64748b" : "#0b1120",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: !canAdvanceFromStep0 ? "not-allowed" : "pointer",
                  letterSpacing: "0.05em",
                  boxShadow: !canAdvanceFromStep0 ? "none" : "0 8px 20px rgba(56,189,248,0.2)"
                }}
              >
                {t.onboardingContinue || "Continue →"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={onboardingSaving}
                className="cinzel mobile-pressable"
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: "transparent",
                  border: "1px solid var(--card-border-idle)",
                  color: "#cbd5e1",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  cursor: onboardingSaving ? "not-allowed" : "pointer"
                }}
              >
                {t.onboardingBack || "Back"}
              </button>
              <button
                type="button"
                data-tour="setup-begin"
                onClick={handleStartRequest}
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
                {onboardingSaving ? t.onboardingSaving : t.onboardingBegin}
              </button>
            </div>
          )}
        </div>
      </div>

      {showWarning && (
        <div className="logout-confirm-overlay" style={{ zIndex: 220, background: "rgba(0,0,0,0.6)" }}>
          <div className="logout-confirm-card" style={{ maxWidth: 400 }}>
            <div className="mt-1 mb-4 flex justify-center" style={{ color: "#fbbf24" }}><IconWarning size={42} /></div>
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
                  onComplete(normalizedHandle);
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
