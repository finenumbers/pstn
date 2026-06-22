export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverStaleImportJobs } = await import(
      "@/packages/import/recoverStaleImportJobs"
    );
    const recovered = await recoverStaleImportJobs();
    if (recovered > 0) {
      console.warn(
        `Recovered ${recovered} stale import job(s) after server start`
      );
    }
  }
}
