begin;

-- Reserve the internal domain for accounts provisioned through the admin API.
create or replace function public.guard_internal_username_address()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users as account
    where account.id = new.id
      and lower(account.email) like '%@users.office-reset.invalid'
      and (
        coalesce(account.raw_app_meta_data ->> 'office_reset_username', '') !~ '^[a-z0-9_]{3,24}$'
        or account.email <> (account.raw_app_meta_data ->> 'office_reset_username') || '@users.office-reset.invalid'
      )
  ) then
    raise exception 'Reserved account address';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_internal_username_address() from public, anon, authenticated;
-- GoTrue writes admin app_metadata after inserting the row, inside the same transaction.
create constraint trigger guard_internal_username_address
after insert or update of email, raw_app_meta_data on auth.users
deferrable initially deferred
for each row when (lower(new.email) like '%@users.office-reset.invalid')
execute function public.guard_internal_username_address();

create table public.username_signup_limits (
  bucket text not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key (bucket, window_start)
);
alter table public.username_signup_limits enable row level security;
revoke all on table public.username_signup_limits from public, anon, authenticated;

create or replace function public.consume_username_signup_attempt(client_bucket text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_window timestamptz := date_bin(interval '10 minutes', now(), '2000-01-01 UTC'::timestamptz);
  request_count integer;
begin
  if client_bucket !~ '^[a-f0-9]{64}$' or client_bucket is null then
    return false;
  end if;

  delete from public.username_signup_limits where window_start < current_window - interval '10 minutes';

  insert into public.username_signup_limits as limits (bucket, window_start, attempts)
  values (client_bucket, current_window, 1)
  on conflict (bucket, window_start) do update set attempts = limits.attempts + 1
    where limits.attempts < 5
  returning attempts into request_count;
  if request_count is null then return false; end if;

  insert into public.username_signup_limits as limits (bucket, window_start, attempts)
  values ('global', current_window, 1)
  on conflict (bucket, window_start) do update set attempts = limits.attempts + 1
    where limits.attempts < 60
  returning attempts into request_count;
  return request_count is not null;
end;
$$;

revoke all on function public.consume_username_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_username_signup_attempt(text) to service_role;

commit;
