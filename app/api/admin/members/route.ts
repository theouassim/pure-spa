import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function getCurrentUserRole(): Promise<{ userId: string; role: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!data) return null;
  return { userId: user.id, role: data.role };
}

export async function GET() {
  const current = await getCurrentUserRole();
  if (!current) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, user_id, email, role, status, created_at")
    .neq("status", "revoked")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    members: data ?? [],
    currentRole: current.role,
    currentUserId: current.userId,
  });
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUserRole();
  if (!current || current.role !== "owner") {
    return NextResponse.json({ error: "Seul un owner peut inviter des membres." }, { status: 403 });
  }

  const { email, role } = await request.json();

  if (!email || !role || !["owner", "membre"].includes(role)) {
    return NextResponse.json({ error: "Email et rôle requis (owner | membre)." }, { status: 400 });
  }

  const { data: existingMember } = await supabaseAdmin
    .from("admin_users")
    .select("id, status")
    .eq("email", email)
    .single();

  if (existingMember && existingMember.status !== "revoked") {
    return NextResponse.json({ error: "Ce membre existe déjà." }, { status: 409 });
  }

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const userId = inviteData.user.id;

  if (existingMember && existingMember.status === "revoked") {
    await supabaseAdmin
      .from("admin_users")
      .update({ role, status: "invited", user_id: userId })
      .eq("id", existingMember.id);
  } else {
    await supabaseAdmin
      .from("admin_users")
      .insert({ user_id: userId, email, role, status: "invited" });
  }

  return NextResponse.json({ success: true });
}
