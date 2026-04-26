// Cosmetic catalogue — must mirror server/src/index.js COSMETIC_ITEMS.
// 7 placeholder items (5 silver-currency-style stub previews) until
// real animated assets land. Pricing in Gold.
//
// Each entry:
//   id          server id (must match server's COSMETIC_ITEMS)
//   nameKey     i18n key for the user-facing name
//   descKey     i18n key for the short description
//   costGold    gold cost
//   category    "background" | "frame"
//   previewIcon emoji we render as the slot art
//
// When real previews exist we'll swap previewIcon for a React preview
// component while keeping the rest of the schema unchanged.

const COSMETIC_ITEMS = [
  {
    id: "bg_cosmic",
    nameKey: "cosmeticBgCosmicName",
    descKey: "cosmeticBgCosmicDesc",
    costGold: 5,
    category: "background",
    previewIcon: "🌌"
  },
  {
    id: "frame_phoenix",
    nameKey: "cosmeticFramePhoenixName",
    descKey: "cosmeticFramePhoenixDesc",
    costGold: 8,
    category: "frame",
    previewIcon: "🔥"
  },
  {
    id: "frame_frost",
    nameKey: "cosmeticFrameFrostName",
    descKey: "cosmeticFrameFrostDesc",
    costGold: 6,
    category: "frame",
    previewIcon: "❄️"
  },
  {
    id: "bg_sunset",
    nameKey: "cosmeticBgSunsetName",
    descKey: "cosmeticBgSunsetDesc",
    costGold: 4,
    category: "background",
    previewIcon: "🌅"
  },
  {
    id: "frame_lightning",
    nameKey: "cosmeticFrameLightningName",
    descKey: "cosmeticFrameLightningDesc",
    costGold: 7,
    category: "frame",
    previewIcon: "⚡"
  },
  {
    id: "bg_ocean",
    nameKey: "cosmeticBgOceanName",
    descKey: "cosmeticBgOceanDesc",
    costGold: 3,
    category: "background",
    previewIcon: "🌊"
  },
  {
    id: "frame_mythic",
    nameKey: "cosmeticFrameMythicName",
    descKey: "cosmeticFrameMythicDesc",
    costGold: 12,
    category: "frame",
    previewIcon: "🎴"
  }
];

export default COSMETIC_ITEMS;

export function parseOwnedCosmetics(raw) {
  if (Array.isArray(raw)) return raw.filter((id) => typeof id === "string");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
