/**
 * Twilio WhatsApp notification helper
 * Sends combined waste submission alert to admin via WhatsApp
 */

interface StationData {
  kategoriInduk: string;
  productList: string[];
  jumlahProdukList: number[];
  unitList: string[];
}

interface WasteNotifData {
  storeName: string;
  shift: string;
  tanggal: string;
  submittedBy?: string;
  stations: StationData[];
}

// Station icon mapping
function getStationIcon(station: string): string {
  const s = station.toUpperCase();
  if (s.includes('NOODLE') || s.includes('MIE')) return '🍜';
  if (s.includes('DIMSUM')) return '🥟';
  if (s.includes('BAR') || s.includes('DRINK') || s.includes('BEVERAGE')) return '🍹';
  if (s.includes('PRODUKSI') || s.includes('KITCHEN')) return '🏭';
  if (s.includes('FOOD')) return '🍽️';
  return '📦';
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

  // Build station sections
  const stationSections = data.stations.map(st => {
    const icon = getStationIcon(st.kategoriInduk);
    const items = st.productList.map((product, i) => {
      const qty = st.jumlahProdukList[i] || 0;
      const unit = st.unitList[i] || 'PCS';
      return `  • ${product} — ${qty} ${unit}`;
    }).join('\n');
    return `${icon} *${st.kategoriInduk}*\n${items}`;
  }).join('\n\n');

  const totalItems = data.stations.reduce((sum, st) => sum + st.productList.length, 0);

  const message = `✅ *WASTE SUKSES!*

🏪 *Resto:* ${data.storeName}
📅 *Tanggal:* ${data.tanggal}
⏰ *Shift:* ${data.shift}
📊 *Station:* ${data.stations.length} station | ${totalItems} item
👤 *Dilaporkan Oleh:* ${data.submittedBy || 'Unknown'}

📋 *Data Waste-nya ini wak:*

${stationSections}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

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
      console.log('[Twilio WA] Combined notification sent successfully');
    }
  } catch (err) {
    console.error('[Twilio WA] Failed to send:', err);
  }
}
