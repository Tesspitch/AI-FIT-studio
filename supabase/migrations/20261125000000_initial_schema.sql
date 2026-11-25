create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  age integer check (age > 0),
  height_cm numeric check (height_cm > 0),
  weight_kg numeric check (weight_kg > 0),
  experience_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  difficulty text,
  camera_view text,
  reference_video_key text,
  evaluation_config jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at >= started_at),
  status text not null,
  total_reps integer not null default 0 check (total_reps >= 0),
  correct_reps integer not null default 0 check (correct_reps between 0 and total_reps),
  correct_rep_rate numeric check (correct_rep_rate between 0 and 100),
  average_form_score numeric check (average_form_score between 0 and 100),
  movement_consistency numeric check (movement_consistency between 0 and 100),
  overall_score numeric check (overall_score between 0 and 100),
  scoring_version text,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  total_reps integer not null default 0 check (total_reps >= 0),
  correct_reps integer not null default 0 check (correct_reps between 0 and total_reps),
  average_form_score numeric check (average_form_score between 0 and 100),
  movement_consistency numeric check (movement_consistency between 0 and 100),
  overall_score numeric check (overall_score between 0 and 100),
  evaluation_config_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table public.rep_evaluations (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  rep_number integer not null check (rep_number > 0),
  form_score numeric not null check (form_score between 0 and 100),
  is_correct boolean not null,
  duration_ms integer not null check (duration_ms > 0),
  metrics jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '[]'::jsonb,
  scoring_version text not null,
  feedback_version text not null,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, rep_number)
);

create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index workout_exercises_session_idx on public.workout_exercises (session_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger exercises_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.rep_evaluations enable row level security;

revoke all on public.profiles, public.exercises, public.workout_sessions,
  public.workout_exercises, public.rep_evaluations from anon, authenticated;
grant select on public.exercises to anon, authenticated;
grant select, insert, update on public.profiles, public.workout_sessions,
  public.workout_exercises, public.rep_evaluations to authenticated;

create policy "Manage own profile" on public.profiles
for all to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Read active exercise catalog" on public.exercises
for select to anon, authenticated using (is_active);

create policy "Read exercises in own history" on public.exercises
for select to authenticated using (
  exists (
    select 1 from public.workout_exercises as entry
    join public.workout_sessions as session on session.id = entry.session_id
    where entry.exercise_id = exercises.id and session.user_id = (select auth.uid())
  )
);

create policy "Manage own sessions" on public.workout_sessions
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Manage exercises under own sessions" on public.workout_exercises
for all to authenticated
using (
  exists (select 1 from public.workout_sessions as session
    where session.id = workout_exercises.session_id and session.user_id = (select auth.uid()))
)
with check (
  exists (select 1 from public.workout_sessions as session
    where session.id = workout_exercises.session_id and session.user_id = (select auth.uid()))
);

create policy "Manage evaluations under own sessions" on public.rep_evaluations
for all to authenticated
using (
  exists (
    select 1 from public.workout_exercises as entry
    join public.workout_sessions as session on session.id = entry.session_id
    where entry.id = rep_evaluations.workout_exercise_id and session.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workout_exercises as entry
    join public.workout_sessions as session on session.id = entry.session_id
    where entry.id = rep_evaluations.workout_exercise_id and session.user_id = (select auth.uid())
  )
);
