/**
 * Meta WhatsApp Cloud API (Graph) configuration shared by media download / upload / send.
 */
import { metaAccessToken } from "@/lib/whatsapp/adapter";

export { graphApiVersion, graphUrl } from "@/lib/whatsapp/graphBase";

export type MetaCredentials = { token: string; phoneNumberId: string };

export function metaCredentials(): MetaCredentials | null {
  const token = metaAccessToken();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

/** Short, secret-free error detail from a Graph response. */
export async function graphErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string; code?: number } };
      if (json.error?.message) return `${response.status} (${json.error.code ?? "?"}): ${json.error.message.slice(0, 200)}`;
    } catch {
      /* not JSON */
    }
    return `${response.status}: ${text.slice(0, 200)}`;
  } catch {
    return String(response.status);
  }
}
