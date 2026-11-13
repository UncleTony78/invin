import "server-only";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Local development uses PGlite (Postgres in-process, stored in ~/.invin/pglite).
 * Production will point DATABASE_URL at Neon and swap this for drizzle-orm/neon-http;
 * the schema and queries stay the same.
 */
/* Kept outside the project: synced folders (OneDrive, Dropbox) lock files mid-write and corrupt the database. */
export const PGLITE_DIR = process.env.PGLITE_DIR ?? join(homedir(), ".invin", "pglite");

function create() {
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  return drizzlePglite(client, { schema });
}

type Db = ReturnType<typeof create>;
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
