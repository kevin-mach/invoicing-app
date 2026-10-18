import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBank } from "@/lib/integrations/bank";
import { syncSquare } from "@/lib/integrations/square";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily read-only pulls (bank lines, POS sales). Nothing is ever sent to an accounting system or
 * HMRC from here — those need a person to review and confirm. */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("integration_connections")
    .select("org_id, provider")
    .in("provider", ["truelayer", "square"])
    .eq("status", "connected");

  let ok = 0;
  let failed = 0;
  for (const c of connections ?? []) {
    try {
      if (c.provider === "truelayer") await syncBank(c.org_id);
      else await syncSquare(c.org_id);
      ok++;
    } catch {
      failed++; // already recorded against the connection and its sync log
    }
  }
  return NextResponse.json({ ok, failed });
}
