import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function requireOwner(): Promise<{ userId: string } | NextResponse> {
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
    return NextResponse.json({ error: "Seul un owner peut effectuer cette action." }, { status: 403 });
  }

  return { userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ownerOrError = await requireOwner();
  if (ownerOrError instanceof NextResponse) return ownerOrError;

  const { id } = await params;
  const { role } = await request.json();

  if (!role || !["owner", "membre"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("admin_users")
    .select("user_id, role")
    .eq("id", id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  }

  // Garde-fou : empêcher de rétrograder le dernier owner
  if (target.role === "owner" && role === "membre") {
    const { count } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Impossible : il doit rester au moins un owner." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({ role })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ownerOrError = await requireOwner();
  if (ownerOrError instanceof NextResponse) return ownerOrError;

  const { id } = await params;

  const { data: target } = await supabaseAdmin
    .from("admin_users")
    .select("user_id, role")
    .eq("id", id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  }

  // Garde-fou : empêcher de supprimer le dernier owner
  if (target.role === "owner") {
    const { count } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Impossible : il doit rester au moins un owner." },
        { status: 400 }
      );
    }
  }

  // Soft revoke (garde l'historique)
  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({ status: "revoked" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
