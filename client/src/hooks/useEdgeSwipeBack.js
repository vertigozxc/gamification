import { useRef } from "react";

/**
 * Returns touch handlers that fire `onBack` when the user performs an iOS-style
 * edge-swipe: finger starts within the left-edge gutter, moves right by at
 * least `minDx` with limited vertical drift, within `maxDt` ms.
 *
 * Spread the returned object onto the root element of a modal/screen:
 *   const bind = useEdgeSwipeBack(onClose);
 *   <div {...bind}> … </div>
 */
export default function useEdgeSwipeBack(onBack, {
  edge = 24,
  minDx = 60,
  maxDt = 700,
  verticalRatio = 0.6,
  enabled = true,
} = {}) {
  const ref = useRef(null);

  const onTouchStart = (e) => {
    if (!enabled || !onBack) return;
    if (!e.touches || e.touches.length !== 1) { ref.current = null; return; }
    const t = e.touches[0];
    if (t.clientX > edge) { ref.current = null; return; }
    ref.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e) => {
    const s = ref.current;
    ref.current = null;
    if (!s || !onBack) return;
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Date.now() - s.t;
    if (dt > maxDt) return;
    if (dx < minDx) return;
    if (Math.abs(dy) > dx * verticalRatio) return;
    onBack();
  };

  return { onTouchStart, onTouchEnd, onTouchCancel: onTouchEnd };
}
