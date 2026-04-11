import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.xpNext <= 250) {
      await prisma.user.update({
        where: { id: user.id },
        data: { xpNext: user.xpNext * 3 }
      });
      console.log('Migrated user:', user.username);
    }
  }
}
main().catch(console.error).finally(()=> prisma.$disconnect());
