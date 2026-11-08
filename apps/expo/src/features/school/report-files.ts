import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { WorkflowFile } from "@school-connect/core/workflows";
export async function pickReport(pdfOnly = true): Promise<WorkflowFile | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: pdfOnly ? "application/pdf" : ["application/pdf", "image/png", "image/jpeg"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if (file.size > (/\.pdf$/i.test(asset.name) ? 10485760 : 5242880))
    throw new Error("PDFs may be up to 10 MiB; images up to 5 MiB.");
  return { name: asset.name, bytes: await file.arrayBuffer() };
}
/** Ad media: PNG/JPEG up to 5 MiB or MP4/WebM up to 15 MiB (server re-validates). */
export async function pickMedia(): Promise<WorkflowFile | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/png", "image/jpeg", "video/mp4", "video/webm"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!/\.(png|jpe?g|mp4|webm)$/i.test(asset.name))
    throw new Error("Choose a PNG or JPEG image, or an MP4 or WebM video.");
  const file = new File(asset.uri);
  if (file.size > (/\.(mp4|webm)$/i.test(asset.name) ? 15728640 : 5242880))
    throw new Error("Images may be up to 5 MiB; videos up to 15 MiB.");
  return { name: asset.name, bytes: await file.arrayBuffer() };
}
export async function openReport(file: WorkflowFile) {
  if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory)
    throw new Error("File sharing is unavailable.");
  let binary = "";
  for (const byte of new Uint8Array(file.bytes)) binary += String.fromCharCode(byte);
  const path = FileSystem.cacheDirectory + "school-report.pdf";
  await FileSystem.writeAsStringAsync(path, btoa(binary), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: "application/pdf",
    dialogTitle: "Open learner report",
  });
}

export async function openDownload(link: { url: string; name: string; contentType: string }) {
  if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory)
    throw new Error("File sharing is unavailable.");
  const path =
    FileSystem.cacheDirectory +
    "wgjs-" +
    Date.now() +
    "-" +
    link.name.replace(/[^a-z0-9._-]/gi, "_");
  try {
    const result = await FileSystem.downloadAsync(link.url, path, { cache: false });
    if (result.status !== 200) throw new Error("Download expired. Open the file again.");
    await Sharing.shareAsync(path, {
      mimeType: link.contentType,
      dialogTitle: "Open school document",
    });
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
