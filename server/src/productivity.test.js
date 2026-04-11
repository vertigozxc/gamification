import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDailyScore,
  calculatePI,
  calculateRank,
  getTier
} from "./productivity.js";

test("calculateDailyScore follows formula exactly", () => {
  const score = calculateDailyScore(200, 4, 8);
  assert.equal(score, 100);

  const lowScore = calculateDailyScore(120, 2, 3);
  assert.equal(lowScore, 33.15);
});

test("calculatePI returns null until 3 days and computes weighted PI", () => {
  assert.equal(calculatePI([10, 20], 20), null);

  const pi = calculatePI([50, 60, 70, 80], 80);
  assert.equal(pi, 69.5);
});

test("getTier maps PI ranges correctly", () => {
  assert.equal(getTier(0), "IRON");
  assert.equal(getTier(40), "BRONZE");
  assert.equal(getTier(55), "SILVER");
  assert.equal(getTier(70), "GOLD");
  assert.equal(getTier(80), "PLATINUM");
  assert.equal(getTier(90), "DIAMOND");
});

test("calculateRank applies tier week requirements and clamping", () => {
  const diamondWeek5 = calculateRank("DIAMOND", 5);
  assert.equal(diamondWeek5.rankLevel, 1);

  const diamondWeek25 = calculateRank("DIAMOND", 25);
  assert.equal(diamondWeek25.rankLevel, 5);

  const ironWeek0 = calculateRank("IRON", 0);
  assert.equal(ironWeek0.rankLevel, 1);
});
