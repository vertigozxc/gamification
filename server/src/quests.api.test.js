import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "./index.js";
import { prisma } from "./db.js";
import { getDailyQuestCount, getPreferredQuestCount, getRandomQuestCount } from "./quests.js";

const DAILY_QUEST_COUNT = getDailyQuestCount();
const PINNED_COUNT = getPreferredQuestCount();
const EXPECTED_OTHER_COUNT = Math.max(0, Math.min(4, DAILY_QUEST_COUNT - PINNED_COUNT));
const EXPECTED_RANDOM_COUNT = Math.max(0, Math.min(getRandomQuestCount(), DAILY_QUEST_COUNT - PINNED_COUNT));

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test("GET /api/quests keeps categories unique in the random quest slots", async () => {
  const pinnedIds = Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",");
  const response = await fetch(`${baseUrl}/api/quests?username=tester&pinnedQuestIds=${pinnedIds}&date=2026-04-09T00:00:00.000Z`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.ok(Array.isArray(payload.quests), "quests array missing");
  assert.equal(payload.quests.length, DAILY_QUEST_COUNT, `expected exactly ${DAILY_QUEST_COUNT} daily quests`);

  const otherQuests = payload.quests.slice(PINNED_COUNT, PINNED_COUNT + EXPECTED_OTHER_COUNT);
  assert.equal(otherQuests.length, EXPECTED_OTHER_COUNT, `expected exactly ${EXPECTED_OTHER_COUNT} non-pinned quests after the pinned slots`);

  const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
  assert.equal(new Set(categories).size, categories.length, "non-pinned slots must have unique categories");
});

test("GET /api/quests maintains unique categories across 50 different usernames", async () => {
  let failCount = 0;
  const tests = [];

  for (let i = 0; i < 50; i += 1) {
    const username = `user_${i}`;
    const pinnedIds = Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",");
    const url = `${baseUrl}/api/quests?username=${encodeURIComponent(username)}&pinnedQuestIds=${pinnedIds}&date=2026-04-09T00:00:00.000Z`;

    tests.push(
      fetch(url)
        .then((res) => res.json())
        .then((payload) => {
          const otherQuests = payload.quests?.slice(PINNED_COUNT, PINNED_COUNT + EXPECTED_OTHER_COUNT) || [];
          if (otherQuests.length !== EXPECTED_OTHER_COUNT) {
            throw new Error(`expected ${EXPECTED_OTHER_COUNT} other quests, got ${otherQuests.length}`);
          }

          const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
          const uniqueCount = new Set(categories).size;
          if (uniqueCount !== EXPECTED_OTHER_COUNT) {
            failCount += 1;
            console.error(`username ${username}: found ${uniqueCount} unique categories instead of ${EXPECTED_OTHER_COUNT}. Categories: ${categories.join(", ")}`);
          }
        })
        .catch((err) => {
          failCount += 1;
          console.error(`username ${username}: ${err.message}`);
        })
    );
  }

  await Promise.all(tests);
  assert.equal(failCount, 0, `${failCount} usernames failed the unique category check`);
});

test("GET /api/quests maintains unique categories across different reset seeds", async () => {
  let failCount = 0;
  const tests = [];

  for (let seed = 0; seed < 30; seed += 1) {
    const pinnedIds = Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",");
    const url = `${baseUrl}/api/quests?username=tester&pinnedQuestIds=${pinnedIds}&resetSeed=${seed}&date=2026-04-09T00:00:00.000Z`;

    tests.push(
      fetch(url)
        .then((res) => res.json())
        .then((payload) => {
          const otherQuests = payload.quests?.slice(PINNED_COUNT, PINNED_COUNT + EXPECTED_OTHER_COUNT) || [];
          if (otherQuests.length !== EXPECTED_OTHER_COUNT) {
            throw new Error(`expected ${EXPECTED_OTHER_COUNT} other quests, got ${otherQuests.length}`);
          }

          const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
          const uniqueCount = new Set(categories).size;
          if (uniqueCount !== EXPECTED_OTHER_COUNT) {
            failCount += 1;
            console.error(`seed ${seed}: found ${uniqueCount} unique categories instead of ${EXPECTED_OTHER_COUNT}. Categories: ${categories.join(", ")}`);
          }
        })
        .catch((err) => {
          failCount += 1;
          console.error(`seed ${seed}: ${err.message}`);
        })
    );
  }

  await Promise.all(tests);
  assert.equal(failCount, 0, `${failCount} seeds failed the unique category check`);
});

test("GET /api/quests respects excludeCategories parameter on reroll", async () => {
  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "exclusion-tester", displayName: "Exclusion Tester" })
  });
  assert.equal(upsertResponse.status, 200);

  // First, get initial quests
  const pinnedIds = Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",");
  const initialResponse = await fetch(`${baseUrl}/api/quests?username=exclusion-tester&pinnedQuestIds=${pinnedIds}&date=2026-04-09T00:00:00.000Z`);
  assert.equal(initialResponse.status, 200);

  const initialPayload = await initialResponse.json();
  const initialOtherQuests = initialPayload.quests?.slice(PINNED_COUNT, PINNED_COUNT + EXPECTED_OTHER_COUNT) || [];
  assert.equal(initialOtherQuests.length, EXPECTED_OTHER_COUNT, `expected ${EXPECTED_OTHER_COUNT} initial other quests`);

  // Extract categories from initial other quests
  const initialCategories = initialOtherQuests.map((quest) => String(quest?.category || "").toUpperCase());
  assert.equal(new Set(initialCategories).size, EXPECTED_OTHER_COUNT, "initial quests must have unique categories");
  const excludedCategory = initialCategories[0];

  // Call reset-daily API with excludeCategories
  const resetResponse = await fetch(`${baseUrl}/api/reset-daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "exclusion-tester",
      isReroll: true,
      excludeCategories: [excludedCategory]
    })
  });
  assert.equal(resetResponse.status, 200);

  const resetPayload = await resetResponse.json();
  assert.ok(Array.isArray(resetPayload.quests), "reset response must include quests array");
  assert.ok(resetPayload.quests.length >= EXPECTED_OTHER_COUNT, "reset response must include rerolled quests");

  // Verify that constrained rerolled quests do NOT have any categories from the exclusion list.
  const rerolledOtherQuests = resetPayload.quests.slice(0, EXPECTED_OTHER_COUNT);
  const rerolledCategories = rerolledOtherQuests.map((quest) => String(quest?.category || "").toUpperCase());

  const excludeSet = new Set([excludedCategory]);
  for (const category of rerolledCategories.slice(0, EXPECTED_OTHER_COUNT)) {
    // First 4 should not be in exclude list
    assert.equal(
      excludeSet.has(category),
      false,
      `rerolled quest category "${category}" should not be in exclusion list: ${Array.from(excludeSet).join(", ")}`
    );
  }

  // Verify rerolled other quests still maintain unique categories in the constrained slots
  const constrainedRerolled = rerolledCategories.slice(0, EXPECTED_OTHER_COUNT);
  assert.equal(
    new Set(constrainedRerolled).size,
    EXPECTED_OTHER_COUNT,
    `rerolled quests must have unique categories, got: ${constrainedRerolled.join(", ")}`
  );
});

test("POST /api/reset-daily handles impossible excludeCategories without failing", async () => {
  const username = "exhaustive-exclusion-tester";

  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: "Exhaustive Exclusion Tester" })
  });
  assert.equal(upsertResponse.status, 200);

  const exhaustiveExcludeCategories = ["BODY", "MIND", "SOCIAL", "DISCIPLINE", "RECOVERY", "UNCATEGORIZED"];

  const resetResponse = await fetch(`${baseUrl}/api/reset-daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      isReroll: true,
      excludeCategories: exhaustiveExcludeCategories
    })
  });

  assert.equal(resetResponse.status, 200);
  const payload = await resetResponse.json();

  assert.ok(Array.isArray(payload.quests), "reroll response must include quests array");
  assert.ok(payload.quests.length >= EXPECTED_OTHER_COUNT, "reroll should still return a valid quest set even with exhaustive exclusions");

  const constrainedQuests = payload.quests.slice(0, EXPECTED_OTHER_COUNT);
  assert.equal(constrainedQuests.length, EXPECTED_OTHER_COUNT, `reroll should still provide ${EXPECTED_OTHER_COUNT} constrained quest slots`);
});

test("POST /api/quests/complete grants 2 tokens starting from level 10", async () => {
  const username = `lvl10_${Date.now().toString().slice(-6)}`;

  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: "Level Ten Reward" })
  });
  assert.equal(upsertResponse.status, 200);

  await prisma.user.update({
    where: { username },
    data: {
      level: 9,
      xp: 90,
      xpNext: 100,
      tokens: 0,
      preferredQuestIds: Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",")
    }
  });

  const gameStateResponse = await fetch(`${baseUrl}/api/game-state/${encodeURIComponent(username)}`);
  assert.equal(gameStateResponse.status, 200);
  const gameStatePayload = await gameStateResponse.json();
  const questId = gameStatePayload?.quests?.[0]?.id;
  assert.ok(Number.isInteger(questId), "expected at least one available quest");

  const completeResponse = await fetch(`${baseUrl}/api/quests/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, questId })
  });
  assert.equal(completeResponse.status, 200);

  const completePayload = await completeResponse.json();
  assert.equal(completePayload.tokens, 2);

  const updatedUser = await prisma.user.findUnique({ where: { username } });
  assert.equal(updatedUser?.level, 10);
  assert.equal(updatedUser?.tokens, 2);
});

test("POST /api/shop/freeze-streak only charges once when requests race", async () => {
  const username = `frz_${Date.now().toString().slice(-6)}`;

  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: "Freeze Race" })
  });
  assert.equal(upsertResponse.status, 200);

  await prisma.user.update({
    where: { username },
    data: {
      tokens: 5,
      streakFreezeExpiresAt: null
    }
  });

  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/shop/freeze-streak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      })
    )
  );

  const statusCodes = responses.map((response) => response.status);
  assert.equal(statusCodes.filter((status) => status === 200).length, 1);

  const updatedUser = await prisma.user.findUnique({ where: { username } });
  assert.equal(updatedUser?.tokens, 2);
  assert.ok(updatedUser?.streakFreezeExpiresAt, "expected freeze expiration to be set");

  const gameStateResponse = await fetch(`${baseUrl}/api/game-state/${encodeURIComponent(username)}`);
  assert.equal(gameStateResponse.status, 200);
  const gameStatePayload = await gameStateResponse.json();
  assert.equal(gameStatePayload.streakFreezeActive, true);
});

test("GET /api/game-state returns full random daily quests when 2 custom habits are pinned", async () => {
  const username = `custommix_${Date.now().toString().slice(-6)}`;

  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: "Custom Mix Tester" })
  });
  assert.equal(upsertResponse.status, 200);

  const user = await prisma.user.findUnique({ where: { username } });
  assert.ok(user, "user should exist after upsert");

  const firstCustom = await prisma.customQuest.create({
    data: {
      userId: user.id,
      title: "Custom Habit One",
      description: "first",
      stat: "sta"
    }
  });
  const secondCustom = await prisma.customQuest.create({
    data: {
      userId: user.id,
      title: "Custom Habit Two",
      description: "second",
      stat: "sta"
    }
  });

  const firstCustomVirtualId = 1_000_000 + firstCustom.id;
  const secondCustomVirtualId = 1_000_000 + secondCustom.id;

  await prisma.user.update({
    where: { username },
    data: {
      preferredQuestIds: `1,${firstCustomVirtualId},${secondCustomVirtualId}`,
      randomQuestIds: ""
    }
  });

  const gameStateResponse = await fetch(`${baseUrl}/api/game-state/${encodeURIComponent(username)}`);
  assert.equal(gameStateResponse.status, 200);
  const payload = await gameStateResponse.json();

  assert.ok(Array.isArray(payload?.quests), "game-state should return quests array");
  const quests = payload.quests;
  assert.equal(quests.length, PINNED_COUNT + EXPECTED_RANDOM_COUNT);

  const pinned = quests.slice(0, PINNED_COUNT);
  const random = quests.slice(PINNED_COUNT);

  const customPinnedCount = pinned.filter((quest) => quest?.isCustom === true).length;
  assert.equal(customPinnedCount, 2, "expected two custom habits in pinned slots");
  assert.equal(random.length, EXPECTED_RANDOM_COUNT, `expected exactly ${EXPECTED_RANDOM_COUNT} random quests`);
});

test("POST /api/shop/replace-pinned-quests allows free swap after 21 days, otherwise requires 7 tokens", async () => {
  const username = `pin21_${Date.now().toString().slice(-6)}`;

  const upsertResponse = await fetch(`${baseUrl}/api/profiles/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: "Pinned 21d Tester" })
  });
  assert.equal(upsertResponse.status, 200);

  await prisma.user.update({
    where: { username },
    data: {
      preferredQuestIds: "1,2,3",
      tokens: 0,
      lastFreeTaskRerollAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    }
  });

  const blockedResponse = await fetch(`${baseUrl}/api/shop/replace-pinned-quests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, preferredQuestIds: [4, 5, 6], useTokens: false })
  });
  assert.equal(blockedResponse.status, 400);
  const blockedPayload = await blockedResponse.json();
  assert.equal(blockedPayload?.error, "Not enough tokens");

  await prisma.user.update({
    where: { username },
    data: {
      preferredQuestIds: "1,2,3",
      tokens: 0,
      lastFreeTaskRerollAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000)
    }
  });

  const freeResponse = await fetch(`${baseUrl}/api/shop/replace-pinned-quests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, preferredQuestIds: [4, 5, 6], useTokens: false })
  });
  assert.equal(freeResponse.status, 200);
  const freePayload = await freeResponse.json();
  assert.equal(freePayload?.tokens, 0);
  assert.deepEqual(freePayload?.preferredQuestIds, [4, 5, 6]);
  assert.ok(freePayload?.lastFreeTaskRerollAt, "expected lastFreeTaskRerollAt to be refreshed after free swap");
});

test("GET /api/quests generates variable effort distributions for random quests (50+30+10, 50+20+20, 40+30+20, 30+30+30)", async () => {
  const pinnedIds = Array.from({ length: PINNED_COUNT }, (_, index) => index + 1).join(",");
  const date = "2026-04-15T00:00:00.000Z";
  const combinations = new Set();

  // Generate quests for 100 different usernames to see the variety of effort distributions
  for (let i = 0; i < 100; i += 1) {
    const username = `effort_var_${i}`;
    const response = await fetch(`${baseUrl}/api/quests?username=${encodeURIComponent(username)}&pinnedQuestIds=${pinnedIds}&date=${date}`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    const randomQuests = payload.quests.slice(PINNED_COUNT, PINNED_COUNT + EXPECTED_OTHER_COUNT);
    
    if (randomQuests.length === EXPECTED_OTHER_COUNT) {
      const totalXp = randomQuests.reduce((sum, quest) => sum + Number(quest?.xp || 0), 0);
      const effortSum = randomQuests.reduce((sum, quest) => sum + Number(quest?.effortScore || 0), 0);
      const sortedXp = randomQuests.map((q) => Number(q?.xp || 0)).sort((a, b) => b - a).join("+");
      combinations.add(sortedXp);
    }
  }

  // Verify that we have multiple different distributions (not just 50+30+10)
  assert.ok(combinations.size > 1, `expected multiple effort distributions, but only found: ${Array.from(combinations).join(", ")}`);
  
  // Verify that all combinations sum to 90 (effort 9 total)
  for (const combo of combinations) {
    const parts = combo.split("+").map((x) => Number(x));
    const sum = parts.reduce((a, b) => a + b, 0);
    assert.equal(sum, 90, `expected total XP of 90 for combination ${combo}, got ${sum}`);
  }
});
