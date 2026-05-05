// src/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
//  Supabase client — uses CRA environment variable convention (REACT_APP_*)
//
//  SETUP INSTRUCTIONS
//  ──────────────────
//  1. Go to https://supabase.com → your project → Settings → API
//
//  2. Create a file called  .env  in your project root (same folder as
//     package.json) with these two lines:
//
//       REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//       REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
//
//  3. Add .env to your .gitignore so it is NEVER committed to GitHub.
//
//  4. In Vercel → your project → Settings → Environment Variables, add
//     the same two variables for Production, Preview and Development.
//
//  5. Run the SQL in the comment block below inside:
//     Supabase Dashboard → SQL Editor → New Query
//
// ─────────────────────────────────────────────────────────────────────────────
//  SQL — PASTE INTO SUPABASE SQL EDITOR AND RUN
// ─────────────────────────────────────────────────────────────────────────────
/*

-- ── COURSES ──────────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  course_code      text not null,
  course_name      text not null,
  instructor_name  text,
  instructor_email text,
  room             text,
  schedule         text,
  color_tag        text not null default 'Blue'
                   check (color_tag in ('Blue','Green','Purple','Pink','Orange')),
  created_at       timestamptz default now()
);
alter table public.courses enable row level security;
create policy "users_own_courses" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── NOTES ────────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  content     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.notes enable row level security;
create policy "users_own_notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

-- ── DEADLINES ────────────────────────────────────────────────────────────────
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  description text,
  due_date    timestamptz not null,
  priority    text not null default 'Medium'
              check (priority in ('High','Medium','Low')),
  status      text not null default 'Pending'
              check (status in ('Pending','Done')),
  reminder    text default 'None'
              check (reminder in ('None','1 day before','2 hours before')),
  created_at  timestamptz default now()
);
alter table public.deadlines enable row level security;
create policy "users_own_deadlines" on public.deadlines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── QUIZZES ───────────────────────────────────────────────────────────────────
create table if not exists public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  title          text not null,
  date_time      timestamptz not null,
  topics_covered text,
  weight         numeric(5,2) default 0 check (weight >= 0 and weight <= 100),
  score          numeric(5,2)           check (score  >= 0 and score  <= 100),
  status         text not null default 'Upcoming'
                 check (status in ('Upcoming','Completed')),
  created_at     timestamptz default now()
);
alter table public.quizzes enable row level security;
create policy "users_own_quizzes" on public.quizzes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── ASSESSMENTS ───────────────────────────────────────────────────────────────
create table if not exists public.assessments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  title           text not null,
  type            text not null default 'Midterm'
                  check (type in ('Midterm','Final','Project')),
  due_date        timestamptz not null,
  weight          numeric(5,2) not null default 0
                  check (weight >= 0 and weight <= 100),
  submission_type text not null default 'Online'
                  check (submission_type in ('Online','In-person','File upload')),
  status          text not null default 'Not Started'
                  check (status in ('Not Started','In Progress','Submitted','Graded')),
  created_at      timestamptz default now()
);
alter table public.assessments enable row level security;
create policy "users_own_assessments" on public.assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  title           text not null,
  description     text,
  due_date        timestamptz not null,
  points          numeric(7,2) check (points >= 0),
  submission_type text not null default 'Text entry'
                  check (submission_type in ('Link','File upload','Text entry')),
  status          text not null default 'Not Started'
                  check (status in ('Not Started','In Progress','Submitted','Graded')),
  priority        text not null default 'Medium'
                  check (priority in ('High','Medium','Low')),
  created_at      timestamptz default now()
);
alter table public.assignments enable row level security;
create policy "users_own_assignments" on public.assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── TIMETABLE SLOTS ───────────────────────────────────────────────────────────
create table if not exists public.timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  day         text not null
              check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time  text not null,
  end_time    text not null,
  label       text,
  color_tag   text default 'Blue'
              check (color_tag in ('Blue','Green','Purple','Pink','Orange')),
  created_at  timestamptz default now()
);
alter table public.timetable_slots enable row level security;
create policy "users_own_timetable" on public.timetable_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

*/
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This error surfaces in the browser console during local dev only.
  // On Vercel it will be caught at build time if env vars are missing.
  console.error(
    '[StudyDesk] Missing Supabase env vars.\n' +
    'Create a .env file with REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  SUPABASE_URL  || '',
  SUPABASE_ANON_KEY || ''
);
