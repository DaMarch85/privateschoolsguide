import { assertAdminReviewToken } from '../_shared/admin-auth.ts';
import { createAdminClient, normalizeUrl } from '../_shared/claim-publisher.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ClaimRow = {
  id: string;
  school_id: string | number;
  plan_slug: 'claimed' | 'enhanced' | 'featured';
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  contact_form_url: string | null;
  notes: string | null;
  internal_notes?: string | null;
  founding_programme: boolean | null;
  image_urls: unknown;
  open_day_title: string | null;
  open_day_start_at: string | null;
  open_day_booking_url: string | null;
  open_day_notes: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  auto_publish: boolean | null;
  claim_status: string;
  payment_status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type SchoolRow = {
  id: string | number;
  name: string;
  slug: string;
  website: string | null;
  website_override_url?: string | null;
  contact_form_url?: string | null;
  profile_package?: string | null;
  profile_managed_by_school?: boolean | null;
  claimed_at?: string | null;
};

type LocationLinkRow = {
  school_id: string | number;
  location_id: string | number;
  sort_order: number | null;
};

type LocationRow = {
  id: string | number;
  name: string;
  slug: string;
  is_live?: boolean | null;
};

type SchoolImageRow = {
  school_id: string | number;
  image_url: string | null;
  alt_text: string | null;
  image_type: string;
  sort_order: number | null;
  source?: string | null;
  is_active?: boolean | null;
};

type SchoolOpenDayRow = {
  school_id: string | number;
  title: string | null;
  start_at: string | null;
  booking_url: string | null;
  notes: string | null;
  source?: string | null;
  is_active?: boolean | null;
};

type ListFilter = 'all' | 'actionable' | 'awaiting_payment' | 'live' | 'rejected' | 'cancelled';

function toKey(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

function dedupe<T extends string | number>(values: T[]): T[] {
  return Array.from(new Set(values.filter((value) => String(value ?? '').trim().length > 0)));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normaliseFilter(value: string | null): ListFilter {
  if (value === 'actionable' || value === 'awaiting_payment' || value === 'live' || value === 'rejected' || value === 'cancelled') {
    return value;
  }
  return 'all';
}

function normaliseSearch(value: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function readImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getQueueRecommendation(claim: ClaimRow): string {
  if (claim.claim_status === 'paid') {
    return 'Payment has been received. Review the content and approve it to publish the selected package.';
  }
  if (claim.claim_status === 'submitted' || claim.claim_status === 'needs_review') {
    return claim.founding_programme
      ? 'This Founding School Programme request is ready for editorial review. Approving it will publish the Enhanced package without Stripe billing.'
      : 'Review the school contact details, links and images, then approve to publish the profile.';
  }
  if (claim.claim_status === 'checkout_pending') {
    return 'The school has not completed payment yet. This claim can stay in the queue until Stripe confirms checkout.';
  }
  if (claim.claim_status === 'published') {
    return 'This claim is already live. The live profile panel shows what parents currently see.';
  }
  if (claim.claim_status === 'rejected') {
    return 'This claim was rejected. Reopen it if the school comes back with better verification or updated assets.';
  }
  if (claim.claim_status === 'cancelled') {
    return 'Stripe marked this claim as cancelled. Reopen only if you want to reconsider it manually.';
  }
  return 'Review this claim before publishing changes to the live school page.';
}

function getPaymentLabel(value: string): string {
  switch (value) {
    case 'free':
      return 'Free claim';
    case 'founding_trial':
      return 'Founding programme';
    case 'checkout_pending':
      return 'Awaiting checkout';
    case 'paid':
      return 'Paid';
    case 'active':
      return 'Subscription active';
    case 'trialing':
      return 'Trialing';
    case 'past_due':
      return 'Past due';
    case 'unpaid':
      return 'Unpaid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return value || 'Not started';
  }
}

function getPlanName(value: ClaimRow['plan_slug']): string {
  return value === 'featured' ? 'Featured' : value === 'enhanced' ? 'Enhanced' : 'Claimed';
}

function isClaimActionable(claim: ClaimRow): boolean {
  return claim.claim_status === 'submitted' || claim.claim_status === 'needs_review' || claim.claim_status === 'paid';
}

function canRejectClaim(claim: ClaimRow): boolean {
  return claim.claim_status !== 'published' && claim.claim_status !== 'cancelled';
}

function canReopenClaim(claim: ClaimRow): boolean {
  return claim.claim_status === 'rejected' || claim.claim_status === 'cancelled';
}

function canCancelBilling(claim: ClaimRow): boolean {
  return Boolean(claim.stripe_subscription_id) && ['paid', 'active', 'trialing', 'past_due', 'unpaid'].includes(claim.payment_status);
}

async function loadSchoolContext(supabase: ReturnType<typeof createAdminClient>, schoolIds: Array<string | number>) {
  const uniqueSchoolIds = dedupe(schoolIds);
  if (!uniqueSchoolIds.length) return new Map<string, { school: SchoolRow; location: LocationRow | null; schoolPageUrl: string | null }>();

  const [{ data: schoolsData, error: schoolsError }, { data: locationLinksData, error: linksError }] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, slug, website, website_override_url, contact_form_url, profile_package, profile_managed_by_school, claimed_at')
      .in('id', uniqueSchoolIds),
    supabase
      .from('location_schools')
      .select('school_id, location_id, sort_order')
      .in('school_id', uniqueSchoolIds)
  ]);

  if (schoolsError) throw new Error(`Could not load schools for admin review queue: ${schoolsError.message}`);
  if (linksError) throw new Error(`Could not load school location links for admin review queue: ${linksError.message}`);

  const locationIds = dedupe(((locationLinksData || []) as LocationLinkRow[]).map((row) => row.location_id));
  const locationsData = locationIds.length
    ? await supabase.from('locations').select('id, name, slug, is_live').in('id', locationIds)
    : { data: [], error: null };

  if (locationsData.error) {
    throw new Error(`Could not load locations for admin review queue: ${locationsData.error.message}`);
  }

  const locationsById = new Map<string, LocationRow>();
  ((locationsData.data || []) as LocationRow[]).forEach((location) => {
    locationsById.set(toKey(location.id), location);
  });

  const linksBySchool = new Map<string, LocationLinkRow[]>();
  ((locationLinksData || []) as LocationLinkRow[]).forEach((row) => {
    const key = toKey(row.school_id);
    const list = linksBySchool.get(key) || [];
    list.push(row);
    linksBySchool.set(key, list);
  });

  const contextBySchool = new Map<string, { school: SchoolRow; location: LocationRow | null; schoolPageUrl: string | null }>();
  ((schoolsData || []) as SchoolRow[]).forEach((school) => {
    const key = toKey(school.id);
    const candidateLinks = [...(linksBySchool.get(key) || [])]
      .filter((row) => locationsById.get(toKey(row.location_id))?.is_live !== false)
      .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999));
    const location = candidateLinks.length ? locationsById.get(toKey(candidateLinks[0].location_id)) || null : null;
    const schoolPageUrl = location ? `/${location.slug}/schools/${school.slug}/` : null;
    contextBySchool.set(key, { school, location, schoolPageUrl });
  });

  return contextBySchool;
}

function listSummaryItem(claim: ClaimRow, schoolContext: { school: SchoolRow; location: LocationRow | null; schoolPageUrl: string | null } | undefined) {
  const school = schoolContext?.school;
  const location = schoolContext?.location;
  const summary = {
    id: claim.id,
    schoolId: toKey(claim.school_id),
    schoolName: school?.name || 'Unknown school',
    schoolSlug: school?.slug || null,
    schoolPageUrl: schoolContext?.schoolPageUrl || null,
    locationName: location?.name || null,
    planSlug: claim.plan_slug,
    planName: getPlanName(claim.plan_slug),
    foundingProgramme: Boolean(claim.founding_programme),
    claimStatus: claim.claim_status,
    paymentStatus: claim.payment_status,
    paymentLabel: getPaymentLabel(claim.payment_status),
    contactName: claim.contact_name || null,
    contactEmail: claim.contact_email || null,
    contactRole: claim.contact_role || null,
    createdAt: claim.created_at,
    reviewedAt: claim.reviewed_at || null,
    reviewedBy: claim.reviewed_by || null,
    imageCount: readImageUrls(claim.image_urls).length,
    hasLiveProfile: school?.profile_managed_by_school === true,
    livePackage: school?.profile_package || 'organic'
  };

  return {
    ...summary,
    searchText: [
      summary.schoolName,
      summary.locationName,
      summary.contactName,
      summary.contactEmail,
      summary.contactRole,
      summary.planName,
      summary.claimStatus,
      summary.paymentLabel
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).join(' ')
  };
}

async function loadSelectedClaimExtras(supabase: ReturnType<typeof createAdminClient>, schoolId: string | number) {
  const [{ data: imageRows, error: imageError }, { data: openDayRows, error: openDayError }] = await Promise.all([
    supabase
      .from('school_images')
      .select('school_id, image_url, alt_text, image_type, sort_order, source, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('school_open_days')
      .select('school_id, title, start_at, booking_url, notes, source, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('start_at', { ascending: true })
  ]);

  if (imageError) throw new Error(`Could not load live school images for admin review: ${imageError.message}`);
  if (openDayError) throw new Error(`Could not load live school open days for admin review: ${openDayError.message}`);

  return {
    images: (imageRows || []) as SchoolImageRow[],
    openDays: (openDayRows || []) as SchoolOpenDayRow[]
  };
}

function detailView(claim: ClaimRow, schoolContext: { school: SchoolRow; location: LocationRow | null; schoolPageUrl: string | null } | undefined, extras: { images: SchoolImageRow[]; openDays: SchoolOpenDayRow[] }) {
  const school = schoolContext?.school;
  const liveClaimImages = extras.images
    .filter((image) => image.source === 'school_claim')
    .map((image) => ({
      url: normalizeUrl(image.image_url),
      alt: image.alt_text,
      imageType: image.image_type
    }))
    .filter((image): image is { url: string; alt: string | null; imageType: string } => Boolean(image.url));

  const liveClaimOpenDays = extras.openDays
    .filter((item) => item.source === 'school_claim')
    .map((item) => ({
      title: item.title,
      startAt: item.start_at,
      bookingUrl: normalizeUrl(item.booking_url),
      notes: item.notes
    }));

  return {
    id: claim.id,
    schoolId: toKey(claim.school_id),
    schoolName: school?.name || 'Unknown school',
    schoolSlug: school?.slug || null,
    schoolPageUrl: schoolContext?.schoolPageUrl || null,
    locationName: schoolContext?.location?.name || null,
    planSlug: claim.plan_slug,
    planName: getPlanName(claim.plan_slug),
    foundingProgramme: Boolean(claim.founding_programme),
    claimStatus: claim.claim_status,
    paymentStatus: claim.payment_status,
    paymentLabel: getPaymentLabel(claim.payment_status),
    contactName: claim.contact_name || null,
    contactRole: claim.contact_role || null,
    contactEmail: claim.contact_email || null,
    contactPhone: claim.contact_phone || null,
    submittedWebsiteUrl: normalizeUrl(claim.website_url),
    submittedContactFormUrl: normalizeUrl(claim.contact_form_url),
    schoolSubmittedNotes: claim.notes || null,
    internalNotes: claim.internal_notes || null,
    submittedImageUrls: readImageUrls(claim.image_urls),
    openDayTitle: claim.open_day_title || null,
    openDayStartAt: claim.open_day_start_at || null,
    openDayBookingUrl: normalizeUrl(claim.open_day_booking_url),
    openDayNotes: claim.open_day_notes || null,
    stripeCheckoutSessionId: claim.stripe_checkout_session_id || null,
    stripeCustomerId: claim.stripe_customer_id || null,
    stripeSubscriptionId: claim.stripe_subscription_id || null,
    autoPublish: Boolean(claim.auto_publish),
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
    publishedAt: claim.published_at || null,
    reviewedAt: claim.reviewed_at || null,
    reviewedBy: claim.reviewed_by || null,
    queueRecommendation: getQueueRecommendation(claim),
    canApprove: isClaimActionable(claim),
    canReject: canRejectClaim(claim),
    canReopen: canReopenClaim(claim),
    canCancelBilling: canCancelBilling(claim),
    liveProfile: school ? {
      websiteUrl: normalizeUrl(school.website_override_url) || normalizeUrl(school.website),
      contactFormUrl: normalizeUrl(school.contact_form_url),
      profilePackage: school.profile_package || 'organic',
      profileManagedBySchool: Boolean(school.profile_managed_by_school),
      claimedAt: school.claimed_at || null,
      schoolClaimImages: liveClaimImages,
      schoolClaimOpenDays: liveClaimOpenDays
    } : null
  };
}

function applyListFilter(query: any, filter: ListFilter) {
  if (filter === 'actionable') {
    return query.in('claim_status', ['submitted', 'needs_review', 'paid']);
  }
  if (filter === 'awaiting_payment') {
    return query.eq('claim_status', 'checkout_pending');
  }
  if (filter === 'live') {
    return query.eq('claim_status', 'published');
  }
  if (filter === 'rejected') {
    return query.eq('claim_status', 'rejected');
  }
  if (filter === 'cancelled') {
    return query.eq('claim_status', 'cancelled');
  }
  return query;
}

async function summaryCounts(supabase: ReturnType<typeof createAdminClient>) {
  const [actionable, awaitingPayment, live, rejected, cancelled, total] = await Promise.all([
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true }).in('claim_status', ['submitted', 'needs_review', 'paid']),
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true }).eq('claim_status', 'checkout_pending'),
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true }).eq('claim_status', 'published'),
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true }).eq('claim_status', 'rejected'),
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true }).eq('claim_status', 'cancelled'),
    supabase.from('school_profile_claims').select('id', { count: 'exact', head: true })
  ]);

  const error = [actionable, awaitingPayment, live, rejected, cancelled, total].find((result) => result.error)?.error;
  if (error) throw new Error(`Could not load admin review queue counts: ${error.message}`);

  return {
    actionable: actionable.count || 0,
    awaitingPayment: awaitingPayment.count || 0,
    live: live.count || 0,
    rejected: rejected.count || 0,
    cancelled: cancelled.count || 0,
    total: total.count || 0
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    assertAdminReviewToken(request);
    const url = new URL(request.url);
    const filter = normaliseFilter(url.searchParams.get('filter'));
    const selectedClaimId = String(url.searchParams.get('claim') || '').trim() || null;
    const search = normaliseSearch(url.searchParams.get('q'));
    const limit = clamp(Number(url.searchParams.get('limit') || 60), 20, search ? 200 : 120);
    const supabase = createAdminClient();

    let claimsQuery = supabase
      .from('school_profile_claims')
      .select('id, school_id, plan_slug, contact_name, contact_role, contact_email, contact_phone, website_url, contact_form_url, notes, internal_notes, founding_programme, image_urls, open_day_title, open_day_start_at, open_day_booking_url, open_day_notes, stripe_checkout_session_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, auto_publish, claim_status, payment_status, published_at, created_at, updated_at, reviewed_at, reviewed_by')
      .order('created_at', { ascending: false })
      .limit(limit);

    claimsQuery = applyListFilter(claimsQuery, filter);
    const { data: claimsData, error: claimsError } = await claimsQuery;
    if (claimsError) throw new Error(`Could not load school profile claims: ${claimsError.message}`);

    const claims = (claimsData || []) as ClaimRow[];
    const contextMap = await loadSchoolContext(supabase, claims.map((claim) => claim.school_id));
    const listItems = claims
      .map((claim) => listSummaryItem(claim, contextMap.get(toKey(claim.school_id))))
      .filter((item) => !search || item.searchText.includes(search))
      .map(({ searchText, ...item }) => item);

    let selectedClaim = null;
    if (selectedClaimId) {
      const { data: selectedClaimData, error: selectedClaimError } = await supabase
        .from('school_profile_claims')
        .select('id, school_id, plan_slug, contact_name, contact_role, contact_email, contact_phone, website_url, contact_form_url, notes, internal_notes, founding_programme, image_urls, open_day_title, open_day_start_at, open_day_booking_url, open_day_notes, stripe_checkout_session_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, auto_publish, claim_status, payment_status, published_at, created_at, updated_at, reviewed_at, reviewed_by')
        .eq('id', selectedClaimId)
        .maybeSingle();

      if (selectedClaimError) throw new Error(`Could not load selected claim: ${selectedClaimError.message}`);
      if (selectedClaimData) {
        const selected = selectedClaimData as ClaimRow;
        const selectedContextMap = contextMap.has(toKey(selected.school_id))
          ? contextMap
          : await loadSchoolContext(supabase, [selected.school_id]);
        const extras = await loadSelectedClaimExtras(supabase, selected.school_id);
        selectedClaim = detailView(selected, selectedContextMap.get(toKey(selected.school_id)), extras);
      }
    }

    return jsonResponse({
      ok: true,
      summary: await summaryCounts(supabase),
      filters: {
        filter,
        q: search,
        limit
      },
      claims: listItems,
      selectedClaim
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not load the admin review queue.' }, { status: 400 });
  }
});
