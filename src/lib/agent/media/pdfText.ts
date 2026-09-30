/** Local PDF text extraction (pdf-parse) — fallback when Gemini is unavailable. */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type PdfParse = (data: Buffer, options?: { max?: number }) => Promise<{ text: string; numpages?: number }>;

export async function extractPdfText(bytes: Buffer, maxPages = 10, maxChars = 12_000): Promise<string> {
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParse;
    const result = await pdfParse(bytes, { max: maxPages });
    return result.text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxChars);
  } catch {
    return "";
  }
}
