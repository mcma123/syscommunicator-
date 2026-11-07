/** Johannesburg date, rand and status-tone helpers shared by school screens. */
const ZONE = "Africa/Johannesburg";
export const formatDate = (at: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: ZONE, ...options }).format(at);
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);

/** Maps a server status to the existing tag tones (red default, green, gold, neutral). */
export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (
    /(paid|published|scheduled|submitted|active|released|granted|present|confirmed|complete)/.test(
      s,
    )
  )
    return "green";
  if (/(overdue|failed|declined|absent|revoked)/.test(s)) return "";
  if (/(due|pending|awaiting|draft|review|open|outstanding|unpublished)/.test(s)) return "gold";
  return "neutral";
}
