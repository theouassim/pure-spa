import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability-service";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const serviceId = searchParams.get("serviceId");
  const dateStr = searchParams.get("date");

  if (!serviceId || !dateStr) {
    return NextResponse.json(
      { error: "serviceId et date requis" },
      { status: 400 }
    );
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "date invalide" }, { status: 400 });
  }

  const slots = await getAvailableSlots(serviceId, date);

  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });
}
