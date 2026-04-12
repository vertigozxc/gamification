const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
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

export function resetDaily(username, isReroll = false, excludeCategories = []) {
  return request("/api/reset-daily", {
    method: "POST",
    body: JSON.stringify({ username, isReroll, excludeCategories })
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

export function syncState(username, { level, xp, xpNext }) {
  return request("/api/sync-state", {
    method: "POST",
    body: JSON.stringify({ username, level, xp, xpNext })
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

export function submitQuestFeedback(username, questId, rating, textNotes, questionType = 'How useful was this task?') {
  return request('/api/quest-feedback', {
    method: 'POST',
    body: JSON.stringify({ username, questId, rating, textNotes, questionType })
  });
}

export function fetchQuestFeedbackAnalytics() {
  return request('/api/analytics/feedback');
}
