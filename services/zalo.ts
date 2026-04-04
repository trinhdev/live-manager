
import { User, ShiftRequest, Shift } from '../types';
import { DAYS_OF_WEEK } from '../constants';

export interface ZaloConfig {
  webhookUrl: string; 
  botToken: string;   
  groupId: string;    
}

export const ZaloService = {
  config: null as ZaloConfig | null,

  setConfig: (config: ZaloConfig) => {
    ZaloService.config = config;
  },

  /**
   * Helper function để gửi request
   */
  sendRequest: async (text: string) => {
    if (!ZaloService.config) return false;
    const { botToken, groupId, webhookUrl } = ZaloService.config;

    // ==========================================
    // STRATEGY 1: WEBHOOK (Ưu tiên nhất nếu có)
    // ==========================================
    if (webhookUrl && webhookUrl.trim() !== "") {
       // Bỏ qua nếu là link trang chủ zalo
       if (webhookUrl.includes('zalo.me') && !webhookUrl.includes('api')) {
           // Fallthrough
       } else {
           console.log("🚀 Sending generic webhook to:", webhookUrl);
           try {
               // 1.1 Direct Webhook (Standard CORS)
               // Server (api/webhook.js) đã cấu hình CORS, nên ta KHÔNG dùng 'no-cors' nữa
               // để có thể đọc được phản hồi lỗi nếu có.
               const res = await fetch(webhookUrl, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ text, message: text, chat_id: groupId })
               });

               if (!res.ok) {
                   const errData = await res.json().catch(() => ({}));
                   console.error("Webhook Error Response:", errData);
                   throw new Error(errData.error || `Server Error ${res.status}`);
               }

               const data = await res.json();
               console.log("✅ Webhook sent success:", data);
               return true;

           } catch (e: any) {
               console.error("Webhook failed:", e);
               // Nếu webhook thất bại, ta ném lỗi ra để UI hiển thị
               throw new Error(`Webhook Failed: ${e.message}`);
           }
       }
    }

    // ==========================================
    // STRATEGY 2: NATIVE ZALO OA (Chính Hãng - Client Side)
    // ==========================================
    // Chỉ chạy nếu Webhook không được cấu hình hoặc thất bại (nhưng ở trên ta throw error rồi)
    // Phần này dùng để test Token nhập tay trực tiếp ở client (nếu không dùng Webhook)
    if (botToken && groupId) {
        const payload = {
            recipient: { user_id: groupId },
            message: { text: text }
        };
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'access_token': botToken
        };
        
        // 2.1: Thử Public Proxies (CorsProxy)
        // Lưu ý: Token gửi qua Query Param để tránh bị Proxy lọc mất Header
        const targetUrlWithToken = `https://openapi.zalo.me/v2.0/oa/message?access_token=${botToken}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrlWithToken)}`;

        try {
            console.log("Trying Client Proxy:", proxyUrl);
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (data && data.error === 0) {
                console.log("✅ Zalo sent via Public Proxy");
                return true;
            } else {
                console.error("❌ Zalo API Error:", data);
                const msg = data.message || `Error Code: ${data.error}`;
                throw new Error(`Zalo API Error: ${msg}`);
            }
        } catch (e: any) {
            console.warn("Proxy attempt failed", e);
            throw new Error(`Direct Send Failed: ${e.message}`);
        }
    }

    throw new Error("Chưa cấu hình Webhook URL hoặc Bot Token/Group ID");
  },

  testConnection: async (config: ZaloConfig) => {
    const oldConfig = ZaloService.config;
    ZaloService.setConfig(config);
    
    try {
        // Gửi tin nhắn
        await ZaloService.sendRequest("🔔 [LiveSync] Kết nối thành công! Hệ thống đã sẵn sàng.");
        if (!oldConfig) ZaloService.setConfig(config);
        return { success: true, message: "OK" };
    } catch (e: any) {
        if (!oldConfig) ZaloService.setConfig(config);
        return { success: false, message: e.message };
    }
  },

  sendMessage: async (message: string) => {
    try {
        await ZaloService.sendRequest(message);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
  },

  notifyNewRequest: async (request: ShiftRequest, manager: User, shift: Shift) => {
    const typeStr = request.type === 'LEAVE' ? 'XIN NGHỈ' : 'XIN ĐỔI CA';
    const dayStr = DAYS_OF_WEEK[request.dayIndex];
    const swapInfo = request.type === 'SWAP' ? `\n🔄 Đề xuất: ${request.targetUserName}` : '';
    
    const message = `🔔 [YÊU CẦU MỚI]\n👤 Nhân sự: ${request.userName}\n📝 Loại: ${typeStr}\n📅 Ca: ${dayStr} (${shift.name})${swapInfo}\n💬 Lý do: ${request.reason}\n👉 Quản lý kiểm tra app!`;
    
    return ZaloService.sendMessage(message);
  },

  notifyAvailabilitySubmitted: async (user: User, manager: User) => {
    const message = `✅ [ĐĂNG KÝ LỊCH]\n👤 ${user.name} đã gửi lịch rảnh tuần tới.`;
    return ZaloService.sendMessage(message);
  },

  notifyScheduleFinalized: async (staffList: User[]) => {
    const message = `📅 [LỊCH TUẦN MỚI]\nAdmin đã chốt lịch Live tuần tới.\n👉 Mọi người vào app kiểm tra ca trực nhé!`;
    return ZaloService.sendMessage(message);
  },

  notifyShiftReminder: async (user: User, shift: Shift, dayName: string) => {
    const message = `⏰ [NHẮC CA LIVE]\n👋 ${user.name} ơi,\nBạn có ca ${shift.name} hôm nay (${dayName}).\nKhung giờ: ${shift.startTime} - ${shift.endTime}.\nLên sóng đúng giờ nhé! 🚀`;
    return ZaloService.sendMessage(message);
  }
};
