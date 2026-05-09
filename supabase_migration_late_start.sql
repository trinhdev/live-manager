-- Migration: Add "Late Start" (Lên Trễ) columns to schedule table
-- Run this in Supabase SQL Editor

ALTER TABLE schedule
  ADD COLUMN IF NOT EXISTS late_start_minutes integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS late_reason text DEFAULT NULL;

-- Optional: add a comment for clarity
COMMENT ON COLUMN schedule.late_start_minutes IS 'Số phút lên trễ so với giờ ca gốc (NULL = đúng giờ)';
COMMENT ON COLUMN schedule.late_reason IS 'Lý do lên trễ (tùy chọn, ghi chú nội bộ)';
