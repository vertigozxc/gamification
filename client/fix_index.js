const fs = require('fs');
const path = '../server/src/index.js';
let code = fs.readFileSync(path, 'utf8');

// remove the corrupted function
code = code.replace(/function assignDynamicXp[\s\S]*?\}\n\n/, '');

const helper = \unction assignDynamicXp(quests, preferredQuestIds) {
  const nonPinned = quests.filter((q) => !preferredQuestIds.includes(q.id));
  const totalBaseXp = nonPinned.reduce((sum, q) => sum + (q.xp || 10), 0);
  
  const assigned = {};
  if (totalBaseXp === 0 || nonPinned.length === 0) {
    nonPinned.forEach(q => assigned[q.id] = 20);
  } else {
    let remaining = 80;
    nonPinned.forEach((q, idx) => {
      if (idx === nonPinned.length - 1) {
        assigned[q.id] = Math.max(0, remaining);
      } else {
        const share = Math.round(80 * ((q.xp || 10) / totalBaseXp));
        assigned[q.id] = share;
        remaining -= share;
      }
    });
  }

  return quests.map((q) => ({
    ...q,
    xp: preferredQuestIds.includes(q.id) ? 30 : Math.max(5, assigned[q.id] || 20)
  }));
}

\;

code = code.replace('function dailyQuestsForUser', helper + 'function dailyQuestsForUser');

// replace dailyQuestsForUser overwrite
code = code.replace(
\  return quests.map((quest) => ({
    ...quest,
    xp: preferredQuestIds.includes(quest.id) ? 30 : 20
  }));\,
  '  return assignDynamicXp(quests, preferredQuestIds);'
);

// replace composeDailyQuests overwrite
code = code.replace(
\    .map((quest) => ({
      ...quest,
      xp: preferredQuestIds.includes(quest.id) ? 30 : 20
    }));\,
  \    .map((quest) => quest);

  return assignDynamicXp(baseQuestsFiltered, preferredQuestIds);\);

code = code.replace(
\  return selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean)\,
\  const baseQuestsFiltered = selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean)\
);

// fix POST /api/quests-complete logic where questBaseXp overrides
code = code.replace(
\    const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
    const questBaseXp = pinnedQuestIds.includes(quest.id) ? 30 : 20;
    const xpState = xpAfterQuest(user, { ...quest, xp: questBaseXp }, user.streak || 0);\,
\    const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
    // \quest\ already contains the dynamically assigned xp from \composeDailyQuests\
    const questBaseXp = quest.xp;
    const xpState = xpAfterQuest(user, quest, user.streak || 0);\
);

fs.writeFileSync(path, code);
console.log('Fixed index.js');
