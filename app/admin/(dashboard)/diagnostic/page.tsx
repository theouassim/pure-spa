import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DiagnosticClient } from "./diagnostic-client";

export default async function AdminDiagnosticPage() {
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

  return <DiagnosticClient />;
}
