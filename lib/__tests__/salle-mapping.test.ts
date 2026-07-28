import { describe, it, expect } from "vitest";
import { getSlotForCalendarSource, getAllMappedSlots } from "../salle-mapping";

describe("salle-mapping", () => {
  it("salle_1 → slot 1", () => {
    expect(getSlotForCalendarSource("salle_1")).toBe(1);
  });

  it("salle_2 → slot 2", () => {
    expect(getSlotForCalendarSource("salle_2")).toBe(2);
  });

  it("calendar_source inconnu → null", () => {
    expect(getSlotForCalendarSource("salle_3")).toBeNull();
    expect(getSlotForCalendarSource("")).toBeNull();
  });

  it("getAllMappedSlots retourne [1, 2]", () => {
    expect(getAllMappedSlots().sort()).toEqual([1, 2]);
  });
});
