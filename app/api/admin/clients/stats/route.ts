import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "";
  const sortBy = searchParams.get("sort") || "dernier_rdv";
  const sortDir = searchParams.get("dir") || "desc";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const { data, error } = await supabaseAdmin.rpc("get_clients_with_stats", {
    search_query: q || null,
    sort_by: sortBy,
    sort_dir: sortDir,
    page_limit: limit,
    page_offset: offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}
