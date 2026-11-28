begin;

create table public.first_login_screenings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  occupation text not null check (occupation = btrim(occupation) and char_length(occupation) between 1 and 120),
  habits text[] not null default '{}'
    check (cardinality(habits) <= 5 and habits <@ array['long_sitting', 'long_standing', 'neck_bending',
      'repetitive_arm_use', 'frequent_reaching']::text[]),
  pain_areas text[] not null default '{}'
    check (cardinality(pain_areas) <= 9 and pain_areas <@ array['neck', 'shoulders', 'arms_elbows', 'wrists_hands',
      'upper_back', 'lower_back', 'hips', 'thighs_knees', 'calves_ankles']::text[]),
  pain_duration text
    check (pain_duration in ('under_one_week', 'one_to_four_weeks', 'one_to_three_months', 'over_three_months')),
  pain_score smallint not null check (pain_score between 0 and 10),
  daily_impact text not null check (daily_impact in ('none', 'low', 'moderate', 'high')),
  completed_at timestamptz not null default now(),
  check (
    (cardinality(pain_areas) = 0 and pain_duration is null and pain_score = 0 and daily_impact = 'none')
    or (cardinality(pain_areas) > 0 and pain_duration is not null)
  )
);

alter table public.first_login_screenings enable row level security;
revoke all on table public.first_login_screenings from public, anon, authenticated;
grant select on table public.first_login_screenings to authenticated;
grant insert (occupation, habits, pain_areas, pain_duration, pain_score, daily_impact)
  on table public.first_login_screenings to authenticated;

create policy "Read own first login screening" on public.first_login_screenings
for select to authenticated using (user_id = (select auth.uid()));

create policy "Submit own first login screening" on public.first_login_screenings
for insert to authenticated with check (user_id = (select auth.uid()) and not coalesce(
  ((select auth.jwt()) ->> 'is_anonymous')::boolean, false
));

notify pgrst, 'reload schema';

commit;
