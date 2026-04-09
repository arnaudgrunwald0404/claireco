# ClaireCo — Database Schema

All tables live in Supabase (Postgres). Run these in the Supabase SQL editor in order.

---

## Enable Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector; -- for semantic matching in Phase 2
```

---

## Table: users

Managed by Supabase Auth. Extended with a profile table.

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text unique not null,
  department text,
  is_champion boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Table: use_cases

The library of known use cases. Seeded from use-cases.json.

```sql
create table public.use_cases (
  id integer primary key,
  function text not null,          -- e.g. "Customer Success"
  name text not null,              -- Short problem statement
  description text not null,       -- Full description
  keywords text[] not null,        -- For keyword matching
  embedding vector(1536),          -- For semantic matching (Phase 2)
  match_count integer default 0,   -- Times confirmed as a match
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true,
  source text default 'seed'       -- 'seed' | 'discovered'
);

-- Index for vector similarity search
create index on use_cases using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for function filtering
create index on use_cases (function);
```

---

## Table: conversations

One row per ClaireCo session.

```sql
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  department text not null,
  status text default 'in_progress',
    -- 'in_progress' | 'completed' | 'abandoned'
  path text,
    -- 'A' (known confirmed) | 'B' (rejected, redirected) | 'C' (new)
  match_use_case_id integer references public.use_cases(id),
  match_confidence numeric,        -- 0.0 to 1.0
  match_confirmed boolean,         -- Did user confirm the match?
  message_count integer default 0,
  transcript jsonb default '[]',   -- Array of {role, content, timestamp}
  started_at timestamptz default now(),
  completed_at timestamptz,
  device text                      -- 'mobile' | 'desktop'
);

-- RLS: employees see only their own
alter table public.conversations enable row level security;

create policy "Users see own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users insert own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users update own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Champions see all conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_champion = true
    )
  );
```

---

## Table: briefs

One row per completed conversation. The structured PRD extracted by Claude.

```sql
create table public.briefs (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  brief_ref text unique not null,  -- e.g. "AGT-4821"

  -- Extracted fields
  department text not null,
  pain_summary text not null,
  frequency text,
  systems_involved text[],
  people_affected text,
  time_impact text,
  success_criteria text,
  edge_cases text,

  -- Classification
  match_type text not null,        -- 'known' | 'new'
  matched_use_case_id integer references public.use_cases(id),
  confidence text,                 -- 'high' | 'medium' | 'low'
  readiness text,                  -- 'ready_to_build' | 'needs_followup' | 'exploratory'

  -- Scoring (filled by champion)
  score_value integer,             -- Sum of value dimension (V1-V6), max 30
  score_feasibility integer,       -- Sum of feasibility dimension (F1-F6), max 30
  score_adoption integer,          -- Sum of adoption dimension (A1-A3), max 15
  score_total integer,             -- Total out of 75
  priority_tier text,              -- 'P1' | 'P2' | 'P3' | 'Hold'

  -- Champion workflow
  champion_id uuid references public.profiles(id),
  champion_notes text,
  status text default 'pending',
    -- 'pending' | 'in_review' | 'scored' | 'building' | 'shipped' | 'rejected'

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-generate brief_ref
create or replace function generate_brief_ref()
returns trigger as $$
begin
  new.brief_ref = 'AGT-' || floor(random() * 9000 + 1000)::text;
  return new;
end;
$$ language plpgsql;

create trigger set_brief_ref
  before insert on public.briefs
  for each row execute procedure generate_brief_ref();

-- RLS
alter table public.briefs enable row level security;

create policy "Users see own briefs"
  on public.briefs for select
  using (auth.uid() = user_id);

create policy "Champions see all briefs"
  on public.briefs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_champion = true
    )
  );
```

---

## Table: use_case_submissions

Tracks which use cases get submitted most often. Used for heat maps.

```sql
create table public.use_case_submissions (
  id uuid default uuid_generate_v4() primary key,
  use_case_id integer references public.use_cases(id),
  brief_id uuid references public.briefs(id),
  department text,
  confirmed boolean,               -- Was the match confirmed by user?
  created_at timestamptz default now()
);
```

---

## Useful Queries

### Briefs pending champion review
```sql
select b.brief_ref, b.department, b.pain_summary, b.match_type,
       b.confidence, b.created_at, p.full_name as submitted_by
from briefs b
join profiles p on b.user_id = p.id
where b.status = 'pending'
order by b.created_at desc;
```

### Most requested use cases
```sql
select uc.name, uc.function, count(*) as request_count,
       sum(case when us.confirmed then 1 else 0 end) as confirmed_count
from use_case_submissions us
join use_cases uc on us.use_case_id = uc.id
group by uc.id, uc.name, uc.function
order by request_count desc;
```

### Department heat map
```sql
select department, count(*) as brief_count,
       count(case when match_type = 'known' then 1 end) as known_matches,
       count(case when match_type = 'new' then 1 end) as new_discoveries
from briefs
group by department
order by brief_count desc;
```

### Weekly submission trend
```sql
select date_trunc('week', created_at) as week,
       count(*) as submissions
from briefs
group by week
order by week desc
limit 12;
```

---

## Seeding Use Cases

After creating the table, seed it from use-cases.json:

```javascript
// seed-use-cases.js (run once via Supabase Edge Function or locally)
import { createClient } from '@supabase/supabase-js'
import useCases from './use-cases.json' assert { type: 'json' }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { error } = await supabase
  .from('use_cases')
  .upsert(useCases, { onConflict: 'id' })

if (error) console.error(error)
else console.log(`Seeded ${useCases.length} use cases`)
```
