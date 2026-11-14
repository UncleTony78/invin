/* Apply database migrations (drizzle/*.sql). `npm run db:migrate`.
   With DATABASE_URL: the hosted Postgres (run on every deploy, before the build).
   Without it: the local PGlite database (stop `npm run dev` first). Never adds or removes data. */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // Migrations need a direct connection when the provider offers one (Neon: DATABASE_URL_UNPOOLED)
    const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED?.trim() || url, max: 1 });
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await pool.end();
    console.log("[invin] database is up to date");
    return;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? join(homedir(), ".invin", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.close();
  console.log("[invin] local database is up to date");
}

main().catch((e) => {
  console.error("[invin] migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
