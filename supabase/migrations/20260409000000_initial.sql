-- ══════════════════════════════════════════════════════════════════
-- ClaireCo — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════

-- Enable pgvector for Phase 2 semantic embeddings
create extension if not exists vector;

-- ── profiles ────────────────────────────────────────────────────
-- Mirrors auth.users; auto-populated by trigger on sign-up.
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  email         text unique,
  department    text,
  is_champion   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Trigger: create profile row whenever a new user signs up via OAuth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── use_cases ────────────────────────────────────────────────────
create table if not exists use_cases (
  id          int primary key,
  function    text not null,
  name        text not null,
  description text,
  keywords    text[],
  embedding   vector(1536),        -- Phase 2: OpenAI text-embedding-3-small
  match_count int not null default 0,
  is_active   boolean not null default true,
  source      text default 'seed', -- 'seed' | 'user_submitted'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for Phase 2 semantic search
create index if not exists use_cases_embedding_idx
  on use_cases using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create index if not exists use_cases_function_idx on use_cases (function);

-- ── conversations ─────────────────────────────────────────────────
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete set null,
  department          text,
  status              text not null default 'in_progress'
                        check (status in ('in_progress','completed','abandoned')),
  path                text check (path in ('A','B','C')),
  matched_use_case_id int references use_cases(id) on delete set null,
  match_confidence    numeric(4,3),
  match_confirmed     boolean,
  message_count       int not null default 0,
  transcript          jsonb not null default '[]'::jsonb,
  device              text check (device in ('mobile','desktop')),
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists conversations_user_id_idx on conversations (user_id);
create index if not exists conversations_status_idx  on conversations (status);

-- ── briefs ────────────────────────────────────────────────────────
create table if not exists briefs (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid references conversations(id) on delete set null,
  user_id             uuid references profiles(id) on delete set null,
  brief_ref           text unique,
  department          text,
  pain_summary        text,
  frequency           text,
  systems_involved    text[],
  people_affected     text,
  time_impact         text,
  success_criteria    text,
  edge_cases          text,
  match_type          text check (match_type in ('known','new')),
  matched_use_case_id int references use_cases(id) on delete set null,
  confidence          text check (confidence in ('high','medium','low')),
  readiness           text check (readiness in ('ready_to_build','needs_followup','exploratory')),
  -- Champion scoring fields
  score_value         int,
  score_feasibility   int,
  score_adoption      int,
  score_total         int,
  priority_tier       text check (priority_tier in ('P1','P2','P3','Hold')),
  champion_id         uuid references profiles(id) on delete set null,
  champion_notes      text,
  status              text not null default 'pending'
                        check (status in ('pending','in_review','scored','building','shipped','rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Trigger: auto-generate brief_ref as AGT-XXXX on insert
create or replace function generate_brief_ref()
returns trigger language plpgsql as $$
declare
  ref text;
  attempts int := 0;
begin
  loop
    ref := 'AGT-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    begin
      new.brief_ref := ref;
      return new;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 20 then
        raise exception 'Could not generate unique brief_ref';
      end if;
    end;
  end loop;
end;
$$;

drop trigger if exists set_brief_ref on briefs;
create trigger set_brief_ref
  before insert on briefs
  for each row
  when (new.brief_ref is null)
  execute function generate_brief_ref();

-- Trigger: auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists briefs_touch_updated_at on briefs;
create trigger briefs_touch_updated_at
  before update on briefs
  for each row execute function touch_updated_at();

create index if not exists briefs_user_id_idx         on briefs (user_id);
create index if not exists briefs_status_idx          on briefs (status);
create index if not exists briefs_conversation_id_idx on briefs (conversation_id);

-- ── use_case_submissions ─────────────────────────────────────────
create table if not exists use_case_submissions (
  id           uuid primary key default gen_random_uuid(),
  use_case_id  int references use_cases(id) on delete cascade,
  brief_id     uuid references briefs(id) on delete cascade,
  department   text,
  confirmed    boolean,
  created_at   timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════

alter table profiles           enable row level security;
alter table use_cases          enable row level security;
alter table conversations      enable row level security;
alter table briefs             enable row level security;
alter table use_case_submissions enable row level security;

-- profiles: users see their own row; champions see all
create policy "Users see own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users update own profile"
  on profiles for update using (auth.uid() = id);

-- use_cases: anyone authenticated can read active use cases
create policy "Read active use cases"
  on use_cases for select using (is_active = true);

-- conversations: users see/write their own; champions see all
create policy "Users manage own conversations"
  on conversations for all using (auth.uid() = user_id);
create policy "Champions read all conversations"
  on conversations for select using (
    exists (select 1 from profiles where id = auth.uid() and is_champion = true)
  );

-- briefs: users see their own; champions see all
create policy "Users see own briefs"
  on briefs for select using (auth.uid() = user_id);
create policy "Users insert own briefs"
  on briefs for insert with check (auth.uid() = user_id);
create policy "Champions read all briefs"
  on briefs for select using (
    exists (select 1 from profiles where id = auth.uid() and is_champion = true)
  );
create policy "Champions update briefs"
  on briefs for update using (
    exists (select 1 from profiles where id = auth.uid() and is_champion = true)
  );

-- use_case_submissions: internal only (no user-facing policies needed)
create policy "Service role only for submissions"
  on use_case_submissions for all using (false);
