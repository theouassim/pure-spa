"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  slots: SlotData[];
  loading: boolean;
}

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatDayLabel(date: Date): string {
  return DAY_NAMES[date.getDay()];
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

const DAYS_SHOWN = 7;

export function SlotPicker({ service, onSelect, onBack }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [daySlots, setDaySlots] = useState<DaySlots[]>([]);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (!tracked) {
      track("calendar_viewed", { service_id: service.id });
      setTracked(true);
    }
  }, [service.id, tracked]);

  const days = useMemo(() => {
    const result: { date: Date; dateStr: string; label: string; dayLabel: string }[] = [];
    for (let i = 0; i < DAYS_SHOWN; i++) {
      const d = addDays(weekStart, i);
      result.push({
        date: d,
        dateStr: toLocalDateStr(d),
        label: formatDateLabel(d),
        dayLabel: formatDayLabel(d),
      });
    }
    return result;
  }, [weekStart]);

  const fetchSlotsForDay = useCallback(
    async (dateStr: string): Promise<SlotData[]> => {
      try {
        const res = await fetch(
          `/api/slots?serviceId=${service.id}&date=${dateStr}`
        );
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

      setDaySlots(
        days.map((d) => {
          const found = results.find((r) => r.dateStr === d.dateStr);
          return {
            date: d.dateStr,
            label: d.label,
            dayLabel: d.dayLabel,
            slots: found?.slots ?? [],
            loading: false,
          };
        })
      );
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [days, fetchSlotsForDay]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canGoPrev = weekStart.getTime() > today.getTime();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
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

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -DAYS_SHOWN))}
          disabled={!canGoPrev}
          className="p-2 rounded-full hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-text">
          {formatDateLabel(weekStart)} — {formatDateLabel(addDays(weekStart, DAYS_SHOWN - 1))}
        </span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, DAYS_SHOWN))}
          className="p-2 rounded-full hover:bg-accent-light transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Columns layout */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {daySlots.map((day) => (
          <div key={day.date} className="flex flex-col">
            {/* Day header */}
            <div className="text-center py-2 border-b border-border mb-2">
              <div className="text-xs text-text-muted capitalize">{day.dayLabel}</div>
              <div className="text-sm font-medium">{day.label}</div>
            </div>

            {/* Slots */}
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
  );
}
