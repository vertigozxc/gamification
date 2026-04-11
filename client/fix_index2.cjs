const fs = require('fs');
const path = '../server/src/index.js';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/function assignDynamicXp[\s\S]*?\}\n/, '');

const helper = `
function assignDynamicXp(quests, preferredQuestIds) {
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
`;

if (!code.includes('assignDynamicXp')) {
  code = code.replace('function dailyQuestsForUser', helper + 'function dailyQuestsForUser');
}

const mapRepl1 = `  return quests.map((quest) => ({
    ...quest,
    xp: preferredQuestIds.includes(quest.id) ? 30 : 20
  }));`;

if (code.includes(mapRepl1)) {
  code = code.replace(mapRepl1, '  return assignDynamicXp(quests, preferredQuestIds);');
}

const mapRepl2 = `    .map((quest) => ({
      ...quest,
      xp: preferredQuestIds.includes(quest.id) ? 30 : 20
    }));`;

const endPRep2 = `    .map((quest) => quest);

  return assignDynamicXp(baseQuestsFiltered, preferredQuestIds);`;

if (code.includes(mapRepl2)) {
  code = code.replace(mapRepl2, endPRep2);
}

const preMapRepl2 = `  return selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean)`;

const postMapRepl2 = `  const baseQuestsFiltered = selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean)`;

if (code.includes(preMapRepl2)) {
  code = code.replace(preMapRepl2, postMapRepl2);
}

const xpRepl1 = `    const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
    const questBaseXp = pinnedQuestIds.includes(quest.id) ? 30 : 20;
    const xpState = xpAfterQuest(user, { ...quest, xp: questBaseXp }, user.streak || 0);`;

const xpTo1 = `    // \`quest\` already contains the dynamically assigned xp from composeDailyQuests
    const xpState = xpAfterQuest(user, quest, user.streak || 0);`;

if (code.includes(xpRepl1)) {
  code = code.replace(xpRepl1, xpTo1);
}

fs.writeFileSync(path, code);
console.log('Done!');
