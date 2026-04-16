import { getStreakXpMultiplier } from "./quests.js";

export function slugifyUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "")
    .slice(0, 24);
}

export function getDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildInviteCode() {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase();
  const partB = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${partA}${partB}`;
}

export function getStreakMultiplier(streak) {
  return getStreakXpMultiplier(streak);
}

export function xpAfterQuest(user, quest, streak = 0) {
  const multiplier = getStreakMultiplier(streak);
  const questXp = Math.floor(quest.xp * multiplier);
  let xp = user.xp + questXp;
  let level = user.level;
  let xpNext = user.xpNext;
  
  // Fix xpNext for level 1 existing users
  if (level === 1 && xpNext === 300) {
    xpNext = 250;
  }

  while (xp >= xpNext) {
    xp -= xpNext;
    level += 1;
    // ensure xpNext is correctly re-calculated when leveling up
    xpNext = level === 1 ? 250 : Math.floor(xpNext * 1.1);
  }

  return { xp, level, xpNext, awardedXp: questXp, multiplier };
}
