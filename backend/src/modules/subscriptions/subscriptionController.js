import { logSafeError } from "../../utils/logSafeError.js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "../../infrastructure/database/supabase.js";

import { stripe, PRICE_ID, FRONTEND_URL, verifyCommercialPrice, verifyReusedCustomer, VAT_TAX_RATE_ID } from "./stripeService.js";

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CHECKOUT_DURATION_SECONDS = 30 * 60;

const BLOCKED_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);

// ==========================================
// ERRORES
// ==========================================

function respondError(res, error) {
  logSafeError("SUBSCRIPTIONS", error);

  return res.status(error?.code === "BILLING_CONFIGURATION" ? 503 : 500).json({
    success: false,
    ...(error?.code === "BILLING_CONFIGURATION" ? { code: "BILLING_CONFIGURATION" } : {}),
    message: error?.code === "BILLING_CONFIGURATION" ? "La facturación no está configurada correctamente. Contacta con soporte." : "No se pudo procesar la solicitud.",
  });
}

// ==========================================
// VALIDAR IDENTIFICADOR
// ==========================================

function validBusinessId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

// ==========================================
// VERIFICAR PROPIETARIO
// ==========================================

async function ownedBusiness(userId, businessId) {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, owner_id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// ==========================================
// CONSULTAR SUSCRIPCIÓN EN SUPABASE
// ==========================================

async function findSubscription(businessId) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function customerIsShared(customerId, businessId) {
  if (!customerId) return false;
  const { data, error } = await supabaseAdmin.from("subscriptions")
    .select("business_id").eq("stripe_customer_id", customerId)
    .neq("business_id", businessId).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

// ==========================================
// CONSULTAR ESTADO ACTUAL EN STRIPE
// ==========================================

async function retrieveRemoteSubscription(existing) {
  if (!existing?.stripe_subscription_id) {
    return null;
  }

  return stripe.subscriptions.retrieve(existing.stripe_subscription_id);
}

// ==========================================
// OBTENER SUSCRIPCIÓN
// GET /api/subscriptions/:businessId
// ==========================================

export async function getSubscription(req, res) {
  try {
    const { businessId } = req.params;

    if (!validBusinessId(businessId)) {
      return res.status(400).json({
        success: false,
        message: "Identificador de restaurante inválido.",
      });
    }

    const business = await ownedBusiness(req.user.id, businessId);

    if (!business) {
      return res.status(403).json({
        success: false,
        message: "No eres propietario del restaurante.",
      });
    }

    const subscription = await findSubscription(businessId);

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
      });
    }

    // Solo devolvemos los datos que necesita
    // el frontend. Nunca devolvemos claves
    // privadas ni datos de tarjetas.

    return res.json({
      success: true,

      subscription: {
        id: subscription.id,
        business_id: subscription.business_id,
        status: subscription.status,

        stripe_customer_id: subscription.stripe_customer_id,

        stripe_subscription_id: subscription.stripe_subscription_id,

        trial_ends_at: subscription.trial_ends_at,

        trial_used_at: subscription.trial_used_at,

        current_period_end: subscription.current_period_end,

        cancel_at_period_end: subscription.cancel_at_period_end,

        checkout_expires_at: subscription.checkout_expires_at,
        checkout_session_id: subscription.checkout_session_id,
      },
    });
  } catch (error) {
    return respondError(res, error);
  }
}

// ==========================================
// CREAR CHECKOUT
// POST /api/subscriptions/checkout
// ==========================================

export async function createCheckout(req, res) {
  let reservedAttempt = null;
  let stripeRequestStarted = false;

  try {
    const { businessId } = req.body ?? {};
    if (Object.keys(req.body ?? {}).some(key => key !== "businessId")) return res.status(400).json({ success: false, message: "Solicitud de facturación no válida." });

    if (!validBusinessId(businessId)) {
      return res.status(400).json({
        success: false,
        message: "Identificador de restaurante inválido.",
      });
    }

    // ======================================
    // 1. VERIFICAR PROPIETARIO
    // ======================================

    const business = await ownedBusiness(req.user.id, businessId);

    if (!business) {
      return res.status(403).json({
        success: false,
        message: "No eres propietario del restaurante.",
      });
    }

    // ======================================
    // 2. CONSULTAR SUSCRIPCIÓN EXISTENTE
    // ======================================

    const existing = await findSubscription(businessId);

    if (await customerIsShared(existing?.stripe_customer_id, businessId)) {
      return res.status(409).json({ success: false, message: "La cuenta de facturación está compartida. Contacta con soporte." });
    }

    // ======================================
    // 3. COMPROBAR SUSCRIPCIÓN EN STRIPE
    // ======================================

    const remote = await retrieveRemoteSubscription(existing);

    if (remote && BLOCKED_STATUSES.has(remote.status)) {
      return res.status(409).json({
        success: false,
        message: "Ya existe una suscripción. Gestiona la actual desde facturación.",
      });
    }

    // ======================================
    // 4. COMPROBAR CHECKOUT PENDIENTE
    // ======================================

    if (
      existing?.status === "checkout_pending" &&
      existing.checkout_expires_at &&
      new Date(existing.checkout_expires_at).getTime() > Date.now()
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Ya existe un proceso de contratación pendiente. Espera a que caduque antes de intentarlo de nuevo.",
      });
    }

    // Never start a second payment while an older session may already be paid.
    if (existing?.status === "checkout_pending") {
      if (!existing.checkout_session_id) return res.status(409).json({ success: false, message: "Hay un pago pendiente de reconciliación. Contacta con soporte." });
      const previousSession = await stripe.checkout.sessions.retrieve(existing.checkout_session_id);
      if (previousSession.status !== "expired") return res.status(409).json({ success: false, message: "El Checkout anterior sigue abierto o completado. Actualiza el estado." });
    }
    await verifyCommercialPrice();
    if (existing?.stripe_customer_id) await verifyReusedCustomer(existing.stripe_customer_id);
    const attemptId = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_DURATION_SECONDS;
    const reservation = { business_id: businessId, status: "checkout_pending", checkout_attempt_id: attemptId, checkout_expires_at: new Date(expiresAt * 1000).toISOString(), checkout_session_id: null };
    let reserveQuery;
    if (!existing) reserveQuery = supabaseAdmin.from("subscriptions").insert(reservation);
    else {
      // Postgres applies this compare-and-set atomically, including across workers.
      reserveQuery = supabaseAdmin.from("subscriptions").update(reservation).eq("business_id", businessId).eq("status", existing.status);
      for (const field of ["checkout_attempt_id", "checkout_expires_at", "stripe_subscription_id", "trial_used_at"]) {
        reserveQuery = existing[field] == null ? reserveQuery.is(field, null) : reserveQuery.eq(field, existing[field]);
      }
    }
    const { data: reserved, error: reserveError } = await reserveQuery.select("business_id").maybeSingle();
    if (reserveError?.code === "23505" || (!reserveError && !reserved)) return res.status(409).json({ success: false, message: "Otro proceso ha iniciado la contratación. Actualiza el estado." });
    if (reserveError) throw reserveError;

    reservedAttempt = {
      businessId,
      attemptId,
      previousStatus: existing?.status ?? "inactive",
    };

    // ======================================
    // 6. COMPROBAR PRUEBA GRATUITA
    // ======================================

    const trialAllowed = !existing?.trial_used_at;

    // ======================================
    // 7. REUTILIZAR CLIENTE DE STRIPE
    // ======================================

    const customerOptions = existing?.stripe_customer_id
      ? {
          customer: existing.stripe_customer_id,
        }
      : {
          customer_email: req.user.email || undefined,
        };

    // No se puede enviar customer_email
    // cuando se reutiliza customer.

    // ======================================
    // 8. CREAR SESIÓN DE STRIPE
    // ======================================

    stripeRequestStarted = true;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",

        ...customerOptions,

        client_reference_id: businessId,

        line_items: [
          {
            price: PRICE_ID,
            quantity: 1,
          },
        ],

        payment_method_collection: "always",
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,

        subscription_data: {
          default_tax_rates: [VAT_TAX_RATE_ID],
          ...(trialAllowed
            ? {
                trial_period_days: 7,
              }
            : {}),

          metadata: {
            business_id: businessId,
            owner_id: req.user.id,
            checkout_attempt_id: attemptId,
          },
        },

        metadata: {
          business_id: businessId,
          owner_id: req.user.id,
          checkout_attempt_id: attemptId,
        },

        success_url: `${FRONTEND_URL}/billing/${businessId}?checkout=success`,

        cancel_url: `${FRONTEND_URL}/billing/${businessId}?checkout=cancelled`,

        expires_at: expiresAt,
      },
      {
        idempotencyKey: `checkout_${businessId}_${attemptId}`,
      },
    );

    if (!session.url) {
      throw new Error("Stripe no ha devuelto la URL de Checkout.");
    }


    // Persistir la sesión para poder recuperarla o caducarla al volver.
    const { error: saveSessionError } = await supabaseAdmin
      .from("subscriptions")
      .update({ checkout_session_id: session.id })
      .eq("business_id", businessId)
      .eq("checkout_attempt_id", attemptId);
    if (saveSessionError) throw saveSessionError;

    return res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    logSafeError("CHECKOUT", error);

    // Solo revertimos la reserva si no se
    // ha creado una sesión de Stripe.
    //
    // Any Stripe request may have committed despite a lost response.
    // Keep its reservation until reconciliation; never blindly retry a payment.

    if (reservedAttempt && !stripeRequestStarted) {
      try {
        const { data: current } = await supabaseAdmin
          .from("subscriptions")
          .select("checkout_attempt_id, stripe_subscription_id")
          .eq("business_id", reservedAttempt.businessId)
          .maybeSingle();

        if (current?.checkout_attempt_id === reservedAttempt.attemptId && !current.stripe_subscription_id) {
          const { error: cleanupError } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: reservedAttempt.previousStatus,
              checkout_attempt_id: null,
              checkout_expires_at: null,
              checkout_session_id: null,
            })
            .eq("business_id", reservedAttempt.businessId)
            .eq("checkout_attempt_id", reservedAttempt.attemptId);

          if (cleanupError) {
            logSafeError("CHECKOUT_CLEANUP", cleanupError);
          }
        }
      } catch (cleanupError) {
        logSafeError("CHECKOUT_CLEANUP", cleanupError);
      }
    }

    return respondError(res, error);
  }
}

// Cancelar o recuperar un intento de Checkout sin bloquear al cliente.
export async function cancelPendingCheckout(req, res) {
  try {
    const { businessId } = req.body ?? {};
    if (Object.keys(req.body ?? {}).some(key => key !== "businessId")) return res.status(400).json({ success: false, message: "Solicitud de facturación no válida." });
    if (!validBusinessId(businessId)) {
      return res.status(400).json({ success: false, message: "Restaurante inválido." });
    }
    const business = await ownedBusiness(req.user.id, businessId);
    if (!business) return res.status(403).json({ success: false, message: "No autorizado." });
    const existing = await findSubscription(businessId);
    if (!existing || existing.status !== "checkout_pending") {
      return res.json({ success: true });
    }
    if (existing.stripe_subscription_id) {
      const remote = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
      if (BLOCKED_STATUSES.has(remote.status)) {
        return res.status(409).json({ success: false, message: "La suscripción ya existe. Actualiza la página." });
      }
    }
    if (existing.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(existing.checkout_session_id);
      if (session.status === "complete") {
        return res.status(409).json({ success: false, message: "Stripe ha completado el Checkout. Actualiza el estado." });
      }
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id);
      }
    } else {
      // Local expiry cannot prove that a legacy session was never paid.
      return res.status(409).json({ success: false, message: "No se puede confirmar el estado del pago. Contacta con soporte para reconciliar este intento." });
    }
    let clearQuery = supabaseAdmin.from("subscriptions")
      .update({ status: "inactive", checkout_attempt_id: null, checkout_expires_at: null, checkout_session_id: null })
      .eq("business_id", businessId)
      .eq("status", "checkout_pending");
    clearQuery = existing.checkout_attempt_id == null ? clearQuery.is("checkout_attempt_id", null) : clearQuery.eq("checkout_attempt_id", existing.checkout_attempt_id);
    const { data: cleared, error } = await clearQuery.select("business_id").maybeSingle();
    if (error) throw error;
    if (!cleared) return res.status(409).json({ success: false, message: "El estado del pago cambió. Actualiza la página." });
    return res.json({ success: true });
  } catch (error) {
    return respondError(res, error);
  }
}

// ==========================================
// PORTAL DE FACTURACIÓN
// POST /api/subscriptions/portal
// ==========================================

export async function createPortal(req, res) {
  try {
    const { businessId } = req.body ?? {};
    if (Object.keys(req.body ?? {}).some(key => key !== "businessId")) return res.status(400).json({ success: false, message: "Solicitud de facturación no válida." });

    if (!validBusinessId(businessId)) {
      return res.status(400).json({
        success: false,
        message: "Identificador de restaurante inválido.",
      });
    }

    // ======================================
    // 1. VERIFICAR PROPIETARIO
    // ======================================

    const business = await ownedBusiness(req.user.id, businessId);

    if (!business) {
      return res.status(403).json({
        success: false,
        message: "No eres propietario del restaurante.",
      });
    }

    // ======================================
    // 2. OBTENER CLIENTE DE STRIPE
    // ======================================

    const existing = await findSubscription(businessId);

    if (!existing?.stripe_customer_id) {
      return res.status(404).json({
        success: false,
        message: "Todavía no existe una cuenta de facturación para este restaurante.",
      });
    }

    // ======================================
    // 3. CREAR SESIÓN DEL PORTAL
    // ======================================

    if (await customerIsShared(existing.stripe_customer_id, businessId)) return res.status(409).json({ success: false, message: "La cuenta de facturación está compartida. Contacta con soporte antes de abrir el portal." });

    const session = await stripe.billingPortal.sessions.create({
      customer: existing.stripe_customer_id,

      return_url: `${FRONTEND_URL}/billing/${businessId}`,
    });

    return res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    return respondError(res, error);
  }
}
