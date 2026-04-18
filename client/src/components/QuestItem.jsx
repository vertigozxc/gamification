import { useRef, useCallback, useEffect, useState } from "react";

export function QuestItem({ quest, index, isDone, questRenderCount, compact, t, onCompleteQuest, children, isLongTapOnly }) {
  const longPressTimer = useRef(null);
  const hintTimer = useRef(null);
  const lastTapTime = useRef(0);
  const longPressTriggered = useRef(false);
  const [showTapHint, setShowTapHint] = useState(false);

  const tapHintText = t.questCompleteGestureHint || "Double-tap or long-press to complete";

  const showHintPopup = useCallback(() => {
    setShowTapHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      setShowTapHint(false);
    }, 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (isDone || !isLongTapOnly) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(100);
      longPressTriggered.current = true;
      setShowTapHint(false);
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
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapTime.current < 400) { // 400ms double tap
      setShowTapHint(false);
      onCompleteQuest(quest, e);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
      showHintPopup();
    }
  }, [quest, isDone, onCompleteQuest, isLongTapOnly, showHintPopup]);

  return (
    <div
      className={`qb-quest-item mobile-pressable ${isDone ? "qb-quest-done" : ""}`}
      style={!isDone && questRenderCount === 0 ? { animationDelay: `${index * 0.06}s`, position: "relative" } : { position: "relative" }}
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
      {showTapHint && !isDone ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 10,
            zIndex: 3,
            borderRadius: 10,
            background: "rgba(2, 6, 23, 0.92)",
            border: "1px solid rgba(103, 232, 249, 0.55)",
            color: "#cffafe",
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            padding: "8px 10px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)"
          }}
        >
          {tapHintText}
        </div>
      ) : null}
    </div>
  );
}
