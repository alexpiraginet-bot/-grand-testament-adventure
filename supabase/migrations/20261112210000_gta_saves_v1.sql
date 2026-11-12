-- Grand Testament Adventure (browser game): players' saved progress. Additive only; touches nothing else in the project.
-- Target chosen by Alex on 12/11/2026: an existing Supabase project with the least use (Bento WhatsApp, upidmpzzcpotuwetherp).
-- Checked before writing this (read-only): all 14 public tables there have RLS on with no policy, no views, one trigger
-- function; so the publishable key the game ships gives no access to that project's data.
--
-- No account: each player holds a random recovery code; the table keeps only sha256(code). Access only through the two
-- functions below (RLS on, no policy, no grant on the table). Idempotent.
create table if not exists public.gta_saves (
  key_hash   text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  version    integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.gta_saves is 'Grand Testament Adventure: progresso salvo dos jogadores. Chave = sha256 do codigo de recuperacao. Acesso so por gta_save_get/gta_save_put.';
alter table public.gta_saves enable row level security;
revoke all on table public.gta_saves from anon, authenticated;

create or replace function public.gta_save_get(p_code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select s.data from public.gta_saves s
  where length(p_code) between 32 and 64
    and s.key_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
$$;

create or replace function public.gta_save_put(p_code text, p_data jsonb)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  h text;
  t timestamptz;
begin
  if p_code is null or length(p_code) not between 32 and 64 then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 16384
     or jsonb_typeof(p_data -> 'v') <> 'number' then
    raise exception 'invalid save' using errcode = '22023';
  end if;
  h := encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
  -- a ceiling on new rows, so a script cannot fill the project's database
  if not exists (select 1 from public.gta_saves where key_hash = h)
     and (select count(*) from (select 1 from public.gta_saves limit 100000) x) >= 100000 then
    raise exception 'save capacity reached' using errcode = '53400';
  end if;
  insert into public.gta_saves (key_hash, data, version)
  values (h, p_data, (p_data ->> 'v')::integer)
  on conflict (key_hash) do update set data = excluded.data, version = excluded.version, updated_at = now()
  returning updated_at into t;
  return t;
end
$$;

revoke all on function public.gta_save_get(text) from public;
revoke all on function public.gta_save_put(text, jsonb) from public;
grant execute on function public.gta_save_get(text) to anon, authenticated;
grant execute on function public.gta_save_put(text, jsonb) to anon, authenticated;
