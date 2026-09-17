import { supabaseAdmin } from "@/lib/supabase-admin";

export interface CategoryRow {
  nom: string;
  ouverte_par_defaut: boolean;
  position: number;
}

/**
 * Renvoie la config d'affichage des catégories utilisées par au moins un service actif.
 * Les catégories créées depuis le catalogue et absentes de service_categories
 * y sont ajoutées en fin de liste (fermées par défaut).
 * Les catégories sans service actif restent en base (ordre conservé) mais ne sont pas renvoyées.
 */
export async function syncServiceCategories(): Promise<CategoryRow[]> {
  const [servicesRes, categoriesRes] = await Promise.all([
    supabaseAdmin.from("services").select("categorie").eq("actif", true),
    supabaseAdmin
      .from("service_categories")
      .select("nom, ouverte_par_defaut, position")
      .order("position"),
  ]);

  if (servicesRes.error) throw new Error(servicesRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  const used = new Set(
    (servicesRes.data ?? []).map((s) => (s.categorie ?? "").trim()).filter(Boolean)
  );
  const existing = categoriesRes.data ?? [];
  const known = new Set(existing.map((c) => c.nom));

  let nextPosition = existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
  const missing: CategoryRow[] = [...used]
    .filter((nom) => !known.has(nom))
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((nom) => ({ nom, ouverte_par_defaut: false, position: nextPosition++ }));

  if (missing.length > 0) {
    const { error } = await supabaseAdmin
      .from("service_categories")
      .upsert(missing, { onConflict: "nom", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return [...existing, ...missing].filter((c) => used.has(c.nom));
}
