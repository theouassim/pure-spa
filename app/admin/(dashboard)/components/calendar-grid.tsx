"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, Filter, AlertTriangle } from "lucide-react";
import { toZonedTime } from "date-fns-tz";
import type { CalendarEvent } from "@/app/api/admin/events/route";
import { EventDetailModal } from "./event-detail-modal";

const TZ = "Europe/Paris";
const JOUR_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface CalendarGridProps {
  joursOuverts: number[];
  horaires: { jour: number; ouverture: string; fermeture: string }[];
  nbRessources: number;
}

type SourceFilter = "all" | "booking" | "external";
type SalleFilter = "all" | "salle_1" | "salle_2";

export function CalendarGrid({ joursOuverts, horaires, nbRessources }: CalendarGridProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [salleFilter, setSalleFilter] = useState<SalleFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 24 * 3600_000).toISOString();
    try {
      const res = await fetch(`/api/admin/events?from=${from}&to=${to}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((e) => {
    if (sourceFilter === "booking" && e.type !== "booking") return false;
    if (sourceFilter === "external" && e.type !== "external") return false;
    if (salleFilter !== "all" && e.type === "external" && e.salle !== salleFilter) return false;
    return true;
  });

  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 24 * 3600_000);
    return { date: d, isoDay: i === 6 ? 7 : i + 1 };
  }).filter((d) => joursOuverts.includes(d.isoDay));

  const amplitude = getAmplitude(horaires, joursOuverts);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 3600_000);

  return (
    <div className="space-y-4">
      {/* Header: navigation + filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(prev => new Date(prev.getTime() - 7 * 24 * 3600_000))}
            className="rounded-md border border-border p-1.5 hover:bg-accent-light"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent-light"
          >
            <Calendar size={14} />
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => setWeekStart(prev => new Date(prev.getTime() + 7 * 24 * 3600_000))}
            className="rounded-md border border-border p-1.5 hover:bg-accent-light"
          >
            <ChevronRight size={18} />
          </button>
          <span className="ml-2 text-sm font-medium text-text">
            {formatDateRange(weekStart, weekEnd)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="rounded-md border border-border bg-bg-card px-2 py-1 text-xs"
          >
            <option value="all">Tous</option>
            <option value="booking">Site</option>
            <option value="external">Planity</option>
          </select>
          <select
            value={salleFilter}
            onChange={(e) => setSalleFilter(e.target.value as SalleFilter)}
            className="rounded-md border border-border bg-bg-card px-2 py-1 text-xs"
          >
            <option value="all">Toutes salles</option>
            <option value="salle_1">Salle 1</option>
            <option value="salle_2">Salle 2</option>
          </select>
        </div>
      </div>

      {/* Grille calendrier */}
      <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            Chargement...
          </div>
        )}
        {!loading && (
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${daysOfWeek.length}, 1fr)` }}>
            {/* En-tête jours */}
            <div className="border-b border-r border-border" />
            {daysOfWeek.map(({ date, isoDay }) => (
              <div
                key={isoDay}
                className="border-b border-r border-border px-2 py-2 text-center text-xs font-medium text-text-muted last:border-r-0"
              >
                <div>{JOUR_LABELS[isoDay - 1]}</div>
                <div className="text-sm font-semibold text-text">
                  {date.getDate()}
                </div>
              </div>
            ))}

            {/* Corps : heures + colonnes */}
            <div className="border-r border-border">
              {amplitude.hours.map((hour) => (
                <div
                  key={hour}
                  className="flex h-16 items-start justify-end border-b border-border pr-2 text-[10px] text-text-muted"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {daysOfWeek.map(({ date, isoDay }) => {
              const dayEvents = getEventsForDay(filteredEvents, date);
              const positioned = positionEvents(dayEvents, nbRessources);
              return (
                <div
                  key={isoDay}
                  className="relative border-r border-border last:border-r-0"
                  style={{ height: `${amplitude.hours.length * 64}px` }}
                >
                  {/* Lignes horaires */}
                  {amplitude.hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-b border-border/50"
                      style={{ top: `${(hour - amplitude.startHour) * 64}px`, height: 64 }}
                    />
                  ))}
                  {/* Events */}
                  {positioned.map((pe) => (
                    <EventBlock
                      key={pe.event.id}
                      event={pe.event}
                      top={getTopPx(pe.event, amplitude)}
                      height={getHeightPx(pe.event, amplitude)}
                      left={pe.left}
                      width={pe.width}
                      overbooking={pe.overbooking}
                      onClick={pe.event.type === "booking" ? () => setSelectedEvent(pe.event) : undefined}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

// ======================
// Event block component
// ======================

interface EventBlockProps {
  event: CalendarEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  overbooking: boolean;
  onClick?: () => void;
}

function EventBlock({ event, top, height, left, width, overbooking, onClick }: EventBlockProps) {
  const isBooking = event.type === "booking";
  const baseClasses = "absolute overflow-hidden rounded px-1.5 py-0.5 text-[10px] leading-tight transition-opacity";

  const verif = isBooking && event.verificationRequise;
  const style = verif
    ? "bg-amber-100 text-amber-800 border border-amber-400"
    : isBooking
      ? "bg-primary/90 text-white border border-primary-dark"
      : "bg-accent-light/70 text-text-muted border border-border";

  const overbookingStyle = overbooking ? "ring-2 ring-error/60" : "";
  const cursorStyle = isBooking ? "cursor-pointer hover:opacity-80" : "";

  return (
    <div
      className={`${baseClasses} ${style} ${overbookingStyle} ${cursorStyle}`}
      style={{ top: `${top}px`, height: `${Math.max(height, 18)}px`, left, width }}
      onClick={onClick}
    >
      <div className="truncate font-medium flex items-center gap-0.5">
        {verif && <AlertTriangle size={9} className="shrink-0" />}
        {event.label}
      </div>
      {isBooking && event.clientNom && (
        <div className="truncate opacity-80">{event.clientNom}</div>
      )}
      {!isBooking && event.salle && (
        <div className="mt-0.5 inline-block rounded bg-border/60 px-1 text-[9px]">
          {event.salle === "salle_1" ? "Salle 1" : "Salle 2"}
        </div>
      )}
    </div>
  );
}

// ======================
// Positioning logic
// ======================

interface PositionedEvent {
  event: CalendarEvent;
  left: string;
  width: string;
  overbooking: boolean;
}

function positionEvents(events: CalendarEvent[], nbRessources: number): PositionedEvent[] {
  if (events.length === 0) return [];

  const result: PositionedEvent[] = [];

  // Sort by start then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (diff !== 0) return diff;
    const durA = new Date(a.end).getTime() - new Date(a.start).getTime();
    const durB = new Date(b.end).getTime() - new Date(b.start).getTime();
    return durB - durA;
  });

  // For each event, find max simultaneous overlaps DURING its own duration
  const columns: { event: CalendarEvent; col: number }[] = [];

  for (const evt of sorted) {
    const evtStart = new Date(evt.start).getTime();
    const evtEnd = new Date(evt.end).getTime();

    // Find overlapping already-placed events
    const overlapping = columns.filter((placed) => {
      const pStart = new Date(placed.event.start).getTime();
      const pEnd = new Date(placed.event.end).getTime();
      return pStart < evtEnd && evtStart < pEnd;
    });

    // Find first free column
    const usedCols = new Set(overlapping.map((o) => o.col));
    let col = 0;
    while (usedCols.has(col)) col++;

    columns.push({ event: evt, col });
  }

  // Second pass: for each event, compute totalColumns = max overlaps during its duration
  for (const { event: evt, col } of columns) {
    const evtStart = new Date(evt.start).getTime();
    const evtEnd = new Date(evt.end).getTime();

    const overlapping = columns.filter((placed) => {
      const pStart = new Date(placed.event.start).getTime();
      const pEnd = new Date(placed.event.end).getTime();
      return pStart < evtEnd && evtStart < pEnd;
    });

    const totalColumns = Math.max(...overlapping.map((o) => o.col)) + 1;
    const overbooking = col >= nbRessources;
    const widthPct = 100 / totalColumns;

    result.push({
      event: evt,
      left: `${col * widthPct}%`,
      width: `${widthPct}%`,
      overbooking,
    });
  }

  return result;
}

// ======================
// Time helpers
// ======================

function getMonday(date: Date): Date {
  const d = toZonedTime(date, TZ);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getAmplitude(horaires: { jour: number; ouverture: string; fermeture: string }[], joursOuverts: number[]) {
  let earliest = 24;
  let latest = 0;
  for (const h of horaires) {
    if (!joursOuverts.includes(h.jour)) continue;
    const open = parseInt(h.ouverture.split(":")[0]);
    const close = parseInt(h.fermeture.split(":")[0]) + (parseInt(h.fermeture.split(":")[1]) > 0 ? 1 : 0);
    if (open < earliest) earliest = open;
    if (close > latest) latest = close;
  }
  const hours = Array.from({ length: latest - earliest }, (_, i) => earliest + i);
  return { startHour: earliest, endHour: latest, hours };
}

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 24 * 3600_000;
  return events.filter((e) => {
    const paris = toZonedTime(new Date(e.start), TZ);
    const t = new Date(paris.getFullYear(), paris.getMonth(), paris.getDate()).getTime();
    return t >= dayStart && t < dayEnd;
  });
}

function getTopPx(event: CalendarEvent, amplitude: { startHour: number }): number {
  const paris = toZonedTime(new Date(event.start), TZ);
  const minutesSinceOpen = (paris.getHours() - amplitude.startHour) * 60 + paris.getMinutes();
  return (minutesSinceOpen / 60) * 64;
}

function getHeightPx(event: CalendarEvent, amplitude: { startHour: number; endHour: number }): number {
  const start = toZonedTime(new Date(event.start), TZ);
  const end = toZonedTime(new Date(event.end), TZ);
  const durationMin = (end.getTime() - start.getTime()) / 60_000;
  return (durationMin / 60) * 64;
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: TZ };
  const startStr = start.toLocaleDateString("fr-FR", { day: "numeric", timeZone: TZ });
  const endStr = end.toLocaleDateString("fr-FR", opts);
  const year = end.toLocaleDateString("fr-FR", { year: "numeric", timeZone: TZ });
  return `${startStr} – ${endStr} ${year}`;
}
