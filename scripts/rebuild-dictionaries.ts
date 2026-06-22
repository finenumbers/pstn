import {
  rebuildDictionaries,
  refreshDatasetGlobalStats,
} from "@/packages/import/csvLoader";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  await rebuildDictionaries();
  const stats = await refreshDatasetGlobalStats();

  console.log("Dictionaries rebuilt successfully");
  console.log(
    `dataset_meta: ${stats.totalRows} ranges, ${stats.uniqueOperators} operators, capacity ${stats.totalCapacity}`
  );
}

main().catch((error) => {
  console.error("Rebuild failed:", error);
  process.exit(1);
});
