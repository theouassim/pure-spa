import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireOwner(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!data || data.role !== "owner") {
    return NextResponse.json({ error: "Accès réservé aux owners." }, { status: 403 });
  }

  return { userId: user.id };
}
