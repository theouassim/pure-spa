import { describe, it, expect } from "vitest";
import {
  computeAvailableSlots,
  findFreeSlotNumber,
  getDayBoundsUTC,
  type TimeRange,
} from "../availability";
import type { AdminSettings } from "../types";

// ============================================================
// Helpers
// ============================================================

function utc(isoString: string): Date {
  return new Date(isoString);
}

function makeRange(startISO: string, endISO: string): TimeRange {
  return { start: utc(startISO), end: utc(endISO) };
}

// Mercredi 15 janvier 2025 — HEURE D'HIVER (CET = UTC+1)
// 09:00 Paris = 08:00 UTC, 17:00 Paris = 16:00 UTC
const WINTER_DATE = utc("2025-01-15T00:00:00.000Z");

// Mercredi 16 juillet 2025 — HEURE D'ÉTÉ (CEST = UTC+2)
// 09:00 Paris = 07:00 UTC, 17:00 Paris = 15:00 UTC
const SUMMER_DATE = utc("2025-07-16T00:00:00.000Z");

const BASE_SETTINGS: AdminSettings = {
  id: "test",
  horaires_ouverture: [
    { jour: 3, ouverture: "09:00", fermeture: "17:00" },
  ],
  jours_travailles: [1, 2, 3, 4, 5, 6],
  pauses: [{ debut: "12:00", fin: "13:00" }],
  nb_praticiens: 1,
  delai_min_avant_rdv: 60,
  battement_minutes: 15,
  conditions_annulation: "",
  timezone: "Europe/Paris",
  updated_at: "",
};

const FAR_PAST = utc("2025-01-10T00:00:00.000Z");

// ============================================================
// Tests — Fuseau horaire hiver / été
// ============================================================

describe("computeAvailableSlots — timezone Europe/Paris", () => {
  describe("heure d'hiver (CET, UTC+1)", () => {
    it("premier créneau à 08:00 UTC (= 09:00 Paris hiver)", () => {
      const slots = computeAvailableSlots({
        date: WINTER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      expect(slots.length).toBeGreaterThan(0);
      // 09:00 Paris en hiver = 08:00 UTC
      expect(slots[0].start).toEqual(utc("2025-01-15T08:00:00.000Z"));
      expect(slots[0].end).toEqual(utc("2025-01-15T09:00:00.000Z"));
    });

    it("dernier créneau finit à 16:00 UTC (= 17:00 Paris hiver)", () => {
      const slots = computeAvailableSlots({
        date: WINTER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      const last = slots[slots.length - 1];
      // 16:00 Paris = 15:00 UTC, fin = 16:00 UTC (= 17:00 Paris)
      expect(last.start).toEqual(utc("2025-01-15T15:00:00.000Z"));
      expect(last.end).toEqual(utc("2025-01-15T16:00:00.000Z"));
    });

    it("la pause 12:00-13:00 Paris se traduit en 11:00-12:00 UTC en hiver", () => {
      const slots = computeAvailableSlots({
        date: WINTER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      // Aucun créneau ne doit chevaucher [11:00, 12:00) UTC
      for (const slot of slots) {
        const overlaps =
          slot.start.getTime() < utc("2025-01-15T12:00:00.000Z").getTime() &&
          utc("2025-01-15T11:00:00.000Z").getTime() < slot.end.getTime();
        expect(overlaps).toBe(false);
      }
    });
  });

  describe("heure d'été (CEST, UTC+2)", () => {
    it("premier créneau à 07:00 UTC (= 09:00 Paris été)", () => {
      const slots = computeAvailableSlots({
        date: SUMMER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      expect(slots.length).toBeGreaterThan(0);
      // 09:00 Paris en été = 07:00 UTC
      expect(slots[0].start).toEqual(utc("2025-07-16T07:00:00.000Z"));
      expect(slots[0].end).toEqual(utc("2025-07-16T08:00:00.000Z"));
    });

    it("dernier créneau finit à 15:00 UTC (= 17:00 Paris été)", () => {
      const slots = computeAvailableSlots({
        date: SUMMER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      const last = slots[slots.length - 1];
      // 16:00 Paris = 14:00 UTC, fin = 15:00 UTC (= 17:00 Paris)
      expect(last.start).toEqual(utc("2025-07-16T14:00:00.000Z"));
      expect(last.end).toEqual(utc("2025-07-16T15:00:00.000Z"));
    });

    it("la pause 12:00-13:00 Paris se traduit en 10:00-11:00 UTC en été", () => {
      const slots = computeAvailableSlots({
        date: SUMMER_DATE,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      for (const slot of slots) {
        const overlaps =
          slot.start.getTime() < utc("2025-07-16T11:00:00.000Z").getTime() &&
          utc("2025-07-16T10:00:00.000Z").getTime() < slot.end.getTime();
        expect(overlaps).toBe(false);
      }
    });
  });

  describe("jour de la semaine en heure locale", () => {
    it("un samedi soir UTC qui est déjà dimanche à Paris ne génère rien", () => {
      // Samedi 18 janvier 2025, 23:30 UTC = Dimanche 19 janvier 00:30 Paris (hiver)
      // Si on demande les créneaux pour cet instant en tant que "date",
      // le jour local est dimanche (7) qui n'est pas travaillé
      const lateSaturdayUTC = utc("2025-01-18T23:30:00.000Z");
      const slots = computeAvailableSlots({
        date: lateSaturdayUTC,
        serviceDurationMinutes: 60,
        settings: BASE_SETTINGS,
        existingBookings: [],
        externalBookings: [],
        now: FAR_PAST,
      });

      expect(slots).toHaveLength(0);
    });
  });
});

// ============================================================
// Tests — Logique métier (avec fuseau)
// ============================================================

describe("computeAvailableSlots — logique métier", () => {
  it("retourne vide pour un jour non travaillé", () => {
    // Dimanche 19 jan 2025 à midi Paris → jour 7, pas dans jours_travailles
    const sunday = utc("2025-01-19T11:00:00.000Z"); // 12:00 Paris
    const slots = computeAvailableSlots({
      date: sunday,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    expect(slots).toHaveLength(0);
  });

  it("exclut les créneaux avant le délai minimum", () => {
    // now = 10:00 Paris (09:00 UTC en hiver), délai = 60min
    // → créneaux avant 11:00 Paris (10:00 UTC) exclus
    const now = utc("2025-01-15T09:00:00.000Z"); // 10:00 Paris
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now,
    });

    // Tous les créneaux doivent commencer >= 10:00 UTC (= 11:00 Paris)
    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThanOrEqual(utc("2025-01-15T10:00:00.000Z").getTime());
    }
  });

  it("booking bloque un créneau (chevauchement avec battement)", () => {
    // Booking 10:00-11:00 Paris (09:00-10:00 UTC hiver) + battement 15min
    // → effectif [08:45, 10:15) UTC
    const booking = makeRange("2025-01-15T09:00:00.000Z", "2025-01-15T10:00:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    for (const slot of slots) {
      const inConflict =
        slot.start.getTime() < utc("2025-01-15T10:15:00.000Z").getTime() &&
        utc("2025-01-15T08:45:00.000Z").getTime() < slot.end.getTime();
      expect(inConflict).toBe(false);
    }
  });

  it("chevauchement partiel : un créneau empiétant est exclu", () => {
    // Booking 09:30-10:30 Paris (08:30-09:30 UTC) + battement 15min
    // → effectif [08:15, 09:45) UTC
    // Le créneau 09:00 Paris (08:00 UTC, fin 09:00 UTC) empiète car 08:00 < 09:45 AND 08:15 < 09:00
    const booking = makeRange("2025-01-15T08:30:00.000Z", "2025-01-15T09:30:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    const firstSlot = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T08:00:00.000Z").getTime()
    );
    expect(firstSlot).toBeUndefined();
  });

  it("battement : créneau collé bloqué, après battement libre", () => {
    // Booking 09:00-10:00 Paris (08:00-09:00 UTC) + battement 15min
    // → effectif [07:45, 09:15) UTC
    // Créneau 10:00 Paris (09:00 UTC, fin 10:00) : 09:00 < 09:15 → bloqué
    // Créneau 10:15 Paris (09:15 UTC, fin 10:15) : 09:15 < 09:15 → faux → libre
    const booking = makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    const at0900utc = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T09:00:00.000Z").getTime()
    );
    const at0915utc = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T09:15:00.000Z").getTime()
    );
    expect(at0900utc).toBeUndefined();
    expect(at0915utc).toBeDefined();
  });

  it("plusieurs praticiens : 1 occupation < capacité → dispo", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    const booking = makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    // 09:00 Paris (08:00 UTC) toujours dispo (1 < 2)
    const firstSlot = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T08:00:00.000Z").getTime()
    );
    expect(firstSlot).toBeDefined();
  });

  it("plusieurs praticiens : capacité atteinte → bloqué", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    const bookings = [
      makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"),
      makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"),
    ];
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: bookings,
      externalBookings: [],
      now: FAR_PAST,
    });

    const firstSlot = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T08:00:00.000Z").getTime()
    );
    expect(firstSlot).toBeUndefined();
  });

  it("external_bookings (Planity) bloquent un créneau", () => {
    // External 14:00-15:00 Paris (13:00-14:00 UTC hiver)
    const external = makeRange("2025-01-15T13:00:00.000Z", "2025-01-15T14:00:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [external],
      now: FAR_PAST,
    });

    const at1300utc = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T13:00:00.000Z").getTime()
    );
    expect(at1300utc).toBeUndefined();
  });

  it("booking + external se cumulent vers la capacité", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    const booking = makeRange("2025-01-15T13:00:00.000Z", "2025-01-15T14:00:00.000Z");
    const external = makeRange("2025-01-15T13:00:00.000Z", "2025-01-15T14:00:00.000Z");

    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: [booking],
      externalBookings: [external],
      now: FAR_PAST,
    });

    const at1300utc = slots.find(
      (s) => s.start.getTime() === utc("2025-01-15T13:00:00.000Z").getTime()
    );
    expect(at1300utc).toBeUndefined();
  });

  it("tout plein → aucun créneau", () => {
    // Booking couvrant toute la journée 08:00-16:00 UTC (09:00-17:00 Paris)
    const booking = makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T16:00:00.000Z");
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    expect(slots).toHaveLength(0);
  });

  it("rien de réservé → tous les créneaux disponibles, hors pause", () => {
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    expect(slots.length).toBeGreaterThan(0);
    // Aucun créneau pendant la pause 12:00-13:00 Paris (11:00-12:00 UTC)
    for (const slot of slots) {
      const overlaps =
        slot.start.getTime() < utc("2025-01-15T12:00:00.000Z").getTime() &&
        utc("2025-01-15T11:00:00.000Z").getTime() < slot.end.getTime();
      expect(overlaps).toBe(false);
    }
  });

  it("prestation courte (30min) génère plus de créneaux", () => {
    const slots = computeAvailableSlots({
      date: WINTER_DATE,
      serviceDurationMinutes: 30,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    // Dernier créneau : 16:30 Paris (15:30 UTC), fin 17:00 Paris (16:00 UTC)
    const last = slots[slots.length - 1];
    expect(last.start).toEqual(utc("2025-01-15T15:30:00.000Z"));
    expect(last.end).toEqual(utc("2025-01-15T16:00:00.000Z"));
  });
});

// ============================================================
// Tests — findFreeSlotNumber
// ============================================================

describe("findFreeSlotNumber", () => {
  it("retourne 1 quand aucun booking existant", () => {
    const slot = findFreeSlotNumber(
      makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"),
      [],
      2,
      15
    );
    expect(slot).toBe(1);
  });

  it("retourne le plus petit slot libre", () => {
    const existing = [
      { ...makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"), slot_number: 1 },
    ];
    const slot = findFreeSlotNumber(
      makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"),
      existing,
      2,
      15
    );
    expect(slot).toBe(2);
  });

  it("retourne null quand tous les slots sont pris", () => {
    const existing = [
      { ...makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"), slot_number: 1 },
      { ...makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"), slot_number: 2 },
    ];
    const slot = findFreeSlotNumber(
      makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"),
      existing,
      2,
      15
    );
    expect(slot).toBeNull();
  });

  it("tient compte du battement dans l'attribution", () => {
    const existing = [
      { ...makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"), slot_number: 1 },
    ];
    // Candidat 09:00-10:00 UTC chevauche l'effectif [07:45, 09:15) → slot 1 occupé
    const slot = findFreeSlotNumber(
      makeRange("2025-01-15T09:00:00.000Z", "2025-01-15T10:00:00.000Z"),
      existing,
      2,
      15
    );
    expect(slot).toBe(2);
  });

  it("ne bloque pas un booking non-chevauchant (après battement)", () => {
    const existing = [
      { ...makeRange("2025-01-15T08:00:00.000Z", "2025-01-15T09:00:00.000Z"), slot_number: 1 },
    ];
    // Candidat 09:15-10:15 UTC : 09:15 >= 09:15 effectiveEnd → pas de chevauchement
    const slot = findFreeSlotNumber(
      makeRange("2025-01-15T09:15:00.000Z", "2025-01-15T10:15:00.000Z"),
      existing,
      2,
      15
    );
    expect(slot).toBe(1);
  });
});

// ============================================================
// Tests — getDayBoundsUTC
// ============================================================

describe("getDayBoundsUTC", () => {
  it("hiver : début de journée Paris = 23:00 UTC veille", () => {
    const bounds = getDayBoundsUTC(WINTER_DATE, "Europe/Paris", 0);
    // 00:00 Paris 15 jan = 23:00 UTC 14 jan
    expect(bounds.start).toEqual(utc("2025-01-14T23:00:00.000Z"));
    // 00:00 Paris 16 jan = 23:00 UTC 15 jan
    expect(bounds.end).toEqual(utc("2025-01-15T23:00:00.000Z"));
  });

  it("été : début de journée Paris = 22:00 UTC veille", () => {
    const bounds = getDayBoundsUTC(SUMMER_DATE, "Europe/Paris", 0);
    // 00:00 Paris 16 jul = 22:00 UTC 15 jul
    expect(bounds.start).toEqual(utc("2025-07-15T22:00:00.000Z"));
    // 00:00 Paris 17 jul = 22:00 UTC 16 jul
    expect(bounds.end).toEqual(utc("2025-07-16T22:00:00.000Z"));
  });

  it("marge élargie pour le battement", () => {
    const bounds = getDayBoundsUTC(WINTER_DATE, "Europe/Paris", 15);
    // 23:00 UTC - 15min = 22:45 UTC
    expect(bounds.start).toEqual(utc("2025-01-14T22:45:00.000Z"));
    // 23:00 UTC + 15min = 23:15 UTC
    expect(bounds.end).toEqual(utc("2025-01-15T23:15:00.000Z"));
  });
});
