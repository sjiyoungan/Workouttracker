-- Run in Supabase → SQL Editor (once per project)

create table if not exists public.user_workouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_workouts enable row level security;

create policy "Users read own workout data"
  on public.user_workouts for select
  using (auth.uid() = user_id);

create policy "Users insert own workout data"
  on public.user_workouts for insert
  with check (auth.uid() = user_id);

create policy "Users update own workout data"
  on public.user_workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own workout data"
  on public.user_workouts for delete
  using (auth.uid() = user_id);
