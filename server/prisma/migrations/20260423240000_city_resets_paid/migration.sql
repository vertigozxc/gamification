-- Tracks how many paid city resets this user has purchased. Cost for
-- the next reset = min(50, 10 × (cityResetsPaid + 1)): 10 → 20 → 30 →
-- 40 → 50 → 50 … See /api/shop/reset-city.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cityResetsPaid" INTEGER NOT NULL DEFAULT 0;
