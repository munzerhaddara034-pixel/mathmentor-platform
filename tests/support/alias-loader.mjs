import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function probe(base) {
  if (isFile(base)) return base;
  for (const ext of EXTENSIONS) if (isFile(base + ext)) return base + ext;
  for (const ext of EXTENSIONS) if (isFile(path.join(base, `index${ext}`))) return path.join(base, `index${ext}`);
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = probe(path.join(SRC, specifier.slice(2)));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }
  const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : "";
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && parent.startsWith(SRC) && !path.extname(specifier)) {
    const found = probe(path.resolve(path.dirname(parent), specifier));
    if (found && existsSync(found)) return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
