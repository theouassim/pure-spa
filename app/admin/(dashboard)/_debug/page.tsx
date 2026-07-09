import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DebugClient } from "./debug-client";

function isDebugAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG === "true";
}

export default async function AdminDebugPage() {
  if (!isDebugAllowed()) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!data || data.role !== "owner") {
    notFound();
  }

  return <DebugClient />;
}
