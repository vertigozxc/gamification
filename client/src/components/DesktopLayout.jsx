import CityIllustration from "./CityIllustration";
import ProfilePanel from "./ProfilePanel";
import QuestBoard from "./QuestBoard";
import SidePanels from "./SidePanels";
import TokenVault from "./TokenVault";

export default function DesktopLayout({
  showCity, state, levelDisplayRef,
  editingName, nameDraft, characterName,
  onNameDraftChange, onSubmitNameEdit, onStartEditingName, onCancelEditingName,
  xpPercent, completedToday, milestoneProgressPercent, milestoneSteps,
  streakBonusPercent, weekResetTimer,
  pinnedQuests, otherQuests, pinnedQuestProgressById,
  canReroll, questRenderCount,
  pendingQuestIds,
  onReroll, onCompleteQuest, rerollButtonLabel, rerollButtonTitle,
  rerollingQuestId, rerollingPinned,
  resetTimer, leaderboard, authUser, logs,
  canRerollPinned, isFreePinnedReroll, daysUntilFreePinnedReroll,
  onOpenPinnedReplacement, onFreezeStreak, onBuyExtraReroll,
  t
}) {
  return (
    <>
      {showCity && (
        <div className="w-full h-80 sm:h-[400px] md:h-[500px] lg:h-[600px] mb-6 relative rounded-xl overflow-hidden border border-[var(--panel-border)] shadow-lg animate-fade-in" style={{ backgroundColor: 'var(--card-bg)' }}>
          <CityIllustration height="100%" stage={Math.max(0, Math.floor(state.lvl) || 0)} />
        </div>
      )}

      <ProfilePanel
        state={state}
        levelDisplayRef={levelDisplayRef}
        editingName={editingName}
        nameDraft={nameDraft}
        characterName={characterName}
        onNameDraftChange={onNameDraftChange}
        onSubmitNameEdit={onSubmitNameEdit}
        onStartEditingName={onStartEditingName}
        onCancelEditingName={onCancelEditingName}
        xpPercent={xpPercent}
        completedToday={completedToday}
        milestoneProgressPercent={milestoneProgressPercent}
        milestoneSteps={milestoneSteps}
        streakBonusPercent={streakBonusPercent}
        weekResetTimer={weekResetTimer}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <QuestBoard
          pinnedQuests={pinnedQuests} otherQuests={otherQuests}
          pinnedQuestProgressById={pinnedQuestProgressById}
          canRerollRandom={canReroll} onRerollRandom={onReroll}
          rerollButtonLabel={rerollButtonLabel} rerollButtonTitle={rerollButtonTitle}
          completedIds={state.completed} questRenderCount={questRenderCount}
          pendingQuestIds={pendingQuestIds}
          onCompleteQuest={onCompleteQuest} resetTimer={resetTimer}
          streakFreezeActive={state.streakFreezeActive}
          rerollingQuestId={rerollingQuestId}
          rerollingPinned={rerollingPinned}
        />
        <SidePanels leaderboard={leaderboard} authUser={authUser} logs={logs} />
      </div>

      <TokenVault
        tokens={state.tokens}
        streakFreezeActive={state.streakFreezeActive}
        extraRerollsToday={state.extraRerollsToday}
        hasRerolledToday={state.hasRerolledToday}
        canRerollPinned={canRerollPinned}
        isFreePinnedReroll={isFreePinnedReroll}
        daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
        onOpenPinnedReplacement={onOpenPinnedReplacement}
        onFreezeStreak={onFreezeStreak}
        onBuyExtraReroll={onBuyExtraReroll}
      />
    </>
  );
}
