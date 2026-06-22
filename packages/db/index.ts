import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const DEFAULT_API_POOL_MAX = 10;
const DEFAULT_IMPORT_POOL_MAX = 4;

let apiPool: pg.Pool | null = null;
let importPoolInstance: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let importDbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function parsePoolMax(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return connectionString;
}

function createPool(max: number): pg.Pool {
  return new pg.Pool({
    connectionString: getConnectionString(),
    max,
  });
}

function getApiPool(): pg.Pool {
  if (!apiPool) {
    apiPool = createPool(parsePoolMax("DB_POOL_MAX", DEFAULT_API_POOL_MAX));
  }
  return apiPool;
}

export function importPool(): pg.Pool {
  if (!importPoolInstance) {
    importPoolInstance = createPool(
      parsePoolMax("DB_IMPORT_POOL_MAX", DEFAULT_IMPORT_POOL_MAX)
    );
  }
  return importPoolInstance;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getApiPool(), { schema });
  }
  return dbInstance;
}

export function getImportDb() {
  if (!importDbInstance) {
    importDbInstance = drizzle(importPool(), { schema });
  }
  return importDbInstance;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export const importDb = new Proxy({} as ReturnType<typeof getImportDb>, {
  get(_target, prop) {
    return Reflect.get(getImportDb(), prop);
  },
});

/** Primary pool for API routes and read queries. */
export { getApiPool as pool };
