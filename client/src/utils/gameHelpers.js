export const saveKey = (uid) => `rpg_save_${uid}`;
export const characterNameKey = (uid) => `rpg_character_name_${uid}`;
export const portraitKey = (uid) => `rpg_portrait_${uid}`;
export const notesKey = (uid) => `rpg_private_notes_${uid}`;
export const MOBILE_TAB_STORAGE_KEY = "life_rpg_mobile_tab";

export function normalizeMobileTab(value) {
  const normalized = String(value || "").toLowerCase();
  if (["dashboard", "leaderboard", "city", "store", "profile"].includes(normalized)) {
    return normalized;
  }
  return "dashboard";
}

export function getMobileTabIndex(tab) {
  const order = ["city", "leaderboard", "dashboard", "store", "profile"];
  const index = order.indexOf(tab);
  return index >= 0 ? index : 2;
}

export function getMobileTabTitle(tab, t) {
  if (tab === "dashboard") return t.mobileDashboardLabel;
  if (tab === "leaderboard") return t.mobileLeaderboardLabel;
  if (tab === "store") return t.mobileStoreLabel;
  if (tab === "profile") return t.mobileProfileLabel;
  return t.mobileCityLabel;
}

export function getQuestIcon(stat) {
  if (stat === "int") {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M5 5h14v14H5z"/><path d="M5 8h14"/><path d="M8 11l4 3 4-3"/></svg>';
  }
  if (stat === "str") {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="8" width="4" height="8" rx="1.5"/><rect x="18" y="8" width="4" height="8" rx="1.5"/><path d="M6 12h12"/><path d="M6 16h12"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M8 11l4-4 4 4" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M12 13v6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>';
}

export function normalizeQuest(quest, translateQuest, translateCategory) {
  const stat = String(quest?.stat || "sta").toLowerCase();
  const xp = Number(quest?.xp ?? quest?.base_xp ?? 0);
  const rawCategory = String(quest?.category || "Uncategorized").trim() || "Uncategorized";
  const sourceId = String(quest?.sourceId || "");
  const title = String(quest?.title || "Quest");
  const desc = String(quest?.desc ?? quest?.description ?? "");
  return {
    id: Number(quest?.id),
    sourceId,
    title: translateQuest ? translateQuest({ ...quest, sourceId }, "title", title) : title,
    desc: translateQuest ? translateQuest({ ...quest, sourceId }, "description", desc) : desc,
    xp: Number.isFinite(xp) ? xp : 0,
    stat,
    category: translateCategory ? translateCategory(rawCategory) : rawCategory,
    icon: String(quest?.icon || getQuestIcon(stat)),
    isCustom: Boolean(quest?.isCustom) || sourceId.startsWith("custom_") || Number(quest?.id) >= 1_000_000
  };
}

export function normalizePinnedQuestProgress(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => ({
      questId: Number(item?.questId),
      daysCompleted: Math.max(0, Number(item?.daysCompleted) || 0),
      totalDays: Math.max(1, Number(item?.totalDays) || 21)
    }))
    .filter((item) => Number.isInteger(item.questId) && item.questId > 0);
}

export function compressImage(dataUrl, maxSide = 256, quality = 0.7) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(""), 10_000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(""); };
    img.src = dataUrl;
  });
}

export function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

export function createDefaultState() {
  return {
    lvl: 1,
    xp: 0,
    xpNext: 250,
    tokens: 0,
    completed: [],
    logs: [],
    streak: 0,
    lastReset: Date.now(),
    hasRerolledToday: false,
    streakFreezeActive: false,
    extraRerollsToday: 0,
    user: {
      lastFreeTaskRerollAt: null
    },
    preferredQuestIds: [],
    pinnedQuestProgress21d: [],
    productivity: {
      xpToday: 0,
      tasksCompletedToday: 0,
      baseTasksCompletedToday: 0,
      dailyScore: 0,
      currentPI: null,
      piStatus: "calibrating",
      currentTier: "IRON",
      weeksInCurrentTier: 0,
      rankLevel: 1,
      rankLabel: "IRON I"
    }
  };
}

export function normalizeState(rawState) {
  const state = createDefaultState();
  if (!rawState || typeof rawState !== "object") {
    return state;
  }

  state.lvl = typeof rawState.lvl === "number" ? rawState.lvl : 1;
  state.xp = typeof rawState.xp === "number" ? rawState.xp : 0;
  state.xpNext = typeof rawState.xpNext === "number" ? rawState.xpNext : 250;
  state.tokens = typeof rawState.tokens === "number" ? rawState.tokens : 0;
  state.completed = Array.isArray(rawState.completed) ? rawState.completed : [];
  state.logs = Array.isArray(rawState.logs) ? rawState.logs : [];
  state.streak = typeof rawState.streak === "number" ? rawState.streak : 0;
  state.lastReset = typeof rawState.lastReset === "number" ? rawState.lastReset : Date.now();
  state.hasRerolledToday = false;
  state.streakFreezeActive = rawState.streakFreezeActive === true;
  state.extraRerollsToday = 0;
  state.user = {
    ...state.user,
    ...(rawState.user && typeof rawState.user === "object" ? rawState.user : {})
  };
  state.preferredQuestIds = Array.isArray(rawState.preferredQuestIds)
    ? rawState.preferredQuestIds.filter((id) => Number.isInteger(id))
    : [];
  state.pinnedQuestProgress21d = normalizePinnedQuestProgress(rawState.pinnedQuestProgress21d);
  state.productivity = {
    ...state.productivity,
    ...(rawState.productivity && typeof rawState.productivity === "object" ? rawState.productivity : {})
  };
  return state;
}

export function loadState(uid) {
  const saved = localStorage.getItem(saveKey(uid));
  if (!saved) return normalizeState(null);
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return normalizeState(null);
  }
}

export function saveState(uid, state) {
  localStorage.setItem(saveKey(uid), JSON.stringify(state));
}

export function getMsUntilNextUtcMidnight(nowMs) {
  const now = new Date(nowMs);
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));
  return Math.max(0, nextMidnight.getTime() - nowMs);
}

export function formatTwoDigits(num) {
  return String(num).padStart(2, "0");
}

export function formatDurationWithDays(ms) {
  const totalSecs = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hrs = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const hms = `${formatTwoDigits(hrs)}:${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}
