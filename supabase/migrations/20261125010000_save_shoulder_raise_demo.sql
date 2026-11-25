begin;

insert into public.exercises (id, name, is_active)
values ('f8a536b6-cb19-4b50-b2f9-a0f868d8e273', 'กางแขนขวาถึงระดับไหล่ (ทดลอง)', false)
on conflict (id) do nothing;

create or replace function public.save_shoulder_raise_demo(
  session_id uuid, started_at timestamptz, ended_at timestamptz, reps jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  exercise_id constant uuid := 'f8a536b6-cb19-4b50-b2f9-a0f868d8e273';
  version constant text := 'shoulder-raise-demo-v1';
  inserted_id uuid;
  rep_count integer;
  correct_count integer;
  average_score numeric;
begin
  if owner_id is null then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  if started_at is null or ended_at is null or ended_at < started_at
    or jsonb_typeof(reps) is distinct from 'array' then
    raise exception 'Invalid workout payload' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where abs(rep.peak_angle - 90) <= 10), round(avg(rep.score), 1)
  into rep_count, correct_count, average_score
  from jsonb_to_recordset(reps) as rep(score integer, peak_angle integer, duration_ms integer);

  insert into public.profiles (id) values (owner_id) on conflict (id) do nothing;

  insert into public.workout_sessions (
    id, user_id, started_at, ended_at, status, total_reps, correct_reps,
    correct_rep_rate, average_form_score, overall_score, scoring_version
  ) values (
    session_id, owner_id, started_at, ended_at, 'completed', rep_count, correct_count,
    round(100.0 * correct_count / nullif(rep_count, 0), 1), average_score, average_score, version
  ) on conflict (id) do nothing returning id into inserted_id;

  if inserted_id is null then
    if exists (select 1 from public.workout_sessions as saved
      where saved.id = session_id and saved.user_id = owner_id and saved.scoring_version = version) then
      return session_id;
    end if;
    raise exception 'Session unavailable' using errcode = '42501';
  end if;

  insert into public.workout_exercises (
    id, session_id, exercise_id, total_reps, correct_reps, average_form_score,
    overall_score, evaluation_config_snapshot
  ) values (
    inserted_id, inserted_id, exercise_id, rep_count, correct_count, average_score,
    average_score, jsonb_build_object('version', version, 'target_angle', 90, 'correct_tolerance', 10)
  );

  insert into public.rep_evaluations (
    workout_exercise_id, rep_number, form_score, is_correct, duration_ms,
    metrics, feedback, scoring_version, feedback_version
  )
  select inserted_id, (item.number)::integer, rep.score, abs(rep.peak_angle - 90) <= 10, rep.duration_ms,
    jsonb_build_object('peak_angle', rep.peak_angle), '[]'::jsonb, version, version
  from jsonb_array_elements(reps) with ordinality as item(value, number)
  cross join lateral jsonb_to_record(item.value) as rep(score integer, peak_angle integer, duration_ms integer);

  return inserted_id;
end;
$$;

revoke all on function public.save_shoulder_raise_demo(uuid, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.save_shoulder_raise_demo(uuid, timestamptz, timestamptz, jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
