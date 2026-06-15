import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.person.count();
  if (count > 0) {
    console.log(`[seed] ${count} people already exist — skipping.`);
    return;
  }

  // A simple two-adult household to start. Rename these in the app later.
  await prisma.person.createMany({
    data: [
      { name: "Mom", color: "#ff5c8a", isAdult: true },
      { name: "Dad", color: "#7c4dff", isAdult: true },
    ],
  });
  console.log("[seed] created Mom and Dad. Edit names/phones in Settings.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
