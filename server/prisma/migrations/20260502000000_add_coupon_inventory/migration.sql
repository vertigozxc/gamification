-- Coupon inventory: JSON-encoded list of unactivated shop coupons.
-- Each coupon entry: { id, type, boughtAt }. Buying a utility item
-- creates a coupon; activating one removes it and applies the effect.
--
-- activeCosmetics: JSON object {category: cosmeticId} — the equipped
-- frame / background per category. Owning a cosmetic doesn't auto-
-- equip; user activates one from inventory.
--
-- lastFreePinnedRerollGrantedAt: when we last granted a free
-- pinned-reroll coupon (creation + every 21 days). Superseded the old
-- "free reroll cooldown" semantics on lastFreeTaskRerollAt.
--
-- Existing rows get safe defaults; no data backfill needed.

ALTER TABLE "User" ADD COLUMN "couponInventory" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN "activeCosmetics" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "lastFreePinnedRerollGrantedAt" TIMESTAMP(3);
