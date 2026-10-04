/** Random part from the platform CSPRNG (Web Crypto: same API in Node and the browser). */
function randomSuffix(bytes = 5): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${randomSuffix()}`;
}
