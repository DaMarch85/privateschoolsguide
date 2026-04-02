import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createAdminClient, normalizeUrl, publishClaim, unpublishClaim, type SchoolClaimRow } from '../_shared/claim-publisher.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type PlanSlug = 'claimed' | 'enhanced' | 'featured';
type ManageAction = 'status' | 'change_plan' | 'cancel_profile';

type ManagePayload = {
  action?: ManageAction;
  schoolId?: string | number;
  contactEmail?: string;
  targetPlan?: PlanSlug;
};

type ClaimRow = SchoolClaimRow & {
  id: string;
  school_id: string | number;
  plan_slug: PlanSlug;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  founding_programme?: boolean | null;
  image_urls?: unknown;
  notes?: string | null;
  open_day_title?: string | null;
  open_day_start_at?: string | null;
  open_day_booking_url?: string | null;
  open_day_notes?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  auto_publish?: boolean | null;
  claim_status?: string | null;
  payment_status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SchoolRow = {
  id: string | number;
  name: string;
  profile_package?: string | null;
  profile_managed_by_school?: boolean | null;
  website_override_url?: string | null;
  contact_form_url?: string | null;
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

function cleanText(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeEmail(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

function normalizePlan(value: unknown): PlanSlug {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'enhanced') return 'enhanced';
  if (raw === 'featured') return 'featured';
  return 'claimed';
}

function parseSchoolId(value: unknown): string | number {
  const cleaned = cleanText(value);
  if (!cleaned) throw new Error('Please choose a school.');
  const asNumber = Number(cleaned);
  if (Number.isFinite(asNumber) && String(asNumber) === cleaned) return asNumber;
  return cleaned;
}

function getSiteUrl(): string {
  return String(Deno.env.get('PUBLIC_SITE_URL') || 'https://www.privateschoolguide.co.uk').replace(/\/$/, '');
}

function planLabel(plan: PlanSlug): string {
  return plan === 'featured' ? 'Featured profile' : plan === 'enhanced' ? 'Enhanced profile' : 'Claimed profile';
}

function planPriceLabel(plan: PlanSlug): string {
  return plan === 'featured' ? '£99 / month' : plan === 'enhanced' ? '£39 / month' : 'Free';
}

function planSummary(plan: PlanSlug): string {
  if (plan === 'featured') return 'Priority placement above Enhanced profiles.';
  if (plan === 'enhanced') return 'Priority placement above free listings.';
  return 'Keeps the profile accurate and clearly school-supported.';
}

function isPaidPlan(plan: PlanSlug): boolean {
  return plan === 'enhanced' || plan === 'featured';
}

function hasActiveSubscription(claim: ClaimRow): boolean {
  return Boolean(cleanText(claim.stripe_subscription_id));
}

function getPriceId(plan: PlanSlug): string {
  if (plan === 'enhanced') {
    const value = Deno.env.get('STRIPE_PRICE_ENHANCED_MONTHLY');
    if (!value) throw new Error('Missing STRIPE_PRICE_ENHANCED_MONTHLY.');
    return value;
  }
  if (plan === 'featured') {
    const value = Deno.env.get('STRIPE_PRICE_FEATURED_MONTHLY');
    if (!value) throw new Error('Missing STRIPE_PRICE_FEATURED_MONTHLY.');
    return value;
  }
  throw new Error('The claimed profile does not use a Stripe price.');
}

function buildAvailableActions(currentPlan: PlanSlug): Array<{ action: 'change_plan' | 'cancel_profile'; targetPlan?: PlanSlug; label: string; tone?: 'primary' | 'danger' | 'default' }> {
  if (currentPlan === 'claimed') {
    return [
      { action: 'change_plan', targetPlan: 'enhanced', label: 'Upgrade to Enhanced', tone: 'primary' },
      { action: 'change_plan', targetPlan: 'featured', label: 'Upgrade to Featured' },
      { action: 'cancel_profile', label: 'Cancel claimed profile', tone: 'danger' }
    ];
  }

  if (currentPlan === 'enhanced') {
    return [
      { action: 'change_plan', targetPlan: 'featured', label: 'Upgrade to Featured', tone: 'primary' },
      { action: 'change_plan', targetPlan: 'claimed', label: 'Downgrade to Claimed' },
      { action: 'cancel_profile', label: 'Cancel profile', tone: 'danger' }
    ];
  }

  return [
    { action: 'change_plan', targetPlan: 'enhanced', label: 'Downgrade to Enhanced' },
    { action: 'change_plan', targetPlan: 'claimed', label: 'Downgrade to Claimed' },
    { action: 'cancel_profile', label: 'Cancel profile', tone: 'danger' }
  ];
}

async function getClaimContext(supabase: ReturnType<typeof createAdminClient>, schoolId: string | number, contactEmail: string) {
  const [{ data: schoolData, error: schoolError }, { data: claimsData, error: claimsError }] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, profile_package, profile_managed_by_school, website_override_url, contact_form_url')
      .eq('id', schoolId)
      .maybeSingle(),
    supabase
      .from('school_profile_claims')
      .select('*')
      .eq('school_id', schoolId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
  ]);

  if (schoolError) throw new Error(`Could not load the selected school: ${schoolError.message}`);
  if (!schoolData) throw new Error('The selected school could not be found.');
  if (claimsError) throw new Error(`Could not load school profile history: ${claimsError.message}`);

  const matchingClaims = ((claimsData || []) as ClaimRow[]).filter((claim) => normalizeEmail(claim.contact_email) === contactEmail);
  if (!matchingClaims.length) {
    throw new Error('We could not match that school and contact email to a live school-supported profile.');
  }

  const liveClaim = matchingClaims.find((claim) => claim.claim_status === 'published')
    || matchingClaims.find((claim) => ['paid', 'checkout_pending', 'submitted', 'needs_review'].includes(String(claim.claim_status || '')))
    || matchingClaims[0];

  const school = schoolData as SchoolRow;
  const currentPlan = school.profile_managed_by_school
    ? normalizePlan(school.profile_package || liveClaim.plan_slug || 'claimed')
    : 'claimed';

  return {
    school,
    liveClaim,
    currentPlan,
    matchingClaims
  };
}

async function createCheckoutSession({
  plan,
  claimId,
  schoolId,
  customerEmail
}: {
  plan: PlanSlug;
  claimId: string;
  schoolId: string | number;
  customerEmail: string;
}) {
  if (!isPaidPlan(plan)) return null;
  const stripeKey = stripeSecretKey;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY.');

  const priceId = getPriceId(plan);
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', `${getSiteUrl()}/claim-your-profile/?checkout=success&claim=${claimId}`);
  body.set('cancel_url', `${getSiteUrl()}/claim-your-profile/?checkout=cancel&claim=${claimId}`);
  body.set('line_items[0][price]', priceId);
  body.set('line_items[0][quantity]', '1');
  body.set('customer_email', customerEmail);
  body.set('metadata[claim_id]', claimId);
  body.set('metadata[school_id]', String(schoolId));
  body.set('metadata[package_slug]', plan);
  body.set('subscription_data[metadata][claim_id]', claimId);
  body.set('subscription_data[metadata][school_id]', String(schoolId));
  body.set('subscription_data[metadata][package_slug]', plan);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Stripe could not create the subscription session.');
  }

  return {
    url: String(payload.url || ''),
    id: String(payload.id || ''),
    priceId
  };
}

async function cancelSubscription(subscriptionId: string) {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured, so subscriptions cannot be cancelled right now.');
  await stripe.subscriptions.cancel(subscriptionId);
}

async function changePaidSubscriptionPlan(subscriptionId: string, targetPlan: PlanSlug) {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured, so subscription changes are unavailable right now.');
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items?.data?.[0]?.id;
  if (!itemId) throw new Error('The live Stripe subscription does not contain a billable item.');
  const updated = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
    proration_behavior: 'create_prorations',
    items: [{ id: itemId, price: getPriceId(targetPlan) }]
  });
  return {
    paymentStatus: String(updated.status || 'active'),
    priceId: getPriceId(targetPlan)
  };
}

async function clearStripeReferences(supabase: ReturnType<typeof createAdminClient>, claimId: string) {
  const { error } = await supabase
    .from('school_profile_claims')
    .update({
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_checkout_session_id: null,
      published_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', claimId);

  if (error) throw new Error(`The profile was updated but Stripe references could not be cleared: ${error.message}`);
}

async function createUpgradeClaim({
  supabase,
  sourceClaim,
  school,
  contactEmail,
  targetPlan
}: {
  supabase: ReturnType<typeof createAdminClient>;
  sourceClaim: ClaimRow;
  school: SchoolRow;
  contactEmail: string;
  targetPlan: PlanSlug;
}) {
  const claimId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const websiteUrl = normalizeUrl(sourceClaim.website_url || school.website_override_url);
  const contactFormUrl = normalizeUrl(sourceClaim.contact_form_url || school.contact_form_url);

  const { error: insertError } = await supabase.from('school_profile_claims').insert({
    id: claimId,
    school_id: sourceClaim.school_id,
    plan_slug: targetPlan,
    contact_name: sourceClaim.contact_name,
    contact_role: sourceClaim.contact_role,
    contact_email: contactEmail,
    contact_phone: sourceClaim.contact_phone,
    website_url: websiteUrl,
    contact_form_url: contactFormUrl,
    notes: sourceClaim.notes,
    founding_programme: false,
    image_urls: sourceClaim.image_urls || [],
    open_day_title: sourceClaim.open_day_title,
    open_day_start_at: sourceClaim.open_day_start_at,
    open_day_booking_url: sourceClaim.open_day_booking_url,
    open_day_notes: sourceClaim.open_day_notes,
    auto_publish: true,
    claim_status: 'checkout_pending',
    payment_status: 'checkout_pending',
    created_at: createdAt,
    updated_at: createdAt
  });

  if (insertError) throw new Error(`Could not create the upgrade checkout draft: ${insertError.message}`);

  const checkout = await createCheckoutSession({
    plan: targetPlan,
    claimId,
    schoolId: sourceClaim.school_id,
    customerEmail: contactEmail
  });

  if (!checkout?.url) throw new Error('Stripe Checkout could not be created for this package.');

  const { error: updateError } = await supabase
    .from('school_profile_claims')
    .update({
      stripe_checkout_session_id: checkout.id,
      stripe_price_id: checkout.priceId,
      updated_at: new Date().toISOString()
    })
    .eq('id', claimId);

  if (updateError) throw new Error(`Could not link the upgrade draft to Stripe Checkout: ${updateError.message}`);

  return checkout.url;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const payload = await request.json().catch(() => null) as ManagePayload | null;
    const action = payload?.action || 'status';
    const schoolId = parseSchoolId(payload?.schoolId);
    const contactEmail = normalizeEmail(payload?.contactEmail);
    const targetPlan = normalizePlan(payload?.targetPlan);

    if (!contactEmail) throw new Error('Please enter the school contact email address.');

    const supabase = createAdminClient();
    const { school, liveClaim, currentPlan } = await getClaimContext(supabase, schoolId, contactEmail);

    if (action === 'status') {
      return jsonResponse({
        ok: true,
        schoolName: school.name,
        currentPlan,
        currentPlanLabel: planLabel(currentPlan),
        currentPriceLabel: planPriceLabel(currentPlan),
        currentSummary: planSummary(currentPlan),
        paymentStatus: String(liveClaim.payment_status || 'free'),
        availableActions: school.profile_managed_by_school ? buildAvailableActions(currentPlan) : []
      });
    }

    if (action === 'cancel_profile') {
      if (!school.profile_managed_by_school || liveClaim.claim_status !== 'published') {
        throw new Error('Only live school-supported profiles can be cancelled from this form.');
      }

      const subscriptionId = cleanText(liveClaim.stripe_subscription_id);
      if (subscriptionId) {
        await cancelSubscription(subscriptionId);
      }

      await unpublishClaim({
        supabase,
        claim: liveClaim,
        nextClaimStatus: 'cancelled',
        nextPaymentStatus: 'cancelled'
      });

      if (subscriptionId) {
        await clearStripeReferences(supabase, liveClaim.id);
      }

      return jsonResponse({
        ok: true,
        message: `${school.name} is no longer marked as a school-supported profile.`
      });
    }

    if (action !== 'change_plan') {
      throw new Error('Unsupported management action.');
    }

    if (targetPlan === currentPlan) {
      return jsonResponse({ ok: true, message: `${school.name} is already on the ${planLabel(currentPlan).toLowerCase()}.` });
    }

    if (targetPlan === 'claimed') {
      const subscriptionId = cleanText(liveClaim.stripe_subscription_id);
      if (subscriptionId) {
        await cancelSubscription(subscriptionId);
      }

      await publishClaim({
        supabase,
        claim: {
          ...liveClaim,
          plan_slug: 'claimed',
          payment_status: 'free'
        },
        packageSlug: 'claimed'
      });

      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          plan_slug: 'claimed',
          payment_status: 'free',
          updated_at: new Date().toISOString(),
          stripe_subscription_id: null,
          stripe_price_id: null,
          stripe_checkout_session_id: null
        })
        .eq('id', liveClaim.id);

      if (error) throw new Error(`The profile was downgraded, but the claim record could not be refreshed: ${error.message}`);

      return jsonResponse({
        ok: true,
        message: `${school.name} has been downgraded to a claimed profile.`
      });
    }

    if (hasActiveSubscription(liveClaim) && isPaidPlan(currentPlan)) {
      const updated = await changePaidSubscriptionPlan(String(liveClaim.stripe_subscription_id), targetPlan);

      await publishClaim({
        supabase,
        claim: {
          ...liveClaim,
          plan_slug: targetPlan,
          payment_status: updated.paymentStatus
        },
        packageSlug: targetPlan
      });

      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          plan_slug: targetPlan,
          payment_status: updated.paymentStatus,
          stripe_price_id: updated.priceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', liveClaim.id);

      if (error) throw new Error(`The live package changed, but the claim record could not be updated: ${error.message}`);

      return jsonResponse({
        ok: true,
        message: `${school.name} has been moved to the ${planLabel(targetPlan).toLowerCase()}.`
      });
    }

    const checkoutUrl = await createUpgradeClaim({
      supabase,
      sourceClaim: liveClaim,
      school,
      contactEmail,
      targetPlan
    });

    return jsonResponse({
      ok: true,
      checkoutUrl,
      message: 'Redirecting to Stripe Checkout…'
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'We could not manage the school profile right now.' }, { status: 400 });
  }
});
