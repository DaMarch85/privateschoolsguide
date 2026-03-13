-- The Private School Guide
-- Core scalable schema additions for Astro + Supabase build-time generation.
-- IMPORTANT: this migration assumes schools.id is UUID.
-- If your current schools.id is bigint, change every school_id column below to bigint before running.

create extension if not exists pgcrypto;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  region text,
  hero_title text,
  meta_title text,
  meta_description text,
  intro_text text,
  latitude double precision,
  longitude double precision,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.location_schools (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  sort_order integer not null default 100,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique (location_id, school_id)
);

create index if not exists idx_location_schools_location_sort on public.location_schools(location_id, sort_order);
create index if not exists idx_location_schools_school on public.location_schools(school_id);

create table if not exists public.school_fee_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year text not null,
  fee_type text not null check (fee_type in ('day', 'weekly_boarding', 'full_boarding')),
  year_group_label text not null,
  amount_gbp numeric(10,2) not null,
  includes_vat boolean not null default true,
  notes text,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year, fee_type, year_group_label)
);

create index if not exists idx_school_fee_profiles_school on public.school_fee_profiles(school_id);

create table if not exists public.school_exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_type text not null check (exam_type in ('alevel', 'gcse')),
  result_year integer not null,
  entries_count integer,
  pct_a_star_a numeric(6,5),
  pct_a_star_b numeric(6,5),
  pct_9_7 numeric(6,5),
  pct_9_4 numeric(6,5),
  unique_subjects integer,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, exam_type, result_year)
);

create index if not exists idx_school_exam_results_school on public.school_exam_results(school_id, exam_type, result_year desc);

create table if not exists public.school_subject_popularity (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_type text not null check (exam_type in ('alevel', 'gcse')),
  result_year integer not null,
  subject_name text not null,
  entries_count integer,
  share_of_entries numeric(6,5),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, exam_type, result_year, subject_name)
);

create index if not exists idx_school_subject_popularity_school on public.school_subject_popularity(school_id, exam_type, result_year desc, sort_order);

create table if not exists public.school_bursaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  has_bursaries boolean,
  summary text,
  entry_points text,
  max_award_percent numeric(5,2),
  annual_fund_amount_gbp numeric(12,2),
  means_tested boolean,
  hardship_support boolean,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_images (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  image_type text not null check (image_type in ('hero', 'thumb', 'gallery')),
  image_url text not null,
  alt_text text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_images_school on public.school_images(school_id, image_type, sort_order);

create table if not exists public.school_open_days (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  booking_url text,
  notes text,
  is_verified boolean not null default false,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_open_days_school on public.school_open_days(school_id, start_at);

alter table public.locations enable row level security;
alter table public.location_schools enable row level security;
alter table public.school_fee_profiles enable row level security;
alter table public.school_exam_results enable row level security;
alter table public.school_subject_popularity enable row level security;
alter table public.school_bursaries enable row level security;
alter table public.school_images enable row level security;
alter table public.school_open_days enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'locations' and policyname = 'Public read locations') then
    create policy "Public read locations" on public.locations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'location_schools' and policyname = 'Public read location_schools') then
    create policy "Public read location_schools" on public.location_schools for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_fee_profiles' and policyname = 'Public read school_fee_profiles') then
    create policy "Public read school_fee_profiles" on public.school_fee_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_exam_results' and policyname = 'Public read school_exam_results') then
    create policy "Public read school_exam_results" on public.school_exam_results for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_subject_popularity' and policyname = 'Public read school_subject_popularity') then
    create policy "Public read school_subject_popularity" on public.school_subject_popularity for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_bursaries' and policyname = 'Public read school_bursaries') then
    create policy "Public read school_bursaries" on public.school_bursaries for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_images' and policyname = 'Public read school_images') then
    create policy "Public read school_images" on public.school_images for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_open_days' and policyname = 'Public read school_open_days') then
    create policy "Public read school_open_days" on public.school_open_days for select using (true);
  end if;
end $$;
