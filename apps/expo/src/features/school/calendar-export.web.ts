import { eventIcs } from "@school-connect/core/calendar";
import type { ModuleRecord } from "@school-connect/core/live";
export async function shareEvent(record: ModuleRecord) {
  const url = URL.createObjectURL(
    new Blob([eventIcs(record, Date.now())], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "school-event.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
