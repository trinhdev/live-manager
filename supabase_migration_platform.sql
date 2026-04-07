-- ============================================================
--  LiveSync — Platform Migration (TikTok + Shopee)
--  Chạy file này trên Supabase > SQL Editor > Run
--  File này KHÔNG xóa dữ liệu cũ, chỉ ALTER thêm cột.
-- ============================================================

-- ─── 1. USERS: thêm cột platforms (array) ────────────────────
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{tiktok}';

-- Cập nhật dữ liệu cũ: user chưa có platforms → gán tiktok
UPDATE users SET platforms = '{tiktok}' WHERE platforms IS NULL;

-- ─── 2. SHIFTS: thêm cột platform ───────────────────────────
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok' 
CHECK (platform IN ('tiktok', 'shopee'));

-- Cập nhật dữ liệu cũ
UPDATE shifts SET platform = 'tiktok' WHERE platform IS NULL;

-- ─── 3. SCHEDULE: thêm cột platform ─────────────────────────
ALTER TABLE schedule 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok' 
CHECK (platform IN ('tiktok', 'shopee'));

-- Cập nhật dữ liệu cũ
UPDATE schedule SET platform = 'tiktok' WHERE platform IS NULL;

-- Cập nhật unique constraint (drop old, create new)
ALTER TABLE schedule DROP CONSTRAINT IF EXISTS schedule_brand_id_week_id_day_index_shift_id_key;
ALTER TABLE schedule ADD CONSTRAINT schedule_brand_platform_week_day_shift_key 
  UNIQUE (brand_id, platform, week_id, day_index, shift_id);

-- ─── 4. AVAILABILITIES: thêm cột platform ───────────────────
ALTER TABLE availabilities 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok' 
CHECK (platform IN ('tiktok', 'shopee'));

-- Cập nhật dữ liệu cũ
UPDATE availabilities SET platform = 'tiktok' WHERE platform IS NULL;

-- Cập nhật unique constraint
ALTER TABLE availabilities DROP CONSTRAINT IF EXISTS availabilities_brand_id_user_id_week_id_day_index_shift_id_key;
ALTER TABLE availabilities ADD CONSTRAINT availabilities_brand_platform_user_week_day_shift_key 
  UNIQUE (brand_id, platform, user_id, week_id, day_index, shift_id);

-- ─── 5. REQUESTS: thêm cột platform ─────────────────────────
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok' 
CHECK (platform IN ('tiktok', 'shopee'));

-- Cập nhật dữ liệu cũ
UPDATE requests SET platform = 'tiktok' WHERE platform IS NULL;

-- ─── 6. SEED: Ca live mẫu cho Shopee ─────────────────────────
-- (Chỉ insert nếu chưa tồn tại)
INSERT INTO shifts (id, name, start_time, end_time, color, brand_id, platform) VALUES
  ('baselab-shopee-morning', 'Ca Sáng', '08:00', '12:00', 'bg-orange-100 text-orange-800 border-orange-200', 'baselab', 'shopee'),
  ('baselab-shopee-afternoon', 'Ca Chiều', '13:00', '17:00', 'bg-blue-100 text-blue-800 border-blue-200', 'baselab', 'shopee'),
  ('baselab-shopee-evening', 'Ca Tối', '19:00', '23:00', 'bg-purple-100 text-purple-800 border-purple-200', 'baselab', 'shopee')
ON CONFLICT (id) DO NOTHING;

-- Done! 🎉
