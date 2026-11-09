import type { WorkflowFile } from "@school-connect/core/workflows";
export async function pickReport(pdfOnly = true): Promise<WorkflowFile | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = pdfOnly
      ? "application/pdf,.pdf"
      : "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";
    input.oncancel = () => resolve(undefined);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      resolve({ name: file.name, bytes: await file.arrayBuffer() });
    };
    input.click();
  });
}
/** A picked Ad Center file; the body is read only when it uploads. */
export type PickedAdFile = { name: string; size: number; uri: string; read: () => Promise<Blob> };
export async function pickAdFiles(): Promise<PickedAdFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mov";
    input.oncancel = () => resolve([]);
    input.onchange = () =>
      resolve(
        Array.from(input.files ?? []).map((file) => ({
          name: file.name,
          size: file.size,
          uri: URL.createObjectURL(file),
          read: async () => file,
        })),
      );
    input.click();
  });
}
export async function openReport(file: WorkflowFile) {
  const url = URL.createObjectURL(new Blob([file.bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openDownload(link: { url: string; name: string; contentType: string }) {
  const response = await fetch(link.url, { cache: "no-store" });
  if (!response.ok) throw new Error("Download expired. Open the file again.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = link.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
