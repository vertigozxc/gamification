export function summarizeTodayProgress(completedQuests = [], preferredQuestIds = []) {
  const pinnedSet = new Set(preferredQuestIds);
  const tasksCompleted = completedQuests.length;
  const baseTasksCompleted = completedQuests.filter((quest) => pinnedSet.has(quest.id)).length;
  const xpToday = completedQuests.reduce((sum, quest) => sum + (Number(quest.xp) || 0), 0);

  return {
    xpToday,
    tasksCompleted,
    baseTasksCompleted
  };
}

export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
