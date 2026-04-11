import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "./index.js";

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

test("GET /api/quests keeps categories unique in the 4 non-pinned slots", async () => {
  const response = await fetch(`${baseUrl}/api/quests?username=tester&pinnedQuestIds=1,2,3,4&date=2026-04-09T00:00:00.000Z`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.ok(Array.isArray(payload.quests), "quests array missing");
  assert.ok(payload.quests.length >= 8, "expected at least 8 daily quests");

  const otherQuests = payload.quests.slice(4, 8);
  assert.equal(otherQuests.length, 4, "expected exactly 4 non-pinned quests in slots 5-8");

  const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
  assert.equal(new Set(categories).size, categories.length, "non-pinned slots must have unique categories");
});

test("GET /api/quests maintains unique categories across 50 different usernames", async () => {
  let failCount = 0;
  const tests = [];

  for (let i = 0; i < 50; i += 1) {
    const username = `user_${i}`;
    const pinnedIds = [1, 2, 3, 4].join(",");
    const url = `${baseUrl}/api/quests?username=${encodeURIComponent(username)}&pinnedQuestIds=${pinnedIds}&date=2026-04-09T00:00:00.000Z`;

    tests.push(
      fetch(url)
        .then((res) => res.json())
        .then((payload) => {
          const otherQuests = payload.quests?.slice(4, 8) || [];
          if (otherQuests.length !== 4) {
            throw new Error(`expected 4 other quests, got ${otherQuests.length}`);
          }

          const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
          const uniqueCount = new Set(categories).size;
          if (uniqueCount !== 4) {
            failCount += 1;
            console.error(`username ${username}: found ${uniqueCount} unique categories instead of 4. Categories: ${categories.join(", ")}`);
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
    const pinnedIds = [1, 2, 3, 4].join(",");
    const url = `${baseUrl}/api/quests?username=tester&pinnedQuestIds=${pinnedIds}&resetSeed=${seed}&date=2026-04-09T00:00:00.000Z`;

    tests.push(
      fetch(url)
        .then((res) => res.json())
        .then((payload) => {
          const otherQuests = payload.quests?.slice(4, 8) || [];
          if (otherQuests.length !== 4) {
            throw new Error(`expected 4 other quests, got ${otherQuests.length}`);
          }

          const categories = otherQuests.map((quest) => String(quest?.category || "").toUpperCase());
          const uniqueCount = new Set(categories).size;
          if (uniqueCount !== 4) {
            failCount += 1;
            console.error(`seed ${seed}: found ${uniqueCount} unique categories instead of 4. Categories: ${categories.join(", ")}`);
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
  const initialResponse = await fetch(`${baseUrl}/api/quests?username=exclusion-tester&pinnedQuestIds=1,2,3,4&date=2026-04-09T00:00:00.000Z`);
  assert.equal(initialResponse.status, 200);

  const initialPayload = await initialResponse.json();
  const initialOtherQuests = initialPayload.quests?.slice(4, 8) || [];
  assert.equal(initialOtherQuests.length, 4, "expected 4 initial other quests");

  // Extract categories from initial other quests
  const initialCategories = initialOtherQuests.map((quest) => String(quest?.category || "").toUpperCase());
  assert.equal(new Set(initialCategories).size, 4, "initial quests must have unique categories");
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
  assert.ok(resetPayload.quests.length >= 8, "reset response must have at least 8 quests");

  // Verify that first 4 constrained rerolled quests do NOT have any categories from the exclusion list.
  const rerolledOtherQuests = resetPayload.quests.slice(0, 4);
  const rerolledCategories = rerolledOtherQuests.map((quest) => String(quest?.category || "").toUpperCase());

  const excludeSet = new Set([excludedCategory]);
  for (const category of rerolledCategories.slice(0, 4)) {
    // First 4 should not be in exclude list
    assert.equal(
      excludeSet.has(category),
      false,
      `rerolled quest category "${category}" should not be in exclusion list: ${Array.from(excludeSet).join(", ")}`
    );
  }

  // Verify rerolled other quests still maintain unique categories in first 4 slots
  const firstFourRerolled = rerolledCategories.slice(0, 4);
  assert.equal(
    new Set(firstFourRerolled).size,
    4,
    `first 4 rerolled other quests must have unique categories, got: ${firstFourRerolled.join(", ")}`
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
  assert.ok(payload.quests.length >= 8, "reroll should still return a full quest set even with exhaustive exclusions");

  const constrainedQuests = payload.quests.slice(0, 4);
  assert.equal(constrainedQuests.length, 4, "reroll should still provide 4 constrained quest slots");
});
