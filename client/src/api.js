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

// Transient server errors and cold-start timeouts are retry-worthy; a
// plain 4xx is a logic error and should bubble up immediately.
const RETRYABLE_STATUS = new Set([408, 502, 503, 504]);
// Delays before attempt 2, 3, 4. Total worst-case added wait ~3.2s before
// we give up — keeps the UX snappy when the network actually IS broken
// while surviving a single Render cold-start or Cloudflare hiccup.
const RETRY_BACKOFFS_MS = [300, 900, 2000];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dispatchNetworkEvent(name, detail) {
  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch {
    // ignore — diagnostics only, must never break the request.
  }
}

async function request(path, options = {}) {
  const selectedLanguage = getSelectedLanguage();
  const method = ((options && options.method) || "GET").toUpperCase();
  // Only retry idempotent reads by default — POST/PUT/PATCH/DELETE could
  // double-apply. Individual callers can opt in via `idempotent: true`
  // when the server contract is safe to retry (e.g. delete-by-id where
  // the second attempt harmlessly 404s).
  const canRetry = method === "GET" || method === "HEAD" || options.idempotent === true;
  const maxAttempts = canRetry ? RETRY_BACKOFFS_MS.length + 1 : 1;
  let notifiedRetry = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
      // Network-level failure — fetch rejected. Retry if we still have
      // attempts left and the method is idempotent.
      if (canRetry && attempt < maxAttempts) {
        if (!notifiedRetry) {
          dispatchNetworkEvent("api-retry-start", { path, method });
          notifiedRetry = true;
        }
        await delay(RETRY_BACKOFFS_MS[attempt - 1]);
        continue;
      }
      try {
        const mod = await import("./eventLogger.js");
        mod.logError("api_network_error", networkError, { path, method, attempts: attempt });
      } catch {
        // ignore
      }
      if (notifiedRetry) dispatchNetworkEvent("api-retry-end", { path, method, ok: false });
      throw networkError;
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      // Retry only the transient 5xx/408. 4xx responses surface immediately.
      if (canRetry && attempt < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
        if (!notifiedRetry) {
          dispatchNetworkEvent("api-retry-start", { path, method });
          notifiedRetry = true;
        }
        await delay(RETRY_BACKOFFS_MS[attempt - 1]);
        continue;
      }

      const errorMessage = (data && data.error) || `Request failed (${response.status})`;
      // Only ship 5xx (server bugs) to the admin events log. 4xx are
      // expected business rejections ("Already claimed today", "Invalid
      // request", auth failures, rate limits) — they're noise for admin
      // and surface to the user through the normal error flow anyway.
      if (response.status >= 500) {
        try {
          const mod = await import("./eventLogger.js");
          mod.logEvent("api_error", {
            level: "error",
            message: errorMessage,
            meta: { path, status: response.status, method, attempts: attempt }
          });
        } catch {
          // ignore
        }
      }
      if (notifiedRetry) dispatchNetworkEvent("api-retry-end", { path, method, ok: false });
      const errObj = new Error(errorMessage);
      errObj.data = data;
      errObj.status = response.status;
      throw errObj;
    }

    if (notifiedRetry) dispatchNetworkEvent("api-retry-end", { path, method, ok: true });
    return data;
  }

  // Unreachable (loop always returns/throws) but keeps the linter happy.
  throw new Error("request() exhausted retries");
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

export function fetchAllQuests({ level, streak } = {}) {
  const params = new URLSearchParams();
  if (Number.isFinite(level)) params.set("level", String(level));
  if (Number.isFinite(streak)) params.set("streak", String(streak));
  const qs = params.toString();
  return request(`/api/quests/all${qs ? `?${qs}` : ""}`);
}

export function completeOnboarding(username, displayName, preferredQuestIds, photoUrl, handle) {
  return request("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({ username, displayName, preferredQuestIds, photoUrl, handle })
  });
}

export function skipOnboarding(username, displayName, photoUrl, handle) {
  return request("/api/onboarding/skip", {
    method: "POST",
    body: JSON.stringify({ username, displayName, photoUrl, handle })
  });
}

// Finish the animated tour. `awardLevel:false` when the user tapped Skip —
// the tour is still marked done (so it won't reopen next login) but no
// +1 level is granted.
export function completeOnboardingTour(username, { awardLevel = true } = {}) {
  return request("/api/onboarding/tour/complete", {
    method: "POST",
    body: JSON.stringify({ username, awardLevel })
  });
}

export function resetOnboardingTour(username) {
  return request("/api/onboarding/tour/reset", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

// Server suggests an unclaimed @handle seeded from the displayName the
// user just typed. Used to pre-fill the onboarding @handle input.
export function suggestHandle(displayName) {
  const qs = new URLSearchParams({ displayName: String(displayName || "") }).toString();
  return request(`/api/handle/suggest?${qs}`);
}

// Debounced availability check for the @handle input. Passing `username`
// (Firebase UID) lets the server exclude the caller's own current handle.
export function checkHandle(value, username) {
  const params = new URLSearchParams({ value: String(value || "") });
  if (username) params.set("username", String(username));
  return request(`/api/handle/check?${params.toString()}`);
}

export function startQuestTimer(username, questId) {
  return request("/api/quests/timer/start", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function pauseQuestTimer(username, questId) {
  return request("/api/quests/timer/pause", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function resumeQuestTimer(username, questId) {
  return request("/api/quests/timer/resume", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function stopQuestTimer(username, questId) {
  return request("/api/quests/timer/stop", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function completeQuest(username, questId) {
  return request("/api/quests/complete", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function tickQuestCounter(username, questId) {
  return request("/api/quests/counter/tick", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function fetchQuestCounter(username, questId) {
  return request(`/api/quests/counter/${encodeURIComponent(username)}/${questId}`);
}

export function submitQuestNote(username, questId, kind, items) {
  return request("/api/quests/note/submit", {
    method: "POST",
    body: JSON.stringify({ username, questId, kind, items })
  });
}

export function fetchNotesHistory(username, limit = 60) {
  const qs = new URLSearchParams({ limit: String(limit) }).toString();
  return request(`/api/notes/history/${encodeURIComponent(username)}?${qs}`);
}

export function createPersonalNote(username, text) {
  return request("/api/notes/personal/create", {
    method: "POST",
    body: JSON.stringify({ username, text })
  });
}

export async function deletePersonalNote(username, id) {
  const qs = new URLSearchParams({ username }).toString();
  try {
    return await request(`/api/notes/personal/${encodeURIComponent(id)}?${qs}`, {
      method: "DELETE",
      // Delete-by-id is idempotent: if a retry hits the server after the
      // first attempt already succeeded, it will 404. We treat that as
      // success below — the note is gone either way.
      idempotent: true
    });
  } catch (err) {
    if (err?.status === 404) return { ok: true, alreadyGone: true };
    throw err;
  }
}

export function updatePersonalNote(username, id, text) {
  return request(`/api/notes/personal/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ username, text })
  });
}

export function resetDaily(username, isReroll = false, excludeCategories = [], targetQuestIds = [], keepQuestIds = [], force = false) {
  return request("/api/reset-daily", {
    method: "POST",
    body: JSON.stringify({ username, isReroll, excludeCategories, targetQuestIds, keepQuestIds, force })
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

// ─────────────────────────────────────────────────────────────────
// Cached GETs for hot community screens. Repeated visits within the
// TTL return the last payload instantly; mutations (send request,
// accept, leave challenge, …) must call evictCommunityCache() to
// force the next read.
// ─────────────────────────────────────────────────────────────────
import { withCache, evictCachePrefix } from "./utils/apiCache";

const COMMUNITY_TTL = 30_000; // 30s feels snappy without going stale

export function evictCommunityCache() {
  evictCachePrefix("friends:");
  evictCachePrefix("challenges:");
  evictCachePrefix("leaderboard");
  evictCachePrefix("profile:");
}

export function fetchFriends(username, { force = false } = {}) {
  return withCache(
    `friends:list:${username}`,
    () => request(`/api/friends/list/${encodeURIComponent(username)}`),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function fetchFriendRelation(me, them) {
  const qs = new URLSearchParams({ me, them }).toString();
  return request(`/api/friends/relation?${qs}`);
}

// Mutation wrappers invalidate the community cache so the next read
// picks up fresh server state instead of stale cached lists.
async function withCommunityInvalidation(promise) {
  try {
    const result = await promise;
    evictCommunityCache();
    return result;
  } catch (err) {
    evictCommunityCache();
    throw err;
  }
}

export function sendFriendRequest(fromUsername, toUsername) {
  return withCommunityInvalidation(request("/api/friends/request", {
    method: "POST",
    body: JSON.stringify({ fromUsername, toUsername })
  }));
}

export function respondToFriendRequest(username, requestId, response) {
  return withCommunityInvalidation(request("/api/friends/respond", {
    method: "POST",
    body: JSON.stringify({ username, requestId, response })
  }));
}

export function cancelFriendRequest(fromUsername, toUsername) {
  return withCommunityInvalidation(request("/api/friends/cancel", {
    method: "POST",
    body: JSON.stringify({ fromUsername, toUsername })
  }));
}

export function removeFriend(myUsername, theirUsername) {
  return withCommunityInvalidation(request("/api/friends/remove", {
    method: "DELETE",
    body: JSON.stringify({ myUsername, theirUsername })
  }));
}

export function fetchIncomingFriendRequests(username, { force = false } = {}) {
  return withCache(
    `friends:requests:${username}`,
    () => request(`/api/friends/requests/${encodeURIComponent(username)}`),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function searchUsers(query, limit = 20) {
  const qs = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  return request(`/api/users/search?${qs}`);
}

export function fetchPublicProfile(username, { force = false } = {}) {
  return withCache(
    `profile:public:${username}`,
    () => request(`/api/users/${encodeURIComponent(username)}/public`),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function fetchWeeklyLeaderboard(meUsername, { force = false } = {}) {
  const path = meUsername
    ? `/api/leaderboard/weekly?me=${encodeURIComponent(meUsername)}`
    : "/api/leaderboard/weekly";
  return withCache(
    `leaderboard:weekly:${meUsername || "anon"}`,
    () => request(path),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function fetchUserChallenges(username, { force = false } = {}) {
  return withCache(
    `challenges:user:${username}`,
    () => request(`/api/challenges/user/${encodeURIComponent(username)}`),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function fetchChallenge(challengeId, { force = false } = {}) {
  return withCache(
    `challenges:detail:${challengeId}`,
    () => request(`/api/challenges/${encodeURIComponent(challengeId)}`),
    { ttlMs: COMMUNITY_TTL, force }
  );
}

export function createChallenge(payload) {
  return withCommunityInvalidation(request("/api/challenges", {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function joinChallenge(challengeId, username) {
  return withCommunityInvalidation(request(`/api/challenges/${encodeURIComponent(challengeId)}/join`, {
    method: "POST",
    body: JSON.stringify({ username })
  }));
}

export function leaveChallenge(challengeId, username) {
  return withCommunityInvalidation(request(`/api/challenges/${encodeURIComponent(challengeId)}/leave`, {
    method: "POST",
    body: JSON.stringify({ username })
  }));
}

export function completeChallenge(challengeId, username) {
  return withCommunityInvalidation(request(`/api/challenges/${encodeURIComponent(challengeId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ username })
  }));
}

export function inviteToChallenge(challengeId, inviterUsername, inviteeUsernames) {
  return withCommunityInvalidation(request(`/api/challenges/${encodeURIComponent(challengeId)}/invite`, {
    method: "POST",
    body: JSON.stringify({ inviterUsername, inviteeUsernames })
  }));
}

export function resetCity(username) {
  return request("/api/shop/reset-city", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function removeChallengeParticipant(challengeId, requesterUsername, username) {
  return withCommunityInvalidation(request(`/api/challenges/${encodeURIComponent(challengeId)}/remove-participant`, {
    method: "POST",
    body: JSON.stringify({ requesterUsername, username })
  }));
}

export function syncState(username, { level, xp, xpNext, tokens }) {
  return request("/api/sync-state", {
    method: "POST",
    body: JSON.stringify({ username, level, xp, xpNext, tokens })
  });
}

export function fetchLeaderboard({ force = false } = {}) {
  return withCache(
    "leaderboard:top",
    () => request("/api/leaderboard"),
    { ttlMs: COMMUNITY_TTL, force }
  );
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

export function buyXpBoost(username) {
  return request("/api/shop/buy-xp-boost", {
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

export function createCustomQuest(username, { title, description, needsTimer, timeEstimateMin }) {
  return request("/api/custom-quests", {
    method: "POST",
    body: JSON.stringify({
      username,
      title,
      description,
      needsTimer: Boolean(needsTimer),
      timeEstimateMin: Math.max(0, Number(timeEstimateMin) || 0)
    })
  });
}

export function updateCustomQuest(username, id, { title, description, needsTimer, timeEstimateMin }) {
  const virtualId = Number(id);
  const dbId = virtualId >= 1_000_000 ? virtualId - 1_000_000 : virtualId;
  const body = { username, title, description };
  if (needsTimer !== undefined) body.needsTimer = Boolean(needsTimer);
  if (timeEstimateMin !== undefined) body.timeEstimateMin = Math.max(0, Number(timeEstimateMin) || 0);
  return request(`/api/custom-quests/${dbId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
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

export function updatePreferredLanguage(username, language) {
  return request("/api/profiles/language", {
    method: "POST",
    body: JSON.stringify({ username, language })
  });
}

export function updateCityName(username, cityName) {
  return request("/api/profiles/city-name", {
    method: "POST",
    body: JSON.stringify({ username, cityName })
  });
}

export function fetchAchievements(username) {
  return request(`/api/users/${encodeURIComponent(username)}/achievements`);
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

export function devGrantXp(username, amount = 500) {
  return request("/api/dev/grant-xp", {
    method: "POST",
    body: JSON.stringify({ username, amount })
  });
}

export function devGrantTokens(username, amount = 5) {
  return request("/api/dev/grant-tokens", {
    method: "POST",
    body: JSON.stringify({ username, amount })
  });
}

export function devGrantStreak(username, amount = 1) {
  return request("/api/dev/grant-streak", {
    method: "POST",
    body: JSON.stringify({ username, amount })
  });
}

export function devResetMe(username) {
  return request("/api/dev/reset-me", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function addPinnedQuest(username, questId) {
  return request("/api/habits/pin-one", {
    method: "POST",
    body: JSON.stringify({ username, questId })
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

export function dismissStreakBurnNotice(username) {
  return request("/api/streak/dismiss-burn-notice", {
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
