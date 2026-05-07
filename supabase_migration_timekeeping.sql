-- Migration: Tạo bảng timekeeping để lưu tiền hỗ trợ
-- Chạy trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS timekeeping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  brand_id text,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year  integer NOT NULL,
  bonus_amount integer NOT NULL DEFAULT 0,
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, brand_id, month, year)
);

-- Index để query nhanh theo brand + tháng
CREATE INDEX IF NOT EXISTS idx_timekeeping_brand_month
  ON timekeeping(brand_id, year, month);

-- Enable RLS (nếu dùng Supabase Auth - bỏ qua nếu dùng service key)
-- ALTER TABLE timekeeping ENABLE ROW LEVEL SECURITY;
