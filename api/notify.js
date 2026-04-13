// api/notify.js — Vercel Serverless Function
// Gửi OneSignal push từ server-side: an toàn hơn, đáng tin hơn client-side

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Lấy key từ server env (không cần VITE_ prefix — không bị expose ra browser)
  const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
  const APP_ID = process.env.ONESIGNAL_APP_ID;

  if (!REST_API_KEY || !APP_ID) {
    console.error('[notify] OneSignal env vars missing');
    return res.status(500).json({ error: 'OneSignal not configured on server' });
  }

  const { title, message, targetUserIds } = req.body || {};

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  const payload = {
    app_id: APP_ID,
    headings: { en: title, vi: title },
    contents: { en: message, vi: message },
    target_channel: 'push',
  };

  // Gửi đến user cụ thể hoặc broadcast tất cả
  if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    payload.include_aliases = { external_id: targetUserIds };
  } else {
    payload.included_segments = ['All'];
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('[notify] OneSignal response:', data);

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[notify] OneSignal push error:', error);
    return res.status(500).json({ error: 'Failed to send push notification' });
  }
}
