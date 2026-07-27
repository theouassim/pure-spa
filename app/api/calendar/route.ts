import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const location = searchParams.get("location");

  if (!title || !start || !end) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const formatICSDate = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pure SPA Institut//Booking//FR",
    "BEGIN:VEVENT",
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location || "Pure SPA Institut, 36 Rue Aristide Briand, 69800 Saint Priest"}`,
    `DESCRIPTION:Rendez-vous chez Pure SPA Institut. Merci de vous présenter 5 minutes avant l'heure.`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rdv-pure-spa.ics"`,
    },
  });
}
