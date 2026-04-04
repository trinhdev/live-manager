-- ============================================================
--  LiveSync — Patch: Đổi brand slug 'default' → 'baselab'
--  Chạy cái này nếu bạn đã chạy migration lần đầu với 'default'
-- ============================================================

-- Bước 1: Thêm brand baselab (nếu chưa có)
insert into brands (id, name, color)
values ('baselab', 'BaseLab', '#2563EB')
on conflict (id) do nothing;

-- Bước 2: Chuyển toàn bộ data sang brand 'baselab'
update users          set brand_id = 'baselab' where brand_id = 'default';
update shifts         set brand_id = 'baselab' where brand_id = 'default';
update schedule       set brand_id = 'baselab' where brand_id = 'default';
update availabilities set brand_id = 'baselab' where brand_id = 'default';
update requests       set brand_id = 'baselab' where brand_id = 'default';

-- Bước 3: Xóa brand cũ
delete from brands where id = 'default';

-- Verify
select * from brands;
select id, name, role, brand_id from users order by brand_id;
