import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("service_categories")
    .select("nom, ouverte_par_defaut, position")
    .order("position");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.nom || typeof body.nom !== "string" || !body.nom.trim()) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("service_categories")
    .upsert(
      {
        nom: body.nom.trim(),
        ouverte_par_defaut: body.ouverte_par_defaut ?? false,
        position: body.position ?? 0,
      },
      { onConflict: "nom" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!Array.isArray(body.categories)) {
    return NextResponse.json({ error: "categories[] requis." }, { status: 400 });
  }

  for (const cat of body.categories) {
    const { error } = await supabaseAdmin
      .from("service_categories")
      .upsert(
        {
          nom: cat.nom,
          ouverte_par_defaut: cat.ouverte_par_defaut ?? false,
          position: cat.position ?? 0,
        },
        { onConflict: "nom" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
