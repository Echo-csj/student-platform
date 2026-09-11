-- 学员管理平台 · Supabase 数据模型
-- 执行方式：在 Supabase 控制台 SQL Editor 粘贴执行；或 `supabase db push`。
-- 设计原则：owner 行级隔离（多角色由 owner/manager 共享同一账号体系下的数据）；
--          所有写操作走 RLS，前端仅用 anon key + 已登录用户。

-- ============ 扩展 ============
create extension if not exists "pgcrypto";

-- ============ 角色表 ============
-- profiles 与 auth.users 一对一；role ∈ manager(管理者) / teacher(教师) / ta(助教)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('manager','teacher','ta')),
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ 学员 ============
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade text,
  school text,
  subject text,
  enroll_date date,
  phone text,
  tags text[],
  notes text,
  created_at timestamptz not null default now()
);
alter table public.students enable row level security;
create policy "owner students" on public.students for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 测评（入学/周测/月测/期中/期末） ============
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  name text not null,
  date date not null default current_date,
  type text not null check (type in ('enrollment','weekly','monthly','mid','final')),
  total_score numeric,
  total_full numeric,
  source text check (source in ('graded_upload','ai_graded','manual')),
  paper_url text,           -- 已批阅/未批阅试卷存储路径
  answer_url text,          -- 答案存储路径
  note text,
  created_at timestamptz not null default now()
);
alter table public.assessments enable row level security;
create policy "owner assessments" on public.assessments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 逐题明细 ============
create table if not exists public.exam_details (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_no text,
  module text,
  knowledge_point text,
  cognitive_level text,
  full_score numeric,
  score numeric,
  error_type text,
  note text,
  data_source text
);
alter table public.exam_details enable row level security;
create policy "owner exam_details" on public.exam_details for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 诊断（入学 / 阶段） ============
create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  kind text not null check (kind in ('enrollment','stage')),
  report jsonb,
  suggestions jsonb,
  plan jsonb,
  created_at timestamptz not null default now()
);
alter table public.diagnoses enable row level security;
create policy "owner diagnoses" on public.diagnoses for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 学期课程规划 ============
create table if not exists public.course_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null check (term in ('s1','winter','s2','summer')),
  start_date date,
  end_date date,
  total_sessions int,
  sessions jsonb,           -- [{seq,date,topic,focus,status}]
  created_at timestamptz not null default now()
);
alter table public.course_plans enable row level security;
create policy "owner course_plans" on public.course_plans for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 学情记录（周测/月测/期中期末 的文字+诊断） ============
create table if not exists public.learning_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  date date not null default current_date,
  type text not null check (type in ('weekly','monthly','mid','final')),
  summary text,
  knowledge_diagnosis jsonb,
  created_at timestamptz not null default now()
);
alter table public.learning_records enable row level security;
create policy "owner learning_records" on public.learning_records for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 上课记录（成长档案用） ============
create table if not exists public.lesson_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  topic text,
  situation text,
  created_at timestamptz not null default now()
);
alter table public.lesson_logs enable row level security;
create policy "owner lesson_logs" on public.lesson_logs for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 知识点库（教材/知识点明细） ============
create table if not exists public.knowledge_db (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  grade_band text,
  title text not null,
  content text,
  file_url text,
  created_at timestamptz not null default now()
);
alter table public.knowledge_db enable row level security;
create policy "owner knowledge_db" on public.knowledge_db for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 校历库 ============
create table if not exists public.calendar_db (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  file_url text,
  created_at timestamptz not null default now()
);
alter table public.calendar_db enable row level security;
create policy "owner calendar_db" on public.calendar_db for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ 索引 ============
create index if not exists idx_students_owner on public.students(owner_id);
create index if not exists idx_assess_owner on public.assessments(owner_id, student_id);
create index if not exists idx_details_owner on public.exam_details(owner_id, assessment_id);
create index if not exists idx_diag_owner on public.diagnoses(owner_id, student_id);
create index if not exists idx_plan_owner on public.course_plans(owner_id, student_id);
create index if not exists idx_lr_owner on public.learning_records(owner_id, student_id);
create index if not exists idx_ll_owner on public.lesson_logs(owner_id, student_id);
create index if not exists idx_kdb_owner on public.knowledge_db(owner_id);
create index if not exists idx_cdb_owner on public.calendar_db(owner_id);
