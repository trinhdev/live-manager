# LiveSync — Multi-Brand Livestream Management

**LiveSync** là hệ thống quản trị nhân sự và xếp ca livestream thông minh, được tối ưu hóa giao diện di động (Mobile-First PWA). Ứng dụng hỗ trợ kiến trúc Multi-Brand (đa thương hiệu), giúp một Super Admin có thể quản trị đồng thời nhiều nhãn hàng, mỗi nhãn hàng sẽ có một không gian làm việc độc lập.

## 🌟 Tính năng Nổi bật

### Dành cho Super Admin (Quản trị hệ thống)
*   **Multi-Brand Dashboard:** Quản lý hàng loạt các thương hiệu, đối tác từ một bảng điều khiển duy nhất (tại đường dẫn gốc `/`).
*   **Fast-Switching:** Bấm vào một brand bất kỳ để nhảy thẳng vào Dashboard của brand đó quản lý nhân sự/ca live như một Manager mà không cần đăng nhập nhiều lần.
*   **Quản lý Brand:** Thêm, sửa, xoá thương hiệu, cấu hình link URL (slug) riêng cho từng khách hàng (VD: `domain.com/baselab`).

### Dành cho Quản lý (Manager)
*   **Xếp Ca Thông Minh:** Hệ thống cảnh báo tự động khi nhân sự đăng ký trùng ca, có tính năng "Xếp ca AI" (tự động phân bổ vào các ô trống).
*   **Quản ký Ca Live & Nhân Sự:** Tuỳ biến các khung giờ Ca Live (Sáng, Tối, Late Night). Lưu trữ hồ sơ nhân viên, phân Rank (S, A, B, C) và quản lý doanh thu.
*   **Phê duyệt Request:** Nhận và duyệt các yêu cầu Xin Nghỉ (Leave) hoặc Đổi Ca (Swap) từ nhân viên.
*   **Kẹp Ca / Điều phối Vận hành:** Giao diện điều phối trực quan cho Streamer và Nhân sự Vận Hành (Operations).

### Dành cho Nhân viên (Staff / Operations)
*   **Giao diện PWA Mobile-First:** Trải nghiệm chạm/vuốt tuyệt vời trên điện thoại di động giúp nhân sự thao tác đăng ký rảnh mọi lúc mọi nơi.
*   **Đăng ký Lịch Rảnh (Availability):** Cho phép tích chọn các ca bản thân có thể làm việc vào tuần sau. Hệ thống tự động lock khi quản lý đã chốt lịch.
*   **Yêu cầu Đổi ca/Nghỉ phép:** Gửi form xin nghỉ hoặc yêu cầu đổi ca trực tiếp cho Quản lý ngay trên nền tảng.

### Thông báo Tự động (Zalo/Telegram Bridge)
*   Hệ thống cho phép cấu hình URL Webhook để tự động gửi tin nhắn báo lịch làm việc vào nhóm chat (Zalo/Telegram).

---

## 🏗 Công nghệ Sử dụng

*   **Frontend:** React 18, Vite, TypeScript.
*   **Styling:** Tailwind CSS, Lucide Icons (bộ giao diện Dark-mode/Glassmorphism cực kỳ cao cấp, tối giản).
*   **Backend & Database:** Supabase (PostgreSQL) kết hợp Row-Level Security (RLS) để cô lập dữ liệu (Data Isolation) giữa các Brand.

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Khởi tạo Database (Supabase)
Dự án sử dụng cơ sở dữ liệu Supabase kết hợp các thủ tục PostgreSQL.

1.  Đăng ký và tạo Project tại [Supabase](https://supabase.com).
2.  Vào phần **SQL Editor**.
3.  Mở file `supabase_setup.sql` trong mã nguồn. Copy toàn bộ nội dung dán vào SQL Editor và nhấn **Run**.
    *Lệnh này sẽ tạo tự động đầy đủ bảng biểu (brands, users, schedule, shifts...), lập các Foreign Keys (hỗ trợ `ON UPDATE CASCADE`) và đổ sẵn dữ liệu mẫu.*

### 2. Thiết lập Biến môi trường
Tạo file `.env` tại thư mục gốc, copy cấu hình API từ Supabase (Settings > API):

```env
VITE_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=ey...[YOUR_ANON_KEY]...
```

### 3. Cài đặt và Chạy thử local
Bạn cần cài đặt Node.js từ phiên bản 18 trở lên.

```bash
# Cài đặt thư viện
npm install

# Khởi chạy máy chủ nội bộ
npm run dev
```

Truy cập hệ thống tại: `http://localhost:5173`

---

## 🔑 Hướng dẫn Sử dụng Sơ bộ

### Đăng nhập Super Admin
*   Truy cập vào trang xuất phát gốc: `http://localhost:5173/`
*   ID Đăng nhập: `superadmin`
*   Mật khẩu: `super123`

### Đăng nhập Quản lý (Manager) / Nhân sự (Staff)
*   Nhân sự thuộc Brand nào thì đăng nhập tại đường dẫn của Brand đó. Ví dụ Brand "BaseLab": `http://localhost:5173/baselab`
*   Nếu thử tạo Brand mẫu, mặc định sẽ có Manager là `admin` mật khẩu `admin`.

---

## 📅 Quy Trình Hoạt Động (Workflow)
1.  **Cuối tuần trước:** Staff sử dụng điện thoại vào trang Đăng ký rảnh để nộp danh sách lịch rảnh tuần sau.
2.  **Đầu tuần này:** Manager xem tổng hợp lịch rảnh, điều chỉnh nhân sự Streamer và Kỹ thuật vận hành cho vào form Ca Live.
3.  **Trong tuần:** Staff đến ca muốn đổi lịch sẽ submit Yêu Cầu đổi qua người khác. Quản lý duyệt hệ thống sẽ tự cập nhật mảng lịch.
4.  **Cuối tháng:** Super Admin có thể lướt xem tình trạng của mọi cửa hàng LiveStream trên hệ thống. 

> Bản quyền phát triển bởi trinhdev. Mọi thông tin tuân thủ theo các thiết chế kiến trúc Serverless, an toàn, ổn định và tốc độ cao.
