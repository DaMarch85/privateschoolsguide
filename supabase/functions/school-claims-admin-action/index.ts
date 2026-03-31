import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { assertAdminReviewToken } from '../_shared/admin-auth.ts';
import { createAdminClient, publishClaim, unpublishClaim, type SchoolClaimRow } from '../_shared/claim-publisher.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ActionPayload = {
  claimId?: string;
  action?: 'approve' | 'reject' | 'save_note' | 'reopen' | 'downgrade' | 'unpublish';
  reviewer?: string;
  note?: string;
  cancelBilling?: boolean;
};

type ClaimRow = SchoolClaimRow & {
  contact_name?: string | null;
  founding_programme?: boolean | null;
  stripe_subscription_id?: string | null;
  claim_status?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

function cleanText(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function appendInternalNote(existing: string | null | undefined, reviewer: string | null, actionLabel: string, note: string | null) {
  const timestamp = new Date().toISOString();
  const entry = note
    ? `[${timestamp}] ${reviewer || 'Admin'} — ${actionLabel}: ${note}`
    : `[${timestamp}] ${reviewer || 'Admin'} — ${actionLabel}`;
  return [String(existing || '').trim(), entry].filter(Boolean).join('\n\n');
}

function resolveApprovalPackage(claim: ClaimRow): 'claimed' | 'enhanced' | 'featured' {
  if (claim.plan_slug === 'claimed') return 'claimed';
  if (claim.founding_programme && claim.plan_slug === 'enhanced') return 'enhanced';
  if (claim.claim_status === 'paid' || ['paid', 'active', 'trialing'].includes(String(claim.payment_status || ''))) {
    return claim.plan_slug;
  }
  throw new Error('This paid package cannot be approved yet because payment has not been confirmed.');
}


function canDowngradeLiveClaim(claim: ClaimRow): boolean {
  return claim.claim_status === 'published' && claim.plan_slug !== 'claimed';
}

function canUnpublishLiveClaim(claim: ClaimRow): boolean {
  return claim.claim_status === 'published';
}

async function cancelSubscription(subscriptionId: string): Promise<string> {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured, so billing cannot be cancelled from the review queue.');
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return String(subscription.status || 'cancelled');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    assertAdminReviewToken(request);
    const body = await request.json().catch(() => null) as ActionPayload | null;
    const claimId = cleanText(body?.claimId);
    const action = body?.action;
    const reviewer = cleanText(body?.reviewer);
    const note = cleanText(body?.note);
    const cancelBilling = Boolean(body?.cancelBilling);

    if (!claimId) {
      throw new Error('Missing claimId.');
    }
    if (!action || !['approve', 'reject', 'save_note', 'reopen', 'downgrade', 'unpublish'].includes(action)) {
      throw new Error('Unsupported admin action.');
    }

    const supabase = createAdminClient();
    const { data: claimData, error: claimError } = await supabase
      .from('school_profile_claims')
      .select('*')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError) throw new Error(`Could not load school claim: ${claimError.message}`);
    const claim = claimData as ClaimRow | null;
    if (!claim) throw new Error('School claim not found.');

    if (action === 'save_note') {
      const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, 'Note added', note || 'Internal note');
      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          internal_notes: nextInternalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (error) throw new Error(`Could not save internal note: ${error.message}`);
      return jsonResponse({ ok: true, message: 'Internal note saved.' });
    }

    if (action === 'reopen') {
      const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, 'Reopened for review', note);
      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          claim_status: 'needs_review',
          internal_notes: nextInternalNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer || 'Admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (error) throw new Error(`Could not reopen school claim: ${error.message}`);
      return jsonResponse({ ok: true, message: 'Claim returned to the review queue.' });
    }

    if (action === 'reject') {
      if (claim.claim_status === 'published') {
        throw new Error('This claim is already published. Use the live downgrade or unpublish action instead.');
      }

      let nextPaymentStatus = String(claim.payment_status || 'not_started');
      if (cancelBilling && claim.stripe_subscription_id) {
        nextPaymentStatus = await cancelSubscription(claim.stripe_subscription_id);
      }

      const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, 'Rejected', note);
      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          claim_status: 'rejected',
          payment_status: nextPaymentStatus === 'canceled' ? 'cancelled' : nextPaymentStatus,
          internal_notes: nextInternalNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer || 'Admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (error) throw new Error(`Could not reject school claim: ${error.message}`);
      return jsonResponse({ ok: true, message: cancelBilling ? 'Claim rejected and Stripe subscription cancelled.' : 'Claim rejected.' });
    }

    if (action === 'downgrade') {
      if (!canDowngradeLiveClaim(claim)) {
        throw new Error('Only live Enhanced or Featured profiles can be downgraded to a claimed profile.');
      }

      let nextPaymentStatus = 'free';
      if (cancelBilling && claim.stripe_subscription_id) {
        await cancelSubscription(claim.stripe_subscription_id);
      }

      await publishClaim({
        supabase,
        claim: {
          ...claim,
          payment_status: nextPaymentStatus
        },
        packageSlug: 'claimed'
      });

      const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, 'Downgraded live profile to claimed', note);
      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          internal_notes: nextInternalNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer || 'Admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (error) throw new Error(`Live profile was downgraded but the claim record could not be updated: ${error.message}`);
      return jsonResponse({ ok: true, message: cancelBilling ? 'Live profile downgraded to claimed and Stripe subscription cancelled.' : 'Live profile downgraded to claimed.' });
    }

    if (action === 'unpublish') {
      if (!canUnpublishLiveClaim(claim)) {
        throw new Error('Only live profiles can be unpublished.');
      }

      let nextPaymentStatus = String(claim.payment_status || 'not_started');
      if (cancelBilling && claim.stripe_subscription_id) {
        nextPaymentStatus = await cancelSubscription(claim.stripe_subscription_id);
      }
      nextPaymentStatus = nextPaymentStatus === 'canceled' ? 'cancelled' : nextPaymentStatus;
      const nextClaimStatus = nextPaymentStatus === 'cancelled' ? 'cancelled' : 'rejected';

      await unpublishClaim({
        supabase,
        claim,
        nextClaimStatus,
        nextPaymentStatus
      });

      const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, 'Unpublished live profile', note);
      const { error } = await supabase
        .from('school_profile_claims')
        .update({
          internal_notes: nextInternalNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer || 'Admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      if (error) throw new Error(`Live profile was unpublished but the claim record could not be updated: ${error.message}`);
      return jsonResponse({ ok: true, message: cancelBilling ? 'Live profile unpublished and Stripe subscription cancelled.' : 'Live profile unpublished.' });
    }

    const packageSlug = resolveApprovalPackage(claim);
    await publishClaim({
      supabase,
      claim,
      packageSlug
    });

    const nextInternalNotes = appendInternalNote(claim.internal_notes, reviewer, `Approved and published on ${packageSlug}`, note);
    const { error: reviewUpdateError } = await supabase
      .from('school_profile_claims')
      .update({
        internal_notes: nextInternalNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer || 'Admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', claim.id);

    if (reviewUpdateError) {
      throw new Error(`Claim was published but review metadata could not be updated: ${reviewUpdateError.message}`);
    }

    return jsonResponse({ ok: true, message: `Claim approved and published on the ${packageSlug} package.` });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: error instanceof Error ? error.message : 'Admin action failed.' }, { status: 400 });
  }
});
