/**
 * Twilio WhatsApp notification helper
 * Sends waste submission alerts to admin via WhatsApp
 */

interface WasteNotifData {
  kategoriInduk: string;
  storeName: string;
  shift: string;
  tanggal: string;
  productList: string[];
  jumlahProdukList: number[];
  unitList: string[];
  submittedBy?: string;
}

export async function sendWhatsAppNotif(data: WasteNotifData): Promise<void> {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WA_SENDER,
    TWILIO_WA_ADMIN,
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WA_SENDER || !TWILIO_WA_ADMIN) {
    console.warn('[Twilio WA] Missing env vars, skipping notification');
    return;
  }

  // Build item summary (max 10 items shown)
  const items = data.productList.slice(0, 10).map((product, i) => {
    const qty = data.jumlahProdukList[i] || 0;
    const unit = data.unitList[i] || 'PCS';
    return `• ${product} — ${qty} ${unit}`;
  }).join('\n');

  const moreItems = data.productList.length > 10
    ? `\n... dan ${data.productList.length - 10} item lainnya`
    : '';

  const totalItems = data.productList.length;

  const message = `🗑️ *WASTE SUBMISSION*

📍 *Store:* ${data.storeName}
📅 *Tanggal:* ${data.tanggal}
⏰ *Shift:* ${data.shift}
🏷️ *Kategori:* ${data.kategoriInduk}
👤 *Submitted by:* ${data.submittedBy || 'Unknown'}

📦 *${totalItems} Item(s):*
${items}${moreItems}

✅ Data berhasil disimpan ke Google Sheets.`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  // Manually encode to avoid URLSearchParams converting '+' to spaces
  const bodyParts = [
    `From=${encodeURIComponent(`whatsapp:${TWILIO_WA_SENDER}`)}`,
    `To=${encodeURIComponent(`whatsapp:${TWILIO_WA_ADMIN}`)}`,
    `Body=${encodeURIComponent(message)}`,
  ];
  const bodyStr = bodyParts.join('&');

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyStr,
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[Twilio WA] Error ${resp.status}:`, errBody);
    } else {
      console.log('[Twilio WA] Notification sent successfully');
    }
  } catch (err) {
    console.error('[Twilio WA] Failed to send:', err);
  }
}
