import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Netlify Functions / AWS Lambda can only persist files under /tmp. */
export function isServerlessRuntime() {
  return Boolean(
    process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY_DEV === "true",
  );
}

export function platformDataDir() {
  if (isServerlessRuntime()) return "/tmp/mathmentor-data";
  return path.join(process.cwd(), "data");
}

export function dataFile(name: string) {
  return path.join(platformDataDir(), name);
}

export async function ensureDataDir() {
  await mkdir(platformDataDir(), { recursive: true });
  return platformDataDir();
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await readFile(dataFile(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeFile(dataFile(name), JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export async function writeJsonFile<T>(name: string, data: T) {
  await ensureDataDir();
  await writeFile(dataFile(name), JSON.stringify(data, null, 2), "utf8");
}
