-- ============================================================
--  Migration: Add brand_id to notifications table
--  Mục đích: Thông báo của brand nào chỉ hiển thị cho nhân sự brand đó
--  Chạy file này trong Supabase > SQL Editor > Run
-- ============================================================

-- 1. Add brand_id column (nullable for backward compatibility with existing notifications)
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Create index for faster brand-filtered queries
CREATE INDEX IF NOT EXISTS idx_notifications_brand_id ON public.notifications(brand_id);

-- Done! Existing notifications without brand_id will show globally (backward compatible).
-- New notifications will be scoped to the brand that created them.
