import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = 'mathmentor_verify_token_2026';
const PHONE_NUMBER_ID = '133334783194073';

// انسخ الرمز الطويل الظاهر في خانة (رمز الوصول) بصفحة Meta وضعه هنا بين علامتي التنصيص
const ACCESS_TOKEN = 'الصق_رمز_الوصول_هنا';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse('Verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.from) {
      const fromNumber = message.from;
      const incomingText = message.text?.body || '';

      console.log(`Received: "${incomingText}" from ${fromNumber}`);

      // نص الرد التلقائي
      const replyMessage = `أهلاً بك في منصة Math Mentor التعليمية! 📐✨\nتم استلام رسالتك: "${incomingText}". كيف يمكننا مساعدتك اليوم؟`;

      await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fromNumber,
          type: 'text',
          text: { body: replyMessage },
        }),
      });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
