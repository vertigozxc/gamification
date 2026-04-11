import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.user.updateMany({ data: { preferredQuestIds: '' } });
  console.log(`Reset onboarding for ${result.count} users.`);
}
main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  });
