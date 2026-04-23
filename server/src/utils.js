import { getStreakXpMultiplier } from "./quests.js";

export function slugifyUsername(value) {
  // Keep identity stable across web and mobile by preserving the exact auth key (Firebase UID).
  return String(value || "").trim().slice(0, 128);
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

// Public @handle — separate from the Firebase-UID "username" PK. Stored
// without the leading "@"; clients re-add it on display. Lowercase slug
// with underscores, 3..20 chars.
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;
const HANDLE_VALID_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX_LENGTH);
}

export function isValidHandleShape(handle) {
  return HANDLE_VALID_RE.test(String(handle || ""));
}

// Build a handle seed from a displayName. Latin letters / digits kept;
// Cyrillic is stripped (the regex only keeps ASCII), so Cyrillic-only
// names fall through to the random-suffix path which is fine. Always
// returns at least 3 chars (padded with a short random suffix).
export function seedHandleFromDisplayName(displayName) {
  const base = String(displayName || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX_LENGTH);
  if (base.length >= HANDLE_MIN_LENGTH) return base;
  // No usable letters in the name — pick a neutral prefix.
  const pad = Math.random().toString(36).slice(2, 6);
  return (base + "user" + pad).slice(0, HANDLE_MAX_LENGTH);
}

// Append a random numeric suffix that fits inside HANDLE_MAX_LENGTH.
// Used to disambiguate collisions.
export function appendHandleSuffix(base) {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const room = HANDLE_MAX_LENGTH - suffix.length;
  return (base.slice(0, Math.max(1, room)) + suffix);
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
