"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { track } from "@/lib/tracking";
import type { ServiceData, SlotData } from "./BookingFunnel";

interface Props {
  service: ServiceData;
  onSelect: (slot: SlotData) => void;
  onBack: () => void;
}

interface DaySlots {
  date: string;
  label: string;
  dayLabel: string;
  fullLabel: string;
  slots: SlotData[];
  loading: boolean;
}

const DAY_NAMES_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const DAY_NAMES_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatDayLabel(date: Date): string {
  return DAY_NAMES_SHORT[date.getDay()];
}

function formatFullDayLabel(date: Date): string {
  return `${DAY_NAMES_FULL[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function getWeekStart(reference: Date): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAYS_PER_BATCH = 7;

export function SlotPicker({ service, onSelect, onBack }: Props) {
  const [daysCount, setDaysCount] = useState(DAYS_PER_BATCH);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [daySlots, setDaySlots] = useState<DaySlots[]>([]);
  const [tracked, setTracked] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!tracked) {
      track("calendar_viewed", { service_id: service.id });
      setTracked(true);
    }
  }, [service.id, tracked]);

  const days = useMemo(() => {
    const result: { date: Date; dateStr: string; label: string; dayLabel: string; fullLabel: string }[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = addDays(weekStart, i);
      result.push({
        date: d,
        dateStr: toLocalDateStr(d),
        label: formatDateLabel(d),
        dayLabel: formatDayLabel(d),
        fullLabel: formatFullDayLabel(d),
      });
    }
    return result;
  }, [weekStart, daysCount]);

  const fetchSlotsForDay = useCallback(
    async (dateStr: string): Promise<SlotData[]> => {
      try {
        const res = await fetch(`/api/slots?serviceId=${service.id}&date=${dateStr}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.slots ?? [];
      } catch {
        return [];
      }
    },
    [service.id]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setDaySlots(
        days.map((d) => ({
          date: d.dateStr,
          label: d.label,
          dayLabel: d.dayLabel,
          fullLabel: d.fullLabel,
          slots: [],
          loading: true,
        }))
      );

      const results = await Promise.all(
        days.map(async (d) => {
          const slots = await fetchSlotsForDay(d.dateStr);
          return { dateStr: d.dateStr, slots };
        })
      );

      if (cancelled) return;

      const loaded = days.map((d) => {
        const found = results.find((r) => r.dateStr === d.dateStr);
        return {
          date: d.dateStr,
          label: d.label,
          dayLabel: d.dayLabel,
          fullLabel: d.fullLabel,
          slots: found?.slots ?? [],
          loading: false,
        };
      });

      setDaySlots(loaded);

      setExpandedDay((prev) => {
        if (prev) return prev;
        const firstWithSlots = loaded.find((d) => d.slots.length > 0);
        return firstWithSlots?.date ?? null;
      });
    }

    loadAll();
    return () => { cancelled = true; };
  }, [days, fetchSlotsForDay]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canGoPrev = weekStart.getTime() > today.getTime();

  function handleLoadMore() {
    setDaysCount((c) => c + DAYS_PER_BATCH);
  }

  function handlePrevWeek() {
    setWeekStart(addDays(weekStart, -DAYS_PER_BATCH));
    setDaysCount(DAYS_PER_BATCH);
    setExpandedDay(null);
  }

  function handleNextWeek() {
    setWeekStart(addDays(weekStart, DAYS_PER_BATCH));
    setDaysCount(DAYS_PER_BATCH);
    setExpandedDay(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm text-primary hover:text-primary-dark transition-colors"
        >
          &larr; Changer de prestation
        </button>
        <div className="text-sm text-text-muted">
          <span className="font-medium text-text">{service.nom}</span>
          {" — "}
          {service.duree_minutes} min
        </div>
      </div>

      {/* Desktop: grid view with week navigation */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevWeek}
            disabled={!canGoPrev}
            className="p-2 rounded-full hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-text">
            {formatDateLabel(weekStart)} — {formatDateLabel(addDays(weekStart, DAYS_PER_BATCH - 1))}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-full hover:bg-accent-light transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daySlots.slice(0, DAYS_PER_BATCH).map((day) => (
            <div key={day.date} className="flex flex-col">
              <div className="text-center py-2 border-b border-border mb-2">
                <div className="text-xs text-text-muted capitalize">{day.dayLabel}</div>
                <div className="text-sm font-medium">{day.label}</div>
              </div>
              <div className="flex flex-col gap-1.5 min-h-[120px]">
                {day.loading ? (
                  <div className="flex flex-col gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 rounded bg-border/50 animate-pulse" />
                    ))}
                  </div>
                ) : day.slots.length === 0 ? (
                  <p className="text-xs text-text-muted/60 text-center py-4">—</p>
                ) : (
                  day.slots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => onSelect(slot)}
                      className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-sm text-center font-medium text-primary transition-all hover:border-primary hover:bg-accent-light/50"
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: accordion days */}
      <div className="md:hidden flex flex-col gap-1.5">
        {daySlots.map((day) => (
          <DayAccordion
            key={day.date}
            day={day}
            expanded={expandedDay === day.date}
            onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            onSelect={onSelect}
          />
        ))}

        <button
          onClick={handleLoadMore}
          className="mt-3 w-full rounded-lg border border-border py-3 text-sm font-medium text-primary hover:bg-accent-light/30 transition-colors"
        >
          Afficher plus de disponibilités
        </button>
      </div>
    </div>
  );
}

function DayAccordion({
  day,
  expanded,
  onToggle,
  onSelect,
}: {
  day: DaySlots;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (slot: SlotData) => void;
}) {
  const hasSlots = !day.loading && day.slots.length > 0;
  const noSlots = !day.loading && day.slots.length === 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        disabled={noSlots}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
          noSlots ? "opacity-50 cursor-default" : "hover:bg-accent-light/30"
        }`}
      >
        <span className={`text-sm font-medium capitalize ${hasSlots ? "text-text" : "text-text-muted"}`}>
          {day.fullLabel}
        </span>
        <div className="flex items-center gap-2">
          {day.loading && (
            <div className="h-4 w-12 rounded bg-border/50 animate-pulse" />
          )}
          {noSlots && (
            <span className="text-xs text-text-muted/60">Complet</span>
          )}
          {hasSlots && (
            <span className="text-xs text-primary">{day.slots.length} créneau{day.slots.length > 1 ? "x" : ""}</span>
          )}
          {!noSlots && (
            <ChevronDown
              size={16}
              className={`text-text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>

      {expanded && hasSlots && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {day.slots.map((slot) => (
              <button
                key={slot.start}
                onClick={() => onSelect(slot)}
                className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm font-medium text-primary transition-all hover:border-primary hover:bg-accent-light/50"
              >
                {formatTime(slot.start)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
