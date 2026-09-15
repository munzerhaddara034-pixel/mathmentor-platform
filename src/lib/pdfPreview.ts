import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);

export async function extractPdfPreview(filePath: string, maxChars = 4000): Promise<string> {
  const buffer = await readFile(filePath);
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      data: Buffer,
      options?: { max?: number },
    ) => Promise<{ text: string }>;
    const result = await pdfParse(buffer, { max: 4 });
    return result.text.replace(/\s+\n/g, "\n").trim().slice(0, maxChars);
  } catch {
    return "";
  }
}
