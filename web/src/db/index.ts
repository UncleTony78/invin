import "server-only";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * With DATABASE_URL (production, e.g. Neon's pooled connection string) InVin talks to that Postgres.
 * Without it, local development uses PGlite (Postgres in-process, stored in ~/.invin/pglite).
 * Same schema, same queries, transactions included.
 */
/* Kept outside the project: synced folders (OneDrive, Dropbox) lock files mid-write and corrupt the database. */
export const PGLITE_DIR = process.env.PGLITE_DIR ?? join(homedir(), ".invin", "pglite");

function local() {
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  return drizzlePglite(client, { schema });
}

type Db = ReturnType<typeof local>;

function create(): Db {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return local();
  // Serverless: a few connections per instance; the provider's pooler does the rest
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
  return drizzlePg(pool, { schema }) as unknown as Db;
}
const g = globalThis as unknown as { __invinDb?: Db };
const real = () => (g.__invinDb ??= create());

/** Connects on first query (not at import), so `next build` workers never open the database. */
export const db = new Proxy({} as Db, {
  get(_, prop) {
    const d = real();
    const v = Reflect.get(d, prop, d);
    return typeof v === "function" ? v.bind(d) : v;
  },
});
export { schema };
