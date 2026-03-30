-- Admin review queue metadata and broader claim status support.

alter table public.school_profile_claims
  add column if not exists internal_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;

alter table public.school_profile_claims
  drop constraint if exists school_profile_claims_claim_status_check;

alter table public.school_profile_claims
  add constraint school_profile_claims_claim_status_check
  check (claim_status in ('submitted', 'needs_review', 'checkout_pending', 'paid', 'published', 'cancelled', 'rejected'));

create index if not exists idx_school_profile_claims_reviewed_at
  on public.school_profile_claims(reviewed_at desc nulls last);

create index if not exists idx_school_profile_claims_admin_queue
  on public.school_profile_claims(claim_status, plan_slug, payment_status, created_at desc);
