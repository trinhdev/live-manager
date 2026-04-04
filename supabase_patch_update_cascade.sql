-- ============================================================
--  LiveSync — Patch: Cho phép sửa Username (ID)
--  Chạy file này trên Supabase SQL Editor để cập nhật khóa ngoại
-- ============================================================

-- 1. Table SCHEDULE
alter table schedule drop constraint if exists schedule_ops_user_id_fkey;
alter table schedule add constraint schedule_ops_user_id_fkey 
  foreign key (ops_user_id) references users(id) on delete set null on update cascade;

-- 2. Table AVAILABILITIES
alter table availabilities drop constraint if exists availabilities_user_id_fkey;
alter table availabilities add constraint availabilities_user_id_fkey 
  foreign key (user_id) references users(id) on delete cascade on update cascade;

-- 3. Table REQUESTS (user_id)
alter table requests drop constraint if exists requests_user_id_fkey;
alter table requests add constraint requests_user_id_fkey 
  foreign key (user_id) references users(id) on delete cascade on update cascade;

-- 4. Table REQUESTS (target_user_id)
alter table requests drop constraint if exists requests_target_user_id_fkey;
alter table requests add constraint requests_target_user_id_fkey 
  foreign key (target_user_id) references users(id) on delete set null on update cascade;

-- Kiểm tra
-- Đã thêm ON UPDATE CASCADE thành công. Bây giờ có thể đổi ID của users mà không bị lỗi.
