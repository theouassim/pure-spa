import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { serviceId, start } = body;

  if (!serviceId || !start) {
    return NextResponse.json(
      { error: "serviceId et start requis" },
      { status: 400 }
    );
  }

  const slotStart = new Date(start);
  if (isNaN(slotStart.getTime())) {
    return NextResponse.json({ error: "start invalide" }, { status: 400 });
  }

  const slots = await getAvailableSlots(serviceId, slotStart);
  const stillAvailable = slots.some(
    (s) => s.start.getTime() === slotStart.getTime()
  );

  return NextResponse.json({ available: stillAvailable });
}
