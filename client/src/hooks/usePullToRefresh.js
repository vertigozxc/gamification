import { useEffect, useRef, useState } from "react";

// Hook-style pull-to-refresh for any scrollable container (or the
// document body if `target` is null). The caller renders the indicator
// wherever it likes using the returned `pullDistance` / `state` values.
//
// Mobile-focused: only triggers when the user pulls down from the very
// top of the scroll region with a touch/pen pointer. Mouse wheel is
// ignored to avoid accidentally refreshing on desktop scroll.

const TRIGGER_PX = 72;
const MAX_PULL_PX = 120;

export default function usePullToRefresh({ target = null, onRefresh, disabled = false } = {}) {
  const [state, setState] = useState("idle"); // idle | pulling | refreshing | done
  const [pullDistance, setPullDistance] = useState(0);
  const active = useRef(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return undefined;
    const el = target?.current || target || null;
    const scrollHost = el || document.scrollingElement || document.documentElement;
    if (!scrollHost) return undefined;

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      if (e.pointerType && e.pointerType !== "touch" && e.pointerType !== "pen") return;
      // Never start a pull gesture while a full-screen social panel
      // (profile / challenge detail / search / …) is the active layer.
      // Screen.jsx sets this data attr for its lifetime.
      if (document.documentElement.dataset.socialScreenOpen === "1") {
        active.current = false;
        return;
      }
      const scrollTop = el ? el.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      if (scrollTop > 1) { active.current = false; return; }
      active.current = true;
      startY.current = e.touches ? e.touches[0].clientY : e.clientY;
      pullRef.current = 0;
    }

    function onTouchMove(e) {
      if (!active.current || refreshingRef.current) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const raw = y - startY.current;
      if (raw <= 0) {
        setState("idle");
        setPullDistance(0);
        pullRef.current = 0;
        return;
      }
      // Rubber-band: resist increasingly as the user pulls further.
      const dampened = Math.min(MAX_PULL_PX, raw * 0.5);
      pullRef.current = dampened;
      setPullDistance(dampened);
      setState(dampened >= TRIGGER_PX ? "ready" : "pulling");
    }

    async function onTouchEnd() {
      if (!active.current || refreshingRef.current) {
        active.current = false;
        return;
      }
      active.current = false;
      const travelled = pullRef.current;
      if (travelled >= TRIGGER_PX && typeof onRefresh === "function") {
        refreshingRef.current = true;
        setState("refreshing");
        setPullDistance(TRIGGER_PX);
        try {
          await onRefresh();
          setState("done");
        } catch {
          setState("done");
        } finally {
          refreshingRef.current = false;
          // Give the user a quick beat to see the "done" state before resetting.
          setTimeout(() => {
            setState("idle");
            setPullDistance(0);
          }, 350);
        }
      } else {
        setState("idle");
        setPullDistance(0);
      }
    }

    const opts = { passive: true };
    scrollHost.addEventListener("touchstart", onTouchStart, opts);
    scrollHost.addEventListener("touchmove", onTouchMove, opts);
    scrollHost.addEventListener("touchend", onTouchEnd);
    scrollHost.addEventListener("touchcancel", onTouchEnd);
    return () => {
      scrollHost.removeEventListener("touchstart", onTouchStart);
      scrollHost.removeEventListener("touchmove", onTouchMove);
      scrollHost.removeEventListener("touchend", onTouchEnd);
      scrollHost.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [target, onRefresh, disabled]);

  return { state, pullDistance, triggerPx: TRIGGER_PX };
}
