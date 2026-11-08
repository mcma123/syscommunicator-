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
export async function pickMedia(): Promise<WorkflowFile | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,video/mp4,video/webm,.png,.jpg,.jpeg,.mp4,.webm";
    input.oncancel = () => resolve(undefined);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(undefined);
      if (!/\.(png|jpe?g|mp4|webm)$/i.test(file.name))
        return reject(new Error("Choose a PNG or JPEG image, or an MP4 or WebM video."));
      if (file.size > (/\.(mp4|webm)$/i.test(file.name) ? 15728640 : 5242880))
        return reject(new Error("Images may be up to 5 MiB; videos up to 15 MiB."));
      resolve({ name: file.name, bytes: await file.arrayBuffer() });
    };
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
