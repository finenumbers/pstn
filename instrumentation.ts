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

    const { refreshUvrAntifraudBinding } = await import(
      "@/packages/db/queries/refreshUvrAntifraudBinding"
    );
    const { tryImportOprFromEnvPath } = await import(
      "@/packages/import/importOprRegister"
    );

    let binding = await refreshUvrAntifraudBinding();
    if (binding.registryOperators === 0) {
      await tryImportOprFromEnvPath();
      binding = await refreshUvrAntifraudBinding();
    }

    if (binding.registryOperators === 0) {
      console.warn(
        "operators_register is empty — column «УВр Антифraud» will be blank until OPR CSV is loaded (see docs/operations.md)"
      );
    }
  }
}
