import { eventIcs } from "@school-connect/core/calendar";
import type { ModuleRecord } from "@school-connect/core/live";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
export async function shareEvent(record: ModuleRecord) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Calendar sharing is unavailable on this device.");
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error("Device cache is unavailable.");
  const path = `${directory}school-event.ics`;
  await FileSystem.writeAsStringAsync(path, eventIcs(record, Date.now()), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, {
    mimeType: "text/calendar",
    UTI: "public.calendar-event",
    dialogTitle: "Add school event",
  });
}
