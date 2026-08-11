import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];

    if (!BOT_TOKEN || ADMIN_IDS.length === 0) {
      return NextResponse.json({ error: "Telegram config missing" }, { status: 500 });
    }

    for (const adminId of ADMIN_IDS) {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId.trim(),
            text: message,
            parse_mode: 'Markdown'
          })
        });
      } catch (e) {
        console.error("Telegram send error", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
