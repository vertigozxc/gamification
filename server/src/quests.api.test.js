import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "./index.js";
import { getDailyQuestCount, getPreferredQuestCount } from "./quests.js";

const DAILY_QUEST_COUNT = getDailyQuestCount();
const PINNED_COUNT = getPreferredQuestCount();
const EXPECTED_OTHER_COUNT = Math.max(0, Math.min(4, DAILY_QUEST_COUNT - PINNED_COUNT));

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

test("GET /api/quests/all localizes the last three discipline quests", async () => {
  const [ruResponse, enResponse] = await Promise.all([
    fetch(`${baseUrl}/api/quests/all?lang=ru`),
    fetch(`${baseUrl}/api/quests/all?lang=en`)
  ]);

  assert.equal(ruResponse.status, 200);
  assert.equal(enResponse.status, 200);

  const ruPayload = await ruResponse.json();
  const enPayload = await enResponse.json();

  const ruNoJunkFood = ruPayload.quests.find((quest) => quest.sourceId === "quest_110");
  const ruNoAlcohol = ruPayload.quests.find((quest) => quest.sourceId === "quest_111");
  const ruNoNicotine = ruPayload.quests.find((quest) => quest.sourceId === "quest_112");
  const ruLongMarch = ruPayload.quests.find((quest) => quest.sourceId === "quest_003");
  const enNoJunkFood = enPayload.quests.find((quest) => quest.sourceId === "quest_110");
  const enNoAlcohol = enPayload.quests.find((quest) => quest.sourceId === "quest_111");
  const enNoNicotine = enPayload.quests.find((quest) => quest.sourceId === "quest_112");
  const enLongMarch = enPayload.quests.find((quest) => quest.sourceId === "quest_003");

  assert.equal(ruLongMarch?.title, "Долгий марш");
  assert.equal(ruLongMarch?.description, "Пройди 10 000 шагов сегодня");

  assert.equal(ruNoJunkFood?.title, "Без вредной еды");
  assert.equal(ruNoJunkFood?.description, "Не ешь вредную еду (пиццу, бургеры, чипсы и другую нездоровую пищу)");
  assert.equal(ruNoAlcohol?.title, "Без алкоголя");
  assert.equal(ruNoAlcohol?.description, "Не употребляй алкоголь");
  assert.equal(ruNoNicotine?.title, "Без никотина");
  assert.equal(ruNoNicotine?.description, "Без никотина - не кури");

  assert.equal(enNoJunkFood?.title, "No Junk Food");
  assert.equal(enNoJunkFood?.description, "Do not eat junk food (pizza, burgers, chips, or other unhealthy foods)");
  assert.equal(enNoAlcohol?.title, "No Alcohol");
  assert.equal(enNoAlcohol?.description, "Do not drink alcohol");
  assert.equal(enNoNicotine?.title, "No Nicotine");
  assert.equal(enNoNicotine?.description, "No nicotine - do not smoke");
  assert.equal(enLongMarch?.title, "Long March");
  assert.equal(enLongMarch?.description, "Walk 10,000 steps");
});
