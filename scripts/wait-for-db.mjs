import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const maxAttempts = 30;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    process.exit(0);
  } catch {
    try {
      await client.end();
    } catch {
      // ignore
    }
    if (attempt === maxAttempts) {
      console.error("PostgreSQL is not ready");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
