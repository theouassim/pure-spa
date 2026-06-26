import { NextRequest, NextResponse } from "next/server";
import { syncAllSalles } from "@/lib/planity-sync";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllSalles();

  return NextResponse.json({
    ok: true,
    synced_at: new Date().toISOString(),
    results,
  });
}
