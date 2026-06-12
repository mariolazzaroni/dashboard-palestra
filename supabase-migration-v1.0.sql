-- Migrazione GymBoard v0.1 -> v1.0.
-- Eseguire una sola volta nel SQL Editor del progetto esistente.

begin;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

alter table public.plans add column if not exists archived_at timestamptz;
alter table public.plan_exercises add column if not exists exercise_id uuid;
alter table public.exercise_results add column if not exists exercise_id uuid;

-- Crea un catalogo unico per utente partendo sia dalle schede sia dallo storico.
insert into public.exercises (user_id, name, normalized_name)
select distinct on (source.user_id, source.normalized_name)
  source.user_id,
  source.name,
  source.normalized_name
from (
  select p.user_id, trim(pe.name) as name, lower(regexp_replace(trim(pe.name), '\s+', ' ', 'g')) as normalized_name
  from public.plan_exercises pe
  join public.plans p on p.id = pe.plan_id
  where pe.name is not null and trim(pe.name) <> ''
  union all
  select w.user_id, trim(er.exercise_name) as name, lower(regexp_replace(trim(er.exercise_name), '\s+', ' ', 'g')) as normalized_name
  from public.exercise_results er
  join public.workouts w on w.id = er.workout_id
  where er.exercise_name is not null and trim(er.exercise_name) <> ''
) source
on conflict (user_id, normalized_name) do nothing;

update public.plan_exercises pe
set exercise_id = e.id
from public.plans p, public.exercises e
where pe.plan_id = p.id
  and e.user_id = p.user_id
  and e.normalized_name = lower(regexp_replace(trim(pe.name), '\s+', ' ', 'g'))
  and pe.exercise_id is null;

update public.exercise_results er
set exercise_id = e.id
from public.workouts w, public.exercises e
where er.workout_id = w.id
  and e.user_id = w.user_id
  and e.normalized_name = lower(regexp_replace(trim(er.exercise_name), '\s+', ' ', 'g'))
  and er.exercise_id is null;

alter table public.plan_exercises alter column exercise_id set not null;
alter table public.exercise_results alter column exercise_id set not null;

alter table public.plan_exercises
  add constraint plan_exercises_exercise_id_fkey foreign key (exercise_id) references public.exercises(id) on delete restrict;
alter table public.exercise_results
  add constraint exercise_results_exercise_id_fkey foreign key (exercise_id) references public.exercises(id) on delete restrict;

alter table public.plan_exercises drop column if exists name;

create index if not exists exercises_user_name_idx on public.exercises(user_id, normalized_name);
create index if not exists exercise_results_exercise_idx on public.exercise_results(exercise_id, workout_id);

alter table public.exercises enable row level security;
create policy "Users manage their exercises"
on public.exercises for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
