-- Migrazione GymBoard v1.4.x -> v1.5.
-- Eseguire una sola volta nel SQL Editor del progetto Supabase esistente.

begin;

alter table public.plan_exercises
  add column if not exists planned_sets integer,
  add column if not exists planned_reps integer;

update public.plan_exercises
set
  planned_sets = coalesce(planned_sets, 3),
  planned_reps = coalesce(planned_reps, 8);

alter table public.plan_exercises
  alter column planned_sets set default 3,
  alter column planned_reps set default 8,
  alter column planned_sets set not null,
  alter column planned_reps set not null;

alter table public.plan_exercises
  drop constraint if exists plan_exercises_planned_sets_check,
  drop constraint if exists plan_exercises_planned_reps_check;

alter table public.plan_exercises
  add constraint plan_exercises_planned_sets_check check (planned_sets > 0),
  add constraint plan_exercises_planned_reps_check check (planned_reps > 0);

commit;
