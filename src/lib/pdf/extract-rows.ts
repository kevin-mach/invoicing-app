import type { ImportField } from "@/lib/csv/parse";

/** Client-only: reads a PDF's text content and reconstructs it into lines by grouping text
 * fragments that share a vertical position on the page. Works for text-based PDFs (price lists,
 * catalogs exported from a spreadsheet); scanned/image-only PDFs won't have extractable text. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = (content.items as { str?: string; transform: number[] }[])
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str as string, y: Math.round(it.transform[5]), x: it.transform[4] }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    let currentY: number | null = null;
    let currentLine: string[] = [];
    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) > 3) {
        if (currentLine.length) lines.push(currentLine.join(" ").trim());
        currentLine = [item.str];
        currentY = item.y;
      } else {
        currentLine.push(item.str);
      }
    }
    if (currentLine.length) lines.push(currentLine.join(" ").trim());
  }

  return lines.filter(Boolean);
}

const TRAILING_NUMBER_LINE = /^(.+?)\s+[£$]?(\d+(?:[.,]\d{1,2})?)\s*$/;
const NOISE_LINE = /^(page\s*\d|subtotal|total|tax|terms|thank you|invoice|date|tel|phone|www\.|http)/i;
const PRICE_FIELD_CANDIDATES = ["sale_price", "cost_price", "price", "unit_price"];

/** Heuristic line parser: for import types with a price-like field (items), splits each line into
 * a name and a trailing price. For other import types (customers/vendors), each usable line becomes
 * the name field as-is — still a much faster starting point than typing entries by hand. */
export function extractRowsFromPdfLines(
  lines: string[],
  fields: ImportField[]
): { rows: Record<string, string>[]; skippedCount: number } {
  const priceField = fields.find((f) => PRICE_FIELD_CANDIDATES.includes(f.key));
  const nameField = fields.find((f) => f.required) ?? fields[0];
  if (!nameField) return { rows: [], skippedCount: 0 };

  const rows: Record<string, string>[] = [];
  let skippedCount = 0;

  for (const line of lines) {
    if (!line || line.length < 2 || NOISE_LINE.test(line)) continue;

    if (priceField) {
      const match = line.match(TRAILING_NUMBER_LINE);
      if (match) {
        const [, nameRaw, priceRaw] = match;
        const name = nameRaw.trim();
        if (name.length < 2) {
          skippedCount++;
          continue;
        }
        rows.push({ [nameField.key]: name, [priceField.key]: priceRaw.replace(",", ".") });
        continue;
      }
    }

    rows.push({ [nameField.key]: line });
  }

  return { rows, skippedCount };
}
