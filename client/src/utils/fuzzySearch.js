// Plain substring search: lowercase both sides, trim, and test inclusion.
// The earlier stemmer + synonym expansion added too much surprise — users
// expect typing "water" to just find "water" in the description, nothing
// fancier. Kept as a single entry point so callers don't have to change.

function normaliseSimple(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyMatch(query, text) {
  const q = normaliseSimple(query);
  if (!q) return true;
  return normaliseSimple(text).includes(q);
}
