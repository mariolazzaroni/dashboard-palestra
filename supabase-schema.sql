-- Schema completo GymBoard v1.0 per nuove installazioni.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null default 0,
  unique (plan_id, exercise_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  name text not null,
  duration integer not null check (duration > 0),
  total_volume numeric not null default 0,
  performed_at timestamptz not null default now()
);

create table public.exercise_results (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  exercise_name text,
  sets integer not null check (sets > 0),
  reps integer not null check (reps > 0),
  load numeric not null check (load >= 0),
  volume numeric generated always as (sets * reps * load) stored
);

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight numeric not null check (weight between 20 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create index exercises_user_name_idx on public.exercises(user_id, normalized_name);
create index workouts_user_date_idx on public.workouts(user_id, performed_at desc);
create index exercise_results_exercise_idx on public.exercise_results(exercise_id, workout_id);
create index plan_exercises_plan_idx on public.plan_exercises(plan_id, position);
create index body_weights_user_date_idx on public.body_weights(user_id, measured_on desc);

alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.exercise_results enable row level security;
alter table public.body_weights enable row level security;

create policy "Users manage their exercises"
on public.exercises for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their plans"
on public.plans for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage exercises in their plans"
on public.plan_exercises for all to authenticated
using (exists (select 1 from public.plans where plans.id = plan_exercises.plan_id and plans.user_id = (select auth.uid())))
with check (exists (select 1 from public.plans where plans.id = plan_exercises.plan_id and plans.user_id = (select auth.uid())));

create policy "Users manage their workouts"
on public.workouts for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their exercise results"
on public.exercise_results for all to authenticated
using (exists (select 1 from public.workouts where workouts.id = exercise_results.workout_id and workouts.user_id = (select auth.uid())))
with check (exists (select 1 from public.workouts where workouts.id = exercise_results.workout_id and workouts.user_id = (select auth.uid())));

create policy "Users manage their body weights"
on public.body_weights for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
