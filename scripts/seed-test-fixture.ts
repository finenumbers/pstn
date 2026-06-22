import { seedTestFixture } from "@/packages/db/seedTestFixture";

seedTestFixture()
  .then((count) => {
    console.log(`Seeded ${count} test fixture rows`);
  })
  .catch((error) => {
    console.error("Test fixture seed failed:", error);
    process.exit(1);
  });
