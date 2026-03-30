-- School-managed profiles, claims workflow, uploads and subscription plumbing.
-- This migration dynamically matches the type of public.schools.id when creating school_profile_claims.school_id.

create extension if not exists pgcrypto;

alter table public.schools add column if not exists website_override_url text;
alter table public.schools add column if not exists contact_form_url text;
alter table public.schools add column if not exists profile_package text;
alter table public.schools add column if not exists profile_managed_by_school boolean not null default false;
alter table public.schools add column if not exists claimed_at timestamptz;

update public.schools set profile_package = 'organic' where profile_package is null;
alter table public.schools alter column profile_package set default 'organic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.schools'::regclass
      AND conname = 'schools_profile_package_check'
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_profile_package_check
      CHECK (profile_package IN ('organic', 'claimed', 'enhanced', 'featured'));
  END IF;
END $$;

create index if not exists idx_schools_profile_package on public.schools(profile_package);
create index if not exists idx_schools_claimed_at on public.schools(claimed_at desc nulls last);

DO $$
DECLARE
  school_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO school_id_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'schools'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF school_id_type IS NULL THEN
    RAISE EXCEPTION 'Could not determine public.schools.id type';
  END IF;

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS public.school_profile_claims (
      id uuid primary key default gen_random_uuid(),
      school_id %s not null references public.schools(id) on delete cascade,
      plan_slug text not null check (plan_slug in ('claimed', 'enhanced', 'featured')),
      contact_name text not null,
      contact_role text,
      contact_email text not null,
      contact_phone text,
      website_url text,
      contact_form_url text,
      notes text,
      founding_programme boolean not null default false,
      image_urls jsonb not null default '[]'::jsonb,
      open_day_title text,
      open_day_start_at timestamptz,
      open_day_booking_url text,
      open_day_notes text,
      stripe_checkout_session_id text,
      stripe_customer_id text,
      stripe_subscription_id text,
      stripe_price_id text,
      auto_publish boolean not null default false,
      claim_status text not null default 'submitted' check (claim_status in ('submitted', 'needs_review', 'checkout_pending', 'paid', 'published', 'cancelled')),
      payment_status text not null default 'not_started' check (payment_status in ('not_started', 'free', 'founding_trial', 'checkout_pending', 'paid', 'active', 'trialing', 'past_due', 'unpaid', 'cancelled')),
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$, school_id_type);
END $$;

create index if not exists idx_school_profile_claims_school on public.school_profile_claims(school_id, created_at desc);
create index if not exists idx_school_profile_claims_status on public.school_profile_claims(claim_status, payment_status, created_at desc);
create unique index if not exists idx_school_profile_claims_checkout_session on public.school_profile_claims(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists idx_school_profile_claims_subscription on public.school_profile_claims(stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.school_profile_claims enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-media',
  'school-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.school_images add column if not exists source text;
alter table public.school_images add column if not exists is_active boolean;
alter table public.school_images add column if not exists claim_id uuid references public.school_profile_claims(id) on delete set null;

update public.school_images set source = 'editorial' where source is null;
update public.school_images set is_active = true where is_active is null;

alter table public.school_images alter column source set default 'editorial';
alter table public.school_images alter column is_active set default true;
alter table public.school_images alter column is_active set not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.school_images'::regclass
      AND conname = 'school_images_source_check'
  ) THEN
    ALTER TABLE public.school_images
      ADD CONSTRAINT school_images_source_check
      CHECK (source IN ('editorial', 'school_claim'));
  END IF;
END $$;

create index if not exists idx_school_images_active_sort on public.school_images(school_id, is_active, image_type, sort_order);
create index if not exists idx_school_images_claim on public.school_images(claim_id);

alter table public.school_open_days add column if not exists source text;
alter table public.school_open_days add column if not exists is_active boolean;
alter table public.school_open_days add column if not exists claim_id uuid references public.school_profile_claims(id) on delete set null;

update public.school_open_days set source = 'editorial' where source is null;
update public.school_open_days set is_active = true where is_active is null;

alter table public.school_open_days alter column source set default 'editorial';
alter table public.school_open_days alter column is_active set default true;
alter table public.school_open_days alter column is_active set not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.school_open_days'::regclass
      AND conname = 'school_open_days_source_check'
  ) THEN
    ALTER TABLE public.school_open_days
      ADD CONSTRAINT school_open_days_source_check
      CHECK (source IN ('editorial', 'school_claim'));
  END IF;
END $$;

create index if not exists idx_school_open_days_active on public.school_open_days(school_id, is_active, start_at);
create index if not exists idx_school_open_days_claim on public.school_open_days(claim_id);
