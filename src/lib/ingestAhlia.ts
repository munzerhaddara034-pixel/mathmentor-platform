import { readdir } from "node:fs/promises";
import path from "node:path";
import { AHLIA_BOOKS_DIR, isDuplicateAhliaFile, libraryPreview, metaForAhliaFile } from "./ahlia";
import { createId } from "./ids";
import { extractPdfPreview } from "./pdfPreview";
import type { LibraryItem, StoreData } from "./types";

export async function ingestAhliaBooks(existing: LibraryItem[]): Promise<{ added: LibraryItem[]; skipped: string[] }> {
  const added: LibraryItem[] = [];
  const skipped: string[] = [];
  let names: string[] = [];
  try {
    names = await readdir(AHLIA_BOOKS_DIR);
  } catch {
    return { added, skipped: ["missing-folder"] };
  }

  const known = new Set(existing.map((item) => item.fileName.toLowerCase()));
  const now = new Date().toISOString();

  for (const fileName of names) {
    if (!fileName.toLowerCase().endsWith(".pdf")) continue;
    if (isDuplicateAhliaFile(fileName)) {
      skipped.push(fileName);
      continue;
    }
    if (known.has(fileName.toLowerCase())) {
      skipped.push(fileName);
      continue;
    }
    const meta = metaForAhliaFile(fileName);
    const sourcePath = path.join(AHLIA_BOOKS_DIR, fileName);
    const preview = await extractPdfPreview(sourcePath);
    added.push({
      id: createId("lib"),
      title: meta.title,
      kind: meta.kind,
      track: meta.track,
      subject: meta.subject,
      language: meta.language,
      fileName,
      sourcePath,
      notes: meta.notes,
      extractedText: preview || libraryPreview({ title: meta.title, notes: meta.notes, fileName }),
      createdAt: now,
    });
    known.add(fileName.toLowerCase());
  }

  return { added, skipped };
}

export function withAhliaMerge(store: StoreData, added: LibraryItem[]): StoreData {
  return { ...store, library: [...added, ...store.library] };
}
