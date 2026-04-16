import PropTypes from "prop-types";
import { useRef, useState, useLayoutEffect, useCallback, useMemo } from "react";
import { useTheme } from "../ThemeContext";
import { QuestItem } from "./QuestItem";
import { useAutoAnimate } from "@formkit/auto-animate/react";

function QuestBoard({
  pinnedQuests,
  otherQuests,
  pinnedQuestProgressById,
  canRerollRandom,
  onRerollRandom,
  rerollButtonLabel,
  rerollButtonTitle,
  completedIds,
  questRenderCount,
  onCompleteQuest,
  resetTimer,
  streakFreezeActive,
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
  const indicatorRef = useRef(null);
  const tabsRowRef = useRef(null);

  const [pinnedListRef] = useAutoAnimate();
  const [otherListRef] = useAutoAnimate();
  const [fallbackListRef] = useAutoAnimate();

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
    if (!tabsRowRef.current || !indicatorRef.current) return;
    const activeBtn = tabsRowRef.current.querySelector(`[data-qtab="${activeQTab}"]`);
    if (!activeBtn) return;
    indicatorRef.current.style.width = `${activeBtn.offsetWidth}px`;
    indicatorRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  }, [activeQTab, tabs.length]);

  const totalQuestCount = pinnedQuests.length + otherQuests.length;
  const remainingQuestCount = Math.max(0, totalQuestCount - completedIds.length);
  const pinnedDone = pinnedQuests.filter((q) => completedIds.includes(q.id)).length;
  const otherDone = otherQuests.filter((q) => completedIds.includes(q.id)).length;

  return (
    <div className={`relative ${compact ? "" : "lg:col-span-2"}`}>
      {/* Timer + streak badge row */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2 text-slate-400" style={{ fontSize: "0.72rem" }}>
          <span>⏰</span>
          <span className="cinzel">{t.dailyResetLabel}</span>
          <span className="font-mono font-bold" style={{ color: "var(--color-primary)" }}>{resetTimer}</span>
        </div>
        <div className="flex items-center gap-2">
          {streakFreezeActive && (
            <span className="inline-flex items-center gap-1 bg-cyan-900/40 rounded-full px-2 py-0.5 text-[10px] text-cyan-300 cinzel">
              {t.streakProtectedBadge}
            </span>
          )}
          <span className="cinzel text-[11px] text-slate-500">{remainingQuestCount}/{totalQuestCount}</span>
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
            onClick={() => setActiveQTab("daily")}
          >
            <span>🎲</span> {t.otherSection} <span className="qb-tab-count">{otherDone}/{otherQuests.length}</span>
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
                const pinnedProgress = pinnedQuestProgressById?.[quest.id] || { daysCompleted: 0, totalDays: 21 };
                const progressPercent = Math.max(0, Math.min(100, (pinnedProgress.daysCompleted / pinnedProgress.totalDays) * 100));

                return (
                  <QuestItem
                    key={`pinned-${quest.id}`}
                    quest={quest}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
                  >
                    <div className="mt-2.5 pl-9 pointer-events-none">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] cinzel tracking-wider uppercase" style={{ color: "var(--color-primary)" }}>{t.progressLabel || "Progress"}</span>
                        <span className="cinzel text-xs font-bold text-slate-300">{pinnedProgress.daysCompleted}/{pinnedProgress.totalDays}</span>
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
                return (
                  <QuestItem
                    key={quest.id}
                    quest={quest}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
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
                return (
                  <QuestItem
                    key={quest.id}
                    quest={quest}
                    index={index}
                    isDone={isDone}
                    questRenderCount={questRenderCount}
                    compact={compact}
                    t={t}
                    onCompleteQuest={onCompleteQuest}
                    isLongTapOnly={true}
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
  canRerollRandom: PropTypes.bool.isRequired,
  onRerollRandom: PropTypes.func.isRequired,
  rerollButtonLabel: PropTypes.string.isRequired,
  rerollButtonTitle: PropTypes.string.isRequired,
  completedIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  questRenderCount: PropTypes.number.isRequired,
  onCompleteQuest: PropTypes.func.isRequired,
  resetTimer: PropTypes.string.isRequired,
  streakFreezeActive: PropTypes.bool.isRequired,
  compact: PropTypes.bool
};

export default QuestBoard;
