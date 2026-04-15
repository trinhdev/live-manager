-- ============================================================
--  LiveSync — Master Supabase Schema (Multi-Brand Architecture)
--  Copy toàn bộ file này, paste vào Supabase > SQL Editor > Run
--  CẢNH BÁO: Lệnh này sẽ XÓA TOÀN BỘ dữ liệu cũ và tạo lại từ đầu.
-- ============================================================

-- ─── 0. EXTENSIONS ───────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── 1. DROP EXISTING TABLES (Resetting DB) ──────────────────
drop table if exists requests cascade;
drop table if exists availabilities cascade;
drop table if exists schedule cascade;
drop table if exists shifts cascade;
drop table if exists users cascade;
drop table if exists brands cascade;

-- ─── 2. TABLE: brands ────────────────────────────────────────
create table brands (
  id         text primary key,    -- slug: 'baselab', 'gimmetee'
  name       text not null,
  logo_url   text,
  color      text default '#2563EB',
  active     boolean default true,
  created_at timestamptz default now()
);
alter table brands enable row level security;
create policy "allow_all_brands" on brands for all using (true) with check (true);

-- ─── 3. TABLE: users ─────────────────────────────────────────
create table users (
  id                        text primary key,
  name                      text not null,
  role                      text not null check (role in ('SUPER_ADMIN', 'MANAGER', 'STAFF', 'OPERATIONS')),
  rank                      text check (rank in ('S', 'A', 'B', 'C')),
  password                  text not null,
  avatar                    text,
  revenue                   bigint default 0,
  zalo_phone                text,
  is_availability_submitted boolean default false,
  brand_id                  text references brands(id) on delete cascade on update cascade,
  created_at                timestamptz default now()
);
alter table users enable row level security;
create policy "allow_all_users" on users for all using (true) with check (true);
alter table users add column if not exists platforms jsonb default '["tiktok"]';

-- ─── 4. TABLE: shifts ────────────────────────────────────────
create table shifts (
  id          text primary key,
  name        text not null,
  start_time  text not null,
  end_time    text not null,
  color       text default 'bg-slate-100 text-slate-800 border-slate-200',
  brand_id    text references brands(id) on delete cascade on update cascade,
  platform    text not null default 'tiktok',
  created_at  timestamptz default now()
);
alter table shifts enable row level security;
create policy "allow_all_shifts" on shifts for all using (true) with check (true);

-- ─── 5. TABLE: schedule ──────────────────────────────────────
create table schedule (
  id                    text primary key,
  week_id               text not null,
  day_index             int  not null,
  shift_id              text not null references shifts(id) on delete cascade on update cascade,
  ops_user_id           text references users(id) on delete set null on update cascade,
  brand_id              text references brands(id) on delete cascade on update cascade,
  note                  text,
  is_finalized          boolean default false,
  streamer_assignments  jsonb default '[]',
  platform              text not null default 'tiktok',
  created_at            timestamptz default now(),
  unique (brand_id, week_id, day_index, shift_id, platform)
);
alter table schedule enable row level security;
create policy "allow_all_schedule" on schedule for all using (true) with check (true);

-- ─── 6. TABLE: availabilities ────────────────────────────────
create table availabilities (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text not null references users(id) on delete cascade on update cascade,
  week_id     text not null,
  day_index   int  not null,
  shift_id    text not null references shifts(id) on delete cascade on update cascade,
  brand_id    text references brands(id) on delete cascade on update cascade,
  platform    text not null default 'tiktok',
  created_at  timestamptz default now(),
  unique (brand_id, user_id, week_id, day_index, shift_id, platform)
);
alter table availabilities enable row level security;
create policy "allow_all_availabilities" on availabilities for all using (true) with check (true);

-- ─── 7. TABLE: requests ──────────────────────────────────────
create table requests (
  id               text primary key,
  user_id          text not null references users(id) on delete cascade on update cascade,
  user_name        text not null,
  type             text not null check (type in ('LEAVE', 'SWAP')),
  week_id          text not null,
  day_index        int  not null,
  shift_id         text not null references shifts(id) on delete cascade on update cascade,
  brand_id         text references brands(id) on delete cascade on update cascade,
  platform         text not null default 'tiktok',
  reason           text not null,
  target_user_id   text references users(id) on delete set null on update cascade,
  target_user_name text,
  status           text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       bigint not null
);
alter table requests enable row level security;
create policy "allow_all_requests" on requests for all using (true) with check (true);

-- ─── 8. SEED DATA ────────────────────────────────────────────

-- Super Admin
insert into users (id, name, role, password, avatar) values
  ('superadmin', 'Super Admin', 'SUPER_ADMIN', 'super123', 'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=171717&fontColor=ffffff');

-- Brand mẫu: BaseLab
insert into brands (id, name, color) values 
  ('baselab', 'BaseLab', '#2563EB');

-- Nhân sự mẫu của BaseLab
insert into users (id, name, role, rank, password, avatar, brand_id) values
  ('admin', 'Quản Lý Chính', 'MANAGER', 'S', 'admin', 'https://picsum.photos/id/1/200/200', 'baselab'),
  ('u1', 'Hương Live', 'STAFF', 'S', '123', 'https://picsum.photos/id/64/200/200', 'baselab');

-- Ca live mẫu của BaseLab (thêm GUID đơn giản dể làm shift_id, hoặc dùng string định dạng)
insert into shifts (id, name, start_time, end_time, color, brand_id, platform) values
  ('baselab-morning', 'Ca Sáng', '08:00', '12:00', 'bg-orange-100 text-orange-800 border-orange-200', 'baselab', 'tiktok'),
  ('baselab-evening', 'Ca Tối (Prime)', '19:00', '23:00', 'bg-purple-100 text-purple-800 border-purple-200', 'baselab', 'tiktok');

-- ─── 9. REALTIME: Enable for all key tables (safe, idempotent) ─
-- Dùng DO block để tránh lỗi "already member of publication"
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedule','users','availabilities','shifts','notifications','requests']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      RAISE NOTICE 'Added table % to supabase_realtime', t;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime, skipping', t;
    END IF;
  END LOOP;
END $$;
