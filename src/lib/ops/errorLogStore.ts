/**
 * Node-only adapter that gives `./errorLog` its persistence: one locked JSON document in the same store as
 * the rest of the platform (Postgres when configured, file otherwise). Importing this module registers the
 * adapter; the edge runtime never loads it, so the `onRequestError` hook stays runtime-agnostic.
 */
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { normalizeOpsErrors, setOpsErrorStore, type OpsErrorEntry } from "./errorLog";

export const OPS_ERRORS_DOCUMENT = "ops-errors.json";

type Document = { errors: OpsErrorEntry[] };
const EMPTY: Document = { errors: [] };

export function registerOpsErrorStore(): void {
  setOpsErrorStore({
    async read(): Promise<OpsErrorEntry[]> {
      const document = await readJsonFile<Document>(OPS_ERRORS_DOCUMENT, EMPTY, { persistFallback: false });
      return normalizeOpsErrors(document?.errors);
    },
    async update(mutate: (entries: OpsErrorEntry[]) => OpsErrorEntry[]): Promise<OpsErrorEntry[]> {
      const saved = await updateJsonFile<Document>(OPS_ERRORS_DOCUMENT, EMPTY, (current) => ({ errors: mutate(normalizeOpsErrors(current?.errors)) }));
      return normalizeOpsErrors(saved?.errors);
    },
  });
}

registerOpsErrorStore();