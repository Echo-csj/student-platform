-- 学员管理平台 · 批量导入所需表结构（在 Supabase SQL Editor 执行一次）
-- 适用项目：supabase.dosworkbench.top（自托管）；云端项目同理。
-- 说明：students 新增列均为可空；subject_scores 独立存多科目分数。

-- 1) students 表扩展列
alter table students add column if not exists gender text;
alter table students add column if not exists class_type text;
alter table students add column if not exists parent_contact text;
alter table students add column if not exists subjects text[];
alter table students add column if not exists payment_method text;
alter table students add column if not exists personality text;
alter table students add column if not exists goals text;
alter table students add column if not exists advisor_note text;
alter table students add column if not exists teacher_req text;
alter table students add column if not exists schedule_note text;
alter table students add column if not exists accompany text;

-- 2) 多科目分数表
create table if not exists subject_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  subject text not null,
  score numeric,
  full_score numeric,
  hours int,
  owner_id uuid,
  created_at timestamptz default now()
);

-- 3) RLS（与 students 一致，按 owner_id 隔离）
alter table subject_scores enable row level security;
drop policy if exists "owner subject_scores all" on subject_scores;
create policy "owner subject_scores all"
  on subject_scores for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 4) 索引（批量判重/查询加速）
create index if not exists idx_students_dup on students(name, school, grade);
create index if not exists idx_subject_scores_student on subject_scores(student_id);
