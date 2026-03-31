import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, normalizeUrl, publishClaim, sendClaimNotificationEmail } from '../_shared/claim-publisher.ts';

type PlanSlug = 'claimed' | 'enhanced' | 'featured';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optionalTrimmed(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function requiredTrimmed(value: FormDataEntryValue | null, message: string): string {
  const trimmed = optionalTrimmed(value);
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function normalizePlan(value: FormDataEntryValue | null): PlanSlug {
  const raw = String(typeof value === 'string' ? value : '').trim().toLowerCase();
  if (raw === 'enhanced') return 'enhanced';
  if (raw === 'featured') return 'featured';
  return 'claimed';
}

function parseSchoolId(value: string): number | string {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(asNumber) === value) return asNumber;
  return value;
}

function parseIsoDateTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Please provide a valid open day date and time.');
  return parsed.toISOString();
}

function isFoundingProgrammeSelected(formData: FormData, plan: PlanSlug): boolean {
  if (plan !== 'enhanced') return false;
  return String(formData.get('founding_programme') || '').toLowerCase() === 'true';
}

function maxImagesForPlan(plan: PlanSlug): number {
  return plan === 'claimed' ? 1 : 5;
}

function isAutoApproveEnabled(): boolean {
  const raw = String(Deno.env.get('AUTO_APPROVE_SCHOOL_CLAIMS') || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}


async function ensureSchoolIsClaimable(supabase: ReturnType<typeof createAdminClient>, schoolId: string | number) {
  const [{ data: schoolData, error: schoolError }, { data: activeClaimData, error: activeClaimError }] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, slug, profile_managed_by_school, profile_package')
      .eq('id', schoolId)
      .maybeSingle(),
    supabase
      .from('school_profile_claims')
      .select('id, claim_status')
      .eq('school_id', schoolId)
      .in('claim_status', ['submitted', 'needs_review', 'checkout_pending', 'paid', 'published'])
      .order('created_at', { ascending: false })
      .limit(1)
  ]);

  if (schoolError) {
    throw new Error(`Could not verify the selected school: ${schoolError.message}`);
  }
  if (!schoolData) {
    throw new Error('The selected school could not be found.');
  }
  if (activeClaimError) {
    throw new Error(`Could not check for existing school claims: ${activeClaimError.message}`);
  }

  const schoolName = String(schoolData.name || 'School').trim() || 'School';
  if (schoolData.profile_managed_by_school || String(schoolData.profile_package || '').trim().toLowerCase() !== 'organic') {
    throw new Error(`${schoolName} already has a claimed or managed profile. Please contact The Private School Guide if you need to update it.`);
  }

  if ((activeClaimData || []).length) {
    throw new Error(`${schoolName} already has an active school profile request in progress. Please contact The Private School Guide if you need help with it.`);
  }

  return {
    schoolName
  };
}

async function createCheckoutSession({
  plan,
  claimId,
  schoolId,
  customerEmail,
  foundingProgramme
}: {
  plan: PlanSlug;
  claimId: string;
  schoolId: string | number;
  customerEmail: string;
  foundingProgramme: boolean;
}) {
  if (foundingProgramme) return null;
  if (plan === 'claimed') return null;

  const siteUrl = String(Deno.env.get('PUBLIC_SITE_URL') || 'https://www.privateschoolguide.co.uk').replace(/\/$/, '');
  const stripeSecretKey = getEnv('STRIPE_SECRET_KEY');
  const enhancedPriceId = Deno.env.get('STRIPE_PRICE_ENHANCED_MONTHLY');
  const featuredPriceId = Deno.env.get('STRIPE_PRICE_FEATURED_MONTHLY');
  const priceId = plan === 'featured' ? featuredPriceId : enhancedPriceId;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for the ${plan} plan.`);
  }

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', `${siteUrl}/claim-your-profile/?checkout=success&claim=${claimId}`);
  body.set('cancel_url', `${siteUrl}/claim-your-profile/?checkout=cancel&claim=${claimId}`);
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
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || 'Stripe could not create the subscription session.';
    throw new Error(message);
  }

  return {
    url: payload.url as string,
    id: payload.id as string,
    priceId
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    if (optionalTrimmed(formData.get('website_confirm'))) {
      return jsonResponse({ ok: true, message: 'Thanks. Your request has been recorded.' });
    }

    const plan = normalizePlan(formData.get('plan_slug'));
    const schoolIdRaw = requiredTrimmed(formData.get('school_id'), 'Please choose a school.');
    const schoolId = parseSchoolId(schoolIdRaw);
    const contactName = requiredTrimmed(formData.get('contact_name'), 'Please add your name.');
    const contactRole = optionalTrimmed(formData.get('contact_role'));
    const contactEmail = requiredTrimmed(formData.get('contact_email'), 'Please add a contact email address.');
    const contactPhone = optionalTrimmed(formData.get('contact_phone'));
    const websiteUrl = normalizeUrl(optionalTrimmed(formData.get('website_url')));
    const contactFormUrl = normalizeUrl(optionalTrimmed(formData.get('contact_form_url')));
    const notes = optionalTrimmed(formData.get('notes'));
    const foundingProgramme = isFoundingProgrammeSelected(formData, plan);
    const openDayTitle = optionalTrimmed(formData.get('open_day_title'));
    const openDayStartAt = parseIsoDateTime(optionalTrimmed(formData.get('open_day_start_at')));
    const openDayBookingUrl = normalizeUrl(optionalTrimmed(formData.get('open_day_booking_url')));

    const imageEntries = formData.getAll('images').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const maxImages = maxImagesForPlan(plan);
    if (imageEntries.length > maxImages) {
      throw new Error(`Please upload no more than ${maxImages} image${maxImages === 1 ? '' : 's'} for the selected package.`);
    }

    for (const file of imageEntries) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error('Images must be JPEG, PNG or WebP files.');
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Each image must be 8MB or smaller.');
      }
    }

    const supabase = createAdminClient();
    const schoolContext = await ensureSchoolIsClaimable(supabase, schoolId);
    const claimId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const schoolMediaPaths: string[] = [];

    for (let index = 0; index < imageEntries.length; index += 1) {
      const file = imageEntries[index];
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${schoolId}/${claimId}/${String(index + 1).padStart(2, '0')}.${extension}`;
      const uploadResponse = await supabase.storage.from('school-media').upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true
      });

      if (uploadResponse.error) {
        throw new Error(`Could not upload ${file.name}: ${uploadResponse.error.message}`);
      }

      const publicUrl = supabase.storage.from('school-media').getPublicUrl(path).data.publicUrl;
      schoolMediaPaths.push(publicUrl);
    }

    const autoPublish = isAutoApproveEnabled();
    const basePaymentStatus = plan === 'claimed'
      ? 'free'
      : foundingProgramme
        ? 'founding_trial'
        : 'checkout_pending';

    const { error: insertError } = await supabase.from('school_profile_claims').insert({
      id: claimId,
      school_id: schoolId,
      plan_slug: plan,
      contact_name: contactName,
      contact_role: contactRole,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      website_url: websiteUrl,
      contact_form_url: contactFormUrl,
      notes,
      founding_programme: foundingProgramme,
      image_urls: schoolMediaPaths,
      open_day_title: openDayTitle,
      open_day_start_at: openDayStartAt,
      open_day_booking_url: openDayBookingUrl,
      auto_publish: autoPublish,
      claim_status: plan === 'claimed' || foundingProgramme ? (autoPublish ? 'published' : 'submitted') : 'checkout_pending',
      payment_status: basePaymentStatus,
      created_at: createdAt,
      updated_at: createdAt
    });

    if (insertError) {
      throw new Error(`Could not save the school claim: ${insertError.message}`);
    }

    const schoolPagePath = null;
    try {
      await sendClaimNotificationEmail({
        claim: {
          id: claimId,
          school_id: schoolId,
          plan_slug: plan,
          contact_name: contactName,
          contact_role: contactRole,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          founding_programme: foundingProgramme,
          website_url: websiteUrl,
          contact_form_url: contactFormUrl,
          image_urls: schoolMediaPaths,
          open_day_title: openDayTitle,
          open_day_start_at: openDayStartAt,
          open_day_booking_url: openDayBookingUrl,
          notes,
          payment_status: basePaymentStatus,
          claim_status: plan === 'claimed' || foundingProgramme ? (autoPublish ? 'published' : 'submitted') : 'checkout_pending'
        },
        schoolName: schoolContext.schoolName,
        schoolPagePath
      });
    } catch (notificationError) {
      console.error('School claim notification email failed', notificationError);
    }

    if (plan === 'claimed' || foundingProgramme) {
      if (autoPublish) {
        await publishClaim({
          supabase,
          claim: {
            id: claimId,
            school_id: schoolId,
            plan_slug: plan,
            website_url: websiteUrl,
            contact_form_url: contactFormUrl,
            image_urls: schoolMediaPaths,
            open_day_title: openDayTitle,
            open_day_start_at: openDayStartAt,
            open_day_booking_url: openDayBookingUrl,
            payment_status: basePaymentStatus
          },
          packageSlug: foundingProgramme ? 'enhanced' : 'claimed'
        });

        return jsonResponse({
          ok: true,
          claimId,
          message: foundingProgramme
            ? 'Your Founding School Programme request has been submitted and published on the Enhanced package.'
            : 'Your claimed profile has been submitted and published.'
        });
      }

      return jsonResponse({
        ok: true,
        claimId,
        message: foundingProgramme
          ? 'Your Founding School Programme request has been submitted for review.'
          : 'Your claimed profile has been submitted for review.'
      });
    }

    const checkout = await createCheckoutSession({
      plan,
      claimId,
      schoolId,
      customerEmail: contactEmail,
      foundingProgramme
    });

    if (!checkout?.url) {
      throw new Error('Stripe Checkout could not be created for this package.');
    }

    const { error: checkoutUpdateError } = await supabase
      .from('school_profile_claims')
      .update({
        stripe_checkout_session_id: checkout.id,
        stripe_price_id: checkout.priceId,
        claim_status: 'checkout_pending',
        payment_status: 'checkout_pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', claimId);

    if (checkoutUpdateError) {
      throw new Error(`Could not link the school claim to Stripe Checkout: ${checkoutUpdateError.message}`);
    }

    return jsonResponse({
      ok: true,
      claimId,
      checkoutUrl: checkout.url,
      message: 'Redirecting to Stripe Checkout…'
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'We could not submit the school profile right now.' },
      { status: 400 }
    );
  }
});
