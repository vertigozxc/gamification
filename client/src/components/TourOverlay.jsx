import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";
import CustomHabitManager from "./modals/CustomHabitManager";
import QuestGroupCard from "./QuestGroupCard";
import CategoryFilterRow from "./CategoryFilterRow";
import InputWithClear from "./InputWithClear";
import { groupQuests, availableCategories, matchesCategory } from "../utils/questGrouping";
import { suggestHandle as apiSuggestHandle, checkHandle as apiCheckHandle } from "../api";

const HANDLE_MIN = 3;
const HANDLE_MAX = 20;
const TOTAL_STEPS = 11; // 0-3 setup, 4-9 spotlight tour, 10 bonus

function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX);
}

const TOUR_STEPS = [
  { phase: "setup", key: "welcome" },
  { phase: "setup", key: "name" },
  { phase: "setup", key: "habits" },
  { phase: "setup", key: "handle" },
  { phase: "tour", key: "quests",      tab: "dashboard",    selector: '[data-tour="quests-board"]',    padding: 10 },
  { phase: "tour", key: "xpstreak",    tab: "dashboard",    selector: '[data-tour="dash-hero"]',       padding: 8  },
  { phase: "tour", key: "city",        tab: "city",         selector: '[data-tour="city-tab"]',        padding: 12 },
  { phase: "tour", key: "leaderboard", tab: "leaderboard",  selector: '[data-tour="leaderboard-tab"]', padding: 12 },
  { phase: "tour", key: "store",       tab: "store",        selector: '[data-tour="store-tab"]',       padding: 12 },
  { phase: "tour", key: "profile",     tab: "profile",      selector: '[data-tour="profile-tab"]',     padding: 12 },
  { phase: "bonus", key: "bonus" },
];

const CONFETTI_COLORS = [
  "#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"
];

function generateConfetti() {
  return Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: Math.random() * 0.8,
    duration: 1.8 + Math.random() * 1.4,
  }));
}

export default function TourOverlay({
  open,
  // setup data from useOnboardingPinned
  onboardingName,
  setOnboardingName,
  onboardingQuestIds,
  onboardingQuestSearch,
  setOnboardingQuestSearch,
  filteredOnboardingQuests,
  allEligibleQuestOptions,
  onToggleOnboardingQuest,
  onboardingError,
  onboardingSaving,
  customQuests,
  customSaving,
  customError,
  onClearCustomError,
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest,
  selectionLimit = 2,
  authUsername = "",
  // actions
  onComplete,    // (handle, onDone) — saves setup, calls onDone(result) instead of closing
  onSkip,        // (handle) — stamps skippedAt, closes overlay
  onTourBonus,   // () — grants +1 level, returns newLevel
  // tab control
  mobileTab,
  setMobileTab,
}) {
  const { t, tf, translateCategory } = useTheme();
  const SELECTION_LIMIT = Math.max(1, Number(selectionLimit) || 2);

  const [step, setStep] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipAbove, setTooltipAbove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [newLevel, setNewLevel] = useState(null);
  const [confetti] = useState(generateConfetti);
  const [setupDone, setSetupDone] = useState(false);
  const spotlightTimerRef = useRef(null);

  // Handle state
  const [handleInput, setHandleInput] = useState("");
  const [handleStatus, setHandleStatus] = useState("idle");
  const [handleTouched, setHandleTouched] = useState(false);
  const checkReqRef = useRef(0);

  // Category filter for habits step
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [initialSelectedIds, setInitialSelectedIds] = useState([]);

  // Seed handle suggestion on open
  useEffect(() => {
    if (!open) return undefined;
    setHandleTouched(false);
    setHandleStatus("idle");
    let cancelled = false;
    const seedName = (onboardingName || "").trim();
    apiSuggestHandle(seedName)
      .then((resp) => {
        if (cancelled) return;
        const suggested = normalizeHandle(resp?.handle || "");
        if (suggested) { setHandleInput(suggested); setHandleStatus("available"); }
        else setHandleInput("");
      })
      .catch(() => { if (!cancelled) setHandleInput(normalizeHandle(seedName) || ""); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced handle availability check
  useEffect(() => {
    if (!open || !handleTouched) return undefined;
    const value = normalizeHandle(handleInput);
    if (value.length < HANDLE_MIN) { setHandleStatus("short"); return undefined; }
    setHandleStatus("checking");
    const req = ++checkReqRef.current;
    const timer = setTimeout(() => {
      apiCheckHandle(value, authUsername || undefined)
        .then((resp) => {
          if (req !== checkReqRef.current || !resp) return;
          if (resp.available) setHandleStatus("available");
          else if (resp.reason === "too_short") setHandleStatus("short");
          else if (resp.reason === "invalid") setHandleStatus("invalid");
          else setHandleStatus("taken");
        })
        .catch(() => { if (req === checkReqRef.current) setHandleStatus("idle"); });
    }, 350);
    return () => clearTimeout(timer);
  }, [handleInput, handleTouched, open, authUsername]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setSlideKey(k => k + 1);
      setSpotlightRect(null);
      setLocalError("");
      setSaving(false);
      setSetupDone(false);
      setNewLevel(null);
      setCategoryFilter("ALL");
      setInitialSelectedIds(Array.isArray(onboardingQuestIds) ? [...onboardingQuestIds] : []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When entering a spotlight step, switch tab + measure target element
  useEffect(() => {
    if (!open) return undefined;
    const current = TOUR_STEPS[step];
    if (current?.phase !== "tour") return undefined;

    if (setMobileTab && current.tab) setMobileTab(current.tab);

    if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current);
    setSpotlightRect(null);

    spotlightTimerRef.current = setTimeout(() => {
      const el = document.querySelector(current.selector);
      if (!el) {
        // Fallback: highlight centre area
        const pad = current.padding ?? 10;
        setSpotlightRect({ top: 120, left: 16, width: window.innerWidth - 32, height: 180, borderRadius: 14, pad });
        setTooltipAbove(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const pad = current.padding ?? 10;
      setSpotlightRect({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 14,
        pad,
      });
      setTooltipAbove(rect.top + rect.height / 2 > window.innerHeight * 0.55);
    }, 420);

    return () => { if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open]);

  // Quests filtering (habits step)
  const nonCustomQuests = useMemo(
    () => (Array.isArray(filteredOnboardingQuests) ? filteredOnboardingQuests.filter((q) => !q.isCustom) : []),
    [filteredOnboardingQuests]
  );
  const categoryOptions = useMemo(() => availableCategories(nonCustomQuests), [nonCustomQuests]);
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0 };
    for (const group of groupQuests(nonCustomQuests)) {
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
    const fullPool = Array.isArray(allEligibleQuestOptions) ? allEligibleQuestOptions.filter((q) => !q.isCustom) : nonCustomQuests;
    const initialGroupsFromFullPool = groupQuests(fullPool).filter((g) => g.variants.some((q) => initialSet.has(q.id)));
    const filteredKeys = new Set(filteredGroups.map((g) => g.key));
    const missingInitialGroups = initialGroupsFromFullPool.filter((g) => !filteredKeys.has(g.key));
    return [...missingInitialGroups, ...filteredGroups].sort((a, b) => {
      const aSelected = a.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      const bSelected = b.variants.some((q) => initialSet.has(q.id)) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredByCategory, nonCustomQuests, initialSelectedIds, allEligibleQuestOptions]);

  const selectedCount = Array.isArray(onboardingQuestIds) ? onboardingQuestIds.length : 0;
  const selectionComplete = selectedCount === SELECTION_LIMIT;
  const normalizedHandle = normalizeHandle(handleInput);
  const handleBlocksSubmit = handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "short";

  const advance = useCallback(() => {
    setSlideKey(k => k + 1);
    setStep(s => s + 1);
    setLocalError("");
  }, []);

  const goBack = useCallback(() => {
    setSlideKey(k => k + 1);
    setStep(s => Math.max(0, s - 1));
    setLocalError("");
  }, []);

  async function handleNextClick() {
    const current = TOUR_STEPS[step];

    // Step 3 (handle) → step 4: save setup via API, keep overlay open
    if (step === 3) {
      if (!onboardingName.trim()) { setLocalError(t.nicknameRequired); return; }
      if (onboardingQuestIds.length !== SELECTION_LIMIT) { setLocalError(tf("pickExactly4PreferredQuests", { n: SELECTION_LIMIT })); return; }
      if (handleBlocksSubmit) return;
      setSaving(true);
      setLocalError("");
      try {
        await onComplete(normalizedHandle, (result) => {
          setSetupDone(true);
          advance();
        });
      } catch (e) {
        setLocalError(e?.message || t.setupFailed);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Last tour step (step 9 = profile) → step 10: grant bonus
    if (step === 9) {
      setSaving(true);
      setLocalError("");
      try {
        const level = await onTourBonus();
        setNewLevel(level);
        setStep(10);
        setSlideKey(k => k + 1);
      } catch (e) {
        setLocalError(e?.message || t.setupFailed);
      } finally {
        setSaving(false);
      }
      return;
    }

    advance();
  }

  async function handleSkipClick() {
    if (setupDone || step >= 4) {
      // Setup already saved — just close without bonus
      if (typeof onSkip === "function") onSkip(normalizedHandle);
      return;
    }
    // Before setup — call proper skip
    if (!onboardingName.trim()) { setLocalError(t.nicknameRequired); return; }
    setSaving(true);
    setLocalError("");
    try {
      await onSkip(normalizedHandle);
    } catch (e) {
      setLocalError(e?.message || t.setupFailed);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const current = TOUR_STEPS[step];

  // ─── BONUS STEP ───────────────────────────────────────────────────────────
  if (current.phase === "bonus") {
    return (
      <div className="tour-overlay">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="tour-confetti-dot"
            style={{
              left: `${c.x}%`,
              top: -10,
              width: c.size,
              height: c.size,
              background: c.color,
              animationName: "tour-confetti-fall",
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
              animationFillMode: "both",
            }}
          />
        ))}
        <div className="tour-bonus-card">
          <div className="tour-bonus-inner">
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🏆</div>
            <h2
              className="cinzel"
              style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)", margin: "0 0 6px" }}
            >
              {t.tourBonusTitle}
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 20px" }}>
              {t.tourBonusSubtitle}
            </p>
            <div className="tour-bonus-level cinzel">{t.tourBonusReward}</div>
            {newLevel ? (
              <p className="cinzel" style={{ fontSize: 13, color: "var(--color-text)", margin: "6px 0 0" }}>
                {t.levelLabel} {newLevel}
              </p>
            ) : null}
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "10px 0 24px", lineHeight: 1.5 }}>
              {t.tourBonusDesc}
            </p>
            <button
              type="button"
              className="cinzel mobile-pressable"
              onClick={() => onSkip(normalizedHandle)}
              style={{
                width: "100%",
                minHeight: 52,
                borderRadius: 14,
                background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                border: "none",
                color: "#0b1120",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.05em",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(56,189,248,0.25)",
              }}
            >
              {t.tourBonusCta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── SPOTLIGHT TOUR STEPS (4–9) ───────────────────────────────────────────
  if (current.phase === "tour") {
    const SPOTLIGHT_KEYS = ["quests", "xpstreak", "city", "leaderboard", "store", "profile"];
    const stepTitleKey = `tourStep${current.key.charAt(0).toUpperCase() + current.key.slice(1)}Title`;
    const stepBodyKey  = `tourStep${current.key.charAt(0).toUpperCase() + current.key.slice(1)}Body`;
    const stepTitle = t[stepTitleKey] || "";
    const stepBody  = t[stepBodyKey]  || "";
    const isLastTourStep = step === 9;
    const tourStepIndex = step - 4; // 0..5

    const tooltipStyle = (() => {
      if (!spotlightRect) return { bottom: 100, left: 16, right: 16 };
      const margin = 16;
      const style = { left: margin, right: margin, width: undefined };
      if (tooltipAbove) {
        style.bottom = window.innerHeight - spotlightRect.top + 12;
      } else {
        style.top = spotlightRect.top + spotlightRect.height + 12;
      }
      return style;
    })();

    const arrowStyle = (() => {
      if (!spotlightRect) return null;
      const arrowX = Math.min(
        Math.max(spotlightRect.left + spotlightRect.width / 2 - 12, 24),
        window.innerWidth - 48
      );
      if (tooltipAbove) {
        return { bottom: window.innerHeight - spotlightRect.top + 4, left: arrowX };
      }
      return { top: spotlightRect.top + spotlightRect.height + 2, left: arrowX };
    })();

    return (
      <div className="tour-overlay" style={{ pointerEvents: "all" }}>
        {/* Dark backdrop + spotlight hole */}
        {spotlightRect && (
          <>
            <div
              className="tour-spotlight-ring"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                borderRadius: spotlightRect.borderRadius,
              }}
            />
            <div
              className="tour-spotlight-pulse"
              style={{
                top: spotlightRect.top - 4,
                left: spotlightRect.left - 4,
                width: spotlightRect.width + 8,
                height: spotlightRect.height + 8,
                borderRadius: (spotlightRect.borderRadius ?? 14) + 4,
              }}
            />
          </>
        )}

        {/* Arrow */}
        {arrowStyle && (
          <div className="tour-arrow" style={arrowStyle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d={tooltipAbove
                  ? "M12 4 L12 18 M6 12 L12 19 L18 12"
                  : "M12 20 L12 6 M6 12 L12 5 L18 12"}
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Tooltip */}
        <div className="tour-tooltip" style={tooltipStyle} key={`tooltip-${step}`}>
          <p
            className="cinzel"
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--color-primary)",
              margin: "0 0 5px",
              letterSpacing: "0.03em",
            }}
          >
            {stepTitle}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0, lineHeight: 1.5 }}>
            {stepBody}
          </p>
          {localError ? (
            <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 6, fontWeight: 600 }}>{localError}</p>
          ) : null}
        </div>

        {/* Bottom nav */}
        <div className="tour-nav">
          <button
            type="button"
            className="cinzel mobile-pressable"
            onClick={handleSkipClick}
            style={{
              minHeight: 42,
              padding: "8px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            {t.tourSkipTour}
          </button>

          <div className="tour-dots">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`tour-dot${i === tourStepIndex ? " active" : ""}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="cinzel mobile-pressable"
            onClick={handleNextClick}
            disabled={saving}
            style={{
              minHeight: 42,
              padding: "8px 16px",
              borderRadius: 12,
              background: saving
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              border: "none",
              color: saving ? "#64748b" : "#0b1120",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? t.tourSaving : isLastTourStep ? t.tourFinish : t.tourNext}
          </button>
        </div>
      </div>
    );
  }

  // ─── SETUP STEPS (0–3) ────────────────────────────────────────────────────
  const isFirstStep = step === 0;
  const isHandleStep = step === 3;
  const isHabitsStep = step === 2;
  const isNameStep   = step === 1;

  const canAdvanceSetup = (() => {
    if (step === 1) return onboardingName.trim().length > 0;
    if (step === 2) return selectionComplete;
    if (step === 3) return onboardingName.trim().length > 0 && selectionComplete && !handleBlocksSubmit;
    return true;
  })();

  const progressPct = step === 2 || step === 3 ? Math.min(100, Math.round((selectedCount / SELECTION_LIMIT) * 100)) : 0;

  return (
    <div className="tour-overlay" style={{ zIndex: 9990 }}>
      {/* Welcome step */}
      {isFirstStep && (
        <div
          className="tour-setup-slide"
          key={`setup-${slideKey}`}
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            background: "var(--card-bg, #0f172a)",
            padding: "calc(env(safe-area-inset-top, 0px) + 40px) 24px calc(env(safe-area-inset-bottom, 0px) + 40px)",
          }}
        >
          <div className="tour-hero-icon" style={{ fontSize: 72, lineHeight: 1, marginBottom: 24 }}>⚔️</div>
          <h1
            className="cinzel"
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "var(--color-primary)",
              textAlign: "center",
              margin: "0 0 12px",
              letterSpacing: "0.04em",
              lineHeight: 1.2,
            }}
          >
            {t.tourWelcomeTitle}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text)",
              textAlign: "center",
              margin: "0 0 8px",
              lineHeight: 1.6,
              maxWidth: 300,
            }}
          >
            {t.tourWelcomeSubtitle}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-muted)", textAlign: "center", margin: "0 0 40px" }}>
            {t.tourWelcomeDuration}
          </p>

          {/* Step dots */}
          <div className="tour-dots" style={{ marginBottom: 28 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`tour-dot${i === step ? " active" : ""}`} />
            ))}
          </div>

          <button
            type="button"
            className="cinzel mobile-pressable"
            onClick={advance}
            style={{
              width: "100%",
              maxWidth: 280,
              minHeight: 52,
              borderRadius: 14,
              background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              border: "none",
              color: "#0b1120",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.06em",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(56,189,248,0.22)",
              marginBottom: 14,
            }}
          >
            {t.tourWelcomeStart}
          </button>
          <button
            type="button"
            className="cinzel mobile-pressable"
            onClick={handleSkipClick}
            disabled={saving}
            style={{
              width: "100%",
              maxWidth: 280,
              minHeight: 44,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.55)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            {saving ? t.tourSaving : t.tourWelcomeSkip}
          </button>
        </div>
      )}

      {/* Name + Habits + Handle steps */}
      {!isFirstStep && (
        <div
          className="tour-setup-slide tour-slide-enter"
          key={`setup-${slideKey}`}
          style={{ background: "var(--card-bg, #0f172a)" }}
        >
          {/* Header */}
          <div
            style={{
              padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 16px) 16px 12px",
              borderBottom: "1px solid var(--card-border-idle)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <h2
                  className="cinzel"
                  style={{ fontSize: 17, fontWeight: 800, color: "var(--color-primary)", margin: 0, lineHeight: 1.2 }}
                >
                  {isNameStep   && t.tourStepNameTitle}
                  {isHabitsStep && t.tourStepHabitsTitle}
                  {isHandleStep && t.tourStepHandleTitle}
                </h2>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
                  {isNameStep   && t.tourStepNameBody}
                  {isHabitsStep && t.tourStepHabitsBody}
                  {isHandleStep && t.tourStepHandleBody}
                </p>
              </div>
              <button
                type="button"
                className="cinzel mobile-pressable"
                onClick={handleSkipClick}
                disabled={saving}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {saving ? "…" : t.tourSkipTour}
              </button>
            </div>

            {/* Progress dots for setup steps 1-3 */}
            <div className="tour-dots" style={{ justifyContent: "flex-start" }}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`tour-dot${i === step ? " active" : ""}`} />
              ))}
            </div>

            {/* Habit selection progress bar (only on steps 2-3) */}
            {(isHabitsStep || isHandleStep) && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#cbd5e1" }}>
                    {t.onboardingSelected
                      ? `${selectedCount} / ${SELECTION_LIMIT} ${t.onboardingSelected}`
                      : `${selectedCount} / ${SELECTION_LIMIT}`}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: selectionComplete ? "var(--color-accent)" : "var(--color-primary)",
                      transition: "width 200ms ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 16px" }}>
            {/* Name step */}
            {isNameStep && (
              <div>
                <label className="cinzel" style={{ display: "block", marginBottom: 6, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)" }}>
                  {t.onboardingNickname}
                </label>
                <InputWithClear
                  value={onboardingName}
                  onChange={setOnboardingName}
                  maxLength={32}
                  placeholder={t.onboardingNicknamePlaceholder}
                  clearAriaLabel={t.clearLabel || "Clear"}
                  inputStyle={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid var(--card-border-idle)",
                    color: "#e2e8f0",
                    fontSize: 15,
                    minHeight: 42,
                    outline: "none",
                    fontFamily: "var(--font-heading)",
                  }}
                />
                <p style={{ margin: "6px 2px 0", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.4 }}>
                  {t.onboardingNameHint}
                </p>
              </div>
            )}

            {/* Handle step */}
            {isHandleStep && (
              <div style={{ marginBottom: 20 }}>
                <label className="cinzel" style={{ display: "block", marginBottom: 6, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)" }}>
                  {t.onboardingHandleLabel || "Username"}
                </label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${
                      handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "short"
                        ? "rgba(239,68,68,0.55)"
                        : handleStatus === "available"
                        ? "rgba(16,185,129,0.55)"
                        : "var(--card-border-idle)"
                    }`,
                    minHeight: 42,
                    transition: "border-color 180ms ease",
                  }}
                >
                  <span aria-hidden style={{ color: "var(--color-muted)", fontSize: 14, fontWeight: 700, marginRight: 4, userSelect: "none" }}>@</span>
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => { setHandleTouched(true); setHandleInput(normalizeHandle(e.target.value)); }}
                    maxLength={HANDLE_MAX}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t.onboardingHandlePlaceholder || "username"}
                    style={{ flex: 1, minWidth: 0, padding: "9px 0", background: "transparent", border: "none", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "var(--font-heading)" }}
                  />
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, minWidth: 56, textAlign: "right", color: handleStatus === "available" ? "#10b981" : (handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "short") ? "#ef4444" : "var(--color-muted)" }}>
                    {handleStatus === "checking" && (t.onboardingHandleChecking || "…")}
                    {handleStatus === "available" && "✓"}
                    {handleStatus === "taken" && (t.onboardingHandleTaken || "taken")}
                    {handleStatus === "invalid" && (t.onboardingHandleInvalid || "invalid")}
                    {handleStatus === "short" && (t.onboardingHandleShort || "3+")}
                  </span>
                </div>
                <p style={{ margin: "6px 2px 0", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.4 }}>
                  {t.onboardingHandleHint}
                </p>
              </div>
            )}

            {/* Habits step or Handle step (habits also shown in handle step) */}
            {(isHabitsStep || isHandleStep) && (
              <div style={{ marginTop: isHandleStep ? 0 : 0 }}>
                {isHabitsStep && (
                  <div style={{ marginBottom: 12, paddingTop: 4 }}>
                    <h3 className="cinzel" style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "0.06em", color: "var(--color-primary)", textTransform: "uppercase" }}>
                      {tf("onboardingPick", { pinned: SELECTION_LIMIT })}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-muted)", lineHeight: 1.4 }}>
                      {t.onboardingPickSubtitle}
                    </p>
                  </div>
                )}
                {isHandleStep && (
                  <div style={{ marginBottom: 10 }}>
                    <span className="cinzel" style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-primary)" }}>
                      {t.browseHabitsSection}
                    </span>
                  </div>
                )}

                <CustomHabitManager
                  customQuests={customQuests}
                  selectedIds={onboardingQuestIds}
                  onToggleSelect={onToggleOnboardingQuest}
                  selectionLimitReached={selectedCount >= SELECTION_LIMIT}
                  accentVar="--color-primary"
                  allowDelete
                  onCreateCustomQuest={onCreateCustomQuest}
                  onUpdateCustomQuest={onUpdateCustomQuest}
                  onDeleteCustomQuest={onDeleteCustomQuest}
                  customSaving={customSaving}
                  customError={customError}
                  onClearCustomError={onClearCustomError}
                />

                <div style={{ marginTop: 12 }}>
                  <div style={{ marginBottom: 8 }}>
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
                      onChange={setOnboardingQuestSearch}
                      placeholder={t.onboardingSearch}
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
                      }}
                    />
                  </div>
                  {questGroups.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", padding: "12px 0" }}>{t.onboardingNoMatch}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {questGroups.map((group) => {
                        const selectedInGroup = group.variants.find((q) => onboardingQuestIds.includes(q.id));
                        const blocked = !selectedInGroup && selectedCount >= SELECTION_LIMIT;
                        return (
                          <QuestGroupCard
                            key={`tour-group-${group.key}`}
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
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid var(--card-border-idle)",
              background: "rgba(0,0,0,0.30)",
              flexShrink: 0,
            }}
          >
            {(localError || onboardingError) ? (
              <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 8px", textAlign: "center", fontWeight: 600 }}>
                {localError || onboardingError}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="cinzel mobile-pressable"
                onClick={goBack}
                style={{
                  minHeight: 48,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: "transparent",
                  border: "1px solid var(--card-border-idle)",
                  color: "#cbd5e1",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                ‹ {t.tourBack}
              </button>
              <button
                type="button"
                className="cinzel mobile-pressable"
                onClick={handleNextClick}
                disabled={saving || onboardingSaving || !canAdvanceSetup}
                style={{
                  flex: 2,
                  minHeight: 48,
                  borderRadius: 12,
                  background: (saving || onboardingSaving || !canAdvanceSetup)
                    ? "rgba(255,255,255,0.08)"
                    : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                  border: "none",
                  color: (saving || onboardingSaving || !canAdvanceSetup) ? "#64748b" : "#0b1120",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: (saving || onboardingSaving || !canAdvanceSetup) ? "not-allowed" : "pointer",
                  letterSpacing: "0.05em",
                  boxShadow: (saving || onboardingSaving || !canAdvanceSetup) ? "none" : "0 6px 18px rgba(56,189,248,0.18)",
                }}
              >
                {(saving || onboardingSaving) ? t.tourSaving : step === 3 ? t.tourNext + " →" : t.tourNext}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
