-- Grand Testament Adventure (browser game): players' saved progress and nicknames. Additive only; touches nothing else
-- in the project. Idempotent (safe to run twice).
-- Target chosen by Alex on 12/11/2026: an existing Supabase project with the least use (Bento WhatsApp, upidmpzzcpotuwetherp).
-- Checked before writing this (read-only): all 14 public tables there have RLS on with no policy, no views, one trigger
-- function; so the publishable key the game ships gives no access to that project's data.
--
-- No account (Alex, 12/11/2026: "apelido + código"): each player holds a random recovery code; the table keeps only
-- sha256(code). The nickname is what other players see; it is unique (ignoring case and accents) and filtered. It is
-- never a way in: only the code is. Access only through the functions below (RLS on, no policy, no grant on the table).

create table if not exists public.gta_saves (
  key_hash   text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  version    integer not null,
  nick       text check (nick is null or char_length(nick) between 3 and 16),
  nick_key   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists gta_saves_nick_key on public.gta_saves (nick_key) where nick_key is not null;
comment on table public.gta_saves is 'Grand Testament Adventure: progresso salvo e apelido dos jogadores. Chave = sha256 do codigo de recuperacao. Acesso so pelas funcoes gta_*.';
alter table public.gta_saves enable row level security;
revoke all on table public.gta_saves from anon, authenticated;

-- the comparable form of a nickname: lower case, no accents, look-alike digits read as letters, no _ or .
create or replace function public.gta_nick_key(p_nick text)
returns text
language sql immutable set search_path = ''
as $$
  -- lower() does not change accented capitals under every collation: the translate covers both cases
  select translate(lower(p_nick),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ013457@$_.',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucnoieastas')
$$;

-- why a nickname cannot be used, or null when it can (format, reserved names, offensive words)
create or replace function public.gta_nick_problem(p_nick text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  w text;
begin
  if p_nick is null or p_nick !~ '^[A-Za-z0-9_.À-ÖØ-öø-ÿ]{3,16}$' then
    return 'formato';
  end if;
  k := public.gta_nick_key(p_nick);
  k := replace(k, 'comput', '______');     -- 'computador' is not an insult
  foreach w in array array['deus', 'jesus', 'cristo', 'jeova', 'jave', 'espiritosanto', 'admin', 'moderador', 'suporte',
                           'oficial', 'biblia', 'grandtestament'] loop
    if position(w in k) > 0 then return 'reservado'; end if;
  end loop;
  foreach w in array array['porra', 'caralho', 'merda', 'puta', 'puto', 'viado', 'buceta', 'boceta', 'piroca', 'xoxota',
                           'foder', 'fodase', 'cacete', 'arrombad', 'desgraca', 'vagabund', 'vadia', 'corno', 'otario',
                           'babaca', 'retardad', 'macaco', 'nazi', 'hitler', 'satanas', 'lucifer', 'demonio', 'diabo',
                           'sexo', 'porno', 'nude', 'fuck', 'shit', 'bitch', 'dick', 'pussy', 'whore', 'nigg'] loop
    if position(w in k) > 0 then return 'ofensivo'; end if;
  end loop;
  if k in ('cu', 'cus', 'pau', 'pqp', 'fdp', 'vsf', 'tnc', 'krl', 'crl', 'bct', 'fds') then return 'ofensivo'; end if;
  return null;
end
$$;

create or replace function public.gta_code_hash(p_code text)
returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if p_code is null or length(p_code) not between 32 and 64 then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  return encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
end
$$;

-- the save and nickname for a code, or null
create or replace function public.gta_save_get(p_code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('save', s.data, 'nick', s.nick)
  from public.gta_saves s
  where s.key_hash = public.gta_code_hash(p_code)
$$;

create or replace function public.gta_save_put(p_code text, p_data jsonb)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  h text := public.gta_code_hash(p_code);
  t timestamptz;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 16384
     or coalesce(jsonb_typeof(p_data -> 'v'), '') <> 'number' then
    raise exception 'invalid save' using errcode = '22023';
  end if;
  -- a ceiling on new rows, so a script cannot fill this project's database
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

-- whether a nickname can be taken: 'livre', 'ocupado', or the problem ('formato', 'reservado', 'ofensivo')
create or replace function public.gta_nick_check(p_nick text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  p text := public.gta_nick_problem(p_nick);
begin
  if p is not null then return p; end if;
  if exists (select 1 from public.gta_saves where nick_key = public.gta_nick_key(p_nick)) then return 'ocupado'; end if;
  return 'livre';
end
$$;

-- gives the code's save a nickname (the save must exist: put first). Returns 'ok', 'ocupado', 'sem-save' or the problem.
create or replace function public.gta_nick_set(p_code text, p_nick text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  h text := public.gta_code_hash(p_code);
  p text := public.gta_nick_problem(p_nick);
begin
  if p is not null then return p; end if;
  if exists (select 1 from public.gta_saves where nick_key = public.gta_nick_key(p_nick) and key_hash <> h) then
    return 'ocupado';
  end if;
  update public.gta_saves set nick = p_nick, nick_key = public.gta_nick_key(p_nick), updated_at = now() where key_hash = h;
  if not found then return 'sem-save'; end if;
  return 'ok';
exception when unique_violation then
  return 'ocupado';
end
$$;

-- Supabase's default privileges grant new functions to anon and authenticated by name: revoke from them too
revoke all on function public.gta_nick_key(text) from public, anon, authenticated;
revoke all on function public.gta_nick_problem(text) from public, anon, authenticated;
revoke all on function public.gta_code_hash(text) from public, anon, authenticated;
revoke all on function public.gta_save_get(text) from public, anon, authenticated;
revoke all on function public.gta_save_put(text, jsonb) from public, anon, authenticated;
revoke all on function public.gta_nick_check(text) from public, anon, authenticated;
revoke all on function public.gta_nick_set(text, text) from public, anon, authenticated;
grant execute on function public.gta_save_get(text) to anon, authenticated;
grant execute on function public.gta_save_put(text, jsonb) to anon, authenticated;
grant execute on function public.gta_nick_check(text) to anon, authenticated;
grant execute on function public.gta_nick_set(text, text) to anon, authenticated;
