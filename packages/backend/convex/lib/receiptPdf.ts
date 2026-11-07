import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { receiptFont, receiptBoldFont, receiptCrest } from "../receiptAssets";
export async function renderReceipt(data: {
  receiptNumber: string;
  schoolName: string;
  currency: string;
  amountCents: number;
  issuedAt: number;
  title: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("School payment receipt");
  pdf.registerFontkit(fontkit);
  const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const font = await pdf.embedFont(decode(receiptFont), { subset: true });
  const bold = await pdf.embedFont(decode(receiptBoldFont), { subset: true });
  const crest = await pdf.embedPng(decode(receiptCrest));
  const page = pdf.addPage([595, 842]),
    red = rgb(0.776, 0.145, 0.169),
    grey = rgb(0.24, 0.24, 0.24);
  const printable = (s: string) => s.replace(/[\x00-\x1f]/g, " ");
  const draw = (s: string, y: number, size = 12, strong = false) =>
    page.drawText(printable(s), {
      x: 48,
      y,
      size,
      font: strong ? bold : font,
      color: grey,
      maxWidth: 490,
      lineHeight: 20,
    });
  page.drawRectangle({ x: 0, y: 815, width: 595, height: 27, color: red });
  page.drawImage(crest, { x: 48, y: 725, width: 65, height: (65 * crest.height) / crest.width });
  page.drawText("Wynberg Girls Junior School", {
    x: 130,
    y: 763,
    size: 18,
    font: bold,
    color: grey,
  });
  page.drawText("Honor Before Honours", { x: 130, y: 738, size: 10, font, color: grey });
  draw("PAYMENT RECEIPT", 676, 20, true);
  draw(`Receipt: ${data.receiptNumber.slice(0, 100)}`, 630);
  draw(
    `Issued: ${new Date(data.issuedAt + 7200000).toISOString().slice(0, 10)} (Johannesburg)`,
    604,
  );
  draw("Description", 550, 11, true);
  draw(data.title.slice(0, 200), 524);
  draw(`Amount received: ${data.currency} ${(data.amountCents / 100).toFixed(2)}`, 410, 18, true);
  draw("Payment status: Succeeded", 374);
  draw("Generated from the school's verified payment record.", 98, 10);
  return pdf.save();
}
