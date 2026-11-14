import { runDueWork } from "@/server/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Production scheduler entry: Vercel Cron (or any cron service) calls this with the shared secret. Vercel sends it automatically when CRON_SECRET is set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  return Response.json(await runDueWork());
}
