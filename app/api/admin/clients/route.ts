import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ clients: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, nom, email, telephone")
    .or(`nom.ilike.%${q}%,email.ilike.%${q}%,telephone.ilike.%${q}%`)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, nom, email, telephone } = body;

  if (!id) {
    return NextResponse.json({ error: "ID client requis" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (nom !== undefined) updates.nom = nom;
  if (email !== undefined) updates.email = email;
  if (telephone !== undefined) updates.telephone = telephone;

  const { error } = await supabaseAdmin
    .from("clients")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
