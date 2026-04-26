// Shared client-side helpers for the coupon-based shop economy.
// Mirrors the server's parseCouponInventory in server/src/index.js.

export const COUPON_TYPES = ["freeze", "reroll", "pinned_reroll", "xp_boost", "city_reset"];

function isValidCoupon(c) {
  return c
    && typeof c === "object"
    && typeof c.id === "string"
    && typeof c.type === "string"
    && COUPON_TYPES.includes(c.type);
}

export function parseCouponInventory(raw) {
  if (Array.isArray(raw)) return raw.filter(isValidCoupon);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidCoupon) : [];
  } catch {
    return [];
  }
}

// Group coupons by type for stack rendering. Returns:
//   [{ type, count, coupons: [...] }, ...]
// where `coupons` keeps the underlying array so callers can pop one
// off (oldest first) for activation.
export function groupCouponsByType(coupons) {
  const map = new Map();
  for (const c of coupons) {
    if (!map.has(c.type)) {
      map.set(c.type, { type: c.type, count: 0, coupons: [] });
    }
    const bucket = map.get(c.type);
    bucket.count += 1;
    bucket.coupons.push(c);
  }
  // Order: oldest-grouped-by-type first, by the boughtAt of the
  // earliest coupon in each group, so the most-stale group sits at
  // the top-left of the inventory grid.
  for (const bucket of map.values()) {
    bucket.coupons.sort((a, b) => (a.boughtAt || 0) - (b.boughtAt || 0));
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.coupons[0]?.boughtAt || 0) - (b.coupons[0]?.boughtAt || 0)
  );
}

// Pull the oldest coupon of a given type — used when the user
// activates a stack and we need to consume a single coupon id.
export function pickOldestCoupon(coupons, type) {
  return coupons
    .filter((c) => c.type === type)
    .sort((a, b) => (a.boughtAt || 0) - (b.boughtAt || 0))[0] || null;
}

// activeCosmetics is a JSON object {category: cosmeticId}.
export function parseActiveCosmetics(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}
