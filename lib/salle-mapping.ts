/**
 * Mapping entre calendar_source (Planity) et slot_number physique.
 * Source unique de vérité pour la correspondance salle ↔ slot.
 */

const CALENDAR_SOURCE_TO_SLOT: Record<string, number> = {
  salle_1: 1,
  salle_2: 2,
};

export function getSlotForCalendarSource(calendarSource: string): number | null {
  return CALENDAR_SOURCE_TO_SLOT[calendarSource] ?? null;
}

export function getAllMappedSlots(): number[] {
  return Object.values(CALENDAR_SOURCE_TO_SLOT);
}
