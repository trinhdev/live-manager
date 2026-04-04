
// api/webhook.js
export default async function handler(req, res) {
  // 1. Cấu hình CORS (QUAN TRỌNG: Phải đặt đầu tiên)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Parse Body an toàn
  let body = req.body;
  if (!body) {
      return res.status(400).json({ error: 'Empty Request Body' });
  }
  // Trong Vercel Function, req.body thường đã là object nếu Header là application/json
  // Nếu là string thì parse lại cho chắc
  if (typeof body === 'string') {
      try {
          body = JSON.parse(body);
      } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON body' });
      }
  }

  const { type, table, record, old_record, text } = body;
  
  // 3. Lấy Credentials từ Env Vars (Server Side)
  // Đây là nơi lấy biến môi trường bạn đã cài đặt trên Vercel
  const BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
  const GROUP_ID = process.env.ZALO_GROUP_ID;

  if (!BOT_TOKEN || !GROUP_ID) {
    console.error("❌ Missing Zalo Config (Env vars). Check Vercel Settings.");
    return res.status(500).json({ 
        error: 'Server Misconfiguration', 
        details: 'ZALO_BOT_TOKEN or ZALO_GROUP_ID is missing in Vercel Environment Variables.' 
    });
  }

  console.log(`Webhook received. Table: ${table || 'N/A'}, Type: ${type || 'MANUAL_TEST'}`);

  let message = '';

  // --- TRƯỜNG HỢP 0: TEST THỦ CÔNG TỪ GIAO DIỆN APP ---
  if (text && !table) {
      message = text;
      console.log("Processing manual test message:", text);
  }

  // --- TRƯỜNG HỢP 1: SUPABASE EVENTS ---
  else if (table === 'requests' && type === 'INSERT') {
    const typeStr = record.type === 'LEAVE' ? 'XIN NGHỈ' : 'XIN ĐỔI CA';
    const dayStr = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'][record.day_index] || 'Ngày khác';
    message = `🔔 [YÊU CẦU MỚI]\n👤 ${record.user_name}\n📝 ${typeStr} - ${dayStr}\n💬 "${record.reason}"`;
  }
  else if (table === 'users' && type === 'UPDATE') {
    if (!old_record?.is_availability_submitted && record.is_availability_submitted) {
      message = `✅ [ĐĂNG KÝ]\n👤 ${record.name} đã nộp lịch rảnh.`;
    }
  }

  // 4. Gửi đến Zalo API
  if (message) {
    try {
      const zaloUrl = `https://openapi.zalo.me/v2.0/oa/message?access_token=${BOT_TOKEN}`;
      const payload = {
        recipient: { user_id: GROUP_ID },
        message: { text: message }
      };

      console.log("Sending to Zalo...");
      const zRes = await fetch(zaloUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const zData = await zRes.json();
      console.log("Zalo Response:", zData);
      
      if (zData.error !== 0) {
          // Trả về lỗi chi tiết từ Zalo để Client biết
          return res.status(400).json({ 
              error: 'Zalo API Error', 
              zaloError: zData.error, 
              zaloMessage: zData.message 
          });
      }

      return res.status(200).json({ success: true, zalo: zData });

    } catch (e) {
      console.error("Fetch Error:", e);
      return res.status(500).json({ error: 'Internal Server Error during Zalo fetch', details: e.message });
    }
  }

  return res.status(200).json({ message: 'No notification needed (Logic skipped)' });
}
