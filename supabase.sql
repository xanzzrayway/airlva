-- AirLva: jalankan SEKALI di Supabase > SQL Editor (aman dijalankan ulang)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, avatar text,
  plan text not null default 'free' check (plan in ('free','pro')),
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
    pl := case when p_plan = 'pro' then 'pro' else 'free' end;
    select raw_user_meta_data, email into meta, mail from auth.users where id = uid;
    insert into public.profiles(id, email, name, avatar, plan, credits, last_daily)
    values (uid, mail, coalesce(meta->>'full_name', meta->>'name', split_part(mail,'@',1)), meta->>'avatar_url', pl, public.plan_initial(pl), today)
    returning * into pr;
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
