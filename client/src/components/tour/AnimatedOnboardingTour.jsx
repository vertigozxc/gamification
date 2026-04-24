import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";

// ── constants ─────────────────────────────────────────────────────────
const TYPE_MS_PER_CHAR = 22;      // typewriter speed
const TYPE_PUNCT_PAUSE_MS = 90;   // extra pause after . ! ? ,
const MASK_PAD = 8;               // spotlight padding around target
const BUBBLE_MARGIN = 14;         // gap between spotlight and bubble
const POSITION_POLL_MS = 320;     // fallback re-measure interval (keyboards, animations)
const SCROLL_DELAY_MS = 240;

// ── utilities ─────────────────────────────────────────────────────────
function readSafeAreaTop() {
  try {
    const css = getComputedStyle(document.documentElement);
    const raw = css.getPropertyValue("--mobile-safe-top").trim() || "0px";
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function readSafeAreaBottom() {
  try {
    // Env-based fallback: read a raw pixel value from a throwaway probe.
    const probe = document.createElement("div");
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    document.body.appendChild(probe);
    const val = parseFloat(getComputedStyle(probe).paddingBottom || "0");
    document.body.removeChild(probe);
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

function getTargetRect(selector) {
  if (!selector) return null;
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { el, rect };
  } catch {
    return null;
  }
}

// ── typewriter hook ───────────────────────────────────────────────────
function useTypewriter(text, { speedMs = TYPE_MS_PER_CHAR, enabled = true, signalKey = 0 } = {}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) {
      setTyped(text || "");
      setDone(true);
      return undefined;
    }
    setTyped("");
    setDone(false);
    if (!text) { setDone(true); return undefined; }

    let i = 0;
    const full = String(text);

    const tick = () => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        setDone(true);
        return;
      }
      const last = full.charAt(i - 1);
      const extra = /[.!?,:;—]/.test(last) ? TYPE_PUNCT_PAUSE_MS : 0;
      timerRef.current = setTimeout(tick, speedMs + extra);
    };

    timerRef.current = setTimeout(tick, speedMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled, signalKey]);

  const skip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTyped(text || "");
    setDone(true);
  }, [text]);

  return { typed, done, skip };
}

// ── main component ────────────────────────────────────────────────────
/**
 * Animated onboarding tour with interactive gating. Renders a dimmed
 * four-curtain overlay with a spotlight hole around the current step's
 * target, a typewriter bubble next to it, and a progress strip on top.
 *
 * Props:
 *   open           — whether the tour is active
 *   steps          — ordered array of step descriptors (see shape below)
 *   onSkip         — user tapped the (×) Skip button; parent should mark
 *                    the tour done without the +1 level bonus
 *   onFinish       — final celebration acknowledged; parent should mark
 *                    the tour done with the +1 level bonus
 *
 * Step shape:
 *   {
 *     id: string,
 *     kind?: "center" | "spotlight"  — default "spotlight"
 *     target?: string                — CSS selector for the element to
 *                                       highlight (for "spotlight")
 *     title: string,
 *     text: string,
 *     bubblePlacement?: "auto"|"top"|"bottom"|"center"
 *     scroll?: boolean               — scroll target into view on enter
 *     onEnter?: () => void           — side effect to run when step opens
 *                                      (e.g. setActiveTab("city"))
 *     gate?: "next" | "tap" | "condition"   — default "next"
 *     isSatisfied?: () => boolean    — for gate:"condition", allow Next
 *     ctaNextLabel?: string          — override the button label
 *     hideNext?: boolean             — hide the Next button entirely
 *   }
 */
export default function AnimatedOnboardingTour({
  open,
  steps,
  onSkip,
  onFinish
}) {
  const { t } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [rectTick, setRectTick] = useState(0);       // trigger re-measure
  const [typewriterKey, setTypewriterKey] = useState(0);
  const [askSkipConfirm, setAskSkipConfirm] = useState(false);
  const [finaleOpen, setFinaleOpen] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 375,
    h: typeof window !== "undefined" ? window.innerHeight : 667
  }));
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);
  const [shakeTick, setShakeTick] = useState(0);
  const enteredIdRef = useRef(null);

  const stepCount = Array.isArray(steps) ? steps.length : 0;
  const step = stepCount > 0 && stepIndex < stepCount ? steps[stepIndex] : null;

  // Reset to first step whenever the tour (re)opens.
  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setFinaleOpen(false);
      setAskSkipConfirm(false);
      enteredIdRef.current = null;
    }
  }, [open]);

  // Read safe-area paddings once on mount + on resize.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      setSafeTop(readSafeAreaTop());
      setSafeBottom(readSafeAreaBottom());
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [open]);

  // Fire step.onEnter exactly once per step transition.
  useEffect(() => {
    if (!open || !step) return;
    if (enteredIdRef.current === step.id) return;
    enteredIdRef.current = step.id;
    setTypewriterKey((k) => k + 1);
    if (typeof step.onEnter === "function") {
      try { step.onEnter(); } catch { /* noop */ }
    }
    if (step.scroll && step.target && step.kind !== "center") {
      setTimeout(() => {
        const found = getTargetRect(step.target);
        if (found?.el && typeof found.el.scrollIntoView === "function") {
          try {
            found.el.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch {
            try { found.el.scrollIntoView(); } catch { /* noop */ }
          }
        }
      }, SCROLL_DELAY_MS);
    }
  }, [open, step]);

  // Re-measure target rect every animation frame for a few cycles after
  // a step transition (layout settles after scroll/animation), then fall
  // back to a cheap poll.
  useEffect(() => {
    if (!open || !step || step.kind === "center") return undefined;
    let raf;
    let polled = 0;
    const kick = () => {
      setRectTick((n) => n + 1);
      polled += 1;
      if (polled < 12) {
        raf = requestAnimationFrame(kick);
      }
    };
    raf = requestAnimationFrame(kick);
    const poll = setInterval(() => setRectTick((n) => n + 1), POSITION_POLL_MS);
    const onScroll = () => setRectTick((n) => n + 1);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearInterval(poll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, step]);

  // Gate = "tap": intercept pointerdown anywhere on document. If the
  // pointer is inside the target rect → advance the tour. Otherwise
  // shake the bubble to signal "wrong spot".
  useEffect(() => {
    if (!open || !step || step.gate !== "tap") return undefined;
    const handler = (ev) => {
      const info = getTargetRect(step.target);
      if (!info) return;
      const r = info.rect;
      const x = ev.clientX;
      const y = ev.clientY;
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) {
        // Defer advance by one frame so the original click fires first.
        requestAnimationFrame(() => advance());
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Derive target rect + bubble placement each render (cheap; getBCR is
  // fast enough at 60 fps when already laid out).
  const layout = useMemo(() => {
    if (!open || !step) return null;
    if (step.kind === "center") {
      return { kind: "center" };
    }
    const info = getTargetRect(step.target);
    if (!info) return { kind: "missing" };
    const r = info.rect;
    return { kind: "spotlight", rect: r };
  // Re-run whenever viewport changes or rectTick increments.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, rectTick, viewport.w, viewport.h]);

  const currentTitle = step?.title || "";
  const currentText = step?.text || "";
  const { typed: typedTitle, done: titleDone, skip: skipTitleType } = useTypewriter(currentTitle, { signalKey: typewriterKey });
  const { typed: typedText, done: textDone, skip: skipTextType } = useTypewriter(currentText, { signalKey: typewriterKey, enabled: titleDone });
  const typingDone = titleDone && textDone;

  const skipTyping = () => {
    skipTitleType();
    skipTextType();
  };

  // Move forward one step; if we're on the last step, open the finale.
  const advance = useCallback(() => {
    if (!open || !step) return;
    if (step.gate === "condition" && typeof step.isSatisfied === "function") {
      if (!step.isSatisfied()) {
        // Shake to signal: not yet.
        setShakeTick((n) => n + 1);
        return;
      }
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex >= stepCount) {
      setFinaleOpen(true);
      return;
    }
    setStepIndex(nextIndex);
  }, [open, step, stepIndex, stepCount]);

  // For gate:"condition" steps, auto-advance the moment the condition
  // flips true — the user shouldn't have to tap Next again if they've
  // already done the thing we asked (e.g. finished setup).
  useEffect(() => {
    if (!open || !step) return undefined;
    if (step.gate !== "condition" || typeof step.isSatisfied !== "function") return undefined;
    if (step.autoAdvance === false) return undefined;
    if (step.isSatisfied()) {
      const id = setTimeout(() => {
        advance();
      }, 260);
      return () => clearTimeout(id);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, rectTick, advance]);

  // Compute bubble placement based on target rect and viewport.
  const bubble = useMemo(() => {
    if (!layout) return null;
    if (layout.kind === "center" || layout.kind === "missing") {
      return {
        top: Math.round(viewport.h / 2 - 110),
        left: 16,
        right: 16,
        width: viewport.w - 32,
        arrow: "none"
      };
    }
    const r = layout.rect;
    const BUBBLE_WIDTH = Math.min(viewport.w - 32, 360);
    const spaceAbove = r.top - safeTop - 20;
    const spaceBelow = viewport.h - r.bottom - safeBottom - 20;
    const prefer = step?.bubblePlacement || "auto";
    let placement = prefer;
    if (prefer === "auto") {
      placement = spaceBelow >= 180 ? "bottom" : spaceAbove >= 180 ? "top" : (spaceBelow >= spaceAbove ? "bottom" : "top");
    }
    const leftRaw = r.left + r.width / 2 - BUBBLE_WIDTH / 2;
    const clampedLeft = Math.max(12, Math.min(viewport.w - BUBBLE_WIDTH - 12, leftRaw));
    let top;
    let arrow = placement;
    if (placement === "top") {
      top = Math.max(safeTop + 56, r.top - BUBBLE_MARGIN - 220);
    } else {
      top = Math.min(viewport.h - safeBottom - 220, r.bottom + BUBBLE_MARGIN);
    }
    return {
      top: Math.round(top),
      left: Math.round(clampedLeft),
      width: BUBBLE_WIDTH,
      arrow
    };
  }, [layout, viewport.w, viewport.h, safeTop, safeBottom, step]);

  // Keyboard: Esc → skip confirm, space/enter → advance.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setAskSkipConfirm(true);
      } else if (e.key === "Enter" || e.key === " ") {
        if (typingDone) advance();
        else skipTyping();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typingDone, advance]);

  if (!open || !step) return null;

  const pct = Math.round(((stepIndex + (finaleOpen ? 1 : 0)) / Math.max(1, stepCount)) * 100);
  const maskRect = layout?.kind === "spotlight" ? layout.rect : null;
  const curtains = maskRect
    ? {
        top: { top: 0, left: 0, right: 0, height: Math.max(0, maskRect.top - MASK_PAD) },
        bottom: { bottom: 0, left: 0, right: 0, top: Math.min(viewport.h, maskRect.bottom + MASK_PAD) },
        left: { top: Math.max(0, maskRect.top - MASK_PAD), left: 0, width: Math.max(0, maskRect.left - MASK_PAD), height: Math.max(0, maskRect.height + 2 * MASK_PAD) },
        right: { top: Math.max(0, maskRect.top - MASK_PAD), right: 0, left: Math.min(viewport.w, maskRect.right + MASK_PAD), height: Math.max(0, maskRect.height + 2 * MASK_PAD) }
      }
    : null;

  const highlight = maskRect
    ? {
        top: Math.round(maskRect.top - MASK_PAD),
        left: Math.round(maskRect.left - MASK_PAD),
        width: Math.round(maskRect.width + 2 * MASK_PAD),
        height: Math.round(maskRect.height + 2 * MASK_PAD)
      }
    : null;

  const canAdvanceNow =
    step.gate === "tap"
      ? false
      : step.gate === "condition" && typeof step.isSatisfied === "function"
        ? step.isSatisfied()
        : true;

  const nextLabel = step.ctaNextLabel || (stepIndex === stepCount - 1
    ? (t.tourFinishLabel || "Finish")
    : (t.tourNextLabel || "Next"));

  return (
    <div className={`tour-root ${finaleOpen ? "tour-root--finale" : ""}`} aria-live="polite">
      {/* curtains (dim) */}
      {layout?.kind === "center" || layout?.kind === "missing" ? (
        <div className="tour-curtain tour-curtain-full" onPointerDown={(e) => e.stopPropagation()} />
      ) : curtains ? (
        <>
          <div className="tour-curtain" style={{ position: "fixed", ...curtains.top }} />
          <div className="tour-curtain" style={{ position: "fixed", ...curtains.bottom }} />
          <div className="tour-curtain" style={{ position: "fixed", ...curtains.left }} />
          <div className="tour-curtain" style={{ position: "fixed", ...curtains.right }} />
        </>
      ) : null}

      {/* highlight ring */}
      {highlight ? (
        <div
          className="tour-highlight"
          style={{
            position: "fixed",
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height
          }}
        />
      ) : null}

      {/* progress dots top strip */}
      <div
        className="tour-progress"
        style={{ top: safeTop + 10 }}
      >
        <div className="tour-progress-track">
          <div className="tour-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="tour-progress-count">{Math.min(stepIndex + 1, stepCount)} / {stepCount}</span>
      </div>

      {/* skip × */}
      <button
        type="button"
        className="tour-skip mobile-pressable"
        style={{ top: safeTop + 10 }}
        onClick={() => setAskSkipConfirm(true)}
        aria-label={t.tourSkipLabel || "Skip tour"}
      >
        {t.tourSkipLabel || "Skip"}
      </button>

      {/* bubble */}
      {bubble ? (
        <div
          className={`tour-bubble tour-bubble--arrow-${bubble.arrow} ${shakeTick ? "tour-bubble--shake" : ""}`}
          key={`bubble-${shakeTick}`}
          style={{
            position: "fixed",
            top: bubble.top,
            left: bubble.left,
            width: bubble.width
          }}
          onClick={() => {
            if (!typingDone) skipTyping();
          }}
        >
          <div className="tour-bubble-title">{typedTitle}{!titleDone ? <span className="tour-caret" /> : null}</div>
          <div className="tour-bubble-text">{typedText}{titleDone && !textDone ? <span className="tour-caret" /> : null}</div>

          <div className="tour-bubble-actions">
            {step.hideNext ? null : (
              <button
                type="button"
                className="tour-next mobile-pressable cinzel"
                disabled={!typingDone || !canAdvanceNow}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!typingDone) { skipTyping(); return; }
                  advance();
                }}
              >
                {nextLabel}
              </button>
            )}
            {step.gate === "tap" ? (
              <div className="tour-gate-hint">{t.tourTapTargetHint || "Tap the highlighted area to continue"}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* finale */}
      {finaleOpen ? (
        <div className="tour-finale" onClick={(e) => e.stopPropagation()}>
          <div className="tour-confetti" aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className={`tour-confetti-piece tour-confetti-piece-${(i % 5) + 1}`} style={{ left: `${(i * 4.4) % 100}%`, animationDelay: `${(i % 7) * 70}ms` }} />
            ))}
          </div>
          <div className="tour-finale-inner">
            <div className="tour-finale-badge">+1</div>
            <h3 className="tour-finale-title cinzel">{t.tourFinaleTitle || "Level Up!"}</h3>
            <p className="tour-finale-text">{t.tourFinaleText || "Thanks for the walkthrough — enjoy your bonus level."}</p>
            <button
              type="button"
              className="tour-finale-cta mobile-pressable cinzel"
              onClick={() => {
                setFinaleOpen(false);
                if (typeof onFinish === "function") onFinish();
              }}
            >
              {t.tourFinaleCta || "Claim bonus"}
            </button>
          </div>
        </div>
      ) : null}

      {/* skip confirm */}
      {askSkipConfirm ? (
        <div className="tour-skip-confirm" onClick={() => setAskSkipConfirm(false)}>
          <div className="tour-skip-card" onClick={(e) => e.stopPropagation()}>
            <h4 className="cinzel">{t.tourSkipConfirmTitle || "Skip the tour?"}</h4>
            <p>{t.tourSkipConfirmText || "You'll miss the +1 level bonus. You can restart the tour later in Profile → Settings."}</p>
            <div className="tour-skip-buttons">
              <button
                type="button"
                className="tour-skip-cancel mobile-pressable cinzel"
                onClick={() => setAskSkipConfirm(false)}
              >
                {t.tourSkipConfirmBack || "Keep going"}
              </button>
              <button
                type="button"
                className="tour-skip-confirm-cta mobile-pressable cinzel"
                onClick={() => {
                  setAskSkipConfirm(false);
                  if (typeof onSkip === "function") onSkip();
                }}
              >
                {t.tourSkipConfirmOk || "Skip anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
