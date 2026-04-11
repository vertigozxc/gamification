import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.user.updateMany({
    data: { preferredQuestIds: "" }
  });
  console.log("Updated users:", result.count);
}
main().finally(() => prisma.$disconnect());
