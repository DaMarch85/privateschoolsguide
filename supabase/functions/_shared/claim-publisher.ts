import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=denonext';

export type SchoolClaimRow = {
  id: string;
  school_id: string | number;
  plan_slug: 'claimed' | 'enhanced' | 'featured';
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  founding_programme?: boolean | null;
  website_url?: string | null;
  contact_form_url?: string | null;
  image_urls?: unknown;
  open_day_title?: string | null;
  open_day_start_at?: string | null;
  open_day_booking_url?: string | null;
  open_day_notes?: string | null;
  notes?: string | null;
  payment_status?: string | null;
  claim_status?: string | null;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function createAdminClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function toTrimmedString(value: unknown): string | null {
  const output = String(value || '').trim();
  return output || null;
}

export function normalizeUrl(value: unknown): string | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function normalizeDateTime(value: unknown): string | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function readImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

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


function escapeHtml(value: unknown): string {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character] || character));
}

function buildAdminClaimUrl(claimId: string): string {
  const siteUrl = String(Deno.env.get('PUBLIC_SITE_URL') || 'https://www.privateschoolguide.co.uk').replace(/\/$/, '');
  return `${siteUrl}/admin/school-claims/?claim=${claimId}`;
}

export async function sendClaimNotificationEmail({
  claim,
  schoolName,
  schoolPagePath
}: {
  claim: SchoolClaimRow;
  schoolName: string;
  schoolPagePath?: string | null;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = toTrimmedString(Deno.env.get('CLAIMS_NOTIFICATION_TO'));
  const from = toTrimmedString(Deno.env.get('CLAIMS_NOTIFICATION_FROM')) || 'The Private School Guide <claims@privateschoolguide.co.uk>';

  if (!apiKey || !to) {
    return { sent: false, skipped: true };
  }

  const siteUrl = String(Deno.env.get('PUBLIC_SITE_URL') || 'https://www.privateschoolguide.co.uk').replace(/\/$/, '');
  const schoolPageUrl = schoolPagePath ? `${siteUrl}${schoolPagePath.startsWith('/') ? schoolPagePath : `/${schoolPagePath}`}` : null;
  const adminUrl = buildAdminClaimUrl(claim.id);
  const planLabel = claim.plan_slug === 'featured' ? 'Featured profile' : claim.plan_slug === 'enhanced' ? 'Enhanced profile' : 'Member profile';
  const paymentLabel = claim.founding_programme ? 'Founding programme' : claim.plan_slug === 'claimed' ? 'Free member profile' : 'Paid package';
  const submittedWebsite = normalizeUrl(claim.website_url);
  const submittedContactForm = normalizeUrl(claim.contact_form_url);
  const submittedImages = readImageUrls(claim.image_urls);
  const openDaySummary = [toTrimmedString(claim.open_day_title), normalizeDateTime(claim.open_day_start_at), normalizeUrl(claim.open_day_booking_url)]
    .filter(Boolean)
    .join(' · ');
  const notes = toTrimmedString(claim.notes);

  const text = [
    `New school profile request submitted for ${schoolName}.`,
    '',
    `Package: ${planLabel}`,
    `Billing: ${paymentLabel}`,
    `Claim ID: ${claim.id}`,
    `Contact: ${toTrimmedString(claim.contact_name) || '—'}${claim.contact_email ? ` <${claim.contact_email}>` : ''}`,
    `Role: ${toTrimmedString(claim.contact_role) || '—'}`,
    `Phone: ${toTrimmedString(claim.contact_phone) || '—'}`,
    `Website: ${submittedWebsite || '—'}`,
    `Admissions/contact: ${submittedContactForm || '—'}`,
    `Images uploaded: ${submittedImages.length}`,
    `Open day: ${openDaySummary || '—'}`,
    `Notes: ${notes || '—'}`,
    '',
    `Admin queue: ${adminUrl}`,
    `School page: ${schoolPageUrl || '—'}`
  ].join('\n');

  const html = `
    <h2>New school profile request submitted</h2>
    <p><strong>${escapeHtml(schoolName)}</strong> has a new school-managed profile request.</p>
    <ul>
      <li><strong>Package:</strong> ${escapeHtml(planLabel)}</li>
      <li><strong>Billing:</strong> ${escapeHtml(paymentLabel)}</li>
      <li><strong>Claim ID:</strong> ${escapeHtml(claim.id)}</li>
      <li><strong>Contact:</strong> ${escapeHtml(toTrimmedString(claim.contact_name) || '—')}${claim.contact_email ? ` &lt;${escapeHtml(claim.contact_email)}&gt;` : ''}</li>
      <li><strong>Role:</strong> ${escapeHtml(toTrimmedString(claim.contact_role) || '—')}</li>
      <li><strong>Phone:</strong> ${escapeHtml(toTrimmedString(claim.contact_phone) || '—')}</li>
      <li><strong>Website:</strong> ${submittedWebsite ? `<a href="${escapeHtml(submittedWebsite)}">${escapeHtml(submittedWebsite)}</a>` : '—'}</li>
      <li><strong>Admissions/contact:</strong> ${submittedContactForm ? `<a href="${escapeHtml(submittedContactForm)}">${escapeHtml(submittedContactForm)}</a>` : '—'}</li>
      <li><strong>Images uploaded:</strong> ${submittedImages.length}</li>
      <li><strong>Open day:</strong> ${escapeHtml(openDaySummary || '—')}</li>
    </ul>
    <p><strong>School-submitted notes:</strong><br />${escapeHtml(notes || '—')}</p>
    <p><a href="${escapeHtml(adminUrl)}">Open the admin review queue</a></p>
    ${schoolPageUrl ? `<p><a href="${escapeHtml(schoolPageUrl)}">Preview the school page</a></p>` : ''}
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Idempotency-Key': `school-claim-${claim.id}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New school claim: ${schoolName}`,
      html,
      text
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Claim notification email failed: ${payload || response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  return { sent: true, id: payload?.id || null };
}

async function triggerSiteRebuild(payload: Record<string, unknown>) {
  const hookUrl = Deno.env.get('SITE_REBUILD_HOOK_URL');
  if (!hookUrl) return { triggered: false };

  try {
    const response = await fetch(hookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return {
      triggered: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      triggered: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}



export async function unpublishClaim({
  supabase,
  claim,
  nextClaimStatus,
  nextPaymentStatus
}: {
  supabase: ReturnType<typeof createAdminClient>;
  claim: SchoolClaimRow;
  nextClaimStatus: 'rejected' | 'cancelled';
  nextPaymentStatus: string;
}) {
  const schoolId = claim.school_id;
  const unpublishedAt = new Date().toISOString();

  const { error: schoolUpdateError } = await supabase
    .from('schools')
    .update({
      website_override_url: null,
      contact_form_url: null,
      profile_package: 'organic',
      profile_managed_by_school: false,
      claimed_at: null
    })
    .eq('id', schoolId);

  if (schoolUpdateError) {
    throw new Error(`Could not clear live school-managed profile fields: ${schoolUpdateError.message}`);
  }

  const { error: deactivateImagesError } = await supabase
    .from('school_images')
    .update({ is_active: false })
    .eq('school_id', schoolId)
    .eq('source', 'school_claim');

  if (deactivateImagesError) {
    throw new Error(`Could not deactivate live school-managed images: ${deactivateImagesError.message}`);
  }

  const { error: deactivateOpenDayError } = await supabase
    .from('school_open_days')
    .update({ is_active: false, updated_at: unpublishedAt })
    .eq('school_id', schoolId)
    .eq('source', 'school_claim');

  if (deactivateOpenDayError) {
    throw new Error(`Could not deactivate live school-managed open days: ${deactivateOpenDayError.message}`);
  }

  const { error: claimUpdateError } = await supabase
    .from('school_profile_claims')
    .update({
      claim_status: nextClaimStatus,
      payment_status: nextPaymentStatus,
      updated_at: unpublishedAt
    })
    .eq('id', claim.id);

  if (claimUpdateError) {
    throw new Error(`Could not mark school claim as unpublished: ${claimUpdateError.message}`);
  }

  const rebuild = await triggerSiteRebuild({
    claim_id: claim.id,
    school_id: schoolId,
    package_slug: 'organic',
    unpublished_at: unpublishedAt
  });

  return {
    rebuild
  };
}

export async function publishClaim({
  supabase,
  claim,
  packageSlug
}: {
  supabase: ReturnType<typeof createAdminClient>;
  claim: SchoolClaimRow;
  packageSlug: 'claimed' | 'enhanced' | 'featured';
}) {
  const schoolId = claim.school_id;
  const { data: schoolRow, error: schoolError } = await supabase
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .single();

  if (schoolError || !schoolRow) {
    throw new Error(`Could not load school for claim publishing: ${schoolError?.message || 'Unknown error'}`);
  }

  const schoolName = String(schoolRow.name || 'School').trim() || 'School';
  const websiteUrl = normalizeUrl(claim.website_url);
  const contactFormUrl = normalizeUrl(claim.contact_form_url);
  const imageUrls = readImageUrls(claim.image_urls);
  const openDayTitle = toTrimmedString(claim.open_day_title);
  const openDayStartAt = normalizeDateTime(claim.open_day_start_at);
  const openDayBookingUrl = normalizeUrl(claim.open_day_booking_url);
  const openDayNotes = toTrimmedString(claim.open_day_notes);
  const publishedAt = new Date().toISOString();

  const { error: schoolUpdateError } = await supabase
    .from('schools')
    .update({
      website_override_url: websiteUrl,
      contact_form_url: contactFormUrl,
      profile_package: packageSlug,
      profile_managed_by_school: true,
      claimed_at: publishedAt
    })
    .eq('id', schoolId);

  if (schoolUpdateError) {
    throw new Error(`Could not update school profile fields: ${schoolUpdateError.message}`);
  }

  if (imageUrls.length) {
    const { error: deactivateImagesError } = await supabase
      .from('school_images')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .eq('source', 'school_claim');

    if (deactivateImagesError) {
      throw new Error(`Could not deactivate existing school-submitted images: ${deactivateImagesError.message}`);
    }

    const imageRows = imageUrls.map((url, index) => ({
      school_id: schoolId,
      image_type: index === 0 ? 'hero' : 'gallery',
      image_url: url,
      alt_text: index === 0 ? `${schoolName} hero image` : `${schoolName} image ${index + 1}`,
      sort_order: index,
      source: 'school_claim',
      is_active: true,
      claim_id: claim.id
    }));

    const { error: imageInsertError } = await supabase.from('school_images').insert(imageRows);
    if (imageInsertError) {
      throw new Error(`Could not insert school-submitted images: ${imageInsertError.message}`);
    }
  }

  if (openDayTitle || openDayBookingUrl || openDayStartAt) {
    const { error: deactivateOpenDayError } = await supabase
      .from('school_open_days')
      .update({ is_active: false, updated_at: publishedAt })
      .eq('school_id', schoolId)
      .eq('source', 'school_claim');

    if (deactivateOpenDayError) {
      throw new Error(`Could not deactivate existing school-submitted open days: ${deactivateOpenDayError.message}`);
    }

    const { error: openDayInsertError } = await supabase.from('school_open_days').insert({
      school_id: schoolId,
      title: openDayTitle || `${schoolName} open day`,
      start_at: openDayStartAt,
      booking_url: openDayBookingUrl,
      notes: openDayNotes,
      is_verified: true,
      source: 'school_claim',
      is_active: true,
      claim_id: claim.id,
      last_verified_at: publishedAt,
      updated_at: publishedAt
    });

    if (openDayInsertError) {
      throw new Error(`Could not insert school-submitted open day: ${openDayInsertError.message}`);
    }
  }

  const nextPaymentStatus = packageSlug === 'claimed'
    ? 'free'
    : (String(claim.payment_status || '').trim() || 'paid');

  const { error: claimUpdateError } = await supabase
    .from('school_profile_claims')
    .update({
      claim_status: 'published',
      payment_status: nextPaymentStatus,
      published_at: publishedAt,
      updated_at: publishedAt
    })
    .eq('id', claim.id);

  if (claimUpdateError) {
    throw new Error(`Could not mark school claim as published: ${claimUpdateError.message}`);
  }

  const rebuild = await triggerSiteRebuild({
    claim_id: claim.id,
    school_id: schoolId,
    package_slug: packageSlug,
    published_at: publishedAt
  });

  return {
    schoolName,
    rebuild
  };
}
