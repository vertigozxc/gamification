import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (!process.argv.includes("--confirm")) {
  console.error("Safety check: pass --confirm to execute this destructive operation.");
  console.error("  node resetAllProgress.js --confirm");
  process.exit(1);
}

async function main() {
  const now = new Date();

  const [deletedCompletions, deletedScores, result] = await prisma.$transaction([
    prisma.questCompletion.deleteMany({}),
    prisma.dailyScore.deleteMany({}),
    prisma.user.updateMany({
      data: {
        preferredQuestIds: "",
        level: 1,
        xp: 0,
        xpNext: 300,
        strPoints: 0,
        intPoints: 0,
        staPoints: 0,
        streak: 0,
        tokens: 0,
        currentPI: null,
        currentTier: "IRON",
        weeksInCurrentTier: 0,
        rankLevel: 1,
        lastTierWeekKey: "",
        lastStreakIncreaseAt: null,
        streakFreezeExpiresAt: null,
        lastFreeTaskRerollAt: null,
        lastDailyResetAt: now
      }
    })
  ]);

  console.log("Deleted quest completions:", deletedCompletions.count);
  console.log("Deleted daily scores:", deletedScores.count);
  console.log("Reset progress for users:", result.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

