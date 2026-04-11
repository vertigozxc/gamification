import { getApiBaseUrl } from "../config/env";

const API_BASE = getApiBaseUrl();
const REQUEST_TIMEOUT_MS = 12000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s. Check API URL: ${API_BASE}`);
    }

    if (error instanceof TypeError) {
      throw new Error(`Cannot reach API at ${API_BASE}. Ensure server is running and phone can access it.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchGameState(username) {
  return request(`/api/game-state/${encodeURIComponent(username)}`);
}

export function fetchAllQuests() {
  return request("/api/quests/all");
}

export function completeQuest(username, questId) {
  return request("/api/quests/complete", {
    method: "POST",
    body: JSON.stringify({ username, questId })
  });
}

export function upsertProfile(username, displayName, photoUrl) {
  return request("/api/profiles/upsert", {
    method: "POST",
    body: JSON.stringify({ username, displayName, photoUrl })
  });
}
