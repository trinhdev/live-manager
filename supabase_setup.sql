-- ============================================================
--  LiveSync — Supabase Schema + Seed Data
--  Copy toàn bộ file này, paste vào Supabase > SQL Editor > Run
-- ============================================================


-- ─── 1. EXTENSIONS ───────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─── 2. DROP existing tables (nếu cần reset) ─────────────────
drop table if exists requests cascade;
drop table if exists availabilities cascade;
drop table if exists schedule cascade;
drop table if exists shifts cascade;
drop table if exists users cascade;


-- ─── 3. TABLE: users ─────────────────────────────────────────
create table users (
  id                      text primary key,
  name                    text not null,
  role                    text not null check (role in ('MANAGER', 'STAFF', 'OPERATIONS')),
  rank                    text check (rank in ('S', 'A', 'B', 'C')),
  password                text not null,
  avatar                  text,
  revenue                 bigint default 0,
  zalo_phone              text,
  is_availability_submitted boolean default false,
  created_at              timestamptz default now()
);

-- RLS: cho phép đọc/ghi không cần auth (app dùng password riêng)
alter table users enable row level security;
create policy "allow_all_users" on users for all using (true) with check (true);


-- ─── 4. TABLE: shifts ────────────────────────────────────────
create table shifts (
  id          text primary key,
  name        text not null,
  start_time  text not null,
  end_time    text not null,
  color       text default 'bg-slate-100 text-slate-800 border-slate-200',
  created_at  timestamptz default now()
);

alter table shifts enable row level security;
create policy "allow_all_shifts" on shifts for all using (true) with check (true);


-- ─── 5. TABLE: schedule ──────────────────────────────────────
create table schedule (
  id                    text primary key,
  week_id               text not null,       -- "2026-04-W1"
  day_index             int  not null,       -- 0=Thứ2 … 6=CN
  shift_id              text not null references shifts(id) on delete cascade,
  ops_user_id           text references users(id) on delete set null,
  note                  text,
  is_finalized          boolean default false,
  streamer_assignments  jsonb default '[]',  -- [{userId, timeLabel?}]
  created_at            timestamptz default now(),
  unique (week_id, day_index, shift_id)
);

alter table schedule enable row level security;
create policy "allow_all_schedule" on schedule for all using (true) with check (true);


-- ─── 6. TABLE: availabilities ────────────────────────────────
create table availabilities (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text not null references users(id) on delete cascade,
  week_id     text not null,
  day_index   int  not null,
  shift_id    text not null references shifts(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, week_id, day_index, shift_id)
);

alter table availabilities enable row level security;
create policy "allow_all_availabilities" on availabilities for all using (true) with check (true);


-- ─── 7. TABLE: requests ──────────────────────────────────────
create table requests (
  id               text primary key,
  user_id          text not null references users(id) on delete cascade,
  user_name        text not null,
  type             text not null check (type in ('LEAVE', 'SWAP')),
  week_id          text not null,
  day_index        int  not null,
  shift_id         text not null references shifts(id) on delete cascade,
  reason           text not null,
  target_user_id   text references users(id) on delete set null,
  target_user_name text,
  status           text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       bigint not null  -- Unix timestamp ms
);

alter table requests enable row level security;
create policy "allow_all_requests" on requests for all using (true) with check (true);


-- ─── 8. SEED DATA: shifts ────────────────────────────────────
insert into shifts (id, name, start_time, end_time, color) values
  ('morning',   'Ca Sáng',       '08:00', '12:00', 'bg-orange-100 text-orange-800 border-orange-200'),
  ('afternoon', 'Ca Chiều',      '13:00', '17:00', 'bg-blue-100 text-blue-800 border-blue-200'),
  ('evening',   'Ca Tối (Prime)','19:00', '23:00', 'bg-purple-100 text-purple-800 border-purple-200'),
  ('late',      'Ca Đêm',        '23:30', '02:00', 'bg-indigo-100 text-indigo-800 border-indigo-200');


-- ─── 9. SEED DATA: users ─────────────────────────────────────
insert into users (id, name, role, rank, password, avatar, revenue, zalo_phone, is_availability_submitted) values
  ('admin', 'Quản Lý Chính', 'MANAGER',    'S', 'admin', 'https://picsum.photos/id/1/200/200',   0,         null,  false),
  ('u1',    'Hương Live',    'STAFF',       'S', '123',   'https://picsum.photos/id/64/200/200',  150000000, null,  false),
  ('u2',    'Tuấn Host',     'STAFF',       'A', '123',   'https://picsum.photos/id/91/200/200',  90000000,  null,  false),
  ('u3',    'Lan Talk',      'STAFF',       'B', '123',   'https://picsum.photos/id/129/200/200', 50000000,  null,  false),
  ('u4',    'Đạt Game',      'STAFF',       'C', '123',   'https://picsum.photos/id/177/200/200', 20000000,  null,  false),
  ('u5',    'Vy Life',       'STAFF',       'A', '123',   'https://picsum.photos/id/203/200/200', 85000000,  null,  false),
  ('ops1',  'Kỹ Thuật Hùng', 'OPERATIONS', null,'123',   'https://picsum.photos/id/300/200/200', 0,         null,  false),
  ('ops2',  'Trợ Lý Mai',    'OPERATIONS', null,'123',   'https://picsum.photos/id/301/200/200', 0,         null,  false);


-- ─── 10. VERIFY ──────────────────────────────────────────────
-- Chạy 2 query dưới để kiểm tra dữ liệu đã được insert đúng:
-- select * from users;
-- select * from shifts;
