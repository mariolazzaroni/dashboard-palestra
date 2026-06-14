-- Migrazione GymBoard v1.3.6 -> v1.4.
-- Eseguire una sola volta nel SQL Editor del progetto Supabase esistente.

begin;

alter table public.exercises
  add column if not exists category text;

update public.exercises
set category = 'Altro'
where category is null
   or category not in ('Petto', 'Schiena', 'Spalle', 'Gambe', 'Bicipiti', 'Tricipiti', 'Core', 'Altro');

alter table public.exercises
  alter column category set default 'Altro',
  alter column category set not null;

alter table public.exercises
  drop constraint if exists exercises_category_check;

alter table public.exercises
  add constraint exercises_category_check
  check (category in ('Petto', 'Schiena', 'Spalle', 'Gambe', 'Bicipiti', 'Tricipiti', 'Core', 'Altro'));

create index if not exists exercises_user_category_idx
  on public.exercises(user_id, category);

commit;
