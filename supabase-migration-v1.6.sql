-- Migrazione GymBoard v1.5 -> v1.6.
-- Eseguire una sola volta nel SQL Editor del progetto Supabase esistente.

begin;

alter table public.plan_exercises
  drop constraint if exists plan_exercises_exercise_id_fkey;

alter table public.plan_exercises
  add constraint plan_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete cascade;

alter table public.exercise_results
  drop constraint if exists exercise_results_exercise_id_fkey;

alter table public.exercise_results
  add constraint exercise_results_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete cascade;

commit;
