import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, publishClaim } from '../_shared/claim-publisher.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20'
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function autoApproveEnabled(): boolean {
  const raw = String(Deno.env.get('AUTO_APPROVE_SCHOOL_CLAIMS') || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

async function findClaimBySessionId(supabase: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data, error } = await supabase
    .from('school_profile_claims')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Could not load school claim by checkout session: ${error.message}`);
  return data;
}

async function findClaimBySubscriptionId(supabase: ReturnType<typeof createAdminClient>, subscriptionId: string) {
  const { data, error } = await supabase
    .from('school_profile_claims')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (error) throw new Error(`Could not load school claim by subscription: ${error.message}`);
  return data;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const signature = request.headers.get('Stripe-Signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!signature || !webhookSecret) {
      throw new Error('Stripe webhook signing secret is not configured.');
    }

    const body = await request.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
    const supabase = createAdminClient();
    const autoPublish = autoApproveEnabled();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const claim = await findClaimBySessionId(supabase, session.id);
        if (!claim) {
          return jsonResponse({ ok: true, ignored: true });
        }

        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
        const nextUpdatedAt = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('school_profile_claims')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            claim_status: autoPublish ? 'published' : 'paid',
            payment_status: 'paid',
            updated_at: nextUpdatedAt
          })
          .eq('id', claim.id);

        if (updateError) {
          throw new Error(`Could not update school claim after Stripe checkout completion: ${updateError.message}`);
        }

        if (autoPublish) {
          await publishClaim({
            supabase,
            claim: {
              ...claim,
              payment_status: 'paid'
            },
            packageSlug: claim.plan_slug
          });
        }

        return jsonResponse({ ok: true });
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const claim = await findClaimBySubscriptionId(supabase, subscription.id);
        if (!claim) {
          return jsonResponse({ ok: true, ignored: true });
        }

        const nextStatus = String(subscription.status || 'active');
        const nextUpdatedAt = new Date().toISOString();
        const nextClaimStatus = claim.claim_status === 'published' ? 'published' : (nextStatus === 'active' || nextStatus === 'trialing') ? 'paid' : claim.claim_status;

        const { error: updateError } = await supabase
          .from('school_profile_claims')
          .update({
            payment_status: nextStatus,
            claim_status: nextClaimStatus,
            updated_at: nextUpdatedAt
          })
          .eq('id', claim.id);

        if (updateError) {
          throw new Error(`Could not sync updated Stripe subscription status: ${updateError.message}`);
        }

        if ((nextStatus === 'active' || nextStatus === 'trialing') && autoPublish && claim.claim_status !== 'published') {
          await publishClaim({
            supabase,
            claim: {
              ...claim,
              payment_status: nextStatus
            },
            packageSlug: claim.plan_slug
          });
        }

        return jsonResponse({ ok: true });
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const claim = await findClaimBySubscriptionId(supabase, subscription.id);
        if (!claim) {
          return jsonResponse({ ok: true, ignored: true });
        }

        const nextUpdatedAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('school_profile_claims')
          .update({
            payment_status: 'cancelled',
            claim_status: 'cancelled',
            updated_at: nextUpdatedAt
          })
          .eq('id', claim.id);

        if (updateError) {
          throw new Error(`Could not mark cancelled Stripe subscription on school claim: ${updateError.message}`);
        }

        await publishClaim({
          supabase,
          claim: {
            ...claim,
            payment_status: 'free'
          },
          packageSlug: 'claimed'
        });

        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ ok: true, ignored: true, eventType: event.type });
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Stripe webhook handling failed.' },
      { status: 400 }
    );
  }
});
