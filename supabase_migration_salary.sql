-- Migration: Thêm cột hourly_rate vào bảng users
-- Chạy lệnh này trong Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate INTEGER DEFAULT 0;

-- Comment: hourly_rate = số tiền VNĐ mỗi giờ live
-- Ví dụ: 50000 = 50.000 VNĐ/giờ
-- Tính lương = (số giờ live + overtime_minutes/60) × hourly_rate
