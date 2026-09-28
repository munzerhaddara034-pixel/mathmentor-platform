import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = 'mathmentor_verify_token_2026';
const PHONE_NUMBER_ID = '133334783194073';
const ACCESS_TOKEN = 'EAAeSF50YIs0BStFj19E0iYufSHahNiZAkaXe26wBH6ScYkNe7A0QxmuvyRYD2U87YmfPUwIwbE1UOW634gpliaJ6H5WVTPDNFDykUXFIvksLJQft18i0AsaJtPYCIeZBYZBM6vH9GV9ekQzI060DMBlx0tPNLl1ZAsrqAuj42zgQFDxuOOtyj6snUkMeM1rnWghnp7WL9F7Dl6Wwn2SBgjXPtWpc2lhnaIbj8fMxacDtwTqyVZCkuLmPCDIQ9VVec3UCpA0qxhYvIkTnZA0MHw';

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

    if (!message || !message.text) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const fromNumber = message.from;
    const incomingText = message.text.body;

    console.log(`Received: "${incomingText}" from ${fromNumber}`);

    const replyText = `تم استلام رسالتك: "${incomingText}". أهلاً بك في منصة Math Mentor! كيف يمكننا مساعدتك اليوم؟`;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: fromNumber,
        type: 'text',
        text: { 
          preview_url: false,
          body: replyText 
        },
      }),
    });

    const resData = await response.json();
    console.log('Meta API Response:', JSON.stringify(resData));

    return NextResponse.json({ status: 'success', data: resData }, { status: 200 });
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
