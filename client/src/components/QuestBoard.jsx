import PropTypes from "prop-types";
import { useRef, useState, useLayoutEffect, useCallback, useMemo } from "react";
import { useTheme } from "../ThemeContext";
import { QuestItem } from "./QuestItem";
import { useAutoAnimate } from "@formkit/auto-animate/react";

function QuestBoard({
  pinnedQuests,
  otherQuests,
  pinnedQuestProgressById,
  dailyQuestFreshDayKey = "",
  dailyQuestFreshStorageId = "",
  canRerollRandom,
  onRerollRandom,
  rerollButtonLabel,
  rerollButtonTitle,
  completedIds,
  pendingQuestIds = [],
  questRenderCount,
  onCompleteQuest,
  resetTimer,
  rerollingQuestId = null,
  rerollingPinned = false,
  compact = false
}) {
  const { t } = useTheme();
  const hasPinned = pinnedQuests.length > 0;
  const hasOther = otherQuests.length > 0;
  const tabs = [];
  if (hasPinned) tabs.push("habits");
  if (hasOther) tabs.push("daily");
  const [activeQTab, setActiveQTab] = useState(tabs[0] || "habits");
  const [selectedRerollId, setSelectedRerollId] = useState(null);
  const [showFreshDailyBadge, setShowFreshDailyBadge] = useState(false);
  const indicatorRef = useRef(null);
  const tabsRowRef = useRef(null);

  const [pinnedListRef] = useAutoAnimate();
  const [otherListRef] = useAutoAnimate();
  const [fallbackListRef] = useAutoAnimate();
  const pendingSet = useMemo(() => new Set(Array.isArray(pendingQuestIds) ? pendingQuestIds : []), [pendingQuestIds]);
  const dailySeenStorageKey = dailyQuestFreshStorageId ? `life_rpg_daily_quests_seen_${dailyQuestFreshStorageId}` : "";

  const markDailyTabSeen = useCallback(() => {
    if (!dailyQuestFreshDayKey || !dailySeenStorageKey || typeof window === "undefined") {
      setShowFreshDailyBadge(false);
      return;
    }

    try {
      window.localStorage.setItem(dailySeenStorageKey, dailyQuestFreshDayKey);
    } catch {
      // ignore storage failures
    }

    setShowFreshDailyBadge(false);
  }, [dailyQuestFreshDayKey, dailySeenStorageKey]);

  const sortQuests = useCallback((quests) => {
    return [...quests].sort((a, b) => {
      const aDone = completedIds.includes(a.id);
      const bDone = completedIds.includes(b.id);
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  }, [completedIds]);

  const sortedPinnedQuests = useMemo(() => sortQuests(pinnedQuests), [pinnedQuests, sortQuests]);
  const sortedOtherQuests = useMemo(() => sortQuests(otherQuests), [otherQuests, sortQuests]);

  useLayoutEffect(() => {
    if (!hasOther || !dailyQuestFreshDayKey || !dailySeenStorageKey || typeof window === "undefined") {
      setShowFreshDailyBadge(false);
      return;
    }

    try {
      const lastSeenDayKey = window.localStorage.getItem(dailySeenStorageKey) || "";
      setShowFreshDailyBadge(lastSeenDayKey !== dailyQuestFreshDayKey);
    } catch {
      setShowFreshDailyBadge(false);
    }
  }, [hasOther, dailyQuestFreshDayKey, dailySeenStorageKey]);

  useLayoutEffect(() => {
    if (activeQTab === "daily" && showFreshDailyBadge) {
      markDailyTabSeen();
    }
  }, [activeQTab, showFreshDailyBadge, markDailyTabSeen]);

  useLayoutEffect(() => {
    if (!tabsRowRef.current || !indicatorRef.current) return;
    const activeBtn = tabsRowRef.current.querySelector(`[data-qtab="${activeQTab}"]`);
    if (!activeBtn) return;
    indicatorRef.current.style.width = `${activeBtn.offsetWidth}px`;
    indicatorRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  }, [activeQTab, tabs.length]);

  const totalQuestCount = pinnedQuests.length + otherQuests.length;
  const completedTodayCount = Math.min(6, completedIds.length);
  const pinnedDone = pinnedQuests.filter((q) => completedIds.includes(q.id)).length;
  const otherDone = otherQuests.filter((q) => completedIds.includes(q.id)).length;

  return (
    <div className={`relative ${compact ? "" : "lg:col-span-2"}`}>
      {/* Timer + streak badge row */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2" style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>
          <span>⏰</span>
          <span className="cinzel">{t.dailyResetLabel}</span>
          <span className="font-mono font-bold" style={{ color: "var(--color-primary)" }}>{resetTimer}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="cinzel text-[11px]" style={{ color: "var(--color-muted)" }}>{completedTodayCount}/6</span>
        </div>
      </div>

      {/* Animated tab switcher */}
      {tabs.length > 1 && (
        <div className="qb-tab-bar mb-4" ref={tabsRowRef}>
          <div className="qb-tab-indicator" ref={indicatorRef} />
          <button
            type="button"
            data-qtab="habits"
            className={`qb-tab-btn ${activeQTab === "habits" ? "qb-tab-active" : ""}`}
            onClick={() => setActiveQTab("habits")}
          >
            <span>📌</span> {t.pinnedSection} <span className="qb-tab-count">{pinnedDone}/{pinnedQuests.length}</span>
          </button>
          <button
            type="button"
            data-qtab="daily"
            className={`qb-tab-btn ${activeQTab === "daily" ? "qb-tab-active" : ""}`}
            onClick={() => {
              setActiveQTab("daily");
              if (showFreshDailyBadge) {
                markDailyTabSeen();
              }
            }}
          >
            <span>🎲</span> {t.otherSection} <span className="qb-tab-count">{otherDone}/{otherQuests.length}</span>
            {showFreshDailyBadge ? (
              <span className="qb-tab-fresh" aria-label={t.dailyQuestFreshBadge || "NEW"}>
                <span className="qb-tab-fresh__spark">✦</span>
                <span className="qb-tab-fresh__label">{t.dailyQuestFreshBadge || "NEW"}</span>
              </span>
            ) : null}
          </button>
        </div>
      )}

      {/* Tab content with crossfade */}
      <div className="qb-tab-content">
        {/* Habits / Pinned tab */}
        {activeQTab === "habits" && hasPinned && (
          <div className="qb-panel-enter">
            <div ref={pinnedListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedPinnedQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                const pinnedProgress = pinnedQuestProgressById?.[quest.id] || { daysCompleted: 0, totalDays: 21 };
                const progressPercent = Math.max(0, Math.min(100, (pinnedProgress.daysCompleted / pinnedProgress.totalDays) * 100));

                return (
                  <QuestItem
                    key={`pinned-${quest.id}`}
                    quest={{ ...quest, isPending }}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
                    isRerolling={rerollingPinned}
                  >
                    <div className="mt-2.5 pl-9 pointer-events-none">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] cinzel tracking-wider uppercase" style={{ color: "var(--color-primary)" }}>{t.progressLabel || "Progress"}</span>
                        <span className="cinzel text-xs font-bold" style={{ color: "var(--color-text)" }}>{pinnedProgress.daysCompleted}/{pinnedProgress.totalDays}</span>
                      </div>
                      <div className="qb-progress-track">
                        <div className="qb-progress-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </QuestItem>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily / Other quests tab */}
        {activeQTab === "daily" && hasOther && (
          <div className="qb-panel-enter flex flex-col">
            <div ref={otherListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedOtherQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                return (
                  <QuestItem
                    key={quest.id}
                    quest={{ ...quest, isPending }}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
                    isRerolling={quest.id === rerollingQuestId}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onRerollRandom}
                disabled={!canRerollRandom}
                className="mobile-pressable qb-reroll-btn"
                title={rerollButtonTitle}
              >
                <span>🎲</span>
                {rerollButtonLabel}
              </button>
            </div>
          </div>
        )}

        {/* Fallback when only one type exists */}
        {tabs.length <= 1 && !hasPinned && hasOther && (
          <div className="qb-panel-enter flex flex-col">
            <div className="mb-3">
              <h3 className="cinzel text-sm font-bold tracking-wider" style={{ color: "var(--pinned-heading)" }}>{t.otherSection}</h3>
            </div>
            <div ref={fallbackListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedOtherQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                return (
                  <QuestItem
                    key={quest.id}
                    quest={{ ...quest, isPending }}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
                    isRerolling={quest.id === rerollingQuestId}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onRerollRandom}
                disabled={!canRerollRandom}
                className="mobile-pressable qb-reroll-btn"
                title={rerollButtonTitle}
              >
                <span>🎲</span>
                {rerollButtonLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

QuestBoard.propTypes = {
  pinnedQuests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string,
    desc: PropTypes.string,
    xp: PropTypes.number,
    category: PropTypes.string,
    icon: PropTypes.string
  })).isRequired,
  otherQuests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string,
    desc: PropTypes.string,
    xp: PropTypes.number,
    category: PropTypes.string,
    icon: PropTypes.string
  })).isRequired,
  pinnedQuestProgressById: PropTypes.object,
  dailyQuestFreshDayKey: PropTypes.string,
  dailyQuestFreshStorageId: PropTypes.string,
  canRerollRandom: PropTypes.bool.isRequired,
  onRerollRandom: PropTypes.func.isRequired,
  rerollButtonLabel: PropTypes.string.isRequired,
  rerollButtonTitle: PropTypes.string.isRequired,
  completedIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  pendingQuestIds: PropTypes.arrayOf(PropTypes.number),
  questRenderCount: PropTypes.number.isRequired,
  onCompleteQuest: PropTypes.func.isRequired,
  resetTimer: PropTypes.string.isRequired,
  compact: PropTypes.bool
};

export default QuestBoard;
