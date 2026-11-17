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
  kind text not null default 'text' check (kind in ('text','project','code')),
  content text not null check (char_length(content) <= 2000),
  meta text, payload jsonb,
  reply_to bigint references public.global_messages(id) on delete set null,
  reply_name text, reply_text text,
  created_at timestamptz not null default now()
);
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
      new.reply_text := left(case rm.kind when 'project' then 'Project: ' || rm.content when 'code' then 'Kode: ' || rm.content else rm.content end, 120);
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
