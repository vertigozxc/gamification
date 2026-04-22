import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* =============================================================================
 * Haptics: best-effort bridge to native iOS WKWebView, with navigator.vibrate
 * fallback on Android browsers. iOS Safari ignores vibrate but our app runs in
 * a native WebView where the host can intercept postMessage and trigger
 * UIImpactFeedbackGenerator.
 * =============================================================================*/

export function haptic(kind = "light") {
  try {
    const bridge = typeof window !== "undefined" && window.webkit?.messageHandlers?.haptic;
    if (bridge && typeof bridge.postMessage === "function") {
      bridge.postMessage({ kind });
      return;
    }
  } catch {
    /* noop */
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const ms = kind === "success" ? [10, 40, 10]
        : kind === "warning" ? [30, 80, 30]
        : kind === "heavy" ? 25
        : kind === "medium" ? 15
        : 8;
      navigator.vibrate(ms);
    }
  } catch {
    /* noop */
  }
}

/* =============================================================================
 * IosNavStack — push/pop navigation with iOS-style slide + edge-swipe back.
 *
 *   <IosNavStack rootTitle="Social">
 *     <RootContent />
 *   </IosNavStack>
 *
 * Inside any descendant, call useIosNav() to push/pop:
 *   const nav = useIosNav();
 *   nav.push({ title: "Profile", content: <Profile username={u} /> });
 * =============================================================================*/

const NavContext = createContext(null);

export function useIosNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useIosNav must be used inside <IosNavStack>");
  return ctx;
}

let idSeq = 0;
const nextId = () => `nav-${++idSeq}`;

export function IosNavStack({ rootTitle, children, onEmptyClose }) {
  const [stack, setStack] = useState([]); // top of stack = last element

  const push = useCallback((screen) => {
    haptic("light");
    setStack((prev) => [...prev, { ...screen, id: screen.id || nextId() }]);
  }, []);

  const pop = useCallback(() => {
    haptic("light");
    setStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const popToRoot = useCallback(() => setStack([]), []);

  const api = useMemo(() => ({ push, pop, popToRoot, depth: stack.length }), [push, pop, popToRoot, stack.length]);

  return (
    <NavContext.Provider value={api}>
      <div className="ios-nav-stack">
        <div className="ios-nav-screen ios-nav-root">{children}</div>
        {stack.map((screen, i) => (
          <PushedScreen
            key={screen.id}
            title={screen.title}
            content={screen.content}
            onBack={pop}
            depth={i + 1}
            rootTitle={rootTitle}
            isTop={i === stack.length - 1}
            onRootEscape={i === 0 && onEmptyClose ? onEmptyClose : undefined}
          />
        ))}
      </div>
    </NavContext.Provider>
  );
}

function PushedScreen({ title, content, onBack, depth, rootTitle, isTop }) {
  const ref = useRef(null);
  const [translateX, setTranslateX] = useState(0);
  const [animating, setAnimating] = useState(true);

  // Edge-swipe tracking: only respond when touch starts within the first ~24px
  // from the left edge, matching iOS behaviour. Track pointer move → translate;
  // release past half-width (or high velocity) → complete pop.
  useEffect(() => {
    const el = ref.current;
    if (!el || !isTop) return;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let tracking = false;
    let width = el.offsetWidth || 1;

    const onStart = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      if (pt.clientX > 24) return;
      tracking = true;
      width = el.offsetWidth || 1;
      startX = pt.clientX;
      lastX = pt.clientX;
      lastT = Date.now();
      setAnimating(false);
    };
    const onMove = (e) => {
      if (!tracking) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = Math.max(0, pt.clientX - startX);
      lastX = pt.clientX;
      lastT = Date.now();
      setTranslateX(dx);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      const dx = Math.max(0, lastX - startX);
      const elapsed = Math.max(16, Date.now() - lastT);
      const velocity = dx / elapsed; // px/ms
      setAnimating(true);
      if (dx > width * 0.45 || velocity > 0.6) {
        // complete the pop
        setTranslateX(width);
        haptic("medium");
        setTimeout(() => onBack(), 260);
      } else {
        // snap back
        setTranslateX(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [isTop, onBack]);

  // Entry animation: we mount at translateX(100%), then flip to 0 with spring.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const style = {
    transform: entered ? `translate3d(${translateX}px, 0, 0)` : "translate3d(100%, 0, 0)",
    transition: animating ? "transform 340ms cubic-bezier(0.32, 0.72, 0, 1)" : "none"
  };

  return (
    <div ref={ref} className="ios-nav-screen ios-nav-pushed" style={style}>
      <IosNavBar title={title} backTitle={depth === 1 ? rootTitle : undefined} onBack={onBack} />
      <div className="ios-nav-body">{content}</div>
    </div>
  );
}

function IosNavBar({ title, backTitle, onBack }) {
  return (
    <div className="ios-nav-bar">
      <button type="button" onClick={onBack} className="ios-nav-back ios-tap" aria-label="Back">
        <span className="ios-nav-back-chev">‹</span>
        {backTitle ? <span className="ios-nav-back-label">{backTitle}</span> : null}
      </button>
      <span className="ios-nav-bar-title">{title}</span>
      <div style={{ minWidth: 40 }} />
    </div>
  );
}

/* =============================================================================
 * useSwipeDown — attach to a sheet element to enable pull-down-to-dismiss.
 *
 * Usage:
 *   const { handlers, progress } = useSwipeDown(onClose);
 *   <div {...handlers} style={{ transform: `translateY(${progress}px)` }}>
 * =============================================================================*/

export function useSwipeDown(onClose, { threshold = 120, velocityThreshold = 0.5 } = {}) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackingRef = useRef({ active: false, startY: 0, lastY: 0, lastT: 0 });

  const handlers = useMemo(() => {
    const cancel = (e) => {
      // Only start if the touch began on the grab handle OR when the inner
      // scrollable has scrollTop === 0 (so we don't hijack scroll).
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (target.closest(".ios-sheet-handle-zone")) return false;
        // For body-originated touches, only engage when scroll container is at top
        const scrollable = target.closest(".ios-sheet-body");
        if (scrollable && scrollable.scrollTop > 0) return true;
      }
      return false;
    };

    const start = (e) => {
      if (cancel(e)) { trackingRef.current.active = false; return; }
      const pt = e.touches ? e.touches[0] : e;
      trackingRef.current = { active: true, startY: pt.clientY, lastY: pt.clientY, lastT: Date.now() };
      setDragging(true);
    };
    const move = (e) => {
      if (!trackingRef.current.active) return;
      const pt = e.touches ? e.touches[0] : e;
      const dy = pt.clientY - trackingRef.current.startY;
      if (dy < 0) { setProgress(0); return; }
      trackingRef.current.lastY = pt.clientY;
      trackingRef.current.lastT = Date.now();
      // pan resistance beyond threshold (iOS rubber-band feel)
      const eased = dy < 240 ? dy : 240 + Math.sqrt(Math.max(0, dy - 240)) * 10;
      setProgress(eased);
    };
    const end = () => {
      if (!trackingRef.current.active) return;
      trackingRef.current.active = false;
      setDragging(false);
      const dy = trackingRef.current.lastY - trackingRef.current.startY;
      const elapsed = Math.max(16, Date.now() - trackingRef.current.lastT);
      const velocity = dy / elapsed;
      if (dy > threshold || velocity > velocityThreshold) {
        haptic("medium");
        setProgress(window.innerHeight);
        setTimeout(() => { onClose(); setProgress(0); }, 240);
      } else {
        setProgress(0);
      }
    };

    return {
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: end,
      onTouchCancel: end
    };
  }, [onClose, threshold, velocityThreshold]);

  const backdropOpacity = Math.max(0, 1 - progress / 600);

  return { handlers, progress, backdropOpacity, dragging };
}

/* =============================================================================
 * useSwipeAction — horizontal swipe to reveal trailing actions (iOS Mail style).
 *
 *   const { rowProps, offset, revealed, close } = useSwipeAction({ actionWidth: 88 });
 *   <div className="swipe-action-container">
 *     <div className="swipe-action-bg"><button>Remove</button></div>
 *     <div {...rowProps} style={{ transform: `translateX(${-offset}px)` }}>row content</div>
 *   </div>
 * =============================================================================*/

export function useSwipeAction({ actionWidth = 88, onCommit } = {}) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const trackingRef = useRef({ active: false, startX: 0, lastX: 0, startOffset: 0 });

  const rowProps = useMemo(() => {
    const start = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      trackingRef.current = { active: true, startX: pt.clientX, lastX: pt.clientX, startOffset: offset };
    };
    const move = (e) => {
      if (!trackingRef.current.active) return;
      const pt = e.touches ? e.touches[0] : e;
      trackingRef.current.lastX = pt.clientX;
      const dx = pt.clientX - trackingRef.current.startX;
      let next = trackingRef.current.startOffset - dx;
      if (next < 0) next = 0;
      if (next > actionWidth * 2) next = actionWidth + Math.sqrt(next - actionWidth) * 4;
      setOffset(next);
    };
    const end = () => {
      if (!trackingRef.current.active) return;
      trackingRef.current.active = false;
      const dx = trackingRef.current.lastX - trackingRef.current.startX;
      if (dx < -actionWidth * 1.6) {
        // full swipe → commit action
        haptic("warning");
        setOffset(0);
        setRevealed(false);
        onCommit && onCommit();
      } else if (offset > actionWidth * 0.5) {
        setOffset(actionWidth);
        setRevealed(true);
      } else {
        setOffset(0);
        setRevealed(false);
      }
    };
    return {
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: end,
      onTouchCancel: end
    };
  }, [offset, actionWidth, onCommit]);

  const close = useCallback(() => { setOffset(0); setRevealed(false); }, []);

  return { rowProps, offset, revealed, close };
}

/* =============================================================================
 * usePullToRefresh — iOS-style pull down at scroll top.
 * =============================================================================*/

export function usePullToRefresh(scrollRef, onRefresh, { threshold = 72 } = {}) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const trackingRef = useRef({ active: false, startY: 0 });

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const start = (e) => {
      if (refreshing) return;
      if (el.scrollTop > 0) return;
      const pt = e.touches ? e.touches[0] : e;
      trackingRef.current = { active: true, startY: pt.clientY };
    };
    const move = (e) => {
      if (!trackingRef.current.active) return;
      const pt = e.touches ? e.touches[0] : e;
      const dy = pt.clientY - trackingRef.current.startY;
      if (dy <= 0) { setPullY(0); return; }
      // rubber-band damping
      setPullY(Math.min(140, dy * 0.5));
    };
    const end = async () => {
      if (!trackingRef.current.active) return;
      trackingRef.current.active = false;
      const current = pullY;
      if (current >= threshold && !refreshing) {
        haptic("medium");
        setRefreshing(true);
        setPullY(threshold);
        try { await onRefresh(); } catch { /* noop */ }
        setRefreshing(false);
      }
      setPullY(0);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [scrollRef, onRefresh, refreshing, pullY, threshold]);

  return { pullY, refreshing };
}
