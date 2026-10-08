import { z } from "zod";
import { logSafeError } from "../utils/logSafeError.js";
import { supabaseAdmin } from "../infrastructure/database/supabase.js";

// Resolve the tenant from the resource being accessed, not from a user-supplied body.
export function requireActiveSubscription(resource) {
  return async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!z.string().uuid().safeParse(id).success) return res.status(400).json({ success: false, message: "Falta el identificador del recurso." });
      let businessId;
      if (resource === "business") businessId = id;
      else {
        const table = { menu: "menus", category: "categories", product: "products" }[resource];
        if (!table) throw new Error("Tipo de recurso desconocido.");
        const { data, error } = await supabaseAdmin.from(table)
          .select(resource === "category" ? "menu_id" : "business_id").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: "Recurso no encontrado." });
        if (resource === "category") {
          const { data: menu, error: menuError } = await supabaseAdmin.from("menus").select("business_id").eq("id", data.menu_id).maybeSingle();
          if (menuError) throw menuError;
          if (!menu) return res.status(404).json({ success: false, message: "Carta no encontrada." });
          businessId = menu.business_id;
        } else businessId = data.business_id;
      }
      // Authorization and billing are independent checks; both are required.
      const { data: business, error: businessError } = await supabaseAdmin.from("businesses")
        .select("id").eq("id", businessId).eq("owner_id", req.user.id).maybeSingle();
      if (businessError) throw businessError;
      if (!business) return res.status(403).json({ success: false, message: "No tienes acceso a este establecimiento." });
      const { data: subscription, error: subscriptionError } = await supabaseAdmin.from("subscriptions")
        .select("status, trial_ends_at, current_period_end").eq("business_id", businessId).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      const now = Date.now();
      const trialValid = subscription?.status === "trialing" && !!subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now;
      const activeValid = subscription?.status === "active" && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > now);
      if (!trialValid && !activeValid) return res.status(402).json({ success: false, code: "SUBSCRIPTION_REQUIRED", businessId, message: "Activa la prueba gratuita o contrata Carteliax para gestionar este establecimiento." });
      req.billingBusinessId = businessId;
      return next();
    } catch (error) {
      logSafeError("BILLING_ACCESS", error);
      return res.status(500).json({ success: false, message: "No se pudo verificar la suscripción." });
    }
  };
}
