-- ============================================================
--  Migration: Add platform column to availabilities + requests
--  Chạy file này trong Supabase > SQL Editor > Run
--  ✅ An toàn - KHÔNG xóa dữ liệu cũ
-- ============================================================

-- 1. Thêm cột platform vào availabilities
alter table availabilities
  add column if not exists platform text not null default 'tiktok';

-- 2. Xóa unique constraint cũ (không có platform)
alter table availabilities
  drop constraint if exists availabilities_brand_id_user_id_week_id_day_index_shift_id_key;

-- 3. Thêm unique constraint mới (có platform)
alter table availabilities
  add constraint availabilities_unique
  unique (brand_id, user_id, week_id, day_index, shift_id, platform);

-- 4. Thêm cột platform vào requests (nếu chưa có)
alter table requests
  add column if not exists platform text not null default 'tiktok';

-- ============================================================
--  Sau khi chạy xong, tính năng "Đăng ký lịch rảnh" sẽ hoạt động
-- ============================================================
