create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  grade text not null,
  term text,
  duration_minutes int not null default 120,
  total_marks int not null default 0,
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exams to authenticated;
grant all on public.exams to service_role;
alter table public.exams enable row level security;
create policy "own exams" on public.exams for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_name text not null,
  class_name text,
  answers jsonb not null default '{}'::jsonb,
  grading jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.results to authenticated;
grant all on public.results to service_role;
alter table public.results enable row level security;
create policy "own results" on public.results for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.results(exam_id);