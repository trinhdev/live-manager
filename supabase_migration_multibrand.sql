-- ============================================================
--  LiveSync — Multi-Brand Migration
--  SAFE: không xóa tables hay data cũ
--  Paste toàn bộ vào Supabase > SQL Editor > Run
-- ============================================================


-- ─── STEP 1: Tạo bảng brands ─────────────────────────────────
create table if not exists brands (
  id         text primary key,    -- slug dùng trên URL: 'gimmetee'
  name       text not null,       -- Tên hiển thị: 'Gimmetee'
  logo_url   text,
  color      text default '#2563EB',
  active     boolean default true,
  created_at timestamptz default now()
);

alter table brands enable row level security;
create policy "allow_all_brands" on brands for all using (true) with check (true);


-- ─── STEP 2: Thêm cột brand_id vào các bảng hiện tại ─────────
alter table users          add column if not exists brand_id text references brands(id) on delete cascade;
alter table shifts         add column if not exists brand_id text references brands(id) on delete cascade;
alter table schedule       add column if not exists brand_id text references brands(id) on delete cascade;
alter table availabilities add column if not exists brand_id text references brands(id) on delete cascade;
alter table requests       add column if not exists brand_id text references brands(id) on delete cascade;


-- ─── STEP 3: Cập nhật constraint role của users (thêm SUPER_ADMIN) ─
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('SUPER_ADMIN', 'MANAGER', 'STAFF', 'OPERATIONS'));


-- ─── STEP 4: Tạo brand mặc định cho data hiện tại ─────────────
insert into brands (id, name, color)
values ('baselab', 'BaseLab', '#2563EB')
on conflict (id) do nothing;


-- ─── STEP 5: Gán toàn bộ data cũ vào brand 'default' ─────────
update users          set brand_id = 'baselab' where brand_id is null and role != 'SUPER_ADMIN';
update shifts         set brand_id = 'baselab' where brand_id is null;
update schedule       set brand_id = 'baselab' where brand_id is null;
update availabilities set brand_id = 'baselab' where brand_id is null;
update requests       set brand_id = 'baselab' where brand_id is null;


-- ─── STEP 6: Tạo tài khoản Super Admin ────────────────────────
insert into users (id, name, role, password, avatar)
values (
  'superadmin',
  'Super Admin',
  'SUPER_ADMIN',
  'super123',
  'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=171717&fontColor=ffffff'
)
on conflict (id) do nothing;


-- ─── STEP 7: Cập nhật UNIQUE constraints (thêm brand_id) ──────
-- Schedule
alter table schedule drop constraint if exists schedule_week_id_day_index_shift_id_key;
alter table schedule add constraint schedule_brand_week_day_shift_uniq
  unique (brand_id, week_id, day_index, shift_id);

-- Availabilities
alter table availabilities drop constraint if exists availabilities_user_id_week_id_day_index_shift_id_key;
alter table availabilities add constraint availabilities_brand_user_week_day_shift_uniq
  unique (brand_id, user_id, week_id, day_index, shift_id);


-- ─── VERIFY ──────────────────────────────────────────────────
-- Chạy các query dưới để kiểm tra:
-- select * from brands;
-- select id, name, role, brand_id from users order by brand_id;
-- select count(*) from shifts where brand_id = 'baselab';
