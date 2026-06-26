import { describe, it, expect } from "vitest";
import { computeAvailableSlots, findFreeSlotNumber, type TimeRange } from "../availability";
import type { AdminSettings } from "../types";

// ============================================================
// Helpers
// ============================================================

function makeDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

function makeTime(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00.000Z`);
}

function makeRange(dateStr: string, startTime: string, endTime: string): TimeRange {
  return {
    start: makeTime(dateStr, startTime),
    end: makeTime(dateStr, endTime),
  };
}

// Mercredi 2025-01-15 (jour=3)
const TEST_DATE = "2025-01-15";
const TEST_DATE_OBJ = makeDate(TEST_DATE);

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
  updated_at: "",
};

// "now" bien avant la journée de test pour ne pas déclencher le délai min
const FAR_PAST = new Date("2025-01-14T08:00:00.000Z");

// ============================================================
// Tests
// ============================================================

describe("computeAvailableSlots", () => {
  it("génère les créneaux candidats selon les horaires (pas de booking)", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    // 09:00-17:00 avec pause 12:00-13:00 = 7h dispo
    // Créneaux de 60min au pas de 15min :
    // 09:00, 09:15, ..., 11:00 (fin 12:00) — le créneau 11:15 (fin 12:15) chevauche la pause
    // 13:00, 13:15, ..., 16:00 (fin 17:00)
    // Avant pause: slots dont [start, start+60min) ne chevauche pas [12:00, 13:00)
    //   = 09:00 à 11:00 (start <= 11:00 car end=12:00 ne chevauche pas [12:00,13:00) en semi-ouvert)
    //   Attention: [11:00, 12:00) ne chevauche PAS [12:00, 13:00) car 12:00 < 13:00 AND 12:00 < 12:00 = false
    //   Mais [11:15, 12:15) chevauche [12:00, 13:00) car 11:15 < 13:00 AND 12:00 < 12:15
    //   Donc avant pause: 09:00, 09:15, ..., 11:00 = 9 créneaux
    // Après pause: [13:00, 14:00) ok, ..., [16:00, 17:00) ok
    //   = 13:00, 13:15, ..., 16:00 = 13 créneaux
    // Total = 9 + 13 = 22

    expect(slots.length).toBe(22);
    expect(slots[0].start).toEqual(makeTime(TEST_DATE, "09:00"));
    expect(slots[0].end).toEqual(makeTime(TEST_DATE, "10:00"));
    expect(slots[slots.length - 1].start).toEqual(makeTime(TEST_DATE, "16:00"));
    expect(slots[slots.length - 1].end).toEqual(makeTime(TEST_DATE, "17:00"));
  });

  it("retourne vide pour un jour non travaillé", () => {
    // Dimanche = jour 7, pas dans jours_travailles
    const sunday = new Date("2025-01-19T00:00:00.000Z");
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
    // now = 10:00, délai = 60min → créneaux avant 11:00 exclus
    const now = makeTime(TEST_DATE, "10:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now,
    });

    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThanOrEqual(makeTime(TEST_DATE, "11:00").getTime());
    }
  });

  it("exclut un créneau quand un booking le chevauche (1 praticienne)", () => {
    // Booking existant 10:00-11:00 + battement 15min → occupe [09:45, 11:15)
    const booking = makeRange(TEST_DATE, "10:00", "11:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    // Aucun créneau dont la plage empiète sur [09:45, 11:15) ne doit apparaître
    for (const slot of slots) {
      const inConflict =
        slot.start.getTime() < makeTime(TEST_DATE, "11:15").getTime() &&
        makeTime(TEST_DATE, "09:45").getTime() < slot.end.getTime();
      expect(inConflict).toBe(false);
    }
  });

  it("gère le chevauchement partiel", () => {
    // Booking 09:30-10:30 + battement 15min → occupe [09:15, 10:45)
    // Le créneau 09:00-10:00 empiète sur [09:15, 10:45) car 09:00 < 10:45 AND 09:15 < 10:00
    const booking = makeRange(TEST_DATE, "09:30", "10:30");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    const nineAm = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "09:00").getTime());
    expect(nineAm).toBeUndefined();
  });

  it("créneaux collés : respecte le battement entre prestations", () => {
    // Booking 09:00-10:00, battement = 15min
    // Le créneau 10:00-11:00 empiète sur [08:45, 10:15) car 10:00 < 10:15
    // Le créneau 10:15-11:15 n'empiète pas : 10:15 >= 10:15 en semi-ouvert?
    // [10:15, 11:15) vs effectif [08:45, 10:15) → 10:15 < 10:15 = false → pas de conflit
    const booking = makeRange(TEST_DATE, "09:00", "10:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    const at1000 = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "10:00").getTime());
    const at1015 = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "10:15").getTime());

    expect(at1000).toBeUndefined(); // bloqué par battement
    expect(at1015).toBeDefined(); // premier créneau libre après battement
  });

  it("plusieurs praticiens : autorise N bookings en parallèle", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    // Un seul booking à 09:00-10:00 → encore un slot libre (count=1 < 2)
    const booking = makeRange(TEST_DATE, "09:00", "10:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    // Le créneau 09:00-10:00 doit être encore dispo (1 occupation < 2 praticiens)
    // Mais attention au battement : le candidat [09:00, 10:00) vs effectif [08:45, 10:15)
    // Le candidat 09:00 < 10:15 AND 08:45 < 10:00 → oui overlap
    // Donc le créneau 09:00 est compté comme 1 occupation, 1 < 2 → disponible
    const nineAm = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "09:00").getTime());
    expect(nineAm).toBeDefined();
  });

  it("plusieurs praticiens : bloque quand capacité atteinte", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    // Deux bookings à 09:00-10:00 → count=2 >= 2 → plein
    const bookings = [
      makeRange(TEST_DATE, "09:00", "10:00"),
      makeRange(TEST_DATE, "09:00", "10:00"),
    ];
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: bookings,
      externalBookings: [],
      now: FAR_PAST,
    });

    const nineAm = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "09:00").getTime());
    expect(nineAm).toBeUndefined();
  });

  it("external_bookings (Planity) bloquent un créneau", () => {
    // Un external_booking 14:00-15:00 bloque exactement comme un booking interne
    const external = makeRange(TEST_DATE, "14:00", "15:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [external],
      now: FAR_PAST,
    });

    // Le créneau 14:00-15:00 ne doit pas apparaître (1 occupation >= 1 praticien)
    const at1400 = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "14:00").getTime());
    expect(at1400).toBeUndefined();
  });

  it("booking + external_bookings se cumulent vers la capacité", () => {
    const settings = { ...BASE_SETTINGS, nb_praticiens: 2 };
    // 1 booking interne + 1 external au même créneau → count=2 >= 2 → plein
    const booking = makeRange(TEST_DATE, "14:00", "15:00");
    const external = makeRange(TEST_DATE, "14:00", "15:00");

    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings,
      existingBookings: [booking],
      externalBookings: [external],
      now: FAR_PAST,
    });

    const at1400 = slots.find((s) => s.start.getTime() === makeTime(TEST_DATE, "14:00").getTime());
    expect(at1400).toBeUndefined();
  });

  it("cas limite : tout plein (chaque créneau occupé)", () => {
    // Remplir tout avec un gros booking 09:00-17:00
    const booking = makeRange(TEST_DATE, "09:00", "17:00");
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [booking],
      externalBookings: [],
      now: FAR_PAST,
    });

    expect(slots).toHaveLength(0);
  });

  it("cas limite : rien de réservé, tous les créneaux disponibles", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 60,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    expect(slots.length).toBeGreaterThan(0);
    // Vérifie qu'aucun créneau ne tombe pendant la pause
    for (const slot of slots) {
      const pauseStart = makeTime(TEST_DATE, "12:00").getTime();
      const pauseEnd = makeTime(TEST_DATE, "13:00").getTime();
      const overlaps =
        slot.start.getTime() < pauseEnd && pauseStart < slot.end.getTime();
      expect(overlaps).toBe(false);
    }
  });

  it("prestation courte (30min) génère plus de créneaux", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE_OBJ,
      serviceDurationMinutes: 30,
      settings: BASE_SETTINGS,
      existingBookings: [],
      externalBookings: [],
      now: FAR_PAST,
    });

    // 30min de durée → le dernier créneau possible est 16:30 (fin 17:00)
    expect(slots[slots.length - 1].start).toEqual(makeTime(TEST_DATE, "16:30"));
    expect(slots.length).toBeGreaterThan(22); // plus que les 60min
  });
});

describe("findFreeSlotNumber", () => {
  it("retourne 1 quand aucun booking existant", () => {
    const slot = findFreeSlotNumber(
      makeRange(TEST_DATE, "09:00", "10:00"),
      [],
      2,
      15
    );
    expect(slot).toBe(1);
  });

  it("retourne le plus petit slot libre", () => {
    const existing = [
      { ...makeRange(TEST_DATE, "09:00", "10:00"), slot_number: 1 },
    ];
    const slot = findFreeSlotNumber(
      makeRange(TEST_DATE, "09:00", "10:00"),
      existing,
      2,
      15
    );
    expect(slot).toBe(2);
  });

  it("retourne null quand tous les slots sont pris", () => {
    const existing = [
      { ...makeRange(TEST_DATE, "09:00", "10:00"), slot_number: 1 },
      { ...makeRange(TEST_DATE, "09:00", "10:00"), slot_number: 2 },
    ];
    const slot = findFreeSlotNumber(
      makeRange(TEST_DATE, "09:00", "10:00"),
      existing,
      2,
      15
    );
    expect(slot).toBeNull();
  });

  it("tient compte du battement dans l'attribution", () => {
    // Booking slot 1 : 09:00-10:00, battement 15min → effectif [08:45, 10:15)
    // Candidat 10:00-11:00 chevauche l'effectif (10:00 < 10:15)
    const existing = [
      { ...makeRange(TEST_DATE, "09:00", "10:00"), slot_number: 1 },
    ];
    const slot = findFreeSlotNumber(
      makeRange(TEST_DATE, "10:00", "11:00"),
      existing,
      2,
      15
    );
    // Slot 1 est occupé (battement), donc on prend slot 2
    expect(slot).toBe(2);
  });

  it("ne bloque pas un booking non-chevauchant", () => {
    // Booking slot 1 : 09:00-10:00, battement 15min → effectif [08:45, 10:15)
    // Candidat 10:15-11:15 → 10:15 >= 10:15 donc pas de chevauchement
    const existing = [
      { ...makeRange(TEST_DATE, "09:00", "10:00"), slot_number: 1 },
    ];
    const slot = findFreeSlotNumber(
      makeRange(TEST_DATE, "10:15", "11:15"),
      existing,
      2,
      15
    );
    expect(slot).toBe(1); // slot 1 est libre pour ce créneau
  });
});
