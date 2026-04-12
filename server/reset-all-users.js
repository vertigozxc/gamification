import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all quest completions...');
  const completions = await prisma.questCompletion.deleteMany({});
  console.log(`Deleted ${completions.count} quest completions.`);

  console.log('Deleting all daily scores...');
  const scores = await prisma.dailyScore.deleteMany({});
  console.log(`Deleted ${scores.count} daily scores.`);

  console.log('Resetting all user progress and onboarding...');
  const now = new Date();
  const users = await prisma.user.updateMany({
    data: {
      preferredQuestIds: '',
      level: 1,
      xp: 0,
      xpNext: 300,
      strPoints: 0,
      intPoints: 0,
      staPoints: 0,
      streak: 0,
      tokens: 0,
      currentPI: null,
      currentTier: 'IRON',
      weeksInCurrentTier: 0,
      rankLevel: 1,
      lastTierWeekKey: '',
      lastStreakIncreaseAt: null,
      streakFreezeExpiresAt: null,
      lastFreeTaskRerollAt: null,
      lastDailyResetAt: now,
    }
  });
  console.log(`Reset progress for ${users.count} users.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
