// «محمد» يراسل الأستاذ منذر على واتساب رقم المنصة: النص والملف، والتنبيه الصريح حين لا تكون القناة مهيّأة.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// The provider must stay unconfigured here: these tests must never send a real WhatsApp message.
for (const key of [
  "WHATSAPP_PROVIDER",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_PHONE_ID",
  "ULTRAMSG_INSTANCE_ID",
  "ULTRAMSG_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
]) {
  delete process.env[key];
}

const owner = await import("../src/lib/team/ownerWhatsApp.ts");
const actions = await import("../src/lib/team/mohamedActions.ts");

describe("owner WhatsApp from the team chat", () => {
  test("the owner's number is the platform instructor number, never the Whish wallet", () => {
    assert.equal(owner.ownerWhatsAppNumber().replace(/\D/g, ""), "96176532421");
  });

  test("an empty request is refused", async () => {
    const result = await owner.sendOwnerWhatsApp({ text: "   " });
    assert.equal(result.ok, false);
    assert.equal(result.sent, false);
    assert.match(result.detailAr, /لا نص ولا ملف/);
  });

  test("without a configured provider nothing is sent and the notice says so", async () => {
    const result = await owner.sendOwnerWhatsApp({ text: "موجز اليوم" });
    assert.equal(result.sent, false);
    assert.equal(result.ok, false);
    assert.match(result.detailAr, /غير مهيّأة/);
  });

  test("a missing attachment is reported instead of pretending it was sent", async () => {
    const result = await owner.sendOwnerWhatsApp({ text: "الملف", file: { attachmentId: "tatt_missing" } });
    assert.equal(result.sent, false);
    assert.equal(result.ok, false);
    assert.match(result.detailAr, /غير مهيّأة|لم أجد المرفق/);
  });

  test("Mohamed's whatsapp block is stripped from the reply and reported in the chat", async () => {
    const reply = 'تمام يا أستاذ منذر.\n```mm-actions\n{"whatsapp":[{"text":"موجز اليوم: 3 اشتراكات جديدة"}]}\n```';
    const { text, recorded } = await actions.applyMohamedActions(reply);
    assert.equal(text.includes("mm-actions"), false);
    assert.equal(text.includes("موجز اليوم"), false);
    assert.equal(recorded.length, 1);
    assert.match(recorded[0], /^واتساب: /);
  });
});
