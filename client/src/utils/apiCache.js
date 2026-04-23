// Tiny in-memory cache with TTL + single-flight dedupe. Intended for
// repeated GETs on screens the user flips between quickly (community
// feed, challenges list, leaderboard) so the second visit within the
// TTL window returns instantly from cache instead of waiting on the
// network again. Invalidation is callsite-controlled via clear()/evict().

const store = new Map(); // key → { data, expiresAt }
const inflight = new Map(); // key → Promise

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data, ttlMs) {
  store.set(key, { data, expiresAt: Date.now() + Math.max(0, Number(ttlMs) || 0) });
}

export function evictCache(key) {
  store.delete(key);
}

export function evictCachePrefix(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function clearCache() {
  store.clear();
}

// Fetches `fetcher()` once per key within ttl. Concurrent callers get
// the same in-flight promise so we never hit the server twice for the
// same key at once. `force: true` bypasses the cache but still dedupes
// simultaneous calls.
export async function withCache(key, fetcher, { ttlMs = 30_000, force = false } = {}) {
  if (!force) {
    const cached = getCached(key);
    if (cached != null) return cached;
  }
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = Promise.resolve()
    .then(() => fetcher())
    .then((data) => {
      if (data != null) setCached(key, data, ttlMs);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}
