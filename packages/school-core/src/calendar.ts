import type { ModuleRecord } from "./live";
const zone = "Africa/Johannesburg";
export function schoolDate(at: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const year = Number(month.slice(0, 4)),
    m = Number(month.slice(5, 7));
  if (m < 1 || m > 12) throw new Error("Invalid month");
  return { from: Date.UTC(year, m - 1, 1) - 7200000, to: Date.UTC(year, m, 1) - 7200000 };
}
export function moveMonth(month: string, offset: number) {
  const y = Number(month.slice(0, 4)),
    m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function eventDays(record: ModuleRecord, month: string) {
  const { from, to } = monthRange(month);
  const days: string[] = [];
  if (record.at === null) return days;
  for (let at = from; at < to; at += 86400000)
    if (record.at < at + 86400000 && (record.endsAt ?? record.at + 1) > at)
      days.push(schoolDate(at));
  return days;
}
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const utc = (at: number) =>
  new Date(at)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function fold(line: string) {
  let output = "",
    bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += char;
    bytes += size;
  }
  return output;
}
export function eventIcs(record: ModuleRecord, generatedAt: number) {
  if (record.at === null || record.endsAt === undefined || record.endsAt <= record.at)
    throw new Error("Event time is unavailable.");
  const date = (at: number) => schoolDate(at).replace(/-/g, "");
  const timing = record.allDay
    ? [`DTSTART;VALUE=DATE:${date(record.at)}`, `DTEND;VALUE=DATE:${date(record.endsAt)}`]
    : [`DTSTART:${utc(record.at)}`, `DTEND:${utc(record.endsAt)}`];
  const location = record.fields?.find((f) => f.label === "Location")?.value;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WGJS Connect//School Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escape(record.id)}@wgjsconnect`,
    `DTSTAMP:${utc(generatedAt)}`,
    ...timing,
    `SUMMARY:${escape(record.title)}`,
    `DESCRIPTION:${escape(record.body)}`,
    ...(location ? [`LOCATION:${escape(location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}

export function monthCells(month: string) {
  const { from, to } = monthRange(month);
  const first = new Date(from + 7200000).getUTCDay();
  const cells: (string | null)[] = Array.from({ length: (first + 6) % 7 }, () => null);
  for (let at = from; at < to; at += 86400000) cells.push(schoolDate(at));
  return cells;
}
