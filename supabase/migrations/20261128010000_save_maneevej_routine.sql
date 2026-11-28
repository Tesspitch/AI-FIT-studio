begin;

insert into public.exercises (id, name, is_active)
values
  ('b916b62e-fe44-407d-a781-6f038abf2f01', 'ท่าสวัสดี', false),
  ('b916b62e-fe44-407d-a781-6f038abf2f02', 'ท่าโม่แป้ง', false),
  ('b916b62e-fe44-407d-a781-6f038abf2f03', 'ท่าถอดเสื้อ', false),
  ('b916b62e-fe44-407d-a781-6f038abf2f04', 'ท่ากรรเชียง', false),
  ('b916b62e-fe44-407d-a781-6f038abf2f05', 'ท่าปล่อยพลัง', false)
on conflict (id) do nothing;

create or replace function public.save_maneevej_routine(
  p_session_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_rounds jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  version constant text := 'maneevej-completion-v1';
  exercise_ids constant uuid[] := array[
    'b916b62e-fe44-407d-a781-6f038abf2f01', 'b916b62e-fe44-407d-a781-6f038abf2f02',
    'b916b62e-fe44-407d-a781-6f038abf2f03', 'b916b62e-fe44-407d-a781-6f038abf2f04',
    'b916b62e-fe44-407d-a781-6f038abf2f05'
  ]::uuid[];
  saved_id uuid;
begin
  if owner_id is null then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  if p_session_id is null or p_started_at is null or p_ended_at is null or p_ended_at < p_started_at
    or jsonb_typeof(p_rounds) is distinct from 'array' then
    raise exception 'Invalid routine payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rounds) <> 10 or exists (
    select 1 from jsonb_array_elements(p_rounds) as item(value)
    where jsonb_typeof(item.value -> 'elapsed_ms') is distinct from 'number'
       or (item.value ->> 'elapsed_ms')::integer <= 0
       or not (item.value ? 'score')
       or item.value -> 'score' not in ('null'::jsonb, '0'::jsonb, '100'::jsonb)
  ) then
    raise exception 'Invalid routine round' using errcode = '22023';
  end if;

  insert into public.profiles (id) values (owner_id) on conflict (id) do nothing;

  insert into public.workout_sessions (
    id, user_id, started_at, ended_at, status, total_reps, correct_reps, scoring_version
  ) values (p_session_id, owner_id, p_started_at, p_ended_at, 'completed', 10, 0, version)
  on conflict (id) do nothing returning id into saved_id;

  if saved_id is null then
    if exists (select 1 from public.workout_sessions as saved
      where saved.id = p_session_id and saved.user_id = owner_id and saved.scoring_version = version) then
      return p_session_id;
    end if;
    raise exception 'Session unavailable' using errcode = '42501';
  end if;

  insert into public.workout_exercises (
    session_id, exercise_id, total_reps, correct_reps, overall_score, evaluation_config_snapshot
  )
  select saved_id, exercise_ids[rounds.exercise_position], 2,
    count(*) filter (where rounds.score = 100), avg(rounds.score),
    jsonb_build_object('version', version, 'position', rounds.exercise_position,
      'duration_ms', sum(rounds.elapsed_ms), 'scored_rounds', count(rounds.score))
  from (
    select ((item.ordinality - 1) / 2 + 1)::integer as exercise_position,
      (item.value ->> 'score')::numeric as score, (item.value ->> 'elapsed_ms')::integer as elapsed_ms
    from jsonb_array_elements(p_rounds) with ordinality as item(value, ordinality)
  ) as rounds
  group by rounds.exercise_position;

  update public.workout_sessions as session
  set overall_score = totals.score, correct_reps = totals.detected
  from (
    select round(avg(entry.overall_score), 1) as score, sum(entry.correct_reps)::integer as detected
    from public.workout_exercises as entry where entry.session_id = saved_id
  ) as totals
  where session.id = saved_id;

  return saved_id;
end;
$$;

revoke all on function public.save_maneevej_routine(uuid, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.save_maneevej_routine(uuid, timestamptz, timestamptz, jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
