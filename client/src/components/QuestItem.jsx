import { useRef, useCallback } from "react";

export function QuestItem({ quest, index, isDone, questRenderCount, compact, t, onCompleteQuest, children, isLongTapOnly }) {
  const longPressTimer = useRef(null);
  const lastTapTime = useRef(0);

  const handlePointerDown = useCallback((e) => {
    if (isDone || !isLongTapOnly) return;
    longPressTimer.current = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(100);
      onCompleteQuest(quest, e);
    }, 500); // 500ms long tap
  }, [quest, isDone, onCompleteQuest, isLongTapOnly]);

  const handlePointerUp = useCallback((e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleClick = useCallback((e) => {
    if (isDone) return;
    if (!isLongTapOnly) {
      onCompleteQuest(quest, e);
      return;
    }
    const now = Date.now();
    if (now - lastTapTime.current < 400) { // 400ms double tap
      onCompleteQuest(quest, e);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [quest, isDone, onCompleteQuest, isLongTapOnly]);

  return (
    <div
      className={`qb-quest-item mobile-pressable ${isDone ? "qb-quest-done" : ""}`}
      style={!isDone && questRenderCount === 0 ? { animationDelay: `${index * 0.06}s` } : {}}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => { if(isLongTapOnly) e.preventDefault(); }}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3 pointer-events-none">
        <div className={`qb-check ${isDone ? "qb-check-done" : ""}`}>
          {isDone ? "✓" : ""}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap pr-12">
            <span className="qb-cat">{String(quest.category || "").toUpperCase()}</span>
            <span className="qb-xp">+{quest.xp} {t.xpLabel}</span>
          </div>
          <h4 className={`cinzel text-white font-bold leading-snug ${compact ? "text-[14px]" : "text-[15px]"}`}>{quest.title}</h4>
          <p className="text-slate-400 text-[13px] mt-0.5 leading-relaxed line-clamp-2">{quest.desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
