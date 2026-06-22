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

    const { ensureOprRegisterLoaded } = await import(
      "@/packages/import/importOprRegister"
    );
    const { refreshUvrAntifraudBinding } = await import(
      "@/packages/db/queries/refreshUvrAntifraudBinding"
    );

    await ensureOprRegisterLoaded();
    const binding = await refreshUvrAntifraudBinding();

    if (binding.registryOperators === 0) {
      console.warn(
        "operators_register is empty — column «УВр Антифraud» will stay blank (bundled OPR file missing?)"
      );
    } else {
      console.warn(
        `UVR binding: ${binding.registryOperators} OPR operators, ${binding.matchedDistinctInns} matched INNs`
      );
    }
  }
}
