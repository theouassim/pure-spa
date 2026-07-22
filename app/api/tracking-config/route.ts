import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("tracking_connectors")
    .select("connector_type, connector_id, enabled")
    .eq("enabled", true);

  const config = {
    ga4_measurement_id: null as string | null,
    ga4_enabled: false,
    gtm_container_id: null as string | null,
    gtm_enabled: false,
    meta_pixel_id: null as string | null,
    meta_pixel_enabled: false,
  };

  if (data) {
    for (const row of data) {
      if (row.connector_type === "ga4") {
        config.ga4_measurement_id = row.connector_id;
        config.ga4_enabled = true;
      } else if (row.connector_type === "gtm") {
        config.gtm_container_id = row.connector_id;
        config.gtm_enabled = true;
      } else if (row.connector_type === "meta_pixel") {
        config.meta_pixel_id = row.connector_id;
        config.meta_pixel_enabled = true;
      }
    }
  }

  return NextResponse.json(
    { config },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
