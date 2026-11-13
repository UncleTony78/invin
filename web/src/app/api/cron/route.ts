import { runDueWork } from "@/server/automation";

export const dynamic = "force-dynamic";

/** Production scheduler entry: a platform cron calls this every few minutes with the shared secret. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  return Response.json(await runDueWork());
}
