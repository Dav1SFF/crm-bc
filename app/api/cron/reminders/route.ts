import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS?.split(',') || [];

export async function GET(request: Request) {
  if (!BOT_TOKEN || ADMIN_IDS.length === 0) {
    return NextResponse.json({ error: "Telegram config missing" }, { status: 500 });
  }

  // Fetch all dealerships that have data. In a huge DB this should be filtered, but it's fine for CRM.
  const { data: dealerships, error } = await supabase.from('dealerships').select('id, name, reminders');

  if (error || !dealerships) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const now = new Date();
  let updates = 0;

  for (const dealership of dealerships) {
    if (!dealership.reminders || dealership.reminders.length === 0) continue;

    let modified = false;
    const updatedReminders = [...dealership.reminders];

    for (let i = 0; i < updatedReminders.length; i++) {
      const reminder = updatedReminders[i];
      const reminderDate = new Date(reminder.date);
      
      const diffMs = reminderDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      if (diffMinutes < 0) continue; // Already passed

      // Check 3 hours (180 mins)
      if (diffMinutes <= 180 && diffMinutes > 60 && !reminder.notified_3h) {
        await sendTelegramAlert(dealership.name, reminder, "через 3 часа (или менее)");
        updatedReminders[i].notified_3h = true;
        modified = true;
      }
      // Check 1 hour (60 mins)
      else if (diffMinutes <= 60 && diffMinutes > 15 && !reminder.notified_1h) {
        await sendTelegramAlert(dealership.name, reminder, "через час");
        updatedReminders[i].notified_1h = true;
        // If we missed the 3h one, mark it as well
        updatedReminders[i].notified_3h = true;
        modified = true;
      }
      // Check 15 mins
      else if (diffMinutes <= 15 && !reminder.notified_15m) {
        await sendTelegramAlert(dealership.name, reminder, "через 15 МИНУТ!");
        updatedReminders[i].notified_15m = true;
        updatedReminders[i].notified_1h = true;
        updatedReminders[i].notified_3h = true;
        modified = true;
      }
    }

    if (modified) {
      await supabase.from('dealerships').update({ reminders: updatedReminders }).eq('id', dealership.id);
      updates++;
    }
  }

  return NextResponse.json({ success: true, updates });
}

async function sendTelegramAlert(dealershipName: string, reminder: any, timeLeft: string) {
  const message = `🔔 *Напоминание: ${reminder.type}*\n\n🚗 Объект: *${dealershipName}*\n🕒 Время: ${new Date(reminder.date).toLocaleString('ru-RU')}\n⏳ Ожидается: *${timeLeft}*\n👤 От: ${reminder.author}`;

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
}
