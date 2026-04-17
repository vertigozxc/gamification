// Sticky A/B variant assignment.
// - Bucket is deterministic per (userId, experimentKey) using FNV-1a hash.
// - Assignments are cached in localStorage so users keep their variant across sessions.
// - First time a variant is assigned for a user, an `ab_assigned` event is logged.

import { logEvent, setExperimentVariants } from "./eventLogger.js";

const STORAGE_KEY = "life_rpg_ab_assignments";
const ANON_ID_KEY = "life_rpg_anon_id";

// Define experiments here. Add/remove as the test plan evolves.
// `weights` must sum to 1; defaults to even split.
export const EXPERIMENTS = {
  onboarding_flow: {
    variants: ["classic", "guided"],
    weights: [0.5, 0.5]
  },
  reroll_pricing: {
    variants: ["t5", "t7"],
    weights: [0.5, 0.5]
  },
  level_up_popup: {
    variants: ["compact", "celebrate"],
    weights: [0.5, 0.5]
  }
};

function readAssignments() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAssignments(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function getOrCreateAnonId() {
  if (typeof window === "undefined") return "anon";
  try {
    let id = window.localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = `anon-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      window.localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

// FNV-1a 32-bit -> [0,1)
function hashUnit(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h / 0xffffffff;
}

function pickVariant(experimentKey, bucketKey) {
  const exp = EXPERIMENTS[experimentKey];
  if (!exp) return null;
  const u = hashUnit(`${experimentKey}::${bucketKey}`);
  const weights = exp.weights && exp.weights.length === exp.variants.length
    ? exp.weights
    : exp.variants.map(() => 1 / exp.variants.length);
  let acc = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    acc += weights[i];
    if (u < acc) return exp.variants[i];
  }
  return exp.variants[exp.variants.length - 1];
}

// Apply (assign + persist) all known experiments for the given user/anon id.
// Returns a map { experimentKey: variant }.
export function ensureAssignments(userId) {
  const bucketKey = userId && String(userId).trim() ? String(userId) : getOrCreateAnonId();
  const stored = readAssignments();
  const userBucket = stored[bucketKey] || {};
  const result = {};
  let dirty = false;

  for (const key of Object.keys(EXPERIMENTS)) {
    if (userBucket[key] && EXPERIMENTS[key].variants.includes(userBucket[key])) {
      result[key] = userBucket[key];
    } else {
      const variant = pickVariant(key, bucketKey);
      result[key] = variant;
      userBucket[key] = variant;
      dirty = true;
      // Fire-and-forget assignment event so the admin dashboard sees it.
      try {
        logEvent("ab_assigned", {
          meta: { experiment: key, variant, bucketKey }
        });
      } catch {
        // ignore
      }
    }
  }

  if (dirty) {
    stored[bucketKey] = userBucket;
    writeAssignments(stored);
  }

  setExperimentVariants(result);
  return result;
}

export function getAssignedVariant(experimentKey) {
  const all = ensureAssignments("");
  return all[experimentKey];
}
