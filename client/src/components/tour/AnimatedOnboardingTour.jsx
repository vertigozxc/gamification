import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";

// ── constants ─────────────────────────────────────────────────────────
const TYPE_MS_PER_CHAR = 22;      // typewriter speed
const TYPE_PUNCT_PAUSE_MS = 90;   // extra pause after . ! ? ,
const MASK_PAD = 8;               // spotlight padding around target
const MASK_RADIUS = 14;           // rounded-rect cutout corner radius
const BUBBLE_MARGIN = 14;         // gap between spotlight and bubble
const DEFAULT_BUBBLE_HEIGHT = 220; // fallback until the real one is measured
const SCROLL_DELAY_MS = 240;
const RAF_SETTLE_FRAMES = 24;     // re-measure for first ~400ms after step transition

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

// The native shell injects --mobile-footer-offset = safeBottomPx + 68
// when the bottom tab bar is visible (and just safeBottomPx when not).
// We use this for bubble positioning so a bottom-anchored bubble sits
// JUST ABOVE the tab bar instead of overlapping with it. Without this
// the bubble's bottom edge could slide under the (locked-but-visible)
// tab bar during the onboarding tour.
function readMobileFooterOffset() {
  try {
    const css = getComputedStyle(document.documentElement);
    const raw = css.getPropertyValue("--mobile-footer-offset").trim() || "0px";
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
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

// Build an SVG <path d=…> string with two subpaths: an outer rect that
// covers the entire viewport and an inner rounded-rect "hole" around the
// spotlight target. Combined with fill-rule="evenodd" this paints the
// dim everywhere EXCEPT inside the hole — a single, gap-free overlay
// that replaces the old 4-curtain strip layout (which left subpixel
// seams at corners and let pointer events leak through them).
function buildSpotlightPath(vw, vh, hole) {
  const radius = Math.max(0, Math.min(MASK_RADIUS, hole.width / 2, hole.height / 2));
  const x1 = hole.left;
  const y1 = hole.top;
  const x2 = hole.left + hole.width;
  const y2 = hole.top + hole.height;
  // Outer rect (clockwise) + inner rounded rect (counter-clockwise),
  // joined into one path string. With fill-rule:evenodd the inner area
  // is treated as outside, leaving a transparent hole.
  return [
    `M0,0`, `H${vw}`, `V${vh}`, `H0`, `Z`,
    `M${x1 + radius},${y1}`,
    `H${x2 - radius}`,
    `Q${x2},${y1} ${x2},${y1 + radius}`,
    `V${y2 - radius}`,
    `Q${x2},${y2} ${x2 - radius},${y2}`,
    `H${x1 + radius}`,
    `Q${x1},${y2} ${x1},${y2 - radius}`,
    `V${y1 + radius}`,
    `Q${x1},${y1} ${x1 + radius},${y1}`,
    `Z`
  ].join(" ");
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
  onFinish,
  // Parent gets notified of the current step id on every transition —
  // lets the onboarding modal lock its Begin button until the tour
  // reaches the "Ready?" step, so the user can't skip ahead.
  onStepChange
}) {
  const { t } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [rectTick, setRectTick] = useState(0);       // trigger re-measure
  const [typewriterKey, setTypewriterKey] = useState(0);
  const [askSkipConfirm, setAskSkipConfirm] = useState(false);
  const [finaleOpen, setFinaleOpen] = useState(false);
  // The highlight ring is INVISIBLE while the spotlight is mid-transition
  // and only fades in once the target rect has been still for a beat.
  // Prevents the user from ever seeing the ring "fly" between steps —
  // it just disappears, the cutout snaps to the new target, and the
  // ring quietly reappears at the final position.
  const [targetSettled, setTargetSettled] = useState(false);
  // When the mobile keyboard opens, window.innerHeight stays roughly
  // the same but visualViewport.height shrinks — read from visualViewport
  // when available so curtain heights and bubble positions stay sane
  // while typing in the nickname / handle fields.
  const readViewport = () => {
    if (typeof window === "undefined") return { w: 375, h: 667 };
    const vv = window.visualViewport;
    return {
      w: vv?.width || window.innerWidth || 375,
      h: vv?.height || window.innerHeight || 667
    };
  };
  const [viewport, setViewport] = useState(readViewport);
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);
  // Mirrors --mobile-footer-offset from the native shell. Bigger than
  // safeBottom when the (locked-but-visible) bottom tab bar is up.
  const [footerOffset, setFooterOffset] = useState(0);
  const [shakeTick, setShakeTick] = useState(0);
  const enteredIdRef = useRef(null);
  const bubbleRef = useRef(null);
  const [bubbleHeight, setBubbleHeight] = useState(DEFAULT_BUBBLE_HEIGHT);
  // Track the id of the step we're on so the index stays stable when
  // the parent rebuilds the steps array (e.g. setup-* steps vanish
  // once showOnboarding flips false). Without this, a completed setup
  // used to jump stepIndex onto an unrelated main-tour step.
  const currentStepIdRef = useRef(null);

  const stepCount = Array.isArray(steps) ? steps.length : 0;
  const step = stepCount > 0 && stepIndex < stepCount ? steps[stepIndex] : null;

  // Reset to first step whenever the tour (re)opens.
  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setFinaleOpen(false);
      setAskSkipConfirm(false);
      enteredIdRef.current = null;
      currentStepIdRef.current = null;
    }
  }, [open]);

  // Keep stepIndex tracking the same step id when the array mutates,
  // and fan the id out to the parent for external locking (e.g. the
  // onboarding modal's Begin button).
  useEffect(() => {
    if (!open) return;
    const nextId = step?.id;
    if (nextId) currentStepIdRef.current = nextId;
    if (typeof onStepChange === "function") {
      try { onStepChange(nextId || null); } catch { /* noop */ }
    }
  }, [open, stepIndex, step?.id, onStepChange]);

  useEffect(() => {
    // Clear reported id when the tour closes.
    if (!open && typeof onStepChange === "function") {
      try { onStepChange(null); } catch { /* noop */ }
    }
  }, [open, onStepChange]);

  useEffect(() => {
    if (!open) return;
    const pinned = currentStepIdRef.current;
    if (!pinned || !Array.isArray(steps) || steps.length === 0) return;
    const foundIdx = steps.findIndex((s) => s?.id === pinned);
    if (foundIdx >= 0 && foundIdx !== stepIndex) {
      setStepIndex(foundIdx);
    }
  // Only re-evaluate when the steps array reference actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  // Auto-skip steps marked hidden (e.g. setup-* steps once the setup
  // modal has closed). This is what keeps the tour continuing after the
  // user taps Start Adventure — without it the tour would silently
  // land on a hidden step and appear broken.
  useEffect(() => {
    if (!open || !step) return;
    if (!step.hidden) return;
    const nextIdx = stepIndex + 1;
    if (nextIdx >= stepCount) {
      setFinaleOpen(true);
      return;
    }
    enteredIdRef.current = null;
    currentStepIdRef.current = null;
    setStepIndex(nextIdx);
  }, [open, step, stepIndex, stepCount]);

  // Lock body / html scrolling while the tour is open. The user kept
  // accidentally scrolling the page out from under the spotlight on
  // long-content steps (the bubble would stay fixed, but the target
  // would slide off-screen). Setting overflow:hidden on <html> + <body>
  // blocks user-initiated scroll (touch / wheel) without affecting
  // programmatic scrollIntoView, so the tour's own per-step scroll
  // logic keeps working — and any spotlight target that has its own
  // overflow:auto / overflow:scroll (e.g. the habits picker's slide
  // bar or any inner list) keeps scrolling normally because we only
  // lock the OUTER document scroll. Restored on unmount / close.
  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Read safe-area paddings once on mount + on resize. Track the
  // visualViewport size separately so the overlay shrinks with the
  // keyboard instead of staying full-height and covering the field the
  // user is trying to type in.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      setSafeTop(readSafeAreaTop());
      setSafeBottom(readSafeAreaBottom());
      setFooterOffset(readMobileFooterOffset());
      setViewport(readViewport());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
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
          const block = step.scrollBlock || "center";
          try {
            found.el.scrollIntoView({ block, behavior: "smooth" });
          } catch {
            try { found.el.scrollIntoView(); } catch { /* noop */ }
          }
        }
      }, SCROLL_DELAY_MS);
    }
  }, [open, step]);

  // Track the target rect via real DOM observers — no polling. The old
  // implementation re-measured on a 320 ms setInterval which produced
  // visible jitter when the target sat inside an animated container
  // (the spotlight visibly "stepped" between measurements). Now:
  //   • a short RAF burst right after the step transition catches the
  //     final position once scroll/animation/layout has settled, and
  //   • a ResizeObserver on the target element + its closest ancestors
  //     fires synchronously the moment its rect actually changes — no
  //     fixed interval, no idle work, zero jitter when nothing moves.
  // A scoped MutationObserver on the target's parent picks up the case
  // where the target itself is removed and re-inserted (e.g. tab swap).
  useEffect(() => {
    if (!open || !step || step.kind === "center" || step.kind === "tab-switch") return undefined;
    const selector = step.target;
    if (!selector) return undefined;

    let raf = null;
    let frames = 0;
    let cancelled = false;
    let ro = null;
    let mo = null;
    let attachRaf = null;
    let attachTries = 0;

    const refresh = () => setRectTick((n) => n + 1);

    // RAF burst — covers the first ~400 ms while scroll-into-view and
    // CSS transitions on neighbouring cards are still settling.
    const kick = () => {
      if (cancelled) return;
      refresh();
      frames += 1;
      if (frames < RAF_SETTLE_FRAMES) {
        raf = requestAnimationFrame(kick);
      }
    };
    raf = requestAnimationFrame(kick);

    // Attach ResizeObserver / MutationObserver as soon as the target is
    // in the DOM. Some steps run inside a Suspense boundary so the
    // element may not be there on the very first frame — retry on RAF
    // up to ~1 s before giving up.
    const attach = () => {
      if (cancelled) return;
      let el = null;
      try { el = document.querySelector(selector); } catch { /* invalid selector */ }
      if (!el) {
        attachTries += 1;
        if (attachTries < 60) {
          attachRaf = requestAnimationFrame(attach);
        }
        return;
      }
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(() => {
          if (!cancelled) refresh();
        });
        ro.observe(el);
        // Watch a few ancestors too — they catch reflows triggered by
        // sibling content (e.g. the quest list growing).
        let parent = el.parentElement;
        for (let i = 0; i < 3 && parent; i += 1) {
          ro.observe(parent);
          parent = parent.parentElement;
        }
      }
      if (typeof MutationObserver === "function") {
        const root = el.parentElement || document.body;
        mo = new MutationObserver(() => { if (!cancelled) refresh(); });
        mo.observe(root, { childList: true, subtree: false });
      }
    };
    attach();

    const onScroll = () => refresh();
    window.addEventListener("scroll", onScroll, true);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (attachRaf) cancelAnimationFrame(attachRaf);
      if (ro) { try { ro.disconnect(); } catch { /* noop */ } }
      if (mo) { try { mo.disconnect(); } catch { /* noop */ } }
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, step]);

  // The highlight ring is hidden by default and only fades in once the
  // target rect has gone STILL for ~220 ms. Every rectTick bump (RAF
  // burst, ResizeObserver, MutationObserver, scroll) restarts the timer,
  // so as long as the spotlight is in motion the ring stays invisible.
  // The moment everything settles, the ring appears at its final
  // position — the user never sees it travel.
  useEffect(() => {
    setTargetSettled(false);
  }, [step?.id]);

  useEffect(() => {
    if (!open || !step) return undefined;
    if (step.kind === "center" || step.kind === "tab-switch") return undefined;
    const id = setTimeout(() => setTargetSettled(true), 220);
    return () => clearTimeout(id);
  }, [open, step, rectTick]);

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
    if (step.kind === "center" || step.kind === "tab-switch") {
      return { kind: step.kind };
    }
    const info = getTargetRect(step.target);
    if (!info) return { kind: "missing" };
    const r = info.rect;
    // fillBottom — stretch the spotlight from the target's top edge
    // all the way to the bottom of the viewport, full width. Keeps
    // the highlight rectangle stable as the user scrolls / picks
    // items inside the target (used by the habits picker).
    if (step.fillBottom) {
      return {
        kind: "spotlight",
        rect: {
          top: r.top,
          left: 0,
          right: viewport.w,
          bottom: viewport.h,
          width: viewport.w,
          height: Math.max(0, viewport.h - r.top)
        }
      };
    }
    // extendBottomTo — span the spotlight from the target's top edge
    // down to a SECOND element's bottom edge (e.g. spotlight from
    // CommunityHero's top all the way down to the third player row).
    // If the second element isn't in the DOM yet, gracefully fall
    // back to the target's own rect.
    if (step.extendBottomTo) {
      const tail = getTargetRect(step.extendBottomTo);
      if (tail) {
        const left = Math.min(r.left, tail.rect.left);
        const right = Math.max(r.right, tail.rect.right);
        const bottom = tail.rect.bottom;
        return {
          kind: "spotlight",
          rect: {
            top: r.top,
            left,
            right,
            bottom,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - r.top)
          }
        };
      }
    }
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
    enteredIdRef.current = null;
    setStepIndex(nextIndex);
  }, [open, step, stepIndex, stepCount]);

  // (The Back button was removed from the bubble — the user can only
  // advance forward or Skip the entire tour. `goBack` and `canGoBack`
  // were dropped along with the rendering call site.)

  // For gate:"condition" steps that explicitly opt into auto-advance,
  // advance the moment the condition flips true. By default steps wait
  // for an explicit Next tap (so typing one character in a name field
  // doesn't jump to the next step on the user).
  useEffect(() => {
    if (!open || !step) return undefined;
    if (step.gate !== "condition" || typeof step.isSatisfied !== "function") return undefined;
    if (step.autoAdvance !== true) return undefined;
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
    if (layout.kind === "tab-switch") {
      // Pin the bubble near the bottom, above the native tab bar, so
      // the arrow points down at the tab the user should tap.
      const BUBBLE_WIDTH = Math.min(viewport.w - 32, 360);
      const leftRaw = (viewport.w - BUBBLE_WIDTH) / 2;
      return {
        top: Math.max(safeTop + 12, viewport.h - safeBottom - 160 - (bubbleHeight || DEFAULT_BUBBLE_HEIGHT)),
        left: Math.round(leftRaw),
        width: BUBBLE_WIDTH,
        arrow: "bottom-pointer"
      };
    }
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
    const h = bubbleHeight || DEFAULT_BUBBLE_HEIGHT;
    // Reserved space at the bottom of the WebView. When the native
    // tab bar is up (which it is during the onboarding tour, just
    // locked from taps), --mobile-footer-offset includes its 68 px
    // height; otherwise it falls back to safeBottom alone. Either
    // way, a "bottom"-anchored bubble must sit ABOVE this reserve
    // or it'll be hidden behind the tab bar.
    const bottomReserved = Math.max(safeBottom, footerOffset);
    const spaceAbove = r.top - safeTop - 20;
    const spaceBelow = viewport.h - r.bottom - bottomReserved - 20;
    const prefer = step?.bubblePlacement || "auto";
    let placement = prefer;
    if (prefer === "auto") {
      placement = spaceBelow >= (h + 20) ? "bottom" : spaceAbove >= (h + 20) ? "top" : (spaceBelow >= spaceAbove ? "bottom" : "top");
    }
    const leftRaw = r.left + r.width / 2 - BUBBLE_WIDTH / 2;
    const clampedLeft = Math.max(12, Math.min(viewport.w - BUBBLE_WIDTH - 12, leftRaw));
    let top;
    const arrow = placement;
    if (placement === "top") {
      // Anchor bubble so its bottom sits above the target (never covers it).
      top = Math.max(safeTop + 12, r.top - BUBBLE_MARGIN - h);
    } else {
      top = Math.min(viewport.h - bottomReserved - h - 12, r.bottom + BUBBLE_MARGIN);
    }
    return {
      top: Math.round(top),
      left: Math.round(clampedLeft),
      width: BUBBLE_WIDTH,
      arrow
    };
  }, [layout, viewport.w, viewport.h, safeTop, safeBottom, footerOffset, step, bubbleHeight]);

  // After every render, measure the bubble's real height so the next
  // position calculation uses an accurate value — long text steps were
  // overflowing the hardcoded 220px budget and covering the target.
  useLayoutEffect(() => {
    if (!bubbleRef.current) return;
    const h = bubbleRef.current.getBoundingClientRect().height;
    if (h && Math.abs(h - bubbleHeight) > 3) {
      setBubbleHeight(h);
    }
  });

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

  // Progress ignores the welcome step entirely. First tour step = 0%,
  // last step = 100%, finale = 100%.
  const totalTrackable = Math.max(1, stepCount - 1);
  const trackableIndex = Math.max(0, stepIndex - 1);
  const divisor = Math.max(1, totalTrackable - 1);
  const rawPct = finaleOpen ? 100 : Math.round((trackableIndex / divisor) * 100);
  const pct = Math.max(0, Math.min(100, rawPct));
  const maskRect = layout?.kind === "spotlight" ? layout.rect : null;

  // Build the spotlight cutout rect (target rect + safety padding,
  // clamped inside the viewport). The same rect feeds both the SVG
  // overlay path and the visible glow ring.
  const cutout = maskRect
    ? {
        left: Math.max(0, Math.round(maskRect.left - MASK_PAD)),
        top: Math.max(0, Math.round(maskRect.top - MASK_PAD)),
        width: Math.max(0, Math.min(viewport.w, Math.round(maskRect.width + 2 * MASK_PAD))),
        height: Math.max(0, Math.min(viewport.h, Math.round(maskRect.height + 2 * MASK_PAD)))
      }
    : null;

  // Single SVG path covering the full viewport with the cutout punched
  // out via fill-rule: evenodd. Replaces the old 4-div curtain strip
  // (top / bottom / left / right) which left subpixel seams at the
  // corners of the spotlight and let pointer events leak through them.
  const spotlightPathD = cutout
    ? buildSpotlightPath(viewport.w, viewport.h, cutout)
    : null;

  const highlight = cutout; // same rect — keeps the existing CSS happy

  const canAdvanceNow =
    step.gate === "tap"
      ? false
      : step.gate === "condition" && typeof step.isSatisfied === "function"
        ? step.isSatisfied()
        : true;

  const nextLabel = step.ctaNextLabel || (stepIndex === stepCount - 1
    ? (t.tourFinishLabel || "Finish")
    : (t.tourNextLabel || "Next"));

  const isWelcome = step.kind === "welcome";

  return (
    <div className={`tour-root ${finaleOpen ? "tour-root--finale" : ""}`} aria-live="polite">
      {/* Dim layer.
          • Welcome / center / tab-switch / missing → solid full-screen dim.
          • Spotlight steps → single SVG with a rounded-rect cutout.
          The SVG approach is gap-free (the old 4-div strip left subpixel
          seams) and pointer-events:visiblePainted on the path means
          clicks land on the dim ONLY where it's painted — the cutout
          area passes events straight through to the spotlit element. */}
      {isWelcome || layout?.kind === "center" || layout?.kind === "missing" || layout?.kind === "tab-switch" ? (
        <div className="tour-curtain tour-curtain-full" onPointerDown={(e) => e.stopPropagation()} />
      ) : spotlightPathD ? (
        <svg
          className="tour-mask-svg"
          width={viewport.w}
          height={viewport.h}
          viewBox={`0 0 ${viewport.w} ${viewport.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={spotlightPathD} fillRule="evenodd" />
        </svg>
      ) : null}

      {/* Transparent blocker over the spotlight cutout for steps that
          should NOT let the user interact with the spotlit element.
          By default the SVG cutout passes pointer events through so
          the user can tap whatever's spotlit (a habit, the Park
          district, etc.); for intro-only steps (quest-board overview,
          daily-board overview, etc.) we want them to read the bubble
          and tap Next, not start completing tasks mid-tour. The
          blocker sits between the SVG and the bubble in the stacking
          order so the bubble's Next button still works. */}
      {!isWelcome && highlight && step.blockInteraction ? (
        <div
          className="tour-cutout-blocker"
          aria-hidden="true"
          style={{
            position: "fixed",
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}

      {/* Glowing highlight ring on top of the SVG cutout — gated by
          targetSettled so the user never sees it mid-flight between
          steps. Keyed by step.id so React unmounts/remounts on every
          step change, restarting the fade-in animation cleanly. */}
      {!isWelcome && highlight && targetSettled ? (
        <div
          key={`tour-highlight-${step.id}`}
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

      {/* Top progress strip removed per design — progress now lives
          inside the bubble (see below) and inside the welcome card. */}

      {/* Welcome hero card: colorful gradient, big emoji, primary Start
          button and a secondary Skip button. No tour-bubble on this step. */}
      {isWelcome ? (
        <div className="tour-welcome-wrap" style={{ top: 0, bottom: 0 }}>
          <div className="tour-welcome-card">
            <div className="tour-welcome-emoji" aria-hidden>🎯</div>
            <p className="tour-welcome-eyebrow cinzel">{t.tourWelcomeEyebrow || "GoHabit"}</p>
            <h2 className="tour-welcome-title cinzel">{typedTitle}{!titleDone ? <span className="tour-caret" /> : null}</h2>
            <p className="tour-welcome-text">{typedText}{titleDone && !textDone ? <span className="tour-caret" /> : null}</p>
            <div className="tour-welcome-buttons">
              <button
                type="button"
                className="tour-welcome-skip mobile-pressable cinzel"
                onClick={() => setAskSkipConfirm(true)}
              >
                {t.tourSkipLabel || "Skip"}
              </button>
              <button
                type="button"
                className="tour-welcome-start mobile-pressable cinzel"
                disabled={!typingDone}
                onClick={() => {
                  if (!typingDone) { skipTyping(); return; }
                  advance();
                }}
              >
                {t.tourWelcomeStart || "Start tour"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* bubble — spotlight / center steps only */}
      {!isWelcome && bubble ? (
        <div
          ref={bubbleRef}
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

          <div className="tour-progress-inline" aria-hidden>
            <div className="tour-progress-inline-track">
              <div className="tour-progress-inline-fill" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="tour-progress-inline-pct cinzel">{Math.min(100, pct)}%</span>
          </div>

          <div className="tour-bubble-actions">
            {/* Skip → opens the same confirm dialog the welcome screen
                uses. There is no Back button anywhere in the tour: the
                user either advances forward or bails out entirely. */}
            <button
              type="button"
              className="tour-skip-inline mobile-pressable cinzel"
              onClick={(e) => {
                e.stopPropagation();
                setAskSkipConfirm(true);
              }}
            >
              {t.tourSkipLabel || "Skip"}
            </button>
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
