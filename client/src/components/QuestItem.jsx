import { useRef, useCallback, useEffect, useState } from "react";

export function QuestItem({ quest, index, isDone, questRenderCount, compact, t, onCompleteQuest, children, isLongTapOnly, isRerolling }) {
  const longPressTimer = useRef(null);
  const hintTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [showTapHint, setShowTapHint] = useState(false);

  const tapHintText = t.questCompleteGestureHint;

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

  const isPending = Boolean(quest?.isPending);

  const handlePointerDown = useCallback((e) => {
    if (isDone || isPending || !isLongTapOnly) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(100);
      longPressTriggered.current = true;
      setShowTapHint(false);
      onCompleteQuest(quest, e);
    }, 500); // 500ms long tap
  }, [quest, isDone, isPending, onCompleteQuest, isLongTapOnly]);

  const handlePointerUp = useCallback((e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleClick = useCallback((e) => {
    if (isDone || isPending) return;
    if (!isLongTapOnly) {
      onCompleteQuest(quest, e);
      return;
    }
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    showHintPopup();
  }, [quest, isDone, isPending, onCompleteQuest, isLongTapOnly, showHintPopup]);

  if (isRerolling) {
    return (
      <div className="qb-quest-item" style={{ position: "relative", overflow: "hidden", cursor: "default" }}>
        <div className="flex items-start gap-3">
          <div className="qb-check" style={{ background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.3)" }} />
          <div className="flex-1 flex flex-col gap-2 py-1">
            <div style={{ height: 9, width: "38%", borderRadius: 4, background: "rgba(148,163,184,0.18)", animation: "pulse 1.4s ease-in-out infinite" }} />
            <div style={{ height: 13, width: "72%", borderRadius: 4, background: "rgba(148,163,184,0.22)", animation: "pulse 1.4s ease-in-out infinite 0.12s" }} />
            <div style={{ height: 10, width: "52%", borderRadius: 4, background: "rgba(148,163,184,0.14)", animation: "pulse 1.4s ease-in-out infinite 0.24s" }} />
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 10, color: "rgba(139,92,246,0.7)", fontWeight: 600, letterSpacing: "0.06em" }}>
          🎲 {t.rerollRolling}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`qb-quest-item mobile-pressable ${isDone ? "qb-quest-done" : ""} ${isPending ? "qb-quest-pending" : ""}`}
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
      {isPending ? (
        <div className="qb-pending-overlay" aria-live="polite">
          <div className="qb-pending-spinner" aria-hidden="true" />
          <span>{t.questCompletingLabel}</span>
        </div>
      ) : null}
      {showTapHint && !isDone && !isPending ? (
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
