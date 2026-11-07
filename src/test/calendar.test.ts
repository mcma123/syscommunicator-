import { it, expect } from "vitest";
import {
  eventIcs,
  schoolDate,
  monthRange,
  eventDays,
  moveMonth,
} from "@school-connect/core/calendar";
import type { ModuleRecord } from "@school-connect/core/live";
const record: ModuleRecord = {
  id: "event-id",
  title: "Arts, music; school",
  body: "First line\nSecond line",
  subtitle: "",
  status: "Scheduled",
  read: false,
  acknowledged: false,
  canAcknowledge: false,
  amountCents: null,
  at: Date.parse("2026-10-31T23:30:00+02:00"),
  endsAt: Date.parse("2026-11-01T01:00:00+02:00"),
  fields: [{ label: "Location", value: "Hall" }],
};
it("exports real UTC event times, escaped text, stable identity and folded UTF-8 lines", () => {
  const ics = eventIcs({ ...record, body: "School " + "\u00e9".repeat(120) + "\rNext" }, 0);
  expect(ics).toContain("DTSTART:20261031T213000Z");
  expect(ics).toContain("DTEND:20261031T230000Z");
  expect(ics).toContain("SUMMARY:Arts\\, music\\; school");
  expect(ics).toContain("UID:event-id@wgjsconnect");
  expect(ics).toContain("LOCATION:Hall");
  expect(ics).toContain("\\nNext");
  for (const line of ics.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
});
it("uses Johannesburg month boundaries, handles month rollover and spanning/all-day events", () => {
  expect(monthRange("2026-11").from).toBe(Date.parse("2026-11-01T00:00:00+02:00"));
  expect(moveMonth("2026-12", 1)).toBe("2027-01");
  expect(schoolDate(record.at!)).toBe("2026-10-31");
  expect(eventDays(record, "2026-11")).toEqual(["2026-11-01"]);
  const ics = eventIcs(
    {
      ...record,
      allDay: true,
      at: Date.parse("2026-11-01T00:00:00+02:00"),
      endsAt: Date.parse("2026-11-03T00:00:00+02:00"),
    },
    0,
  );
  expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
  expect(ics).toContain("DTEND;VALUE=DATE:20261103");
  expect(() => monthRange("2026-13")).toThrow();
});
