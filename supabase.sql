-- AirLva: jalankan SEKALI di Supabase > SQL Editor (aman dijalankan ulang)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, avatar text,
  plan text not null default 'free' check (plan in ('free','pro')),
  plan_chosen boolean not null default false,
  credits int not null default 0 check (credits >= 0),
  last_daily date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_at timestamptz not null default now()
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, mode text,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('u','a')),
  content text not null, mode text, err boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists plan_chosen boolean not null default false;
create index if not exists messages_project_idx on public.messages(project_id, id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profil sendiri" on public.profiles;
create policy "profil sendiri" on public.profiles for select using (id = auth.uid());
drop policy if exists "project sendiri" on public.projects;
create policy "project sendiri" on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pesan sendiri" on public.messages;
create policy "pesan sendiri" on public.messages for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create or replace function public.plan_daily(p text) returns int language sql immutable as $$ select case p when 'pro' then 1000 else 500 end $$;
create or replace function public.plan_initial(p text) returns int language sql immutable as $$ select case p when 'pro' then 5000 else 1000 end $$;

create or replace function public.ensure_profile(p_plan text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pr public.profiles; pl text; meta jsonb; mail text;
        today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if uid is null then raise exception 'belum login'; end if;
  select * into pr from public.profiles where id = uid;
  if not found then
    select raw_user_meta_data, email into meta, mail from auth.users where id = uid;
    insert into public.profiles(id, email, name, avatar, plan, credits, last_daily)
    values (uid, mail, coalesce(meta->>'full_name', meta->>'name', split_part(mail,'@',1)), meta->>'avatar_url', 'free', public.plan_initial('free'), today)
    returning * into pr;
  end if;
  if not pr.plan_chosen and p_plan is not null then
    pl := case when p_plan = 'pro' then 'pro' else 'free' end;
    update public.profiles set plan = pl, credits = public.plan_initial(pl), plan_chosen = true, last_daily = today
    where id = uid returning * into pr;
  elsif pr.last_daily < today then
    update public.profiles set credits = credits + public.plan_daily(pr.plan), last_daily = today
    where id = uid returning * into pr;
  end if;
  return pr;
end $$;

create or replace function public.set_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_plan not in ('free','pro') then raise exception 'plan tidak valid'; end if;
  update public.profiles set plan = p_plan where id = auth.uid();
end $$;

create or replace function public.get_balance(p_user uuid) returns table(bal int, pl text)
language plpgsql security definer set search_path = public as $$
declare pr public.profiles; today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return; end if;
  if pr.last_daily < today then
    update public.profiles set credits = profiles.credits + public.plan_daily(pr.plan), last_daily = today
    where id = p_user returning * into pr;
  end if;
  return query select pr.credits, pr.plan;
end $$;

create or replace function public.spend_credits(p_user uuid, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  update public.profiles set credits = greatest(credits - greatest(p_amount, 0), 0)
  where id = p_user returning credits into remaining;
  return remaining;
end $$;

revoke all on function public.ensure_profile(text), public.set_plan(text), public.get_balance(uuid), public.spend_credits(uuid,int) from public, anon, authenticated;
grant execute on function public.ensure_profile(text), public.set_plan(text) to authenticated;
grant execute on function public.get_balance(uuid), public.spend_credits(uuid,int) to service_role;

-- baris profil dibuat otomatis begitu ada user baru (langsung muncul di Table Editor)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, name, avatar, plan, credits, last_daily)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'avatar_url', 'free', public.plan_initial('free'),
          (now() at time zone 'Asia/Jakarta')::date)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- isi profil untuk user yang sudah terlanjur ada
insert into public.profiles(id, email, name, avatar, plan, credits, last_daily)
select id, email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)),
       raw_user_meta_data->>'avatar_url', 'free', public.plan_initial('free'), (now() at time zone 'Asia/Jakarta')::date
from auth.users on conflict (id) do nothing;

-- ===== CHAT GLOBAL =====
create table if not exists public.global_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text, avatar text,
  kind text not null default 'text' check (kind in ('text','project','code','voice')),
  content text not null check (char_length(content) <= 2000),
  meta text, payload jsonb,
  reply_to bigint references public.global_messages(id) on delete set null,
  reply_name text, reply_text text,
  created_at timestamptz not null default now()
);
alter table public.global_messages drop constraint if exists global_messages_kind_check;
alter table public.global_messages add constraint global_messages_kind_check check (kind in ('text','project','code','voice'));
create index if not exists global_messages_id_idx on public.global_messages(id desc);
alter table public.global_messages enable row level security;
drop policy if exists "global baca" on public.global_messages;
create policy "global baca" on public.global_messages for select to authenticated using (true);
drop policy if exists "global kirim" on public.global_messages;
create policy "global kirim" on public.global_messages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "global hapus" on public.global_messages;
create policy "global hapus" on public.global_messages for delete to authenticated using (user_id = auth.uid());

create or replace function public.global_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr record; rm record;
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  select name, avatar into pr from public.profiles where id = new.user_id;
  new.name := coalesce(pr.name, new.name, 'Pengguna');
  new.avatar := coalesce(pr.avatar, new.avatar);
  if new.reply_to is not null then
    select name, kind, content into rm from public.global_messages where id = new.reply_to;
    if found then
      new.reply_name := rm.name;
      new.reply_text := left(case rm.kind when 'project' then 'Project: ' || rm.content when 'code' then 'Kode: ' || rm.content when 'voice' then 'Pesan suara' else rm.content end, 120);
    else
      new.reply_to := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.global_before_insert() from public, anon, authenticated;
drop trigger if exists global_before_insert on public.global_messages;
create trigger global_before_insert before insert on public.global_messages for each row execute function public.global_before_insert();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'global_messages') then
    alter publication supabase_realtime add table public.global_messages;
  end if;
end $$;

-- ===== CARI / PUBLISH KODE, ADMIN, POP UP =====
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.codes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author text,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 500),
  lang text, runnable boolean not null default false,
  source text not null default 'tempel' check (source in ('tempel','file','ai')),
  code text not null check (char_length(code) <= 200000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  likes int not null default 0, visits int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists codes_status_idx on public.codes(status, id desc);
create table if not exists public.code_likes (
  code_id bigint not null references public.codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (code_id, user_id)
);
create table if not exists public.code_visits (
  code_id bigint not null references public.codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (code_id, user_id)
);
alter table public.codes enable row level security;
alter table public.code_likes enable row level security;
alter table public.code_visits enable row level security;

drop policy if exists "kode baca" on public.codes;
create policy "kode baca" on public.codes for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
drop policy if exists "kode kirim" on public.codes;
create policy "kode kirim" on public.codes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "kode admin ubah" on public.codes;
create policy "kode admin ubah" on public.codes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "kode hapus" on public.codes;
create policy "kode hapus" on public.codes for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "like sendiri" on public.code_likes;
create policy "like sendiri" on public.code_likes for select to authenticated using (user_id = auth.uid());

create or replace function public.codes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.status := case when public.is_admin() then 'approved' else 'pending' end;
    new.likes := 0; new.visits := 0;
  end if;
  select name into nm from public.profiles where id = new.user_id;
  new.author := coalesce(nm, new.author, 'Pengguna');
  return new;
end $$;
revoke all on function public.codes_before_insert() from public, anon, authenticated;
drop trigger if exists codes_before_insert on public.codes;
create trigger codes_before_insert before insert on public.codes for each row execute function public.codes_before_insert();

-- daftar kode + peringkat (Top 300 = rank 1..300, sisanya "kode biasa")
create or replace view public.codes_list with (security_invoker = true) as
select id, user_id, author, title, description, lang, runnable, source, likes, visits, created_at,
       row_number() over (order by (likes * 5 + visits) desc, id) as rank
from public.codes where status = 'approved';
grant select on public.codes_list to authenticated;

create or replace function public.toggle_like(p_code bigint) returns table(is_liked boolean, total int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); had boolean;
begin
  if uid is null then raise exception 'belum login'; end if;
  if not exists (select 1 from public.codes where id = p_code and status = 'approved') then raise exception 'kode tidak ditemukan'; end if;
  delete from public.code_likes where code_id = p_code and user_id = uid returning true into had;
  if had is null then insert into public.code_likes(code_id, user_id) values (p_code, uid); end if;
  update public.codes set likes = (select count(*) from public.code_likes where code_id = p_code) where id = p_code;
  return query select (had is null), (select c.likes from public.codes c where c.id = p_code);
end $$;

create or replace function public.add_visit(p_code bigint) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then return 0; end if;
  insert into public.code_visits(code_id, user_id) values (p_code, uid) on conflict do nothing;
  if found then update public.codes set visits = visits + 1 where id = p_code and status = 'approved'; end if;
  select visits into n from public.codes where id = p_code;
  return coalesce(n, 0);
end $$;
revoke all on function public.toggle_like(bigint), public.add_visit(bigint) from public, anon;
grant execute on function public.toggle_like(bigint), public.add_visit(bigint) to authenticated;

create table if not exists public.popups (
  id bigint generated always as identity primary key,
  title text not null,
  kind text not null default 'biasa' check (kind in ('biasa','html')),
  body text not null check (char_length(body) <= 100000),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.popups enable row level security;
drop policy if exists "popup baca" on public.popups;
create policy "popup baca" on public.popups for select to authenticated using (active or public.is_admin());
drop policy if exists "popup admin tambah" on public.popups;
create policy "popup admin tambah" on public.popups for insert to authenticated with check (public.is_admin());
drop policy if exists "popup admin ubah" on public.popups;
create policy "popup admin ubah" on public.popups for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "popup admin hapus" on public.popups;
create policy "popup admin hapus" on public.popups for delete to authenticated using (public.is_admin());

-- admin boleh melihat & mengubah semua profil (kredit, plan, admin) lewat Admin panel
drop policy if exists "admin lihat profil" on public.profiles;
create policy "admin lihat profil" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "admin ubah profil" on public.profiles;
create policy "admin ubah profil" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- status admin TIDAK bisa diubah dari aplikasi, hanya lewat Supabase (SQL Editor / Table Editor)
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.is_admin := old.is_admin; end if;
  return new;
end $$;
revoke all on function public.profiles_guard() from public, anon, authenticated;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();
