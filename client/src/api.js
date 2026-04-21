function resolveApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";

    if (configured) {
      try {
        const parsed = new URL(configured);
        if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && host !== "localhost" && host !== "127.0.0.1") {
          parsed.hostname = host;
          return parsed.toString().replace(/\/$/, "");
        }
      } catch {
        // ignore malformed env URL and fall back below
      }

      return configured;
    }

    return `${protocol}//${host}:4000`;
  }

  return configured || "http://localhost:4000";
}

const API_BASE = resolveApiBase();
const LANGUAGE_STORAGE_KEY = "rpg_language";

function getSelectedLanguage() {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return typeof storedLanguage === "string" && storedLanguage.trim().toLowerCase().startsWith("ru")
    ? "ru"
    : "en";
}

async function request(path, options = {}) {
  const selectedLanguage = getSelectedLanguage();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "x-language": selectedLanguage,
        ...(options.headers || {})
      },
      cache: "no-store",
      ...options
    });
  } catch (networkError) {
    try {
      const mod = await import("./eventLogger.js");
      mod.logError("api_network_error", networkError, {
        path,
        method: (options && options.method) || "GET"
      });
    } catch {
      // ignore
    }
    throw networkError;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage = (data && data.error) || `Request failed (${response.status})`;
    try {
      const mod = await import("./eventLogger.js");
      mod.logEvent("api_error", {
        level: response.status >= 500 ? "error" : "warn",
        message: errorMessage,
        meta: {
          path,
          status: response.status,
          method: (options && options.method) || "GET"
        }
      });
    } catch {
      // ignore
    }
    const errObj = new Error(errorMessage);
    errObj.data = data;
    errObj.status = response.status;
    throw errObj;
  }

  return data;
}

export function upsertProfile(username, displayName, photoUrl) {
  return request("/api/profiles/upsert", {
    method: "POST",
    body: JSON.stringify({ username, displayName, photoUrl })
  });
}

export function fetchGameState(username) {
  return request(`/api/game-state/${encodeURIComponent(username)}`);
}

export function fetchAllQuests() {
  return request("/api/quests/all");
}

export function completeOnboarding(username, displayName, preferredQuestIds, photoUrl) {
  return request("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({ username, displayName, preferredQuestIds, photoUrl })
  });
}

export function completeQuest(username, questId) {
  return request("/api/quests/complete", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function resetDaily(username, isReroll = false, excludeCategories = [], targetQuestIds = [], keepQuestIds = []) {
  return request("/api/reset-daily", {
    method: "POST",
    body: JSON.stringify({ username, isReroll, excludeCategories, targetQuestIds, keepQuestIds })
  });
}

export function resetHard(username) {
  return request("/api/reset-hard", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function createInvite(inviterUsername) {
  return request("/api/invites/create", {
    method: "POST",
    body: JSON.stringify({ inviterUsername })
  });
}

export function acceptInvite(code, invitedUsername) {
  return request("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ code, invitedUsername })
  });
}

export function fetchFriends(username) {
  return request(`/api/friends/${encodeURIComponent(username)}`);
}

export function syncState(username, { level, xp, xpNext, tokens }) {
  return request("/api/sync-state", {
    method: "POST",
    body: JSON.stringify({ username, level, xp, xpNext, tokens })
  });
}

export function fetchLeaderboard() {
  return request("/api/leaderboard");
}

export function freezeStreak(username) {
  return request("/api/shop/freeze-streak", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function buyExtraReroll(username) {
  return request("/api/shop/extra-reroll", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function replacePinnedQuests(username, preferredQuestIds, useTokens = true) {
  return request("/api/shop/replace-pinned-quests", {
    method: "POST",
    body: JSON.stringify({ username, preferredQuestIds, useTokens })
  });
}
export async function rerollPinned(username, useTokens) {
  return request("/api/quests/reroll-pinned", {
    method: "POST",
    body: JSON.stringify({ username, useTokens })
  });
}

// ── Custom habits ──
export function fetchCustomQuests(username) {
  return request(`/api/custom-quests/${encodeURIComponent(username)}`);
}

export function createCustomQuest(username, { title, description }) {
  return request("/api/custom-quests", {
    method: "POST",
    body: JSON.stringify({ username, title, description })
  });
}

export function updateCustomQuest(username, id, { title, description }) {
  const virtualId = Number(id);
  const dbId = virtualId >= 1_000_000 ? virtualId - 1_000_000 : virtualId;
  return request(`/api/custom-quests/${dbId}`, {
    method: "PATCH",
    body: JSON.stringify({ username, title, description })
  });
}

export function deleteCustomQuest(username, id) {
  const virtualId = Number(id);
  const dbId = virtualId >= 1_000_000 ? virtualId - 1_000_000 : virtualId;
  return request(`/api/custom-quests/${dbId}`, {
    method: "DELETE",
    body: JSON.stringify({ username })
  });
}

export function storeMobileAuthToken(user, bridgeId = "") {
  return request("/api/auth/mobile-token", {
    method: "POST",
    body: JSON.stringify({
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      bridgeId: bridgeId || ""
    })
  });
}

export function retrieveMobileAuthToken(token) {
  return request(`/api/auth/mobile-token/${encodeURIComponent(token)}`);
}

export function retrieveMobileAuthTokenByBridge(bridgeId) {
  return request(`/api/auth/mobile-bridge/${encodeURIComponent(bridgeId)}`);
}

export function fetchProfileStats(username) {
  return request(`/api/profile-stats/${encodeURIComponent(username)}`);
}
export function updateTheme(username, theme) {
  return request("/api/profiles/theme", {
    method: "POST",
    body: JSON.stringify({ username, theme })
  });
}

export function deleteProfile(userId) {
  return request(`/api/profiles/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function citySpin(username) {
  return request("/api/city/spin", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function citySpinClaim(username, claimToken) {
  return request("/api/city/spin/claim", {
    method: "POST",
    body: JSON.stringify({ username, claimToken })
  });
}

export function citySpinStatus(username) {
  return request(`/api/city/spin-status/${encodeURIComponent(username)}`);
}

export function upgradeDistrict(username, districtId) {
  return request("/api/city/upgrade-district", {
    method: "POST",
    body: JSON.stringify({ username, districtId })
  });
}

export function downgradeDistrict(username, districtId) {
  return request("/api/city/downgrade-district", {
    method: "POST",
    body: JSON.stringify({ username, districtId })
  });
}

export function devGrantStats(username) {
  return request("/api/city/dev-grant-stats", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function claimBusinessTokens(username) {
  return request("/api/city/business/claim", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function claimMonthlyFreeze(username) {
  return request("/api/city/residential/claim-freeze", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function useFreeze(username, days = 1) {
  return request("/api/streak/use-freeze", {
    method: "POST",
    body: JSON.stringify({ username, days })
  });
}

export function startVacation(username) {
  return request("/api/city/residential/start-vacation", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}
