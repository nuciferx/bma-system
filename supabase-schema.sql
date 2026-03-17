-- ============================================================
-- BMA System — Supabase Schema
-- run ใน Supabase SQL editor
-- ============================================================

-- enable UUID
create extension if not exists "pgcrypto";

-- ─── Buildings ───────────────────────────────────────────────
create table if not exists buildings (
  building_id        uuid primary key default gen_random_uuid(),
  permit_no          text not null unique,
  permit_form        text not null check (permit_form in ('อ.1', 'ยผ.4')),
  permit_date        text,
  owner_name         text,
  owner_rep          text,
  building_desc      text,
  location_soi       text,
  location_road      text,
  location_subdistrict text,
  location_district  text,
  permit_expire      text,
  original_supervisors jsonb default '[]',
  created_at         timestamptz default now()
);

-- ─── Actions (ทุกครั้งที่ต่ออายุ) ───────────────────────────
create table if not exists actions (
  action_id          uuid primary key default gen_random_uuid(),
  building_id        uuid not null references buildings(building_id),
  case_type          text not null,          -- A B C BC D E F
  renew_count        text,
  renew_from         text,
  renew_to           text,
  receipt_no         text,
  receipt_date       text,
  supervisors_snapshot jsonb default '[]',   -- snapshot ผู้ควบคุม ณ เวลานั้น
  supervisor_changes   jsonb default '[]',   -- การแจ้ง/เปลี่ยนครั้งนี้
  supervisor_history   jsonb default '[]',   -- ประวัติก่อนหน้า
  -- สำคัญ: เลขหนังสือที่รับทราบแล้ว ใช้ใน ข้อเท็จจริงครั้งถัดไป
  ack_doc_no         text,
  ack_doc_date       text,
  fee                text,
  eia_status         text default 'none' check (eia_status in ('none', 'approved')),
  eia_doc_no         text,
  eia_doc_date       text,
  construction_status text,
  complaint          text default 'none' check (complaint in ('none', 'found')),
  complaint_detail   text,
  form_data_snapshot jsonb,                  -- full FormData ตอน save
  doc_url            text,
  doc_date           text,
  created_at         timestamptz default now()
);

-- ─── Attachments ─────────────────────────────────────────────
create table if not exists attachments (
  attach_id     uuid primary key default gen_random_uuid(),
  building_id   uuid not null references buildings(building_id),
  action_id     uuid references actions(action_id),
  file_type     text default 'other',
  file_name     text,
  storage_path  text,               -- Supabase storage path
  public_url    text,
  note          text,
  uploaded_at   timestamptz default now()
);

-- ─── Logs (schema พร้อม ยัง inactive) ────────────────────────
create table if not exists logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,               -- เพิ่ม auth ทีหลัง
  action        text not null,      -- 'ocr' | 'save_case' | 'generate_doc'
  case_id       uuid,
  building_id   uuid,
  payload       jsonb,
  created_at    timestamptz default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists idx_buildings_permit_no    on buildings(permit_no);
create index if not exists idx_buildings_owner_name   on buildings(owner_name);
create index if not exists idx_actions_building_id    on actions(building_id);
create index if not exists idx_actions_created_at     on actions(created_at desc);
create index if not exists idx_attachments_building_id on attachments(building_id);
create index if not exists idx_logs_created_at        on logs(created_at desc);

-- ─── Thai text search (ช่วย search ภาษาไทย) ─────────────────
create extension if not exists pg_trgm;
create index if not exists idx_buildings_owner_trgm
  on buildings using gin (owner_name gin_trgm_ops);
create index if not exists idx_buildings_permit_trgm
  on buildings using gin (permit_no gin_trgm_ops);
