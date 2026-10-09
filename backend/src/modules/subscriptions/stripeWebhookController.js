import { supabaseAdmin } from '../../infrastructure/database/supabase.js';
import { stripe, stripeDate, PRICE_ID, STRIPE_LIVE_MODE } from './stripeService.js';
import { logSafeError } from '../../utils/logSafeError.js';
const HANDLED_EVENTS = new Set(['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','customer.subscription.paused','customer.subscription.resumed']);
const idOf = value => typeof value === 'string' ? value : value?.id;
async function currentSubscription(id) {
  try { return await stripe.subscriptions.retrieve(id); }
  catch (error) { if (error?.statusCode === 404) return null; throw error; }
}
export async function synchronize(event) {
  const object = event.data.object;
  let subscription, session;
  if (event.type === 'checkout.session.completed') {
    session = object;
    if (session.mode !== 'subscription' || !session.subscription) return;
    subscription = await currentSubscription(idOf(session.subscription));
    if (!subscription || (session.metadata?.business_id ?? session.client_reference_id) !== subscription.metadata?.business_id || idOf(session.customer) !== idOf(subscription.customer)) throw Error('CX_BILLING_SESSION');
  } else if (event.type.startsWith('invoice.')) {
    const id = idOf(object.parent?.subscription_details?.subscription ?? object.subscription);
    if (!id) return;
    subscription = await currentSubscription(id);
  } else {
    subscription = await currentSubscription(object.id);
    if (!subscription && event.type === 'customer.subscription.deleted') subscription = object;
  }
  if (!subscription) throw Error('CX_BILLING_SUBSCRIPTION');
  const tenant = subscription.metadata?.business_id, actor = subscription.metadata?.owner_id;
  if (!tenant || !actor) throw Error('CX_BILLING_BINDING');
  const {data:token,error:leaseError} = await supabaseAdmin.rpc('cx_acquire_billing_sync',{p_business:tenant,p_actor:actor});
  if (leaseError || !token) throw Error('CX_BILLING_BUSY');
  try {
    // Read AGAIN under the distributed lease. The earlier lookup only resolved
    // the tenant. Never commit its snapshot after waiting for another worker.
    subscription = await currentSubscription(subscription.id) ?? (event.type === 'customer.subscription.deleted' ? object : null);
    if (!subscription || subscription.metadata?.business_id !== tenant || subscription.metadata?.owner_id !== actor) throw Error('CX_BILLING_BINDING');
    const businessId = subscription.metadata?.business_id, ownerId = subscription.metadata?.owner_id;
    const customerId = idOf(subscription.customer), items = subscription.items?.data ?? [];
    if (subscription.livemode !== STRIPE_LIVE_MODE || !businessId || !ownerId || !customerId || items.length !== 1 || items[0].quantity !== 1) throw Error('CX_BILLING_BINDING');
    if (idOf(items[0].price) !== PRICE_ID) {
      // A commercial Price change must not stop legitimate status updates for
      // historical contracts. Only an already bound subscription/customer may
      // retain its old Price; this cannot create or replace a billing link.
      const { data: existing, error: bindingError } = await supabaseAdmin.from('subscriptions')
        .select('stripe_subscription_id, stripe_customer_id').eq('business_id', businessId).maybeSingle();
      if (bindingError) throw bindingError;
      if (existing?.stripe_subscription_id !== subscription.id || existing?.stripe_customer_id !== customerId) throw Error('CX_BILLING_BINDING');
    }
    const periodEnd = items[0].current_period_end ?? subscription.current_period_end;
    if (['active','trialing'].includes(subscription.status) && !periodEnd) throw Error('CX_BILLING_PERIOD');
    const { error } = await supabaseAdmin.rpc('cx_sync_billing_event', {
      p_event_id:event.id,p_event_type:event.type,p_created:event.created,
      p_payload:{business_id:businessId,owner_id:ownerId,stripe_customer_id:customerId,stripe_subscription_id:subscription.id,status:subscription.status,
        trial_ends_at:stripeDate(subscription.trial_end),current_period_end:stripeDate(periodEnd),cancel_at_period_end:Boolean(subscription.cancel_at_period_end),
        checkout_attempt_id:subscription.metadata?.checkout_attempt_id ?? session?.metadata?.checkout_attempt_id ?? null, stripe_livemode:subscription.livemode, sync_token:token},
    });
    if (error) throw error;
  } finally {
    const {error:releaseError} = await supabaseAdmin.rpc('cx_release_billing_sync',{p_business:tenant,p_token:token});
    if (releaseError) throw Error('CX_BILLING_RELEASE');
  }

}
export async function stripeWebhook(req,res) {
  let event;
  try {
    if (!req.headers['stripe-signature']) return res.status(400).json({success:false,message:'Falta la firma de Stripe.'});
    event = stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).json({success:false,message:'Firma de Stripe inválida.'}); }
  if (event.livemode !== STRIPE_LIVE_MODE || event.account) return res.status(400).json({success:false,message:'Entorno o cuenta de Stripe no permitidos.'});
  if (!HANDLED_EVENTS.has(event.type)) return res.json({received:true});
  try { await synchronize(event); return res.json({received:true}); }
  catch(error) { logSafeError('STRIPE_WEBHOOK',error,{eventType:event.type});return res.status(500).json({received:false}); }
}
